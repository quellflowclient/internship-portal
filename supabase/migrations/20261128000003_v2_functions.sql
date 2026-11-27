-- =====================================================================
-- v2 step 3/4 – helpers, guards (integrity rules), codes and the
-- business functions used by the app, the cron job and public pages.
-- Spec: docs/19_DB_FLOWS_PIPELINES.md §5, §7, §8, §9.
-- Security-definer functions pin search_path and check the caller.
-- Guard triggers that must let migrations/maintenance through check
-- current_user (they run as the caller: authenticated / anon).
-- =====================================================================

-- ---------- Who is calling ----------
create or replace function public.is_service() returns boolean
language sql stable as $$ select coalesce(auth.role(), '') = 'service_role' $$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'admin' from public.profiles where id = (select auth.uid()) and is_active), false)
$$;

create or replace function public.is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'admin' and is_owner from public.profiles where id = (select auth.uid()) and is_active), false)
$$;

create or replace function public.my_role() returns public.user_role
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = (select auth.uid()) and is_active
$$;

create or replace function public.my_student_id() returns uuid
language sql stable security definer set search_path = public as $$
  select s.id from public.students s join public.profiles p on p.id = s.user_id
  where s.user_id = (select auth.uid()) and p.is_active and p.role = 'student' and s.state <> 'archived'
$$;

create or replace function public.is_my_batch(b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.enrollments e
                 where e.batch_id = b and e.student_id = public.my_student_id()
                   and e.status in ('assigned', 'active', 'completed', 'not_completed'))
$$;

create or replace function public.is_my_enrollment(en uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.enrollments e where e.id = en and e.student_id = public.my_student_id())
$$;

-- ---------- Dates ----------
create or replace function public.today_ist() returns date
language sql stable security definer set search_path = public as $$
  select (now() at time zone coalesce((select timezone from public.org_settings where id = 1), 'Asia/Kolkata'))::date
$$;

create or replace function public.is_working_day(d date, p_days jsonb) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(p_days, '[1,2,3,4,5]'::jsonb) @> to_jsonb(extract(isodow from d)::int)
     and not coalesce((select holidays from public.org_settings where id = 1), '[]'::jsonb) @> to_jsonb(d::text)
$$;

-- n-th working day counting from p_start (p_start itself is day 1 if it is a working day)
create or replace function public.nth_working_day(p_start date, p_n int, p_days jsonb) returns date
language plpgsql stable security definer set search_path = public as $$
declare d date := p_start; c int := 0;
begin
  if p_n < 1 then raise exception 'n must be 1 or more'; end if;
  loop
    if public.is_working_day(d, p_days) then
      c := c + 1;
      if c = p_n then return d; end if;
    end if;
    d := d + 1;
    if d > p_start + 3660 then raise exception 'No working days in the schedule'; end if;
  end loop;
end $$;

-- working days in (a, b]; negative when b is before a
create or replace function public.working_days_between(a date, b date, p_days jsonb) returns int
language sql stable security definer set search_path = public as $$
  select case
    when a is null or b is null then null
    when b = a then 0
    when b > a then (select count(*)::int from generate_series(a + 1, b, interval '1 day') g(d) where public.is_working_day(g.d::date, p_days))
    else -(select count(*)::int from generate_series(b + 1, a, interval '1 day') g(d) where public.is_working_day(g.d::date, p_days))
  end
$$;

-- ---------- Codes (DB-2: the portal issues every code) ----------
create or replace function public.format_code(p_pattern text, p_tokens jsonb, p_seq int) returns text
language plpgsql immutable as $$
declare res text := p_pattern; k text; v text; m text[]; w int; s text;
begin
  for k, v in select key, value from jsonb_each_text(coalesce(p_tokens, '{}'::jsonb)) loop
    res := replace(res, '{' || k || '}', v);
  end loop;
  if res ~ '\{(?!SEQ)[A-Z]+\}' then
    raise exception 'Missing value for a token in %', res;
  end if;
  m := regexp_match(res, '\{SEQ(?::([0-9]+))?\}');
  if m is null then raise exception 'Pattern % has no {SEQ}', p_pattern; end if;
  if p_seq is null then return res; end if;           -- scope form keeps {SEQ}
  w := coalesce(m[1]::int, 4);
  s := p_seq::text;
  if length(s) < w then s := lpad(s, w, '0'); end if;
  return regexp_replace(res, '\{SEQ(:[0-9]+)?\}', s);
end $$;

