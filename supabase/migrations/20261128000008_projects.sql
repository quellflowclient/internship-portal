-- =====================================================================
-- Step F · Projects (docs/19 §2.9, §6 "Project", §7 row "Projects").
-- Codes come from the database (next_code('project:<kind>')), never from the client.
-- State machine: planned → active → completed | on_hold | cancelled ; on_hold → active ;
--                reopen: completed → active, cancelled → planned ; archived flag (archived_at) with Undo.
-- =====================================================================

-- Numbering kinds (seed.sql has them too; both skip rows that exist).
insert into public.numbering_schemes (kind, pattern) values
  ('project:client',   'PRJ-CL-{SEQ:4}'),
  ('project:college',  'PRJ-CO-{SEQ:4}'),
  ('project:internal', 'PRJ-IN-{SEQ:4}')
on conflict (kind) do nothing;

-- ---------- Guard: code from the sequence, kind and code fixed, status moves, archived = read-only ----------
create or replace function public.guard_projects() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if new.code is null or btrim(new.code) = '' then
      new.code := public.next_code('project:' || new.kind::text);
    end if;
    if new.status not in ('planned', 'active') then
      raise exception 'A new project starts as planned or active';
    end if;
    new.archived_at := null;
    return new;
  end if;

  if new.code <> old.code then raise exception 'The project code cannot change'; end if;
  if new.kind <> old.kind then raise exception 'The project kind cannot change. Create a new project instead.'; end if;
  if old.archived_at is not null and new.archived_at is not null then
    raise exception 'This project is archived. Restore it before changing it.';
  end if;
  if new.status <> old.status and not (
       (old.status = 'planned'   and new.status in ('active', 'cancelled'))
    or (old.status = 'active'    and new.status in ('completed', 'on_hold', 'cancelled'))
    or (old.status = 'on_hold'   and new.status in ('active', 'cancelled'))
    or (old.status = 'completed' and new.status = 'active')
    or (old.status = 'cancelled' and new.status = 'planned')) then
    raise exception 'A project cannot go from % to %', old.status, new.status;
  end if;
  return new;
end $$;

create trigger projects_guard before insert or update on public.projects
  for each row execute function public.guard_projects();

-- Members and tasks of an archived project are read-only too (removing stays possible only after a restore).
create or replace function public.guard_project_children() returns trigger
language plpgsql security definer set search_path = public as $$
declare pid uuid := case when tg_op = 'DELETE' then old.project_id else new.project_id end;
begin
  if exists (select 1 from public.projects where id = pid and archived_at is not null) then
    raise exception 'This project is archived. Restore it before changing it.';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;

create trigger project_members_archived before insert or update or delete on public.project_members
  for each row execute function public.guard_project_children();
create trigger project_tasks_archived before insert or update or delete on public.project_tasks
  for each row execute function public.guard_project_children();

-- A task assignee must be a member of the project.
create or replace function public.guard_project_tasks() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.assignee_student_id is not null and not exists (
      select 1 from public.project_members m where m.project_id = new.project_id and m.student_id = new.assignee_student_id) then
    raise exception 'The assignee must be a member of this project';
  end if;
  return new;
end $$;

create trigger project_tasks_guard before insert or update on public.project_tasks
  for each row execute function public.guard_project_tasks();

-- Removing a member clears their task assignments (the tasks stay).
create or replace function public.unassign_removed_member() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.project_tasks set assignee_student_id = null
   where project_id = old.project_id and assignee_student_id = old.student_id;
  return old;
end $$;

create trigger project_members_unassign before delete on public.project_members
  for each row execute function public.unassign_removed_member();

-- Audit tasks as well (projects and members are audited since 20261128000003).
create trigger audit_project_tasks after insert or update or delete on public.project_tasks
  for each row execute function public.audit_row();

create index if not exists projects_batch_idx on public.projects (batch_id);
create index if not exists project_members_student_idx on public.project_members (student_id);
create index if not exists project_tasks_project_idx on public.project_tasks (project_id);

-- ---------- Admin list view (counts for the Projects list and the batch Projects tab) ----------
create view public.v_project_list with (security_invoker = true) as
select p.id, p.code, p.name, p.kind, p.status, p.batch_id, b.code as batch_code,
       p.start_date, p.due_date, p.submission_due, p.report_status, p.college_name, p.github_url,
       p.archived_at, p.created_at,
       case when p.kind = 'college' then coalesce(p.submission_due, p.due_date) else p.due_date end as due_on,
       (p.kind = 'college' and p.status <> 'cancelled'
        and coalesce(p.report_status::text, 'not_started') in ('not_started', 'draft', 'reviewed')) as report_pending,
       (select count(*)::int from public.project_members m where m.project_id = p.id) as members,
       (select string_agg(s.full_name, ', ' order by s.full_name)
          from public.project_members m join public.students s on s.id = m.student_id
         where m.project_id = p.id) as member_names,
       (select count(*)::int from public.project_tasks t where t.project_id = p.id) as tasks_total,
       (select count(*)::int from public.project_tasks t where t.project_id = p.id and t.status = 'done') as tasks_done
  from public.projects p left join public.batches b on b.id = p.batch_id;

grant select on public.v_project_list to authenticated;
