-- Seed data for plan v2 (docs/19). Safe to re-run: inserts skip rows that already exist.
-- Prices, document wording and holidays are SAMPLES for the owner to confirm in Settings.

insert into public.org_settings (id, org_name, brand_name, address, llpin, website, contact_email, timezone,
                                 academic_year_start_month, holidays)
values (1, 'Quellflow Technologies LLP', 'Quellflow',
        '2/37, Bavali, Dhrangadhra, Surendranagar, Gujarat 363310', 'ADD-7356',
        'https://quellflow.com', 'contact@quellflow.com', 'Asia/Kolkata', 6, '["2026-12-25", "2027-01-26"]')
on conflict (id) do nothing;

-- Codes (DB-2). {AY} = academic year (2627), {SEQ:n} = running number per prefix.
insert into public.numbering_schemes (kind, pattern) values
  ('lead',                    'QF-{AY}-{SEQ:4}'),
  ('batch',                   '{TRACK}{DUR}-{YYMM}-{SEQ:1}'),
  ('doc:offer',               'QF-OFR-{AY}-{TRACK}-{SEQ:4}'),
  ('doc:tnc',                 'QF-TNC-{AY}-{TRACK}-{SEQ:4}'),
  ('doc:consent',             'QF-CNS-{AY}-{TRACK}-{SEQ:4}'),
  ('doc:joining',             'QF-JNL-{AY}-{TRACK}-{SEQ:4}'),
  ('doc:certificate',         'QF-CERT-{AY}-{TRACK}-{SEQ:4}'),
  ('doc:experience',          'QF-EXP-{AY}-{TRACK}-{SEQ:4}'),
  ('doc:lor',                 'QF-LOR-{AY}-{TRACK}-{SEQ:4}'),
  ('doc:project_certificate', 'QF-PRC-{AY}-{TRACK}-{SEQ:4}'),
  ('project:client',          'PRJ-CL-{SEQ:4}'),
  ('project:college',         'PRJ-CO-{SEQ:4}'),
  ('project:internal',        'PRJ-IN-{SEQ:4}')
on conflict (kind) do nothing;

insert into public.courses (code, name, active) values
  ('AA', 'AI Automation', true),
  ('FS', 'Full Stack Development', true),
  ('QA', 'Software Testing', true),
  ('ML', 'Machine Learning', true),
  ('DO', 'DevOps', false),
  ('DA', 'Data Analytics', false)
on conflict (code) do nothing;

-- Sample fees (owner to confirm)
insert into public.course_plans (course_id, duration_days, fee_inr, benefits)
select c.id, v.d, v.fee, v.benefits
from (values
  ('AA', 30, 4999,  array['Live sessions on weekdays', 'Recorded lessons', 'Mini project', 'Internship certificate']),
  ('AA', 60, 8999,  array['Everything in 30 days', 'Capstone project', 'Letter of recommendation on merit']),
  ('FS', 60, 8999,  array['Live sessions', 'Two projects', 'Internship certificate']),
  ('QA', 30, 3999,  array['Live sessions', 'Test plan project', 'Internship certificate']),
  ('ML', 90, 11999, array['Live sessions', 'Capstone project', 'Internship certificate'])
) as v(course, d, fee, benefits)
join public.courses c on c.code = v.course
on conflict (course_id, duration_days) do nothing;

-- Plan template: AI Automation, 30 days (21 working-day items)
insert into public.plan_templates (course_plan_id, version, active)
select p.id, 1, true from public.course_plans p join public.courses c on c.id = p.course_id
 where c.code = 'AA' and p.duration_days = 30
on conflict (course_plan_id, version) do nothing;

insert into public.plan_template_items (template_id, seq, week, day_offset, kind, title)
select t.id, v.seq, v.week, v.day_offset, v.kind::public.plan_kind, v.title
from (values
  (1, 1, 1, 'session', 'Kick-off and tools setup'),
  (2, 1, 2, 'session', 'Triggers, conditions and outputs'),
  (3, 1, 3, 'task', 'Route 10 sample enquiries'),
  (4, 1, 4, 'test', 'Quiz 1: workflow logic'),
  (5, 2, 5, 'session', 'HTTP, JSON and webhooks'),
  (6, 2, 6, 'session', 'Mapping and validation'),
  (7, 2, 7, 'task', 'Mock API workflow with error log'),
  (8, 2, 8, 'session', 'Error handling and retries'),
  (9, 2, 9, 'test', 'Quiz 2: APIs'),
  (10, 3, 10, 'session', 'Calling LLM APIs from a workflow'),
  (11, 3, 11, 'session', 'Structured output and evaluation'),
  (12, 3, 12, 'task', 'Classify 50 enquiries with AI'),
  (13, 3, 13, 'session', 'Prompt-injection and safety basics'),
  (14, 3, 14, 'milestone', 'Mini project demo'),
  (15, 4, 15, 'session', 'Deploy and monitor workflows'),
  (16, 4, 16, 'buffer', 'Doubt clearing'),
  (17, 4, 17, 'test', 'Final assessment'),
  (18, 4, 18, 'session', 'Portfolio and GitHub clean-up'),
  (19, 4, 19, 'milestone', 'Capstone demo day'),
  (20, 4, 20, 'session', 'Career guidance and feedback'),
  (21, 4, 21, 'milestone', 'Results and certificates')
) as v(seq, week, day_offset, kind, title)
cross join (select t.id from public.plan_templates t join public.course_plans p on p.id = t.course_plan_id
              join public.courses c on c.id = p.course_id where c.code = 'AA' and p.duration_days = 30 and t.active) t
on conflict (template_id, seq) do nothing;

-- Document templates: placeholder wording until the owner (and CA/lawyer) approves the final text.
insert into public.document_templates (type, version, title, body, requires_acceptance)
values
  ('offer', 1, 'Offer letter',
   'Dear {name},\n\nWe are pleased to offer you a place in {programme}, batch {batch}, from {start_date} to {end_date} as a {student_type} intern.\n\n[Wording pending owner approval]', true),
  ('tnc', 1, 'Terms and conditions for interns',
   '1. Programme: {programme}, batch {batch}.\n2. Attendance: at least {min_attendance}% for the certificate.\n\n[Wording pending owner approval]', true),
  ('consent', 1, 'Consent (data, photos, confidentiality)',
   'I, {name}, agree to the use of my data for this programme and to keep client information confidential.\n\n[Wording pending owner approval]', true),
  ('joining', 1, 'Joining letter', 'This is to confirm that {name} has joined {programme} on {start_date}.\n\n[Wording pending owner approval]', false),
  ('certificate', 1, 'Internship certificate', 'This is to certify that {name} completed {programme} from {start_date} to {end_date}. Result: {result}.\n\n[Wording pending owner approval]', false),
  ('experience', 1, 'Experience letter', '{name} worked on {project} from {start_date} to {end_date}.\n\n[Wording pending owner approval]', false),
  ('lor', 1, 'Letter of recommendation', '{body}\n\n[Wording pending owner approval]', false),
  ('project_certificate', 1, 'Project completion certificate', 'This is to certify that {name} completed the project {project}.\n\n[Wording pending owner approval]', false)
on conflict (type, version) do nothing;
