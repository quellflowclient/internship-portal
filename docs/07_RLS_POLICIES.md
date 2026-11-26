# 07 – RLS Policies (Supabase)

Principles (from Supabase docs): RLS acts as an implicit `WHERE` on every query; policies use `(select auth.uid())` (wrapped for performance) and `to authenticated`; `auth.uid()` is null for anon – **never** add `or auth.uid() is null`; table grants are checked first, so revoke defaults and grant explicitly; `service_role` bypasses RLS and stays server-side.

## Helpers
```sql
-- named my_role (current_role is a reserved SQL keyword)
create or replace function public.my_role() returns user_role
language sql stable security definer set search_path = public as $$
  select role from profiles where id = (select auth.uid())
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role in ('admin','super_admin') from profiles where id = (select auth.uid())), false)
$$;

create or replace function public.is_super_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'super_admin' from profiles where id = (select auth.uid())), false)
$$;

create or replace function public.is_batch_mentor(b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from batch_mentors where batch_id = b and mentor_id = (select auth.uid()))
$$;

create or replace function public.can_see_enrollment(e uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(
    select 1 from enrollments en
    where en.id = e and (
      en.profile_id = (select auth.uid())
      or public.is_batch_mentor(en.batch_id)
      or public.is_admin()))
$$;
```

## Grants baseline
```sql
revoke all on all tables in schema public from anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated; -- RLS then narrows
-- anon gets nothing; public verify uses rpc verify_document() granted to anon.
grant execute on function public.verify_document(text) to anon, authenticated;
```

## Policies (pattern per table)
```sql
-- profiles
alter table profiles enable row level security;
create policy "profiles: self read"   on profiles for select to authenticated using (id = (select auth.uid()) or is_admin());
create policy "profiles: mentors read their interns" on profiles for select to authenticated
  using (exists (select 1 from enrollments e where e.profile_id = profiles.id and is_batch_mentor(e.batch_id)));
create policy "profiles: self update" on profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()) and role = (select role from profiles where id = (select auth.uid())));
create policy "profiles: admin write" on profiles for all to authenticated using (is_admin()) with check (is_admin());
-- role escalation: a column-level REVOKE does NOT override a table-level GRANT in Postgres.
-- So: revoke update on profiles from authenticated; grant update (editable columns…) to authenticated;
-- role / is_active / email change only via the admin_set_user_role() RPC. (Caught by tests/db/rls.test.ts.)

-- applicants: admin only (+ mentors read shortlisted of their role – optional view)
create policy "applicants: admin" on applicants for all to authenticated using (is_admin()) with check (is_admin());

-- enrollments
create policy "enrollments: read" on enrollments for select to authenticated using (can_see_enrollment(id));
create policy "enrollments: admin write" on enrollments for all to authenticated using (is_admin()) with check (is_admin());
create policy "enrollments: mentor update" on enrollments for update to authenticated
  using (is_batch_mentor(batch_id)) with check (is_batch_mentor(batch_id));   -- route/scope fields via column grants

-- student-authored tables: daily_updates, weekly_reports, blockers, final_reports, submissions, quiz_attempts, lesson_progress
create policy "x: read" on daily_updates for select to authenticated using (can_see_enrollment(enrollment_id));
create policy "x: student insert" on daily_updates for insert to authenticated
  with check (exists (select 1 from enrollments e where e.id = enrollment_id and e.profile_id = (select auth.uid()) and e.status = 'active'));
create policy "x: student edit same day" on daily_updates for update to authenticated
  using (exists (select 1 from enrollments e where e.id = enrollment_id and e.profile_id = (select auth.uid()))
         and work_date = (now() at time zone 'Asia/Kolkata')::date);

-- mentor-authored tables: diagnostic_scores, mentor_reviews, scope_changes, final_reviews, attendance, submissions.grade
create policy "y: read" on mentor_reviews for select to authenticated
  using (is_admin() or exists (select 1 from enrollments e where e.id = enrollment_id and is_batch_mentor(e.batch_id))
         or (published and exists (select 1 from enrollments e where e.id = enrollment_id and e.profile_id = (select auth.uid()))));
create policy "y: mentor write" on mentor_reviews for insert to authenticated
  with check (exists (select 1 from enrollments e where e.id = enrollment_id and is_batch_mentor(e.batch_id)) or is_admin());
-- diagnostic_scores: same, but students get NO select (they see a summary view after review).

-- tasks
create policy "tasks: read" on tasks for select to authenticated using (can_see_enrollment(enrollment_id));
create policy "tasks: mentor/admin write" on tasks for all to authenticated
  using (is_admin() or exists (select 1 from enrollments e where e.id = enrollment_id and is_batch_mentor(e.batch_id)))
  with check (is_admin() or exists (select 1 from enrollments e where e.id = enrollment_id and is_batch_mentor(e.batch_id)));
create policy "tasks: student progress" on tasks for update to authenticated
  using (exists (select 1 from enrollments e where e.id = enrollment_id and e.profile_id = (select auth.uid())))
  with check (status in ('todo','in_progress','in_review'));   -- cannot self-accept

-- documents
create policy "documents: student own issued" on documents for select to authenticated
  using (profile_id = (select auth.uid()) and status in ('issued','revoked'));
create policy "documents: mentor read" on documents for select to authenticated
  using (exists (select 1 from enrollments e where e.id = enrollment_id and is_batch_mentor(e.batch_id)));
create policy "documents: admin" on documents for all to authenticated using (is_admin()) with check (is_admin());
-- revoke & approve only through RPCs that check is_super_admin(); issued rows: trigger blocks updates to pdf_path/sha256/data.

-- content (playbooks, courses, lessons…): published content readable by enrolled students of that programme; write = admin.
-- payments: student read own; write = server (webhook with service_role) + admin.
-- audit_log: insert via triggers only (security definer); select = is_admin(); no update/delete for anyone.
```

## Storage buckets
| Bucket | Public | Policy |
|---|---|---|
| `public-assets` | yes | read all; write admin |
| `course-content` | no | read: enrolled in course; write admin/mentor-owner |
| `submissions` | no | path `submissions/{enrollment_id}/…`; insert/read: owner student; read: batch mentor, admin |
| `documents` | no | read: owner (issued only) via signed URL from server; write: server only |
| `templates` | no | admin |

## Public verify
```sql
create or replace function public.verify_document(p_code text)
returns table (code text, doc_type document_type, holder_name text, program text, role text,
               start_date date, end_date date, grade text, issued_at timestamptz, status document_status)
language sql stable security definer set search_path = public as $$
  select d.code, d.type, d.data->>'name', d.data->>'program', d.data->>'role',
         (d.data->>'start_date')::date, (d.data->>'end_date')::date, d.data->>'grade', d.issued_at, d.status
  from documents d where d.code = upper(trim(p_code)) and d.status in ('issued','revoked');
$$;
```
Rate-limit `/verify` at the edge (e.g. 30 req/min/IP).

## RLS test cases (must pass – see 14_TESTING_QA)
student A cannot read student B's daily updates / documents · mentor of batch X cannot read batch Y · student cannot set task `accepted` · student cannot change own role · anon cannot select `documents` but can call `verify_document` · revoked document shows REVOKED.
