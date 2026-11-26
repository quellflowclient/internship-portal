-- =====================================================================
-- Helper functions, auth hook, numbering, audit + history triggers,
-- admin RPCs. Security-definer functions pin search_path.
-- =====================================================================

-- ---------- Role helpers (used by RLS) ----------
-- named my_role: current_role is a reserved SQL keyword
create or replace function public.my_role() returns public.user_role
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = (select auth.uid()) and is_active
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role in ('admin', 'super_admin') from public.profiles
                   where id = (select auth.uid()) and is_active), false)
$$;

create or replace function public.is_super_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'super_admin' from public.profiles
                   where id = (select auth.uid()) and is_active), false)
$$;

create or replace function public.is_batch_mentor(b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.batch_mentors bm
    join public.profiles p on p.id = bm.mentor_id
    where bm.batch_id = b and bm.mentor_id = (select auth.uid()) and p.is_active)
$$;

create or replace function public.can_see_enrollment(e uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.enrollments en
    where en.id = e and (
      en.profile_id = (select auth.uid())
      or public.is_batch_mentor(en.batch_id)
      or public.is_admin()))
$$;

create or replace function public.is_in_batch(b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.enrollments en
                 where en.batch_id = b and en.profile_id = (select auth.uid()))
$$;

-- ---------- New auth user -> profile (invite-only activation) ----------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  inv public.invitations;
begin
  select * into inv from public.invitations
   where lower(email) = lower(new.email) and accepted_at is null and revoked_at is null
   order by created_at desc limit 1;

  insert into public.profiles (id, email, full_name, role, is_active)
  values (new.id,
          lower(new.email),
          coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
          coalesce(inv.role, 'student'),
          inv.id is not null)
  on conflict (id) do nothing;

  if inv.id is not null then
    update public.invitations set accepted_at = now(), profile_id = new.id where id = inv.id;
    if inv.applicant_id is not null then
      update public.applicants set profile_id = new.id where id = inv.applicant_id;
      update public.enrollments set profile_id = new.id
       where applicant_id = inv.applicant_id and profile_id is null;
    end if;
  end if;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Academic year & document numbering (D-05) ----------
create or replace function public.academic_year_label(p_at timestamptz default now()) returns text
language plpgsql stable security definer set search_path = public as $$
declare
  sm int; ov text; tz text; d date; y int;
begin
  select academic_year_start_month, academic_year_label_override, timezone
    into sm, ov, tz from public.org_settings where id = 1;
  if ov is not null and btrim(ov) <> '' then
    return btrim(ov);
  end if;
  sm := coalesce(sm, 6);
  d  := (p_at at time zone coalesce(tz, 'Asia/Kolkata'))::date;
  y  := extract(year from d)::int;
  if sm = 1 then
    return y::text;
  end if;
  if extract(month from d)::int < sm then
    y := y - 1;
  end if;
  return lpad((y % 100)::text, 2, '0') || lpad(((y + 1) % 100)::text, 2, '0');
end $$;

create or replace function public.format_document_number(
  p_pattern text, p_ay text, p_yyyy text, p_role text, p_track text, p_seq int)
returns text language plpgsql immutable as $$
declare
  res text; m text[]; width int; s text;
begin
  if position('{ROLE}' in p_pattern) > 0 and (p_role is null or p_role = '') then
    raise exception 'Pattern % needs a role code', p_pattern;
  end if;
  res := replace(p_pattern, '{AY}', coalesce(p_ay, ''));
  res := replace(res, '{YYYY}', coalesce(p_yyyy, ''));
  res := replace(res, '{ROLE}', coalesce(p_role, ''));
  res := replace(res, '{TRACK}', coalesce(p_track, ''));
  m := regexp_match(res, '\{SEQ(?::([0-9]+))?\}');
  if m is null then
    raise exception 'Pattern % has no {SEQ} token', p_pattern;
  end if;
  width := coalesce(m[1]::int, 4);
  s := p_seq::text;
  if length(s) < width then
    s := lpad(s, width, '0');
  end if;
  return regexp_replace(res, '\{SEQ(:[0-9]+)?\}', s);
end $$;

-- Allocates and returns the next number. Admins / service role only.
create or replace function public.next_document_number(
  p_doc_type public.document_type, p_role_code text default null, p_track text default null)
returns text language plpgsql volatile security definer set search_path = public as $$
declare
  sch public.numbering_schemes;
  ay text; seq_ay text; role_key text; n int; tz text;
