-- =====================================================================
-- Step F – student app (docs/19 §4, §10 "Student app").
-- get_my_plan(enrollment): the latest PUBLISHED plan version of the
-- student's own batch, with done / skipped marks and the student's own
-- attendance per item. Needed because students cannot read
-- batch_plan_items (skipped marks) and should not depend on the public
-- share link being on. Never returns other students' data or money.
-- Profile edits need no new function: guard_students() already lets a
-- student change phone, city, github_url and linkedin_url (RLS "students:
-- self update"), and the student app edits only those.
-- =====================================================================

create or replace function public.get_my_plan(p_enrollment uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r record; v public.batch_plan_versions; items jsonb;
begin
  if p_enrollment is null or not public.is_my_enrollment(p_enrollment) then return null; end if;
  select e.id, b.code, b.start_date, b.end_date, b.session_time, b.schedule_days,
         bp.id as plan_id, coalesce(bp.published_version, 0) as published_version,
         coalesce(bp.show_done_marks, true) as show_done_marks,
         c.name as course_name, p.duration_days
    into r
    from public.enrollments e
    join public.batches b on b.id = e.batch_id
    join public.course_plans p on p.id = b.course_plan_id
    join public.courses c on c.id = p.course_id
    left join public.batch_plans bp on bp.batch_id = b.id
   where e.id = p_enrollment
     and e.status in ('assigned', 'active', 'completed', 'not_completed');
  if not found then return null; end if;

  if r.published_version > 0 then
    select * into v from public.batch_plan_versions where batch_plan_id = r.plan_id and version = r.published_version;
    select jsonb_agg(x.it - 'id' || jsonb_build_object(
             'done', r.show_done_marks and exists (select 1 from public.track_entries t
                                                    where t.plan_item_id = (x.it ->> 'id')::uuid and t.deleted_at is null),
             'skipped', exists (select 1 from public.batch_plan_items i
                                 where i.id = (x.it ->> 'id')::uuid and i.skipped_at is not null),
             -- this student's own mark for the latest logged delivery of the item (null = not marked)
             'attendance', (select a.mark from public.attendance a
                              join public.track_entries t on t.id = a.track_entry_id and t.deleted_at is null
                             where t.plan_item_id = (x.it ->> 'id')::uuid and a.enrollment_id = p_enrollment
                             order by t.held_on desc, t.created_at desc limit 1))
           order by x.ord)
      into items
      from jsonb_array_elements(v.items) with ordinality as x(it, ord);
  end if;

  return jsonb_build_object(
    'batch', r.code, 'course', r.course_name, 'duration_days', r.duration_days,
    'start_date', r.start_date, 'end_date', r.end_date, 'session_time', r.session_time, 'schedule_days', r.schedule_days,
    'version', case when r.published_version > 0 then v.version end,
    'published_at', v.published_at, 'change_note', v.change_note,
    'items', coalesce(items, '[]'::jsonb));
end $$;

revoke all on function public.get_my_plan(uuid) from public, anon;
grant execute on function public.get_my_plan(uuid) to authenticated, service_role;