create or replace function public.next_code(p_kind text, p_tokens jsonb default '{}'::jsonb) returns text
language plpgsql volatile security definer set search_path = public as $$
declare pat text; tok jsonb; sc text; n int;
begin
  if not (public.is_admin() or public.is_service()) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select pattern into pat from public.numbering_schemes where kind = p_kind;
  if pat is null then raise exception 'No numbering scheme for %', p_kind; end if;
  tok := jsonb_build_object('AY', public.academic_year_label(now())) || coalesce(p_tokens, '{}'::jsonb);
  sc := public.format_code(pat, tok, null);
  insert into public.number_sequences as ns (kind, scope, last_value) values (p_kind, sc, 1)
  on conflict (kind, scope) do update set last_value = ns.last_value + 1
  returning last_value into n;
  return public.format_code(pat, tok, n);
end $$;

create or replace function public.preview_code(p_kind text, p_tokens jsonb default '{}'::jsonb) returns text
language plpgsql stable security definer set search_path = public as $$
declare pat text; tok jsonb; n int;
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  select pattern into pat from public.numbering_schemes where kind = p_kind;
  if pat is null then return null; end if;
  tok := jsonb_build_object('AY', public.academic_year_label(now())) || coalesce(p_tokens, '{}'::jsonb);
  select coalesce(max(last_value), 0) + 1 into n from public.number_sequences
   where kind = p_kind and scope = public.format_code(pat, tok, null);
  return public.format_code(pat, tok, n);
end $$;

-- ---------- Accounts ----------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare inv public.invitations; st public.students; r public.user_role; active boolean;
begin
  select * into inv from public.invitations
   where email = lower(new.email) and accepted_at is null and revoked_at is null and expires_at > now()
   order by created_at desc limit 1;
  if inv.student_id is not null then
    select * into st from public.students where id = inv.student_id and user_id is null and state <> 'archived';
  else
    select * into st from public.students where email = lower(new.email) and user_id is null and state <> 'archived';
  end if;
  r := coalesce(inv.role, 'student');
  active := inv.id is not null or st.id is not null;

  insert into public.profiles (id, email, full_name, role, is_active)
  values (new.id, lower(new.email),
          coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', st.full_name),
          r, active)
  on conflict (id) do nothing;

  if inv.id is not null then
    update public.invitations set accepted_at = now(), profile_id = new.id where id = inv.id;
  end if;
  if st.id is not null and r = 'student' then
    update public.students set user_id = new.id where id = st.id and user_id is null;
  end if;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- role / active / owner flag / email change only here (or by the service role / SQL editor)
create or replace function public.guard_profiles() returns trigger
language plpgsql set search_path = public as $$
begin
  if current_user in ('authenticated', 'anon')
     and (new.role, new.is_owner, new.is_active, new.email) is distinct from (old.role, old.is_owner, old.is_active, old.email) then
    raise exception 'Role, owner flag, active flag and email change only through admin_set_user_role()' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger profiles_guard before update on public.profiles for each row execute function public.guard_profiles();

create or replace function public.admin_set_user_role(p_profile uuid, p_role public.user_role, p_active boolean, p_owner boolean default null)
returns void language plpgsql security definer set search_path = public as $$
declare t public.profiles; v_owner boolean;
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  select * into t from public.profiles where id = p_profile;
  if not found then raise exception 'Account not found'; end if;
  v_owner := coalesce(p_owner, t.is_owner) and p_role = 'admin';
  if p_profile = (select auth.uid()) and (p_role <> t.role or not p_active or v_owner <> t.is_owner) then
    raise exception 'You cannot change your own role, owner flag or access';
  end if;
  if (t.is_owner or v_owner) and not public.is_owner() then
    raise exception 'Only an owner can manage owner accounts' using errcode = '42501';
  end if;
  update public.profiles set role = p_role, is_active = p_active, is_owner = v_owner where id = p_profile;
end $$;

-- One-time bootstrap of the first owner (SQL editor / service role only; no grant)
create or replace function public.bootstrap_owner(p_email text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.profiles where is_owner and is_active) then
    raise exception 'An owner already exists';
  end if;
  update public.profiles set role = 'admin', is_owner = true, is_active = true where email = lower(p_email);
  if not found then raise exception 'No account for % – sign in once first', p_email; end if;
end $$;

-- ---------- Guards (docs/19 §5) ----------
create or replace function public.guard_students() returns trigger
language plpgsql set search_path = public as $$
declare keep text[] := array['phone', 'city', 'github_url', 'linkedin_url', 'updated_at'];
begin
  if current_user in ('authenticated', 'anon') and not public.is_admin()
     and (to_jsonb(new) - keep) is distinct from (to_jsonb(old) - keep) then
    raise exception 'You can change only your phone, city, GitHub and LinkedIn' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger students_guard before update on public.students for each row execute function public.guard_students();

