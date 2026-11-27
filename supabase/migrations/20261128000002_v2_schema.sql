-- =====================================================================
-- v2 step 2/4 – tables, enums, constraints, indexes.
-- Spec: docs/19_DB_FLOWS_PIPELINES.md §2 and §5.
-- Money is whole rupees (int). Codes are issued by next_code() (step 3).
-- =====================================================================

-- ---------- Enums ----------
create type public.lead_stage        as enum ('new', 'contacted', 'interested', 'counselling', 'converted', 'lost');
create type public.lead_source       as enum ('form', 'whatsapp', 'referral', 'walk_in', 'other');
create type public.lost_reason       as enum ('not_interested', 'no_response', 'not_eligible', 'joined_elsewhere', 'duplicate', 'spam');
create type public.activity_kind     as enum ('call', 'whatsapp', 'email', 'meeting', 'note', 'system');
create type public.student_type      as enum ('paid', 'free', 'stipend');
create type public.student_state     as enum ('active', 'alumni', 'archived');
create type public.batch_status      as enum ('planned', 'running', 'completed', 'cancelled');
create type public.enrollment_status as enum ('assigned', 'active', 'completed', 'not_completed', 'withdrawn', 'dropped', 'transferred');
create type public.plan_kind         as enum ('session', 'task', 'test', 'milestone', 'buffer');
create type public.attendance_mark   as enum ('present', 'absent', 'leave');
create type public.work_mark         as enum ('done', 'late', 'missing', 'excused');
create type public.money_category    as enum ('fee', 'refund', 'stipend', 'bonus', 'other_in', 'other_out');
create type public.money_status      as enum ('expected', 'done', 'void');
create type public.pay_mode          as enum ('upi', 'imps', 'neft', 'bank_transfer', 'cash', 'other');
create type public.doc_type          as enum ('offer', 'tnc', 'consent', 'joining', 'certificate', 'experience', 'lor', 'project_certificate');
create type public.doc_status        as enum ('draft', 'issued', 'accepted', 'revoked', 'superseded');
create type public.project_kind      as enum ('client', 'college', 'internal');
create type public.project_status    as enum ('planned', 'active', 'on_hold', 'completed', 'cancelled');
create type public.report_status     as enum ('not_started', 'draft', 'reviewed', 'submitted', 'approved');
create type public.scan_result       as enum ('valid', 'revoked', 'superseded', 'not_found');

-- ---------- Codes ----------
create table public.numbering_schemes (
  kind        text primary key check (kind ~ '^[a-z_]+(:[a-z_]+)?$'),
  pattern     text not null check (pattern ~ '\{SEQ(:[0-9]+)?\}'),
  updated_at  timestamptz not null default now(),
  updated_by  uuid
);
create table public.number_sequences (
  kind        text not null references public.numbering_schemes (kind) on update cascade,
  scope       text not null,
  last_value  int  not null default 0 check (last_value >= 0),
  primary key (kind, scope)
);

-- ---------- CRM ----------
create table public.leads (
  id                 uuid primary key default gen_random_uuid(),
  code               text not null unique,
  form_response_id   text unique,
  source             public.lead_source not null default 'form',
  full_name          text not null check (btrim(full_name) <> ''),
  phone              text,
  email              text check (email is null or email = lower(email)),
  college            text,
  course             text,
  year_of_study      text,
  interested_track   text,
  answers            jsonb not null default '{}'::jsonb,
  stage              public.lead_stage not null default 'new',
  lost_reason        public.lost_reason,
  lost_note          text,
  owner_id           uuid references public.profiles (id),
  next_follow_up_on  date,
  last_contacted_at  timestamptz,
  student_id         uuid,
  submitted_at       timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  created_by         uuid default auth.uid(),
  check (stage <> 'lost' or lost_reason is not null),
  check (stage <> 'converted' or student_id is not null)
);
create index leads_stage_idx on public.leads (stage);
create index leads_follow_up_idx on public.leads (next_follow_up_on) where stage not in ('converted', 'lost');

