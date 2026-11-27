-- =====================================================================
-- v2 step 4/4 – derived values (views), grants and row level security.
-- Spec: docs/19_DB_FLOWS_PIPELINES.md §3 and §4.
-- Admin views use security_invoker so table RLS still applies.
-- v_my_* views are the student's own window (filtered by my_student_id()).
-- =====================================================================

-- ---------- Plan and progress ----------
create view public.v_plan_item_status with (security_invoker = true) as
with first_delivery as (
  select distinct on (t.plan_item_id) t.plan_item_id, t.held_on
    from public.track_entries t
   where t.deleted_at is null and t.plan_item_id is not null
   order by t.plan_item_id, t.held_on
)
select i.id, bp.batch_id, i.batch_plan_id, i.seq, i.week, i.planned_date, i.kind, i.title, i.skip_reason,
       fd.held_on as delivered_on,
       public.working_days_between(i.planned_date, fd.held_on, b.schedule_days) as delay_days,
       case
         when i.skipped_at is not null then 'skipped'
         when fd.held_on is not null and fd.held_on > i.planned_date then 'late'
         when fd.held_on is not null then 'delivered'
         when i.planned_date < public.today_ist() then 'overdue'
         else 'planned'
       end as status
  from public.batch_plan_items i
  join public.batch_plans bp on bp.id = i.batch_plan_id
  join public.batches b on b.id = bp.batch_id
  left join first_delivery fd on fd.plan_item_id = i.id
 where i.deleted_at is null;

create view public.v_batch_progress with (security_invoker = true) as
select b.id as batch_id, b.code, b.status,
       count(s.id) filter (where s.status in ('delivered', 'late'))::int as done,
       count(s.id)::int as planned,
       count(s.id) filter (where s.status = 'skipped')::int as skipped,
       (select count(*)::int from public.track_entries t
         where t.batch_id = b.id and t.deleted_at is null and t.plan_item_id is null) as unplanned,
       greatest(0, coalesce(
         public.working_days_between(min(s.planned_date) filter (where s.status = 'overdue'), public.today_ist(), b.schedule_days),
         (select s2.delay_days from public.v_plan_item_status s2
           where s2.batch_id = b.id and s2.delivered_on is not null
           order by s2.delivered_on desc, s2.seq desc limit 1),
         0)) as days_behind,
       (public.today_ist() - b.start_date + 1) as day_x,
       (b.end_date - b.start_date + 1) as day_n,
       (select s3.id from public.v_plan_item_status s3
         where s3.batch_id = b.id and s3.status = 'planned'
         order by s3.planned_date, s3.seq limit 1) as next_item_id
  from public.batches b
  left join public.v_plan_item_status s on s.batch_id = b.id
 group by b.id;

-- ---------- Students ----------
-- Runs as the view owner (needed inside v_my_enrollments) and filters rows itself:
-- admins see every enrolment, a student sees only their own.
create view public.v_enrollment_stats as
select e.id as enrollment_id, e.student_id, e.batch_id,
       att.marked, att.present,
       case when att.marked > 0 then round(100.0 * att.present / att.marked)::int end as attendance_pct,
       wk.given, wk.done,
       case when wk.given > 0 then round(100.0 * wk.done / wk.given)::int end as tasks_pct,
       wk.quiz_avg,
       (coalesce(case when att.marked > 0 then 100.0 * att.present / att.marked end, 0)
          >= (select min_attendance_pct from public.org_settings where id = 1)
        and coalesce(case when wk.given > 0 then 100.0 * wk.done / wk.given end, 100)
          >= (select min_task_pct from public.org_settings where id = 1)) as eligible
  from public.enrollments e
  left join lateral (
    select count(*)::int as marked, count(*) filter (where a.mark = 'present')::int as present
      from public.attendance a join public.track_entries t on t.id = a.track_entry_id and t.deleted_at is null
     where a.enrollment_id = e.id) att on true
  left join lateral (
    select (select count(*)::int from public.track_entries t
             where t.batch_id = e.batch_id and t.kind in ('task', 'test') and t.deleted_at is null and t.held_on >= e.start_date) as given,
           count(*) filter (where w.mark in ('done', 'late') and t.kind in ('task', 'test'))::int as done,
           round(avg(10.0 * w.score / w.max_score) filter (where t.kind = 'test' and w.score is not null and w.max_score is not null), 1) as quiz_avg
      from public.work_results w join public.track_entries t on t.id = w.track_entry_id and t.deleted_at is null
     where w.enrollment_id = e.id) wk on true
 where public.is_admin() or e.student_id = public.my_student_id();

