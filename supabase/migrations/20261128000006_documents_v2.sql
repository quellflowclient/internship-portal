-- =====================================================================
-- Step E – documents and certificates (docs/20_DOCUMENTS_SPEC.md §6).
-- Signatories linked to admins (the issuer signs), template layout/background,
-- early / not-eligible / standalone issuing with a reason, plus two Step C fixes.
-- =====================================================================

-- ---------- Signatories: one per admin; the issuing admin signs ----------
alter table public.signatories
  add column profile_id    uuid unique references public.profiles (id),
  add column title_on_docs text;
alter table public.signatories
  add constraint signatories_signature_size check (signature_data is null or length(signature_data) <= 400000);

-- ---------- Templates: Canva background PDF + field positions ----------
alter table public.document_templates
  add column layout          jsonb not null default '{}'::jsonb,
  add column background_path text check (background_path is null or background_path ~ '^/templates/[A-Za-z0-9._-]+\.pdf$');

-- ---------- Documents: reason for early / override / standalone; event details ----------
alter table public.documents
  add column issue_note text,
  add column event      jsonb;

insert into public.numbering_schemes (kind, pattern) values
  ('doc:participation',      'QF-PRT-{AY}-{TRACK}-{SEQ:4}'),
  ('doc:appreciation',       'QF-APR-{AY}-{TRACK}-{SEQ:4}'),
  ('doc:custom_certificate', 'QF-CUS-{AY}-{TRACK}-{SEQ:4}')
on conflict (kind) do nothing;

insert into public.document_templates (type, version, title, body, requires_acceptance) values
  ('participation', 1, 'Certificate of participation',
   'This is to certify that {name} participated in {event_title} held {event_dates}.\n\n[Wording pending owner approval]', false),
  ('appreciation', 1, 'Certificate of appreciation',
   'This certificate is presented to {name} in appreciation of {event_title}.\n\n[Wording pending owner approval]', false),
  ('custom_certificate', 1, 'Certificate',
   '{body}\n\n[Wording pending owner approval]', false)
on conflict (type, version) do nothing;

-- ---------- Issuing rules ----------
create or replace function public.guard_documents() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  allowed text[] := array['status', 'revoked_at', 'revoked_reason', 'pdf_saved', 'shared_via', 'shared_at', 'updated_at'];
  en public.enrollment_status;
  has_note boolean;
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
      has_note := coalesce(btrim(new.issue_note), '') <> '';
      if new.type = 'certificate' then
        select status into en from public.enrollments where id = new.enrollment_id;
        if en is distinct from 'completed' and not (public.is_owner() and has_note) then
          raise exception 'A certificate needs a completed enrolment. An owner can issue it early with a reason.';
        end if;
      elsif new.type = 'project_certificate' and not exists (
          select 1 from public.projects p join public.project_members m on m.project_id = p.id
           where p.id = new.project_id and p.kind = 'college' and m.student_id = new.student_id) then
        raise exception 'A project certificate needs a college project the student is a member of';
      elsif new.type in ('participation', 'appreciation', 'custom_certificate') and not (public.is_owner() and has_note) then
        raise exception 'Certificates without an internship are issued by an owner, with a reason.';
      end if;
    end if;
  end if;
  return new;
end $$;

-- The issuing admin signs. An owner may sign as another active signatory.
drop function if exists public.issue_document(uuid, text);
create or replace function public.issue_document(p_document uuid, p_content_hash text, p_signatory uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare d public.documents; v_track text; v_num text; v_tok text; v_sig uuid;
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  select * into d from public.documents where id = p_document for update;
  if not found then raise exception 'Document not found'; end if;
  if d.status <> 'draft' then raise exception 'Only drafts can be issued'; end if;
  if p_content_hash is null or p_content_hash !~ '^[0-9a-f]{64}$' then raise exception 'Invalid content hash'; end if;

  select id into v_sig from public.signatories where profile_id = (select auth.uid()) and is_active;
  if p_signatory is not null and p_signatory is distinct from v_sig then
    if not public.is_owner() then raise exception 'You can only sign as yourself' using errcode = '42501'; end if;
    select id into v_sig from public.signatories where id = p_signatory and is_active;
  end if;
  if v_sig is null then
    raise exception 'No signature is linked to your account. An owner can add it in Settings, Signatories.';
  end if;

  v_track := case
    when d.type = 'project_certificate' then 'CO'
    when d.type in ('participation', 'appreciation', 'custom_certificate') then 'GN'
    else coalesce((select c.code from public.enrollments e join public.batches b on b.id = e.batch_id
                     join public.course_plans p on p.id = b.course_plan_id join public.courses c on c.id = p.course_id
                    where e.id = d.enrollment_id), 'GN') end;
  v_num := public.next_code('doc:' || d.type::text, jsonb_build_object('TRACK', v_track));
  v_tok := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  update public.documents
     set number = v_num, verify_token = v_tok, content_hash = p_content_hash, status = 'issued',
         issued_at = now(), issued_by = (select auth.uid()), signatory_id = v_sig
   where id = p_document;
  if d.supersedes_id is not null then
    update public.documents set status = 'superseded' where id = d.supersedes_id and status in ('issued', 'accepted');
  end if;
  return jsonb_build_object('number', v_num, 'verify_token', v_tok, 'signatory_id', v_sig);
end $$;
grant execute on function public.issue_document(uuid, text, uuid) to authenticated;

-- Public verify shows the event title for standalone certificates. The document's own result
-- is returned as "outcome" so it never overwrites the check status in "result".
create or replace function public.public_doc_fields(p_data jsonb) returns jsonb
language sql immutable as $$
  select coalesce(jsonb_object_agg(case when k = 'result' then 'outcome' else k end, p_data -> k), '{}'::jsonb)
    from unnest(array['name', 'programme', 'batch', 'start_date', 'end_date', 'result', 'signatory', 'project',
                      'event_title', 'event_dates']) k
   where p_data ? k
$$;

-- ---------- Step C fixes ----------
create policy "plan_template_items: admin delete" on public.plan_template_items
  for delete to authenticated using (public.is_admin());

create or replace function public.get_shared_plan(p_token text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r record; v public.batch_plan_versions; items jsonb;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{32}$' then return null; end if;
  select bp.id, bp.published_version, bp.show_done_marks, b.code, b.start_date, b.end_date, b.session_time, b.schedule_days,
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
    'start_date', r.start_date, 'end_date', r.end_date, 'session_time', r.session_time, 'schedule_days', r.schedule_days,
    'version', v.version, 'published_at', v.published_at, 'change_note', v.change_note,
    'links', jsonb_build_object('whatsapp', r.whatsapp_url, 'classroom', r.classroom_url, 'meet', r.meet_url, 'playlist', r.playlist_url),
    'items', coalesce(items, '[]'::jsonb));
end $$;