begin
  if not (public.is_admin() or coalesce(auth.role(), '') = 'service_role') then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select * into sch from public.numbering_schemes where doc_type = p_doc_type and is_active;
  if not found then
    raise exception 'No active numbering scheme for %', p_doc_type;
  end if;
  select timezone into tz from public.org_settings where id = 1;
  ay := public.academic_year_label(now());
  seq_ay := case when sch.reset_per_academic_year then ay else 'ALL' end;
  role_key := case when position('{ROLE}' in sch.pattern) > 0 then coalesce(p_role_code, '') else '' end;

  insert into public.document_sequences as ds (scheme_id, academic_year_label, role_code, last_no)
  values (sch.id, seq_ay, role_key, 1)
  on conflict (scheme_id, academic_year_label, role_code)
  do update set last_no = ds.last_no + 1
  returning last_no into n;

  return public.format_document_number(
    sch.pattern, ay, to_char(now() at time zone coalesce(tz, 'Asia/Kolkata'), 'YYYY'), p_role_code, p_track, n);
end $$;

-- Preview without consuming a number (settings UI).
create or replace function public.preview_document_number(
  p_doc_type public.document_type, p_role_code text default null, p_track text default null)
returns text language plpgsql stable security definer set search_path = public as $$
declare
  sch public.numbering_schemes; ay text; seq_ay text; role_key text; n int; tz text;
begin
  if not public.is_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select * into sch from public.numbering_schemes where doc_type = p_doc_type and is_active;
  if not found then
    return null;
  end if;
  select timezone into tz from public.org_settings where id = 1;
  ay := public.academic_year_label(now());
  seq_ay := case when sch.reset_per_academic_year then ay else 'ALL' end;
  role_key := case when position('{ROLE}' in sch.pattern) > 0 then coalesce(p_role_code, '') else '' end;
  select coalesce(max(last_no), 0) + 1 into n from public.document_sequences
   where scheme_id = sch.id and academic_year_label = seq_ay and role_code = role_key;
  return public.format_document_number(
    sch.pattern, ay, to_char(now() at time zone coalesce(tz, 'Asia/Kolkata'), 'YYYY'),
    coalesce(p_role_code, 'XX'), p_track, n);
end $$;

-- ---------- Audit ----------
create or replace function public.audit_row() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
begin
  insert into public.audit_log (actor_id, action, entity, entity_id, before, after)
  values ((select auth.uid()),
          lower(tg_op),
          tg_table_name,
          coalesce(v ->> 'id', v ->> 'enrollment_id', v ->> 'program_id'),
          case when tg_op = 'INSERT' then null else to_jsonb(old) end,
          case when tg_op = 'DELETE' then null else to_jsonb(new) end);
  return coalesce(new, old);
end $$;

create trigger audit_profiles          after update or delete            on public.profiles          for each row execute function public.audit_row();
create trigger audit_invitations       after insert or update or delete  on public.invitations       for each row execute function public.audit_row();
create trigger audit_org_settings      after update                      on public.org_settings      for each row execute function public.audit_row();
create trigger audit_numbering_schemes after insert or update or delete  on public.numbering_schemes for each row execute function public.audit_row();
create trigger audit_signatories       after insert or update or delete  on public.signatories       for each row execute function public.audit_row();
create trigger audit_enrollments       after insert or update or delete  on public.enrollments       for each row execute function public.audit_row();
create trigger audit_enrollment_terms  after insert or update or delete  on public.enrollment_terms  for each row execute function public.audit_row();
create trigger audit_program_pricing   after insert or update or delete  on public.program_pricing   for each row execute function public.audit_row();

-- ---------- Applicant status history ----------
create or replace function public.track_applicant_status() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.applicant_status_history (applicant_id, from_status, to_status, changed_by)
    values (new.id, case when tg_op = 'INSERT' then null else old.status end, new.status, (select auth.uid()));
  end if;
  return new;
end $$;

create trigger applicants_status_history
  after insert or update of status on public.applicants
  for each row execute function public.track_applicant_status();

-- ---------- Admin RPCs (column changes RLS can't express) ----------
-- Change a user's role / active flag. Admins cannot create or modify super_admins.
create or replace function public.admin_set_user_role(p_profile uuid, p_role public.user_role, p_active boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
  target public.profiles;
begin
  if not public.is_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select * into target from public.profiles where id = p_profile;
  if not found then
    raise exception 'profile not found';
  end if;
  if (p_role = 'super_admin' or target.role = 'super_admin') and not public.is_super_admin() then
    raise exception 'only a super_admin can manage super_admin accounts' using errcode = '42501';
  end if;
  if p_profile = (select auth.uid()) and (p_role <> target.role or not p_active) then
    raise exception 'you cannot change your own role or deactivate yourself';
  end if;
  update public.profiles set role = p_role, is_active = p_active where id = p_profile;
end $$;

-- One-time bootstrap of the first super_admin (run from SQL editor / service role only).
create or replace function public.bootstrap_super_admin(p_email text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.profiles where role = 'super_admin' and is_active) then
    raise exception 'a super_admin already exists';
  end if;
  update public.profiles set role = 'super_admin', is_active = true where lower(email) = lower(p_email);
  if not found then
    raise exception 'no profile for % – sign in once first', p_email;
  end if;
end $$;