create view public.v_fee_balance with (security_invoker = true) as
select s.id as student_id, x.agreed, x.paid, x.refunded, x.agreed - x.paid + x.refunded as pending
  from public.students s
  cross join lateral (
    select coalesce((select sum(e.fee_inr) from public.enrollments e
                      where e.student_id = s.id and e.type = 'paid' and e.status not in ('withdrawn', 'transferred')), 0)::int as agreed,
           coalesce((select sum(m.amount_inr) from public.money_entries m
                      where m.student_id = s.id and m.category = 'fee' and m.status = 'done'), 0)::int as paid,
           coalesce((select sum(m.amount_inr) from public.money_entries m
                      where m.student_id = s.id and m.category = 'refund' and m.status = 'done'), 0)::int as refunded) x;

create view public.v_student_list with (security_invoker = true) as
select s.id, s.code, s.full_name, s.email, s.phone, s.college, s.course, s.year_of_study, s.state,
       ce.id as enrollment_id, ce.batch_id, b.code as batch_code, coalesce(ce.type, s.planned_type) as type,
       st.attendance_pct, fb.pending as fee_pending,
       case
         when s.state = 'archived' then 'archived'
         when ce.id is null and s.state = 'alumni' then 'alumni'
         when ce.id is null then 'not_assigned'
         when st.attendance_pct < (select min_attendance_pct from public.org_settings where id = 1)
           or (coalesce(fb.pending, 0) > 0 and ce.start_date + 7 < public.today_ist()) then 'at_risk'
         else 'active'
       end as display_status
  from public.students s
  left join lateral (select * from public.enrollments e
                      where e.student_id = s.id and e.status in ('assigned', 'active')
                      order by e.start_date desc limit 1) ce on true
  left join public.batches b on b.id = ce.batch_id
  left join public.v_enrollment_stats st on st.enrollment_id = ce.id
  left join public.v_fee_balance fb on fb.student_id = s.id;

-- ---------- Money and documents ----------
create view public.v_money_month with (security_invoker = true) as
select date_trunc('month', paid_on)::date as month,
       coalesce(sum(amount_inr) filter (where direction = 'in'), 0)::int as money_in,
       coalesce(sum(amount_inr) filter (where direction = 'out'), 0)::int as money_out,
       (coalesce(sum(amount_inr) filter (where direction = 'in'), 0) - coalesce(sum(amount_inr) filter (where direction = 'out'), 0))::int as net
  from public.money_entries
 where status = 'done'
 group by 1;

create view public.v_document_list with (security_invoker = true) as
select d.id, d.type, d.number, d.status, d.student_id, s.full_name as student_name, s.code as student_code,
       d.enrollment_id, d.project_id, d.issued_at, d.revoked_at, d.pdf_saved,
       case when d.status = 'issued' and d.type in ('offer', 'tnc', 'consent') then 'awaiting' else d.status::text end as display_status,
       (select count(*)::int from public.verification_scans v where v.document_id = d.id) as scans
  from public.documents d join public.students s on s.id = d.student_id;

-- ---------- Dashboard "Needs attention" (admin) ----------
create view public.v_attention with (security_invoker = true) as
select * from (
  select 'follow_ups' as key, 'warn' as tone, count(*)::int as n,
         'lead follow-ups due today' as label, 'a-leads' as route, '{"due":"1"}'::jsonb as filters
    from public.leads where stage not in ('converted', 'lost') and next_follow_up_on <= public.today_ist()
  union all
  select 'docs_waiting', 'info', count(*)::int, 'documents waiting more than 3 days for acceptance', 'a-documents', '{"status":"awaiting"}'::jsonb
    from public.documents where status = 'issued' and type in ('offer', 'tnc', 'consent') and issued_at < now() - interval '3 days'
  union all
  select 'proof_missing', 'bad', count(*)::int, 'payments without a saved screenshot', 'a-payments', '{"proof":"missing"}'::jsonb
    from public.money_entries where status = 'done' and not proof_saved
  union all
  select 'stipend_due', 'warn', count(*)::int, 'stipends due within 5 days', 'a-payments', '{"tab":"stipend"}'::jsonb
    from public.money_entries where category = 'stipend' and status = 'expected' and due_on <= public.today_ist() + 5
  union all
  select 'not_assigned', 'acc', count(*)::int, 'paid students not in a batch', 'a-students', '{"batch":"none"}'::jsonb
    from public.students s where s.state = 'active' and s.planned_type = 'paid'
     and not exists (select 1 from public.enrollments e where e.student_id = s.id and e.status in ('assigned', 'active'))
  union all
  select 'behind_' || p.code, 'warn', p.days_behind, p.code || ' is behind plan (days)', 'a-batch', jsonb_build_object('batch', p.batch_id)
    from public.v_batch_progress p where p.status = 'running' and p.days_behind > 0
  union all
  select 'ending_' || b.code, 'info', (b.end_date - public.today_ist())::int, b.code || ' ends soon (days left)', 'a-batch-close', jsonb_build_object('batch', b.id)
    from public.batches b where b.status = 'running' and b.end_date - public.today_ist() between 0 and 7
) x where n > 0;