create or replace function public.guard_enrollments() returns trigger
language plpgsql security definer set search_path = public as $$
declare st public.student_state; bs public.batch_status; cap int; open_count int; check_seat boolean; became_stipend_active boolean;
begin
  if tg_op = 'INSERT' then
    check_seat := true;
    became_stipend_active := new.status = 'active' and new.type = 'stipend';
  else
    check_seat := new.batch_id <> old.batch_id
                  or (new.status in ('assigned', 'active') and old.status not in ('assigned', 'active'));
    became_stipend_active := new.status = 'active' and new.type = 'stipend' and (old.status <> 'active' or old.type <> 'stipend');
  end if;
  if check_seat then
    select state into st from public.students where id = new.student_id;
    if st = 'archived' then raise exception 'Archived students cannot be assigned to a batch'; end if;
    select status, capacity into bs, cap from public.batches where id = new.batch_id;
    if bs in ('completed', 'cancelled') then raise exception 'This batch is %', bs; end if;
    select count(*) into open_count from public.enrollments
     where batch_id = new.batch_id and status in ('assigned', 'active') and id <> new.id;
    if open_count >= cap and coalesce(btrim(new.capacity_override_reason), '') = '' then
      raise exception 'The batch is full (% of % seats). Give a reason to go over capacity.', open_count, cap;
    end if;
  end if;

  if became_stipend_active
     and not exists (select 1 from public.stipend_agreements a where a.enrollment_id = new.id) then
    raise exception 'A stipend enrolment needs a stipend agreement before it becomes active';
  end if;

  if tg_op = 'UPDATE' then
    if new.type <> old.type or new.fee_inr is distinct from old.fee_inr or new.batch_id <> old.batch_id then
      if coalesce(btrim(new.change_reason), '') = '' then
        raise exception 'A reason is required to change the student type, fee or batch';
      end if;
    end if;
    if new.type <> old.type then
      insert into public.enrollment_changes (enrollment_id, change, from_value, to_value, reason)
      values (new.id, 'type', old.type::text, new.type::text, new.change_reason);
    end if;
    if new.fee_inr is distinct from old.fee_inr then
      insert into public.enrollment_changes (enrollment_id, change, from_value, to_value, reason)
      values (new.id, 'fee', old.fee_inr::text, new.fee_inr::text, new.change_reason);
    end if;
    if new.batch_id <> old.batch_id then
      insert into public.enrollment_changes (enrollment_id, change, from_value, to_value, reason)
      values (new.id, 'batch', old.batch_id::text, new.batch_id::text, new.change_reason);
    end if;
    if new.status <> old.status then
      insert into public.enrollment_changes (enrollment_id, change, from_value, to_value, reason)
      values (new.id, 'status', old.status::text, new.status::text, coalesce(new.change_reason, new.exit_reason));
    end if;
    if (new.start_date, new.end_date) is distinct from (old.start_date, old.end_date) then
      insert into public.enrollment_changes (enrollment_id, change, from_value, to_value, reason)
      values (new.id, 'dates', old.start_date || '..' || old.end_date, new.start_date || '..' || new.end_date, new.change_reason);
    end if;
  end if;
  new.change_reason := null;
  return new;
end $$;
create trigger enrollments_guard before insert or update on public.enrollments
  for each row execute function public.guard_enrollments();

create or replace function public.guard_money() returns trigger
language plpgsql security definer set search_path = public as $$
declare e record; rel record;
begin
  if new.enrollment_id is not null then
    select student_id, type into e from public.enrollments where id = new.enrollment_id;
    if e.student_id is distinct from new.student_id then raise exception 'That enrolment belongs to another student'; end if;
    if new.category = 'stipend' and e.type <> 'stipend' then raise exception 'Stipend entries need a stipend enrolment'; end if;
  end if;
  if new.category = 'refund' then
    select student_id, category, status into rel from public.money_entries where id = new.related_entry_id;
    if rel.student_id is distinct from new.student_id or rel.category is distinct from 'fee' or rel.status is distinct from 'done' then
      raise exception 'A refund must link to a received fee of the same student';
    end if;
  end if;
  if new.status = 'void' then
    if tg_op = 'INSERT' then
      new.voided_at := now();
    elsif old.status <> 'void' then
      new.voided_at := now();
    end if;
  else
    new.voided_at := null;
    new.void_reason := null;
  end if;
  return new;
end $$;
create trigger money_guard before insert or update on public.money_entries
  for each row execute function public.guard_money();

create or replace function public.guard_track_entries() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.held_on > public.today_ist() then
    raise exception 'A session cannot be logged for a future date';
  end if;
  if new.plan_item_id is not null and not exists (
       select 1 from public.batch_plan_items i join public.batch_plans p on p.id = i.batch_plan_id
        where i.id = new.plan_item_id and p.batch_id = new.batch_id) then
    raise exception 'That plan item belongs to another batch';
  end if;
  return new;
end $$;
create trigger track_entries_guard before insert or update on public.track_entries
  for each row execute function public.guard_track_entries();

