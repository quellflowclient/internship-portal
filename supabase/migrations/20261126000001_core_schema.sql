-- =====================================================================
-- Quellflow Internship Portal – Phase 1 core schema
-- Identity, admin settings, numbering, intake, programmes, batches,
-- enrolments (+ admin-only money terms), audit log.
-- Spec: docs/06_DATA_MODEL.md · RLS lives in the next migration.
-- =====================================================================

-- ---------- Enums ----------
create type public.user_role         as enum ('super_admin', 'admin', 'mentor', 'student');
create type public.program_track     as enum ('merit', 'paid', 'self_paced');
create type public.engagement_type   as enum ('free', 'paid', 'stipend');
create type public.duration_plan     as enum ('d45', 'd90', 'm6');
create type public.applicant_status  as enum ('new', 'shortlisted', 'on_hold', 'not_now', 'converted');
create type public.enrollment_status as enum ('invited', 'offer_sent', 'accepted', 'payment_pending', 'active',
                                              'paused', 'completed', 'withdrawn', 'terminated');
create type public.training_route    as enum ('foundations', 'guided', 'accelerated');
create type public.task_status       as enum ('todo', 'in_progress', 'in_review', 'revision', 'accepted');
create type public.review_decision   as enum ('accepted', 'revise', 'rescope');
create type public.document_type     as enum ('offer_letter', 'enrollment_letter', 'agreement', 'certificate_completion',
                                              'certificate_excellence', 'certificate_project', 'experience_letter',
                                              'relieving_letter', 'lor', 'invoice', 'grade_report');
create type public.document_status   as enum ('draft', 'pending_approval', 'issued', 'revoked');
create type public.payment_status    as enum ('created', 'paid', 'failed', 'refunded');

-- ---------- Utility ----------
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------- Admin settings (D-05: everything configurable) ----------
create table public.org_settings (
  id                            smallint primary key default 1 check (id = 1),
  org_name                      text not null default 'Quellflow Technologies LLP',
  brand_name                    text not null default 'Quellflow',
  address                       text,
  llpin                         text,
  website                       text,
  contact_email                 text,
  sender_name                   text,
  sender_email                  text,
  verify_base_url               text,
  logo_path                     text,
  timezone                      text not null default 'Asia/Kolkata',
  academic_year_start_month     smallint not null default 6 check (academic_year_start_month between 1 and 12),
  academic_year_label_override  text,
  updated_at                    timestamptz not null default now(),
  updated_by                    uuid
);
create trigger org_settings_updated before update on public.org_settings
  for each row execute function public.set_updated_at();

create table public.roles_catalog (
  code             text primary key check (code ~ '^[A-Z0-9]{2}$'),
  name             text not null,
  track_group      text not null,
  is_launch_track  boolean not null default false,
  form_label       text,
  sort             int not null default 100,
  active           boolean not null default true
);

