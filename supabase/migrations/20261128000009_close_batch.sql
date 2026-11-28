-- =====================================================================
-- Step F – Batch → Close → Archive batch (docs/19 §6 Batch/Student state machines, P7 step 4).
-- close_batch(): running → completed once every enrolment has a result; students with no other
-- open enrolment become alumni. reopen_batch(): Undo within 2 minutes (same window as documents).
-- Audit rows come from the existing audit_row() triggers on batches and students; the student
-- timelines get a 'system' activity, as assign_student() does.
-- =====================================================================

alter table public.batches add column closed_at timestamptz;

-- Only close_batch()/reopen_batch() (security definer) may move a batch into or out of completed.
create or replace function public.guard_batch_close() returns trigger
language plpgsql set search_path = public as $$
begin
  if current_user in ('authenticated', 'anon')
     and ((new.status = 'completed') is distinct from (old.status = 'completed')
          or new.closed_at is distinct from old.closed_at) then
    raise exception 'Use Archive batch on the Close tab to close a batch';
  end if;
  return new;
end $$;
create trigger batches_close_guard before update on public.batches
  for each row execute function public.guard_batch_close();

create or replace function public.close_batch(p_batch uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare b public.batches; n_assigned int; n_active int; n_alumni int; s record;
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  select * into b from public.batches where id = p_batch for update;
  if not found then raise exception 'Batch not found'; end if;
  if b.status = 'completed' then raise exception 'This batch is already closed'; end if;
  if b.status <> 'running' then raise exception 'Only a running batch can be closed (this one is %)', b.status; end if;

  select count(*) filter (where status = 'assigned'), count(*) filter (where status = 'active')
    into n_assigned, n_active
    from public.enrollments where batch_id = p_batch;
  if n_assigned + n_active > 0 then
    raise exception '% still open (% assigned, % active). Set each result first.',
      case when n_assigned + n_active = 1 then '1 enrolment is' else (n_assigned + n_active) || ' enrolments are' end,
      n_assigned, n_active;
  end if;

  update public.batches set status = 'completed', closed_at = now(), updated_at = now() where id = p_batch;

  n_alumni := 0;
  for s in
    select st.id as student_id, e.id as enrollment_id
      from public.enrollments e join public.students st on st.id = e.student_id
     where e.batch_id = p_batch and e.status in ('completed', 'not_completed') and st.state = 'active'
       and not exists (select 1 from public.enrollments o
                        where o.student_id = st.id and o.id <> e.id and o.status in ('assigned', 'active'))
     order by st.id
  loop
    update public.students set state = 'alumni', updated_at = now() where id = s.student_id and state = 'active';
    if found then
      n_alumni := n_alumni + 1;
      insert into public.activities (student_id, enrollment_id, kind, summary, outcome)
      values (s.student_id, s.enrollment_id, 'system', 'Batch ' || b.code || ' closed. Moved to alumni.', 'alumni');
    end if;
  end loop;

  return jsonb_build_object('code', b.code, 'alumni', n_alumni);
end $$;

-- Undo for close_batch(): completed → running within 2 minutes; students it moved to alumni become active again.
create or replace function public.reopen_batch(p_batch uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare b public.batches; n int;
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  select * into b from public.batches where id = p_batch for update;
  if not found then raise exception 'Batch not found'; end if;
  if b.status <> 'completed' then raise exception 'This batch is not closed'; end if;
  if b.closed_at is null or b.closed_at <= now() - interval '2 minutes' then
    raise exception 'Undo is possible only within 2 minutes of closing';
  end if;

  update public.students st set state = 'active', updated_at = now()
   where st.state = 'alumni'
     and exists (select 1 from public.activities a join public.enrollments e on e.id = a.enrollment_id
                  where a.student_id = st.id and e.batch_id = p_batch and a.kind = 'system'
                    and a.outcome = 'alumni' and a.occurred_at >= b.closed_at);
  get diagnostics n = row_count;
  update public.batches set status = 'running', closed_at = null, updated_at = now() where id = p_batch;
  insert into public.activities (student_id, enrollment_id, kind, summary)
  select e.student_id, e.id, 'system', 'Closing of batch ' || b.code || ' undone.'
    from public.enrollments e
   where e.batch_id = p_batch
     and exists (select 1 from public.activities a where a.enrollment_id = e.id and a.outcome = 'alumni'
                  and a.occurred_at >= b.closed_at);
  return jsonb_build_object('code', b.code, 'reactivated', n);
end $$;

revoke all on function public.close_batch(uuid), public.reopen_batch(uuid) from public, anon;
grant execute on function public.close_batch(uuid), public.reopen_batch(uuid) to authenticated;
grant execute on function public.close_batch(uuid), public.reopen_batch(uuid) to service_role;
