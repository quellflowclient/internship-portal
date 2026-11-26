-- =====================================================================
-- Row Level Security – Phase 1 tables. Spec: docs/07_RLS_POLICIES.md
-- Pattern: explicit grants, RLS on every table, (select auth.uid()),
-- policies `to authenticated`; anon gets nothing.
-- =====================================================================

-- ---------- Grants ----------
revoke all on all tables in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated, public;

grant select, insert, update, delete on all tables in schema public to authenticated;

-- profiles: role / is_active / email change only through admin_set_user_role().
-- NOTE: a column-level REVOKE does not override a table-level GRANT in Postgres,
-- so revoke table UPDATE and grant the editable columns explicitly.
revoke update on public.profiles from authenticated;
grant update (full_name, display_name_on_docs, phone_e164, college, course, year_of_study,
              photo_path, linkedin_url, github_url) on public.profiles to authenticated;

-- Functions callable by signed-in users (each checks permissions itself)
grant execute on function public.my_role()                         to authenticated;
grant execute on function public.is_admin()                        to authenticated;
grant execute on function public.is_super_admin()                  to authenticated;
grant execute on function public.is_batch_mentor(uuid)             to authenticated;
grant execute on function public.can_see_enrollment(uuid)          to authenticated;
grant execute on function public.is_in_batch(uuid)                 to authenticated;
grant execute on function public.academic_year_label(timestamptz)  to authenticated;
grant execute on function public.format_document_number(text, text, text, text, text, int) to authenticated;
grant execute on function public.next_document_number(public.document_type, text, text)    to authenticated;
grant execute on function public.preview_document_number(public.document_type, text, text) to authenticated;
grant execute on function public.admin_set_user_role(uuid, public.user_role, boolean)      to authenticated;
-- bootstrap_super_admin: no grant (SQL editor / service role only)

-- ---------- Enable RLS ----------
alter table public.org_settings             enable row level security;
alter table public.roles_catalog            enable row level security;
alter table public.profiles                 enable row level security;
alter table public.invitations              enable row level security;
alter table public.numbering_schemes        enable row level security;
alter table public.document_sequences       enable row level security;
alter table public.signatories              enable row level security;
alter table public.applicants               enable row level security;
alter table public.applicant_status_history enable row level security;
alter table public.programs                 enable row level security;
alter table public.program_pricing          enable row level security;
alter table public.batches                  enable row level security;
alter table public.batch_mentors            enable row level security;
alter table public.enrollments              enable row level security;
alter table public.enrollment_terms         enable row level security;
alter table public.audit_log                enable row level security;

-- ---------- Settings ----------
create policy "org_settings: read (active users)" on public.org_settings
  for select to authenticated using (public.my_role() is not null);
create policy "org_settings: super_admin update" on public.org_settings
  for update to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

create policy "roles_catalog: read" on public.roles_catalog
  for select to authenticated using (true);
create policy "roles_catalog: admin write" on public.roles_catalog
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "numbering_schemes: admin read" on public.numbering_schemes
  for select to authenticated using (public.is_admin());
create policy "numbering_schemes: super_admin write" on public.numbering_schemes
  for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

create policy "document_sequences: admin read" on public.document_sequences
  for select to authenticated using (public.is_admin());
-- no write policy: only next_document_number() (security definer) writes

create policy "signatories: admin read" on public.signatories
  for select to authenticated using (public.is_admin());
create policy "signatories: super_admin write" on public.signatories
  for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

-- ---------- Identity ----------
create policy "profiles: self read" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "profiles: admin read" on public.profiles
  for select to authenticated using (public.is_admin());
create policy "profiles: mentor reads own interns" on public.profiles
  for select to authenticated using (exists (
    select 1 from public.enrollments e
    where e.profile_id = profiles.id and public.is_batch_mentor(e.batch_id)));
create policy "profiles: student reads own mentors" on public.profiles
  for select to authenticated using (exists (
    select 1 from public.enrollments e
    join public.batch_mentors bm on bm.batch_id = e.batch_id
    where e.profile_id = (select auth.uid()) and bm.mentor_id = profiles.id));
create policy "profiles: self update" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy "profiles: admin update" on public.profiles
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
-- inserts come from handle_new_user(); deletes cascade from auth.users

create policy "invitations: admin" on public.invitations
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------- Intake ----------
create policy "applicants: admin" on public.applicants
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "applicant_status_history: admin read" on public.applicant_status_history
  for select to authenticated using (public.is_admin());

-- ---------- Programmes & batches ----------
create policy "programs: read (staff or enrolled)" on public.programs
  for select to authenticated using (
    public.is_admin()
    or public.my_role() = 'mentor'
    or exists (select 1 from public.enrollments e where e.program_id = programs.id and e.profile_id = (select auth.uid())));
create policy "programs: admin write" on public.programs
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "program_pricing: admin only" on public.program_pricing
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "batches: read" on public.batches
  for select to authenticated using (public.is_admin() or public.is_batch_mentor(id) or public.is_in_batch(id));
create policy "batches: admin write" on public.batches
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "batch_mentors: read" on public.batch_mentors
  for select to authenticated using (public.is_admin() or mentor_id = (select auth.uid()) or public.is_in_batch(batch_id));
create policy "batch_mentors: admin write" on public.batch_mentors
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------- Enrolments ----------
create policy "enrollments: read" on public.enrollments
  for select to authenticated using (
    profile_id = (select auth.uid()) or public.is_batch_mentor(batch_id) or public.is_admin());
create policy "enrollments: admin write" on public.enrollments
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Money terms: admin + the candidate themself only (D-04). Mentors excluded.
create policy "enrollment_terms: admin" on public.enrollment_terms
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "enrollment_terms: own" on public.enrollment_terms
  for select to authenticated using (exists (
    select 1 from public.enrollments e
    where e.id = enrollment_terms.enrollment_id and e.profile_id = (select auth.uid())));

-- ---------- Audit ----------
create policy "audit_log: admin read" on public.audit_log
  for select to authenticated using (public.is_admin());
-- no insert/update/delete policies: written only by security-definer triggers
revoke insert, update, delete on public.audit_log from authenticated;
revoke insert, update, delete on public.applicant_status_history from authenticated;
revoke insert, update, delete on public.document_sequences from authenticated;