create or replace function public.guard_entry_enrollment() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.track_entries t join public.enrollments e on e.batch_id = t.batch_id
                  where t.id = new.track_entry_id and e.id = new.enrollment_id) then
    raise exception 'That student is not in this batch';
  end if;
  return new;
end $$;
create trigger attendance_guard before insert or update on public.attendance
  for each row execute function public.guard_entry_enrollment();
create trigger work_results_guard before insert or update on public.work_results
  for each row execute function public.guard_entry_enrollment();

-- Content edits make the draft differ from the published plan; skipping is tracking only.
create or replace function public.mark_plan_dirty() returns trigger
language plpgsql security definer set search_path = public as $$
declare tracking text[] := array['skipped_at', 'skip_reason', 'updated_at'];
begin
  if tg_op = 'UPDATE' and (to_jsonb(new) - tracking) = (to_jsonb(old) - tracking) then
    return null;
  end if;
  update public.batch_plans set has_unpublished_changes = true, updated_at = now()
   where id = case when tg_op = 'DELETE' then old.batch_plan_id else new.batch_plan_id end;
  return null;
end $$;
create trigger batch_plan_items_dirty after insert or update or delete on public.batch_plan_items
  for each row execute function public.mark_plan_dirty();

create or replace function public.guard_batches() returns trigger
language plpgsql set search_path = public as $$
begin
  if current_user in ('authenticated', 'anon') and old.status = 'running'
     and (new.start_date, new.end_date) is distinct from (old.start_date, old.end_date)
     and not public.is_owner() then
    raise exception 'Dates of a running batch can be changed only by an owner';
  end if;
  return new;
end $$;
create trigger batches_guard before update on public.batches for each row execute function public.guard_batches();

create or replace function public.guard_documents() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  allowed text[] := array['status', 'revoked_at', 'revoked_reason', 'pdf_saved', 'shared_via', 'shared_at', 'updated_at'];
  en public.enrollment_status;
begin
  if tg_op = 'INSERT' then
    if new.status <> 'draft' then raise exception 'Documents start as drafts; use issue_document()'; end if;
    return new;
  end if;
  if old.status <> 'draft' and (to_jsonb(new) - allowed) is distinct from (to_jsonb(old) - allowed) then
    raise exception 'Issued documents are frozen. Issue a new version instead.';
  end if;
  if new.status <> old.status then
    if not ((old.status = 'draft' and new.status = 'issued')
         or (old.status = 'issued' and new.status = 'accepted')
         or (old.status in ('issued', 'accepted') and new.status in ('revoked', 'superseded'))
         or (old.status = 'revoked' and new.status in ('issued', 'accepted') and old.revoked_at > now() - interval '2 minutes')) then
      raise exception 'A document cannot go from % to %', old.status, new.status;
    end if;
    if new.status = 'accepted' and not exists (select 1 from public.document_acceptances a where a.document_id = new.id) then
      raise exception 'Only the student''s own acceptance can mark a document accepted';
    end if;
    if new.status = 'revoked' or old.status = 'revoked' then
      if not public.is_owner() then raise exception 'Only an owner can revoke or restore a document' using errcode = '42501'; end if;
      if new.status = 'revoked' then
        new.revoked_at := now();
      else
        new.revoked_at := null;
        new.revoked_reason := null;
      end if;
    end if;
    if old.status = 'draft' and new.status = 'issued' then
      if new.type = 'certificate' then
        select status into en from public.enrollments where id = new.enrollment_id;
        if en is distinct from 'completed' and not public.is_owner() then
          raise exception 'A certificate needs a completed enrolment';
        end if;
      elsif new.type = 'project_certificate' and not exists (
          select 1 from public.projects p join public.project_members m on m.project_id = p.id
           where p.id = new.project_id and p.kind = 'college' and m.student_id = new.student_id) then
        raise exception 'A project certificate needs a college project the student is a member of';
      end if;
    end if;
  end if;
  return new;
end $$;
create trigger documents_guard before insert or update on public.documents
  for each row execute function public.guard_documents();

create or replace function public.guard_project_members() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select kind from public.projects where id = new.project_id) = 'client'
     and not exists (select 1 from public.documents d
                      where d.student_id = new.student_id and d.type = 'consent' and d.status = 'accepted') then
    raise exception 'Client project members must accept the NDA consent first';
  end if;
  return new;
end $$;
create trigger project_members_guard before insert or update on public.project_members
  for each row execute function public.guard_project_members();

create or replace function public.log_lead_stage() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.stage <> old.stage then
    insert into public.activities (lead_id, kind, summary)
    values (new.id, 'system', 'Stage changed from ' || old.stage || ' to ' || new.stage);
  end if;
  return null;
end $$;
create trigger leads_stage_log after update of stage on public.leads
  for each row execute function public.log_lead_stage();

