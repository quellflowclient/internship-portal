-- Seed data: catalogue + default settings. Safe to re-run (upserts).
-- Owner reviews numbering formats and academic year later in Admin → Settings (D-20).

insert into public.org_settings (id, org_name, brand_name, address, llpin, website, contact_email, timezone, academic_year_start_month)
values (1, 'Quellflow Technologies LLP', 'Quellflow',
        '2/37, Bavali, Dhrangadhra, Surendranagar, Gujarat 363310', 'ADD-7356',
        'https://quellflow.com', 'contact@quellflow.com', 'Asia/Kolkata', 6)
on conflict (id) do nothing;

insert into public.roles_catalog (code, name, track_group, is_launch_track, form_label, sort) values
  ('AA', 'AI Automation',                  'AI & Automation',      true,  'AI Automation Developer',                         10),
  ('GA', 'GenAI',                          'AI & Automation',      true,  null,                                              20),
  ('ML', 'AI / ML',                        'AI & Automation',      true,  'AI/ML Developer',                                 30),
  ('FS', 'Full Stack Development',         'Software Development', true,  'Full Stack Developer',                            40),
  ('SE', 'SEO',                            'Growth',               true,  null,                                              50),
  ('QA', 'QA / Software Testing',          'Quality Assurance',    true,  'QA / Software Tester',                            60),
  ('DO', 'DevOps',                         'Software Development', true,  null,                                              70),
  ('BE', 'Backend Development',            'Software Development', false, 'Backend Developer',                               80),
  ('FE', 'Frontend Development',           'Software Development', false, 'Frontend Developer',                              90),
  ('MA', 'Mobile App Development',         'Software Development', false, 'Mobile App Developer',                           100),
  ('UX', 'UI/UX Design',                   'Design',               false, 'UI/UX Designer',                                 110),
  ('GD', 'Graphic Design',                 'Design',               false, 'Graphic Designer',                               120),
  ('3D', '3D Development / Design',        'Design',               false, '3D Developer / Designer',                        130),
  ('DA', 'Data Analytics / Data Science',  'Data',                 false, 'Data Analyst / Data Scientist',                  140),
  ('BD', 'Technical Business Development', 'Business',             false, 'Technical Business Development Associate (BDA)', 150),
  ('RD', 'Technical Research & Development','R&D',                 false, 'Technical Research & Development',               160)
on conflict (code) do update set
  name = excluded.name, track_group = excluded.track_group,
  is_launch_track = excluded.is_launch_track, form_label = excluded.form_label, sort = excluded.sort;

-- Default numbering (docs/08). Only inserted if no active scheme exists for the type.
insert into public.numbering_schemes (doc_type, pattern)
select v.doc_type::public.document_type, v.pattern
from (values
  ('offer_letter',           'QF/OFR/{AY}/{SEQ:4}'),
  ('agreement',              'QF/AGR/{AY}/{SEQ:4}'),
  ('enrollment_letter',      'QF/ENR/{AY}/{SEQ:4}'),
  ('invoice',                'QF/INV/{AY}/{SEQ:4}'),
  ('certificate_completion', 'QF-C-{AY}-{ROLE}-{SEQ:4}'),
  ('certificate_excellence', 'QF-E-{AY}-{ROLE}-{SEQ:4}'),
  ('certificate_project',    'QF-P-{AY}-{ROLE}-{SEQ:4}'),
  ('experience_letter',      'QF/EXP/{AY}/{SEQ:4}'),
  ('relieving_letter',       'QF/REL/{AY}/{SEQ:4}'),
  ('lor',                    'QF/LOR/{AY}/{SEQ:4}'),
  ('grade_report',           'QF/GRD/{AY}/{SEQ:4}')
) as v(doc_type, pattern)
where not exists (select 1 from public.numbering_schemes n where n.doc_type = v.doc_type::public.document_type and n.is_active);