-- ---------- Student's own window (no fees, no money) ----------
create view public.v_my_enrollments as
select e.id as enrollment_id, e.type, e.status, e.start_date, e.end_date,
       b.id as batch_id, b.code as batch_code, b.session_time, b.schedule_days,
       b.whatsapp_url, b.classroom_url, b.meet_url, b.playlist_url, b.drive_url, b.github_url,
       c.name as course_name, p.duration_days, bp.share_token, bp.published_version,
       st.attendance_pct, st.tasks_pct, st.quiz_avg, st.eligible
  from public.enrollments e
  join public.batches b on b.id = e.batch_id
  join public.course_plans p on p.id = b.course_plan_id
  join public.courses c on c.id = p.course_id
  left join public.batch_plans bp on bp.batch_id = b.id
  left join public.v_enrollment_stats st on st.enrollment_id = e.id
 where e.student_id = public.my_student_id()
   and e.status in ('assigned', 'active', 'completed', 'not_completed');

-- =====================================================================
-- Grants
-- =====================================================================
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated, public;

grant select, insert, update, delete on all tables in schema public to authenticated;
-- written only by functions / triggers
revoke insert, update, delete on public.audit_log, public.number_sequences, public.enrollment_changes,
  public.document_acceptances, public.verification_scans, public.batch_plan_versions from authenticated;
-- views are read-only
revoke insert, update, delete on public.v_plan_item_status, public.v_batch_progress, public.v_enrollment_stats,
  public.v_fee_balance, public.v_student_list, public.v_money_month, public.v_document_list, public.v_attention,
  public.v_my_enrollments from authenticated;

grant execute on function
  public.is_service(), public.is_admin(), public.is_owner(), public.my_role(), public.my_student_id(),
  public.is_my_batch(uuid), public.is_my_enrollment(uuid), public.today_ist(), public.is_working_day(date, jsonb),
  public.nth_working_day(date, int, jsonb), public.working_days_between(date, date, jsonb),
  public.academic_year_label(timestamptz), public.format_code(text, jsonb, int),
  public.next_code(text, jsonb), public.preview_code(text, jsonb),
  public.admin_set_user_role(uuid, public.user_role, boolean, boolean),
  public.upsert_form_lead(text, text, text, text, text, text, text, text, jsonb, timestamptz),
  public.create_lead(text, text, public.lead_source, text, text, text),
  public.create_student(text, text, text, text, text, smallint, public.student_type, uuid, uuid, text),
  public.assign_student(uuid, uuid, public.student_type, int, text, int, text, text),
  public.create_batch(uuid, date, int, text, jsonb), public.publish_plan(uuid, text),
  public.get_shared_plan(text), public.issue_document(uuid, text),
  public.accept_document(uuid, text, text, text, text), public.public_doc_fields(jsonb),
  public.verify_document(text, text), public.verify_by_number(text, text, text),
  public.create_stipend_rows(date), public.daily_job(), public.search_all(text)
to authenticated;
-- public pages (no sign-in)
grant execute on function public.get_shared_plan(text), public.verify_document(text, text),
  public.verify_by_number(text, text, text), public.public_doc_fields(jsonb), public.is_service(),
  public.is_admin(), public.is_owner(), public.today_ist()
to anon;
-- service role (import API, cron)
grant execute on all functions in schema public to service_role;
-- bootstrap_owner: no grant (SQL editor only)
revoke execute on function public.bootstrap_owner(text) from service_role;

-- =====================================================================
-- Row level security (anon has no table access at all)
-- =====================================================================
do $$
declare t text;
begin
  foreach t in array array['profiles', 'invitations', 'org_settings', 'numbering_schemes', 'number_sequences', 'signatories',
                           'audit_log', 'leads', 'activities', 'courses', 'course_plans', 'plan_templates', 'plan_template_items',
                           'students', 'batches', 'batch_plans', 'batch_plan_items', 'batch_plan_versions', 'enrollments',
                           'enrollment_changes', 'stipend_agreements', 'money_entries', 'track_entries', 'attendance',
                           'work_results', 'projects', 'project_members', 'project_tasks', 'document_templates', 'documents',
                           'document_acceptances', 'verification_scans'] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- Pattern helpers: "admin rw" = select/insert/update for admins, delete for owners.