-- ---------- Audit (business tables) ----------
do $$
declare t text;
begin
  foreach t in array array['profiles', 'invitations', 'org_settings', 'numbering_schemes', 'signatories', 'leads', 'courses',
                           'course_plans', 'plan_templates', 'students', 'batches', 'batch_plans', 'batch_plan_items',
                           'enrollments', 'stipend_agreements', 'money_entries', 'track_entries', 'projects',
                           'project_members', 'document_templates', 'documents'] loop
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.audit_row()',
                   'audit_' || t, t);
  end loop;
end $$;

-- ---------- Leads (form import, DB-2) ----------
create or replace function public.upsert_form_lead(
  p_form_response_id text, p_full_name text, p_email text, p_phone text, p_college text,
  p_course text, p_year text, p_track text, p_answers jsonb, p_submitted_at timestamptz)
returns text language plpgsql security definer set search_path = public as $$
declare v_code text;
begin
  if not (public.is_service() or public.is_admin()) then raise exception 'not allowed' using errcode = '42501'; end if;
  if coalesce(btrim(p_form_response_id), '') = '' then raise exception 'form_response_id is required'; end if;
  select code into v_code from public.leads where form_response_id = p_form_response_id for update;
  if v_code is not null then
    update public.leads set full_name = btrim(p_full_name), email = lower(btrim(p_email)), phone = p_phone,
           college = p_college, course = p_course, year_of_study = p_year, interested_track = p_track,
           answers = coalesce(p_answers, '{}'::jsonb), submitted_at = p_submitted_at
     where form_response_id = p_form_response_id;
    return v_code;
  end if;
  v_code := public.next_code('lead');
  insert into public.leads (code, form_response_id, source, full_name, email, phone, college, course, year_of_study,
                            interested_track, answers, submitted_at)
  values (v_code, p_form_response_id, 'form', btrim(p_full_name), lower(btrim(p_email)), p_phone, p_college, p_course,
          p_year, p_track, coalesce(p_answers, '{}'::jsonb), p_submitted_at);
  return v_code;
end $$;

