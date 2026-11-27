-- =====================================================================
-- v2 step 1/4 – remove the Phase 1 objects that plan v2 replaces.
-- Spec: docs/19_DB_FLOWS_PIPELINES.md §11. There is no real data yet:
-- only admin profiles are kept (super_admin -> admin + is_owner).
-- =====================================================================

-- Every Phase 1 policy (recreated in step 4)
do $$
declare r record;
begin
  for r in select policyname, tablename from pg_policies where schemaname = 'public' loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
drop trigger if exists audit_profiles on public.profiles;
drop trigger if exists audit_org_settings on public.org_settings;
drop trigger if exists audit_signatories on public.signatories;

drop function if exists public.handle_new_user() cascade;
drop function if exists public.admin_set_user_role(uuid, public.user_role, boolean) cascade;
drop function if exists public.bootstrap_super_admin(text) cascade;
drop function if exists public.next_document_number(public.document_type, text, text) cascade;
drop function if exists public.preview_document_number(public.document_type, text, text) cascade;
drop function if exists public.track_applicant_status() cascade;
drop function if exists public.can_see_enrollment(uuid) cascade;
drop function if exists public.is_in_batch(uuid) cascade;
drop function if exists public.is_batch_mentor(uuid) cascade;
drop function if exists public.my_role() cascade;
drop function if exists public.is_admin() cascade;
drop function if exists public.is_super_admin() cascade;

drop table if exists
  public.enrollment_terms, public.enrollments, public.batch_mentors, public.batches,
  public.program_pricing, public.programs, public.applicant_status_history, public.invitations,
  public.applicants, public.document_sequences, public.numbering_schemes, public.roles_catalog
  cascade;

drop type if exists public.applicant_status, public.enrollment_status, public.program_track,
  public.engagement_type, public.duration_plan, public.training_route, public.task_status,
  public.review_decision, public.document_type, public.document_status, public.payment_status;

-- ---------- profiles: admin | student + owner flag ----------
alter table public.profiles add column is_owner boolean not null default false;
alter table public.profiles alter column role drop default;
alter table public.profiles alter column role type text using role::text;
update public.profiles set is_owner = true, role = 'admin' where role = 'super_admin';
update public.profiles set role = 'student' where role = 'mentor';
drop type public.user_role;
create type public.user_role as enum ('admin', 'student');
alter table public.profiles alter column role type public.user_role using role::public.user_role;
alter table public.profiles alter column role set default 'student';
alter table public.profiles rename column phone_e164 to phone;
alter table public.profiles
  drop column display_name_on_docs, drop column college, drop column course, drop column year_of_study,
  drop column photo_path, drop column linkedin_url, drop column github_url;
alter table public.profiles add column last_seen_at timestamptz;
alter table public.profiles add constraint profiles_owner_is_admin check (not is_owner or role = 'admin');
alter table public.profiles add constraint profiles_email_lower check (email = lower(email));

-- ---------- org_settings: v2 settings ----------
alter table public.org_settings
  add column support_whatsapp      text,
  add column local_files_root      text not null default 'D:\Quellflow-Records\',
  add column file_patterns         jsonb not null default '{
      "fee": "FEE_{code}_{date}_{amount}.jpg", "refund": "REF_{code}_{date}_{amount}.jpg",
      "stipend": "STP_{code}_{month}_{amount}.jpg", "bonus": "BON_{code}_{date}_{amount}.jpg",
      "student_folder": "{root}{year}\\students\\{code}_{name}\\"}'::jsonb,
  add column min_attendance_pct    smallint not null default 75 check (min_attendance_pct between 0 and 100),
  add column min_task_pct          smallint not null default 70 check (min_task_pct between 0 and 100),
  add column working_days          jsonb not null default '[1,2,3,4,5]'::jsonb,
  add column holidays              jsonb not null default '[]'::jsonb,
  add column stipend_pay_by_day    smallint not null default 5 check (stipend_pay_by_day between 1 and 28);

-- ---------- signatories: signature kept inline (no cloud storage) ----------
alter table public.signatories add column signature_data text;