do $$
declare t text;
begin
  foreach t in array array['leads', 'activities', 'students', 'batches', 'batch_plans', 'batch_plan_items', 'enrollments',
                           'stipend_agreements', 'money_entries', 'track_entries', 'attendance', 'work_results', 'projects',
                           'project_members', 'project_tasks', 'documents', 'courses', 'course_plans', 'plan_templates',
                           'plan_template_items', 'invitations'] loop
    execute format('create policy "%s: admin read" on public.%I for select to authenticated using (public.is_admin())', t, t);
    execute format('create policy "%s: admin insert" on public.%I for insert to authenticated with check (public.is_admin())', t, t);
    execute format('create policy "%s: admin update" on public.%I for update to authenticated using (public.is_admin()) with check (public.is_admin())', t, t);
    execute format('create policy "%s: owner delete" on public.%I for delete to authenticated using (public.is_owner())', t, t);
  end loop;
end $$;

-- Plan items and attendance/results are edited freely while drafting; admins may delete them.
create policy "batch_plan_items: admin delete" on public.batch_plan_items for delete to authenticated using (public.is_admin());
create policy "attendance: admin delete" on public.attendance for delete to authenticated using (public.is_admin());
create policy "work_results: admin delete" on public.work_results for delete to authenticated using (public.is_admin());
create policy "project_members: admin delete" on public.project_members for delete to authenticated using (public.is_admin());
create policy "project_tasks: admin delete" on public.project_tasks for delete to authenticated using (public.is_admin());
create policy "invitations: admin delete" on public.invitations for delete to authenticated using (public.is_admin());

-- ---------- Accounts and settings ----------
create policy "profiles: self read" on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy "profiles: admin read" on public.profiles for select to authenticated using (public.is_admin());
create policy "profiles: self update" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy "profiles: admin update" on public.profiles for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "org_settings: signed-in read" on public.org_settings for select to authenticated using (public.my_role() is not null);
create policy "org_settings: owner update" on public.org_settings for update to authenticated using (public.is_owner()) with check (public.is_owner());

create policy "numbering_schemes: admin read" on public.numbering_schemes for select to authenticated using (public.is_admin());
create policy "numbering_schemes: owner write" on public.numbering_schemes for all to authenticated using (public.is_owner()) with check (public.is_owner());
create policy "number_sequences: admin read" on public.number_sequences for select to authenticated using (public.is_admin());
create policy "signatories: admin read" on public.signatories for select to authenticated using (public.is_admin());
create policy "signatories: owner write" on public.signatories for all to authenticated using (public.is_owner()) with check (public.is_owner());
create policy "document_templates: admin read" on public.document_templates for select to authenticated using (public.is_admin());
create policy "document_templates: owner write" on public.document_templates for all to authenticated using (public.is_owner()) with check (public.is_owner());
create policy "audit_log: admin read" on public.audit_log for select to authenticated using (public.is_admin());
create policy "enrollment_changes: admin read" on public.enrollment_changes for select to authenticated using (public.is_admin());
create policy "batch_plan_versions: admin read" on public.batch_plan_versions for select to authenticated using (public.is_admin());
create policy "document_acceptances: admin read" on public.document_acceptances for select to authenticated using (public.is_admin());
create policy "verification_scans: admin read" on public.verification_scans for select to authenticated using (public.is_admin());

-- ---------- Student's own data ----------
create policy "students: self read" on public.students for select to authenticated using (id = public.my_student_id());
create policy "students: self update" on public.students for update to authenticated
  using (id = public.my_student_id()) with check (id = public.my_student_id());   -- columns limited by guard_students()
create policy "courses: student read active" on public.courses for select to authenticated using (active and public.my_student_id() is not null);
create policy "course_plans: student read active" on public.course_plans for select to authenticated using (active and public.my_student_id() is not null);
create policy "batches: student read own" on public.batches for select to authenticated using (public.is_my_batch(id));
create policy "batch_plans: student read own" on public.batch_plans for select to authenticated using (public.is_my_batch(batch_id));
create policy "batch_plan_versions: student read own" on public.batch_plan_versions for select to authenticated
  using (exists (select 1 from public.batch_plans bp where bp.id = batch_plan_id and public.is_my_batch(bp.batch_id)));
create policy "track_entries: student read own batch" on public.track_entries for select to authenticated
  using (deleted_at is null and public.is_my_batch(batch_id));
create policy "attendance: student read own" on public.attendance for select to authenticated using (public.is_my_enrollment(enrollment_id));
create policy "work_results: student read own" on public.work_results for select to authenticated using (public.is_my_enrollment(enrollment_id));
create policy "documents: student read own issued" on public.documents for select to authenticated
  using (student_id = public.my_student_id() and status <> 'draft');
create policy "document_acceptances: student read own" on public.document_acceptances for select to authenticated
  using (student_id = public.my_student_id());
-- enrollments, money_entries, stipend_agreements, projects: no student policy (students use v_my_enrollments; money is admin-only)