-- ---------- Identity ----------
create table public.profiles (
  id                    uuid primary key references auth.users (id) on delete cascade,
  role                  public.user_role not null default 'student',
  is_active             boolean not null default false,
  full_name             text,
  display_name_on_docs  text,
  email                 text not null,
  phone_e164            text check (phone_e164 is null or phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  college               text,
  course                text,
  year_of_study         text,
  photo_path            text,
  linkedin_url          text,
  github_url            text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create unique index profiles_email_lower_uq on public.profiles (lower(email));
create trigger profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();

create table public.invitations (
  id            uuid primary key default gen_random_uuid(),
  email         text not null,
  role          public.user_role not null default 'student',
  applicant_id  uuid,
  invited_by    uuid references public.profiles (id),
  profile_id    uuid references public.profiles (id),
  accepted_at   timestamptz,
  revoked_at    timestamptz,
  created_at    timestamptz not null default now()
);
create unique index invitations_pending_email_uq on public.invitations (lower(email))
  where accepted_at is null and revoked_at is null;

-- ---------- Numbering (dynamic, admin-editable) ----------
create table public.numbering_schemes (
  id                        uuid primary key default gen_random_uuid(),
  doc_type                  public.document_type not null,
  pattern                   text not null check (pattern ~ '\{SEQ(:[0-9]+)?\}'),
  reset_per_academic_year   boolean not null default true,
  is_active                 boolean not null default true,
  updated_at                timestamptz not null default now(),
  updated_by                uuid
);
create unique index numbering_one_active_per_type on public.numbering_schemes (doc_type) where is_active;
create trigger numbering_schemes_updated before update on public.numbering_schemes
  for each row execute function public.set_updated_at();

create table public.document_sequences (
  scheme_id            uuid not null references public.numbering_schemes (id) on delete cascade,
  academic_year_label  text not null,
  role_code            text not null default '',
  last_no              int  not null default 0 check (last_no >= 0),
  primary key (scheme_id, academic_year_label, role_code)
);

create table public.signatories (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  title           text not null,
  signature_path  text,
  stamp_path      text,
  is_active       boolean not null default true,
  sort            int not null default 100,
  created_at      timestamptz not null default now()
);

-- ---------- Intake ----------
create table public.applicants (
  id                uuid primary key default gen_random_uuid(),
  candidate_code    text not null unique,
  form_response_id  text unique,
  email             text not null,
  full_name         text not null,
  phone_e164        text,
  city              text,
  college           text,
  degree            text,
  year_of_study     text,
  role_label        text,                 -- exact text chosen in the form
  role_code         text references public.roles_catalog (code),
  skills            text,
  portfolio_url     text,
  prev_internship   text,
  cv_url            text,
  can_start         text,
  hours_per_week    text,
  work_mode         text,
  extra             text,
  submitted_at      timestamptz,
  status            public.applicant_status not null default 'new',
  notes             text,
  profile_id        uuid references public.profiles (id),
  raw               jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index applicants_email_idx on public.applicants (lower(email));
create index applicants_status_idx on public.applicants (status);
create index applicants_role_idx on public.applicants (role_code);
create trigger applicants_updated before update on public.applicants
  for each row execute function public.set_updated_at();

create table public.applicant_status_history (
  id            bigint generated always as identity primary key,
  applicant_id  uuid not null references public.applicants (id) on delete cascade,
  from_status   public.applicant_status,
  to_status     public.applicant_status not null,
  changed_by    uuid,
  note          text,
  changed_at    timestamptz not null default now()
);

alter table public.invitations
  add constraint invitations_applicant_fk foreign key (applicant_id) references public.applicants (id);

-- ---------- Programmes, batches, enrolments ----------
create table public.programs (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  track        public.program_track not null,
  role_code    text not null references public.roles_catalog (code),
  duration     public.duration_plan not null,
  playbook_id  uuid,                      -- FK added in Phase 2 (playbooks)
  course_id    uuid,                      -- FK added in Phase 3 (courses)
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (track, role_code, duration)
);
create trigger programs_updated before update on public.programs
  for each row execute function public.set_updated_at();

-- Money lives in separate admin-only tables (D-04): mentors/other students never see it.
create table public.program_pricing (
  program_id       uuid primary key references public.programs (id) on delete cascade,
  default_fee_inr  numeric(10, 2) check (default_fee_inr is null or default_fee_inr >= 0),
  gst_rate         numeric(5, 2) not null default 18.00 check (gst_rate between 0 and 100),
  updated_at       timestamptz not null default now()
);

create table public.batches (
  id          uuid primary key default gen_random_uuid(),
  program_id  uuid not null references public.programs (id),
  code        text not null unique,
  name        text not null,
  start_date  date not null,
  end_date    date not null,
  capacity    int check (capacity is null or capacity > 0),
  live_slot   text,
  status      text not null default 'planned' check (status in ('planned', 'active', 'completed', 'cancelled')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (end_date >= start_date)
);
create trigger batches_updated before update on public.batches
  for each row execute function public.set_updated_at();

create table public.batch_mentors (
  batch_id   uuid not null references public.batches (id) on delete cascade,
  mentor_id  uuid not null references public.profiles (id) on delete cascade,
  is_backup  boolean not null default false,
  primary key (batch_id, mentor_id)
);

create table public.enrollments (
  id                  uuid primary key default gen_random_uuid(),
  profile_id          uuid references public.profiles (id),    -- null until the invite is accepted
  applicant_id        uuid references public.applicants (id),
  batch_id            uuid not null references public.batches (id),
  program_id          uuid not null references public.programs (id),
  status              public.enrollment_status not null default 'invited',
  start_date          date,
  end_date            date,
  weekly_hours        int not null default 20 check (weekly_hours between 1 and 60),
  working_days        text not null default 'Mon-Fri',
  mentor_id           uuid references public.profiles (id),
  backup_mentor_id    uuid references public.profiles (id),
  project_brief_id    uuid,                                     -- FK in Phase 2
  reduced_scope_note  text,
  review_slots        text,
  approved_tools      text,
  budget_limit_inr    numeric(10, 2),
  handover_owner      text,
  route               public.training_route,
  offer_accepted_at   timestamptz,
  playbook_version    int,
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  check (end_date is null or start_date is null or end_date >= start_date),
  check (status <> 'active' or (profile_id is not null and mentor_id is not null and start_date is not null and end_date is not null))
);
create index enrollments_profile_idx on public.enrollments (profile_id);
create index enrollments_batch_idx on public.enrollments (batch_id);
create trigger enrollments_updated before update on public.enrollments
  for each row execute function public.set_updated_at();

create table public.enrollment_terms (
  enrollment_id       uuid primary key references public.enrollments (id) on delete cascade,
  engagement_type     public.engagement_type not null default 'free',
  stipend_amount_inr  numeric(10, 2) check (stipend_amount_inr is null or stipend_amount_inr >= 0),
  stipend_frequency   text check (stipend_frequency is null or stipend_frequency in ('monthly', 'one_time')),
  fee_amount_inr      numeric(10, 2) check (fee_amount_inr is null or fee_amount_inr >= 0),
  updated_at          timestamptz not null default now(),
  check (engagement_type <> 'stipend' or (stipend_amount_inr is not null and stipend_frequency is not null)),
  check (engagement_type = 'stipend' or stipend_amount_inr is null)
);
create trigger enrollment_terms_updated before update on public.enrollment_terms
  for each row execute function public.set_updated_at();

-- ---------- Audit log (append-only) ----------
create table public.audit_log (
  id         bigint generated always as identity primary key,
  actor_id   uuid,
  action     text not null,
  entity     text not null,
  entity_id  text,
  before     jsonb,
  after      jsonb,
  at         timestamptz not null default now()
);
create index audit_log_entity_idx on public.audit_log (entity, entity_id);