-- ---------- Courses and templates ----------
create table public.courses (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique check (code ~ '^[A-Z]{2}$'),
  name        text not null,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create table public.course_plans (
  id                   uuid primary key default gen_random_uuid(),
  course_id            uuid not null references public.courses (id),
  duration_days        int  not null check (duration_days in (30, 60, 90)),
  fee_inr              int  not null check (fee_inr >= 0),
  benefits             text[] not null default '{}',
  certificate_wording  text,
  active               boolean not null default true,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (course_id, duration_days)
);
create table public.plan_templates (
  id              uuid primary key default gen_random_uuid(),
  course_plan_id  uuid not null references public.course_plans (id) on delete cascade,
  version         int  not null default 1 check (version > 0),
  active          boolean not null default true,
  created_at      timestamptz not null default now(),
  unique (course_plan_id, version)
);
create unique index plan_templates_one_active on public.plan_templates (course_plan_id) where active;
create table public.plan_template_items (
  id            uuid primary key default gen_random_uuid(),
  template_id   uuid not null references public.plan_templates (id) on delete cascade,
  seq           int  not null check (seq > 0),
  week          int  not null check (week > 0),
  day_offset    int  not null check (day_offset > 0),
  kind          public.plan_kind not null,
  title         text not null,
  description   text,
  resources     jsonb not null default '[]'::jsonb,
  duration_min  int check (duration_min is null or duration_min > 0),
  unique (template_id, seq)
);

-- ---------- Students ----------
create table public.students (
  id                      uuid primary key default gen_random_uuid(),
  code                    text not null unique,
  lead_id                 uuid unique references public.leads (id),
  user_id                 uuid unique references public.profiles (id) on delete set null,
  full_name               text not null check (btrim(full_name) <> ''),
  name_on_documents       text not null check (btrim(name_on_documents) <> ''),
  email                   text not null unique check (email = lower(email)),
  phone                   text not null,
  dob                     date,
  city                    text,
  college                 text not null,
  course                  text,
  year_of_study           smallint check (year_of_study is null or year_of_study between 1 and 6),
  github_url              text,
  linkedin_url            text,
  planned_type            public.student_type,
  planned_course_plan_id  uuid references public.course_plans (id),
  state                   public.student_state not null default 'active',
  archived_reason         text,
  kyc_saved               jsonb not null default '{}'::jsonb,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  created_by              uuid default auth.uid(),
  check (state <> 'archived' or archived_reason is not null)
);
create index students_state_idx on public.students (state);
alter table public.leads add constraint leads_student_fk foreign key (student_id) references public.students (id);

create table public.invitations (
  id           uuid primary key default gen_random_uuid(),
  email        text not null check (email = lower(email)),
  role         public.user_role not null default 'student',
  student_id   uuid references public.students (id),
  invited_by   uuid references public.profiles (id),
  profile_id   uuid references public.profiles (id),
  expires_at   timestamptz not null default now() + interval '30 days',
  accepted_at  timestamptz,
  revoked_at   timestamptz,
  created_at   timestamptz not null default now()
);
create unique index invitations_pending_email_uq on public.invitations (email) where accepted_at is null and revoked_at is null;

-- ---------- Batches and plans ----------
create table public.batches (
  id              uuid primary key default gen_random_uuid(),
  code            text not null unique,
  course_plan_id  uuid not null references public.course_plans (id),
  start_date      date not null,
  end_date        date not null,
  schedule_days   jsonb not null default '[1,2,3,4,5]'::jsonb,
  session_time    text,
  capacity        int  not null default 20 check (capacity > 0),
  status          public.batch_status not null default 'planned',
  coordinator_id  uuid references public.profiles (id),
  whatsapp_url    text,
  classroom_url   text,
  meet_url        text,
  playlist_url    text,
  drive_url       text,
  github_url      text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid default auth.uid(),
  check (end_date >= start_date)
);
create table public.batch_plans (
  id                       uuid primary key default gen_random_uuid(),
  batch_id                 uuid not null unique references public.batches (id) on delete cascade,
  published_version        int  not null default 0 check (published_version >= 0),
  has_unpublished_changes  boolean not null default true,
  share_token              text not null unique default replace(gen_random_uuid()::text, '-', ''),
  share_enabled            boolean not null default true,
  show_done_marks          boolean not null default true,
  updated_at               timestamptz not null default now()
);
create table public.batch_plan_items (
  id             uuid primary key default gen_random_uuid(),
  batch_plan_id  uuid not null references public.batch_plans (id) on delete cascade,
  seq            int  not null check (seq > 0),
  week           int  not null check (week > 0),
  planned_date   date not null,
  kind           public.plan_kind not null,
  title          text not null check (btrim(title) <> ''),
  description    text,
  resources      jsonb not null default '[]'::jsonb,
  duration_min   int check (duration_min is null or duration_min > 0),
  skipped_at     timestamptz,
  skip_reason    text,
  deleted_at     timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  check (skipped_at is null or skip_reason is not null)
);
create index batch_plan_items_plan_idx on public.batch_plan_items (batch_plan_id, planned_date);
create table public.batch_plan_versions (
  id             uuid primary key default gen_random_uuid(),
  batch_plan_id  uuid not null references public.batch_plans (id) on delete cascade,
  version        int  not null check (version > 0),
  published_at   timestamptz not null default now(),
  published_by   uuid default auth.uid(),
  change_note    text,
  items          jsonb not null,
  unique (batch_plan_id, version)
);

-- ---------- Enrolments ----------
create table public.enrollments (
  id                        uuid primary key default gen_random_uuid(),
  student_id                uuid not null references public.students (id),
  batch_id                  uuid not null references public.batches (id),
  type                      public.student_type not null,
  status                    public.enrollment_status not null default 'assigned',
  assigned_on               date not null default current_date,
  start_date                date not null,
  end_date                  date not null,
  fee_inr                   int check (fee_inr is null or fee_inr >= 0),
  free_reason               text,
  approved_by               uuid references public.profiles (id),
  exit_reason               text,
  transferred_to_id         uuid references public.enrollments (id),
  result_note               text,
  capacity_override_reason  text,
  change_reason             text,   -- set in the same UPDATE as a type/fee/batch change; logged and cleared by trigger
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  created_by                uuid default auth.uid(),
  check (end_date >= start_date),
  check (type <> 'paid' or fee_inr is not null),
  check (type <> 'free' or free_reason is not null),
  check (status not in ('withdrawn', 'dropped', 'transferred') or exit_reason is not null),
  check (status <> 'transferred' or transferred_to_id is not null)
);
create unique index enrollments_open_uq on public.enrollments (student_id, batch_id) where status in ('assigned', 'active');
create index enrollments_batch_idx on public.enrollments (batch_id);
create index enrollments_student_idx on public.enrollments (student_id);

create table public.enrollment_changes (
  id             bigint generated always as identity primary key,
  enrollment_id  uuid not null references public.enrollments (id) on delete cascade,
  change         text not null check (change in ('type', 'fee', 'batch', 'dates', 'status')),
  from_value     text,
  to_value       text,
  reason         text,
  changed_by     uuid default auth.uid(),
  changed_at     timestamptz not null default now()
);
create index enrollment_changes_enrollment_idx on public.enrollment_changes (enrollment_id);

create table public.stipend_agreements (
  id             uuid primary key default gen_random_uuid(),
  enrollment_id  uuid not null references public.enrollments (id) on delete cascade,
  monthly_inr    int  not null check (monthly_inr > 0),
  from_month     date not null check (extract(day from from_month) = 1),
  to_month       date check (to_month is null or extract(day from to_month) = 1),
  agreed_note    text,
  created_at     timestamptz not null default now(),
  created_by     uuid default auth.uid(),
  check (to_month is null or to_month >= from_month)
);

-- ---------- Activities (timeline for leads and students) ----------
create table public.activities (
  id             uuid primary key default gen_random_uuid(),
  lead_id        uuid references public.leads (id) on delete cascade,
  student_id     uuid references public.students (id) on delete cascade,
  enrollment_id  uuid references public.enrollments (id) on delete set null,
  kind           public.activity_kind not null,
  summary        text not null check (btrim(summary) <> ''),
  outcome        text,
  occurred_at    timestamptz not null default now(),
  created_at     timestamptz not null default now(),
  created_by     uuid default auth.uid(),
  check (lead_id is not null or student_id is not null)
);
create index activities_lead_idx on public.activities (lead_id, occurred_at desc);
create index activities_student_idx on public.activities (student_id, occurred_at desc);

-- ---------- Money (one ledger) ----------
create table public.money_entries (
  id                uuid primary key default gen_random_uuid(),
  student_id        uuid not null references public.students (id),
  enrollment_id     uuid references public.enrollments (id),
  category          public.money_category not null,
  direction         text not null check (direction in ('in', 'out')),
  amount_inr        int  not null check (amount_inr > 0),
  status            public.money_status not null default 'done',
  period_month      date check (period_month is null or extract(day from period_month) = 1),
  due_on            date,
  paid_on           date,
  mode              public.pay_mode,
  ref_last4         text check (ref_last4 is null or ref_last4 ~ '^[0-9A-Za-z]{1,6}$'),
  note              text,
  related_entry_id  uuid references public.money_entries (id),
  proof_saved       boolean not null default false,
  void_reason       text,
  voided_at         timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  created_by        uuid default auth.uid(),
  check ((category in ('fee', 'other_in')) = (direction = 'in')),
  check (status <> 'done' or (paid_on is not null and mode is not null)),
  check (status <> 'void' or void_reason is not null),
  check (category <> 'refund' or related_entry_id is not null),
  check (category <> 'stipend' or (period_month is not null and enrollment_id is not null)),
  check (category = 'stipend' or status <> 'expected')
);
create unique index money_stipend_month_uq on public.money_entries (enrollment_id, period_month)
  where category = 'stipend' and status <> 'void';
create index money_student_idx on public.money_entries (student_id);
create index money_paid_on_idx on public.money_entries (paid_on) where status = 'done';
create index money_status_idx on public.money_entries (status, category);

-- ---------- Live track ----------
create table public.track_entries (
  id            uuid primary key default gen_random_uuid(),
  batch_id      uuid not null references public.batches (id),
  plan_item_id  uuid references public.batch_plan_items (id) on delete set null,
  held_on       date not null,
  kind          public.plan_kind not null,
  title         text not null check (btrim(title) <> ''),
  link          text,
  note          text,
  deleted_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid default auth.uid()
);
create index track_entries_batch_idx on public.track_entries (batch_id, held_on desc);
create index track_entries_plan_item_idx on public.track_entries (plan_item_id) where plan_item_id is not null;
create table public.attendance (
  track_entry_id  uuid not null references public.track_entries (id) on delete cascade,
  enrollment_id   uuid not null references public.enrollments (id) on delete cascade,
  mark            public.attendance_mark not null,
  primary key (track_entry_id, enrollment_id)
);
create index attendance_enrollment_idx on public.attendance (enrollment_id);
create table public.work_results (
  track_entry_id  uuid not null references public.track_entries (id) on delete cascade,
  enrollment_id   uuid not null references public.enrollments (id) on delete cascade,
  mark            public.work_mark not null,
  score           numeric(6, 2) check (score is null or score >= 0),
  max_score       numeric(6, 2) check (max_score is null or max_score > 0),
  note            text,
  primary key (track_entry_id, enrollment_id),
  check (score is null or max_score is null or score <= max_score)
);
create index work_results_enrollment_idx on public.work_results (enrollment_id);

-- ---------- Projects ----------
create table public.projects (
  id                 uuid primary key default gen_random_uuid(),
  code               text not null unique,
  name               text not null check (btrim(name) <> ''),
  kind               public.project_kind not null,
  batch_id           uuid references public.batches (id),
  status             public.project_status not null default 'planned',
  description        text,
  start_date         date,
  due_date           date,
  lead_admin_id      uuid references public.profiles (id),
  github_url         text,
  github_visibility  text check (github_visibility is null or github_visibility in ('public', 'private', 'org')),
  demo_url           text,
  docs_url           text,
  client_name        text,
  client_contact     text,
  college_name       text,
  guide_name         text,
  submission_due     date,
  report_status      public.report_status,
  archived_at        timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  created_by         uuid default auth.uid(),
  check (kind <> 'client' or client_name is not null),
  check (kind <> 'client' or github_visibility is distinct from 'public')
);
create index projects_kind_idx on public.projects (kind);
create table public.project_members (
  project_id         uuid not null references public.projects (id) on delete cascade,
  student_id         uuid not null references public.students (id),
  role               text,
  hours              int check (hours is null or hours >= 0),
  contribution_note  text,
  primary key (project_id, student_id)
);
create table public.project_tasks (
  id                   uuid primary key default gen_random_uuid(),
  project_id           uuid not null references public.projects (id) on delete cascade,
  title                text not null check (btrim(title) <> ''),
  status               text not null default 'todo' check (status in ('todo', 'doing', 'review', 'done')),
  assignee_student_id  uuid references public.students (id),
  due_on               date,
  link                 text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  created_by           uuid default auth.uid()
);

-- ---------- Documents ----------
create table public.document_templates (
  id                   uuid primary key default gen_random_uuid(),
  type                 public.doc_type not null,
  version              int  not null default 1 check (version > 0),
  title                text not null,
  body                 text not null,
  requires_acceptance  boolean not null default false,
  active               boolean not null default true,
  created_at           timestamptz not null default now(),
  created_by           uuid default auth.uid(),
  unique (type, version)
);
create unique index document_templates_one_active on public.document_templates (type) where active;
create table public.documents (
  id              uuid primary key default gen_random_uuid(),
  type            public.doc_type not null,
  template_id     uuid not null references public.document_templates (id),
  student_id      uuid not null references public.students (id),
  enrollment_id   uuid references public.enrollments (id),
  project_id      uuid references public.projects (id),
  number          text unique,
  verify_token    text unique check (verify_token is null or length(verify_token) >= 32),
  version         int  not null default 1 check (version > 0),
  data            jsonb not null default '{}'::jsonb,
  content_hash    text check (content_hash is null or content_hash ~ '^[0-9a-f]{64}$'),
  status          public.doc_status not null default 'draft',
  issued_at       timestamptz,
  issued_by       uuid references public.profiles (id),
  signatory_id    uuid references public.signatories (id),
  revoked_at      timestamptz,
  revoked_reason  text,
  supersedes_id   uuid references public.documents (id),
  pdf_saved       boolean not null default false,
  shared_via      text check (shared_via is null or shared_via in ('whatsapp', 'email', 'in_person')),
  shared_at       timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid default auth.uid(),
  check (status = 'draft' or (number is not null and verify_token is not null and content_hash is not null and issued_at is not null)),
  check (status <> 'revoked' or revoked_reason is not null)
);
create index documents_student_idx on public.documents (student_id);
create index documents_status_idx on public.documents (status, type);
create table public.document_acceptances (
  id             uuid primary key default gen_random_uuid(),
  document_id    uuid not null unique references public.documents (id) on delete cascade,
  student_id     uuid not null references public.students (id),
  typed_name     text not null,
  checkbox_text  text not null,
  accepted_at    timestamptz not null default now(),
  ip             text,
  user_agent     text,
  content_hash   text not null
);
create table public.verification_scans (
  id           bigint generated always as identity primary key,
  document_id  uuid references public.documents (id) on delete set null,
  at           timestamptz not null default now(),
  method       text not null check (method in ('qr', 'number')),
  result       public.scan_result not null,
  ip_hash      text
);
create index verification_scans_document_idx on public.verification_scans (document_id, at desc);

-- ---------- updated_at ----------
do $$
declare t text;
begin
  foreach t in array array['leads', 'courses', 'course_plans', 'students', 'batches', 'batch_plans', 'batch_plan_items',
                           'enrollments', 'money_entries', 'track_entries', 'projects', 'project_tasks', 'documents'] loop
    execute format('create trigger %I before update on public.%I for each row execute function public.set_updated_at()',
                   t || '_updated', t);
  end loop;
end $$;