create or replace function public.create_lead(
  p_full_name text, p_phone text, p_source public.lead_source, p_email text default null,
  p_college text default null, p_track text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  insert into public.leads (code, source, full_name, phone, email, college, interested_track, owner_id)
  values (public.next_code('lead'), p_source, btrim(p_full_name), p_phone, lower(nullif(btrim(p_email), '')), p_college,
          p_track, (select auth.uid()))
  returning id into v_id;
  return v_id;
end $$;

-- ---------- Students and enrolments ----------
create or replace function public.create_student(
  p_full_name text, p_email text, p_phone text, p_college text,
  p_course text default null, p_year smallint default null,
  p_planned_type public.student_type default null, p_planned_course_plan uuid default null,
  p_lead uuid default null, p_name_on_documents text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_code text; v_id uuid; l public.leads; v_email text := lower(btrim(p_email));
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  if p_lead is not null then
    select * into l from public.leads where id = p_lead for update;
    if not found then raise exception 'Lead not found'; end if;
    if l.stage = 'converted' then raise exception 'This lead is already a student'; end if;
    v_code := l.code;
  else
    v_code := public.next_code('lead');
  end if;
  insert into public.students (code, lead_id, full_name, name_on_documents, email, phone, college, course, year_of_study,
                               planned_type, planned_course_plan_id)
  values (v_code, p_lead, btrim(p_full_name), coalesce(nullif(btrim(p_name_on_documents), ''), btrim(p_full_name)),
          v_email, p_phone, p_college, p_course, p_year, p_planned_type, p_planned_course_plan)
  returning id into v_id;
  if p_lead is not null then
    update public.leads set stage = 'converted', student_id = v_id where id = p_lead;
    insert into public.activities (lead_id, student_id, kind, summary) values (p_lead, v_id, 'system', 'Converted to student ' || v_code);
  end if;
  insert into public.invitations (email, role, student_id, invited_by)
  values (v_email, 'student', v_id, (select auth.uid()))
  on conflict do nothing;
  return v_id;
end $$;

create or replace function public.assign_student(
  p_student uuid, p_batch uuid, p_type public.student_type,
  p_fee int default null, p_free_reason text default null,
  p_stipend_monthly int default null, p_stipend_note text default null,
  p_capacity_reason text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare b public.batches; v_fee int; v_id uuid;
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  select * into b from public.batches where id = p_batch;
  if not found then raise exception 'Batch not found'; end if;
  if p_type = 'paid' then
    v_fee := coalesce(p_fee, (select fee_inr from public.course_plans where id = b.course_plan_id));
  end if;
  insert into public.enrollments (student_id, batch_id, type, start_date, end_date, fee_inr, free_reason, approved_by,
                                  capacity_override_reason)
  values (p_student, p_batch, p_type, b.start_date, b.end_date, v_fee, p_free_reason,
          case when p_type = 'free' then (select auth.uid()) end, p_capacity_reason)
  returning id into v_id;
  if p_type = 'stipend' and p_stipend_monthly is not null then
    insert into public.stipend_agreements (enrollment_id, monthly_inr, from_month, agreed_note)
    values (v_id, p_stipend_monthly, date_trunc('month', b.start_date)::date, p_stipend_note);
  end if;
  insert into public.activities (student_id, enrollment_id, kind, summary)
  values (p_student, v_id, 'system', 'Assigned to ' || b.code || ' as ' || p_type);
  return v_id;
end $$;

-- ---------- Batches and plans ----------
create or replace function public.create_batch(
  p_course_plan uuid, p_start date, p_capacity int default 20,
  p_session_time text default null, p_schedule jsonb default '[1,2,3,4,5]'::jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare cp record; v_code text; b_id uuid; bp_id uuid; t_id uuid;
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  select p.id, p.duration_days, c.code as course_code into cp
    from public.course_plans p join public.courses c on c.id = p.course_id
   where p.id = p_course_plan and p.active;
  if not found then raise exception 'Course plan not found or inactive'; end if;
  v_code := public.next_code('batch', jsonb_build_object('TRACK', cp.course_code, 'DUR', cp.duration_days::text,
                                                         'YYMM', to_char(p_start, 'YYMM')));
  insert into public.batches (code, course_plan_id, start_date, end_date, schedule_days, session_time, capacity)
  values (v_code, p_course_plan, p_start, p_start + cp.duration_days - 1, p_schedule, p_session_time, p_capacity)
  returning id into b_id;
  insert into public.batch_plans (batch_id) values (b_id) returning id into bp_id;
  select id into t_id from public.plan_templates where course_plan_id = p_course_plan and active;
  if t_id is not null then
    insert into public.batch_plan_items (batch_plan_id, seq, week, planned_date, kind, title, description, resources, duration_min)
    select bp_id, i.seq, i.week, public.nth_working_day(p_start, i.day_offset, p_schedule), i.kind, i.title,
           i.description, i.resources, i.duration_min
      from public.plan_template_items i where i.template_id = t_id;
  end if;
  return b_id;
end $$;

create or replace function public.publish_plan(p_batch uuid, p_note text default null) returns int
language plpgsql security definer set search_path = public as $$
declare bp public.batch_plans; v int;
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  select * into bp from public.batch_plans where batch_id = p_batch for update;
  if not found then raise exception 'This batch has no plan'; end if;
  v := bp.published_version + 1;
  insert into public.batch_plan_versions (batch_plan_id, version, change_note, items)
  values (bp.id, v, nullif(btrim(p_note), ''), coalesce((
    select jsonb_agg(jsonb_build_object('id', i.id, 'seq', i.seq, 'week', i.week, 'date', i.planned_date, 'kind', i.kind,
                                        'title', i.title, 'description', i.description, 'resources', i.resources)
                     order by i.planned_date, i.seq)
      from public.batch_plan_items i where i.batch_plan_id = bp.id and i.deleted_at is null), '[]'::jsonb));
  update public.batch_plans set published_version = v, has_unpublished_changes = false, updated_at = now() where id = bp.id;
  return v;
end $$;

-- Public share page (anon). Returns null when the link is off or nothing is published.
create or replace function public.get_shared_plan(p_token text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r record; v public.batch_plan_versions; items jsonb;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{32}$' then return null; end if;
  select bp.id, bp.published_version, bp.show_done_marks, b.code, b.start_date, b.end_date, b.session_time,
         b.whatsapp_url, b.classroom_url, b.meet_url, b.playlist_url, c.name as course_name, p.duration_days
    into r
    from public.batch_plans bp
    join public.batches b on b.id = bp.batch_id
    join public.course_plans p on p.id = b.course_plan_id
    join public.courses c on c.id = p.course_id
   where bp.share_token = p_token and bp.share_enabled and bp.published_version > 0;
  if not found then return null; end if;
  select * into v from public.batch_plan_versions where batch_plan_id = r.id and version = r.published_version;
  select jsonb_agg(x.it - 'id' || jsonb_build_object(
           'done', r.show_done_marks and exists (select 1 from public.track_entries t
                                                  where t.plan_item_id = (x.it ->> 'id')::uuid and t.deleted_at is null),
           'skipped', exists (select 1 from public.batch_plan_items i
                               where i.id = (x.it ->> 'id')::uuid and i.skipped_at is not null))
         order by x.ord)
    into items
    from jsonb_array_elements(v.items) with ordinality as x(it, ord);
  return jsonb_build_object(
    'batch', r.code, 'course', r.course_name, 'duration_days', r.duration_days,
    'start_date', r.start_date, 'end_date', r.end_date, 'session_time', r.session_time,
    'version', v.version, 'published_at', v.published_at, 'change_note', v.change_note,
    'links', jsonb_build_object('whatsapp', r.whatsapp_url, 'classroom', r.classroom_url, 'meet', r.meet_url, 'playlist', r.playlist_url),
    'items', coalesce(items, '[]'::jsonb));
end $$;

-- ---------- Documents ----------
create or replace function public.issue_document(p_document uuid, p_content_hash text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare d public.documents; v_track text; v_num text; v_tok text;
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  select * into d from public.documents where id = p_document for update;
  if not found then raise exception 'Document not found'; end if;
  if d.status <> 'draft' then raise exception 'Only drafts can be issued'; end if;
  if p_content_hash is null or p_content_hash !~ '^[0-9a-f]{64}$' then raise exception 'Invalid content hash'; end if;
  v_track := case when d.type = 'project_certificate' then 'CO' else coalesce((
               select c.code from public.enrollments e join public.batches b on b.id = e.batch_id
                 join public.course_plans p on p.id = b.course_plan_id join public.courses c on c.id = p.course_id
                where e.id = d.enrollment_id), 'GN') end;
  v_num := public.next_code('doc:' || d.type::text, jsonb_build_object('TRACK', v_track));
  v_tok := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  update public.documents
     set number = v_num, verify_token = v_tok, content_hash = p_content_hash, status = 'issued',
         issued_at = now(), issued_by = (select auth.uid())
   where id = p_document;
  if d.supersedes_id is not null then
    update public.documents set status = 'superseded' where id = d.supersedes_id and status in ('issued', 'accepted');
  end if;
  return jsonb_build_object('number', v_num, 'verify_token', v_tok);
end $$;

create or replace function public.accept_document(
  p_document uuid, p_typed_name text, p_checkbox_text text, p_ip text default null, p_user_agent text default null)
returns timestamptz language plpgsql security definer set search_path = public as $$
declare sid uuid := public.my_student_id(); d public.documents; nm text;
begin
  if sid is null then raise exception 'not allowed' using errcode = '42501'; end if;
  select * into d from public.documents where id = p_document for update;
  if not found or d.student_id <> sid then raise exception 'not allowed' using errcode = '42501'; end if;
  if d.type not in ('offer', 'tnc', 'consent') then raise exception 'This document does not need acceptance'; end if;
  if d.status <> 'issued' then raise exception 'Only an issued document can be accepted'; end if;
  if coalesce(btrim(p_checkbox_text), '') = '' then raise exception 'The agreement text is required'; end if;
  select name_on_documents into nm from public.students where id = sid;
  if lower(regexp_replace(btrim(coalesce(p_typed_name, '')), '\s+', ' ', 'g')) <> lower(regexp_replace(btrim(nm), '\s+', ' ', 'g')) then
    raise exception 'Type your name exactly as it appears on the document: %', nm;
  end if;
  insert into public.document_acceptances (document_id, student_id, typed_name, checkbox_text, ip, user_agent, content_hash)
  values (d.id, sid, btrim(p_typed_name), p_checkbox_text, left(p_ip, 64), left(p_user_agent, 300), d.content_hash);
  update public.documents set status = 'accepted' where id = d.id;
  insert into public.activities (student_id, enrollment_id, kind, summary)
  values (sid, d.enrollment_id, 'system', 'Accepted ' || d.number);
  return now();
end $$;

-- Only these snapshot fields are ever shown on the public verify page.
create or replace function public.public_doc_fields(p_data jsonb) returns jsonb
language sql immutable as $$
  select coalesce(jsonb_object_agg(k, p_data -> k), '{}'::jsonb)
    from unnest(array['name', 'programme', 'batch', 'start_date', 'end_date', 'result', 'signatory', 'project']) k
   where p_data ? k
$$;

create or replace function public.verify_result(d public.documents, p_method text, p_ip_hash text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare res public.scan_result;
begin
  if d.id is null then
    insert into public.verification_scans (document_id, method, result, ip_hash) values (null, p_method, 'not_found', left(p_ip_hash, 128));
    return jsonb_build_object('result', 'not_found');
  end if;
  res := case d.status when 'revoked' then 'revoked' when 'superseded' then 'superseded' else 'valid' end;
  insert into public.verification_scans (document_id, method, result, ip_hash) values (d.id, p_method, res, left(p_ip_hash, 128));
  return jsonb_build_object(
    'result', res, 'number', d.number, 'type', d.type,
    'issued_on', (d.issued_at at time zone 'Asia/Kolkata')::date,
    'revoked_on', case when res = 'revoked' then (d.revoked_at at time zone 'Asia/Kolkata')::date end,
    'revoked_reason', case when res = 'revoked' then d.revoked_reason end,
    'replaced_by', (select n.number from public.documents n where n.supersedes_id = d.id and n.status in ('issued', 'accepted') limit 1)
  ) || public.public_doc_fields(d.data);
end $$;

create or replace function public.verify_document(p_token text, p_ip_hash text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare d public.documents;
begin
  if p_token is not null and p_token ~ '^[0-9a-f]{32,64}$' then
    select * into d from public.documents where verify_token = p_token and status <> 'draft';
  end if;
  return public.verify_result(d, 'qr', p_ip_hash);
end $$;

create or replace function public.verify_by_number(p_number text, p_surname text, p_ip_hash text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare d public.documents;
begin
  if coalesce(btrim(p_number), '') <> '' and coalesce(btrim(p_surname), '') <> '' then
    select * into d from public.documents
     where number = upper(btrim(p_number)) and status <> 'draft'
       and lower(regexp_replace(btrim(data ->> 'name'), '^.*\s', '')) = lower(btrim(p_surname));
  end if;
  return public.verify_result(d, 'number', p_ip_hash);
end $$;

-- ---------- Money ----------
create or replace function public.create_stipend_rows(p_month date) returns int
language plpgsql security definer set search_path = public as $$
declare m date := date_trunc('month', p_month)::date; pay_day int; n int;
begin
  if not (public.is_admin() or public.is_service()) then raise exception 'not allowed' using errcode = '42501'; end if;
  select stipend_pay_by_day into pay_day from public.org_settings where id = 1;
  insert into public.money_entries (student_id, enrollment_id, category, direction, amount_inr, status, period_month, due_on, note)
  select e.student_id, e.id, 'stipend', 'out', a.monthly_inr, 'expected', m,
         (m + interval '1 month')::date + (coalesce(pay_day, 5) - 1), trim(to_char(m, 'FMMonth YYYY'))
    from public.enrollments e
    join lateral (select monthly_inr from public.stipend_agreements a
                   where a.enrollment_id = e.id and a.from_month <= m and (a.to_month is null or a.to_month >= m)
                   order by a.from_month desc limit 1) a on true
   where e.type = 'stipend' and e.status = 'active'
  on conflict do nothing;
  get diagnostics n = row_count;
  return n;
end $$;

-- ---------- Daily job (cron, 09:00 IST) ----------
create or replace function public.daily_job() returns jsonb
language plpgsql security definer set search_path = public as $$
declare t date := public.today_ist(); n_batches int; n_enrol int; n_stipend int := 0; n_inv int;
begin
  if not (public.is_service() or public.is_owner()) then raise exception 'not allowed' using errcode = '42501'; end if;
  update public.batches set status = 'running' where status = 'planned' and start_date <= t;
  get diagnostics n_batches = row_count;
  update public.enrollments e set status = 'active'
   where e.status = 'assigned' and e.start_date <= t
     and (select count(distinct d.type) from public.documents d
           where d.enrollment_id = e.id and d.type in ('offer', 'tnc', 'consent') and d.status = 'accepted') = 3
     and (e.type <> 'stipend' or exists (select 1 from public.stipend_agreements a where a.enrollment_id = e.id));
  get diagnostics n_enrol = row_count;
  if extract(day from t) = 1 then
    n_stipend := public.create_stipend_rows(t);
  end if;
  update public.invitations set revoked_at = now()
   where accepted_at is null and revoked_at is null and expires_at < now();
  get diagnostics n_inv = row_count;
  return jsonb_build_object('date', t, 'batches_started', n_batches, 'enrolments_activated', n_enrol,
                            'stipend_rows', n_stipend, 'invitations_expired', n_inv);
end $$;

-- ---------- Global search (admin) ----------
create or replace function public.search_all(p_q text)
returns table (kind text, id uuid, code text, title text, subtitle text)
language plpgsql stable security definer set search_path = public as $$
declare pat text;
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  if length(btrim(coalesce(p_q, ''))) < 2 then return; end if;
  pat := '%' || replace(replace(replace(btrim(p_q), '\', '\\'), '%', '\%'), '_', '\_') || '%';
  return query
    (select 'student'::text, s.id, s.code, s.full_name, s.college from public.students s
      where s.full_name ilike pat or s.code ilike pat or s.email ilike pat or s.phone like pat limit 5)
    union all
    (select 'lead'::text, l.id, l.code, l.full_name, coalesce(l.college, '') from public.leads l
      where l.student_id is null and (l.full_name ilike pat or l.code ilike pat or l.phone like pat) limit 5)
    union all
    (select 'document'::text, d.id, d.number, d.type::text, s.full_name from public.documents d
       join public.students s on s.id = d.student_id where d.number ilike pat limit 5)
    union all
    (select 'project'::text, p.id, p.code, p.name, p.kind::text from public.projects p
      where p.name ilike pat or p.code ilike pat limit 5);
end $$;
