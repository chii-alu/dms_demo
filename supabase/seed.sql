-- Interventions and their current types (SPEC §6). Types are the MELA team's
-- working assumption and are editable in the app. Runs on `supabase db reset`.
insert into interventions (pillar, name, type) values
  ('HENT', 'Ventures', 'selective'),
  ('HENT', 'Venture Funding', 'selective'),
  ('HENT', 'Masterclass', 'open'),
  ('HENT', 'Hackathon', 'selective'),
  ('HENT', 'Mentorship', 'selective'),
  ('HENT', 'Exposure & Networking', 'open'),
  ('HEMP', 'Career Workshops', 'open'),
  ('HEMP', 'Exposure Events', 'open'),
  ('HEMP', 'Internships', 'selective'),
  ('HEMP', 'SIE', 'selective'),
  ('HEMP', 'Courses', 'open'),
  ('HECO', 'At a Glance', 'open'),
  ('HECO', 'Public Sector Fellowship', 'selective'),
  ('HECO', 'Health Expert in Residence Programme', 'selective'),
  ('HECO', 'Research Activities', 'open'),
  ('HECO', 'Public Sector Innovation Hackathon', 'selective'),
  ('HECO', 'Executive Courses', 'selective'),
  ('HECO', 'Impact Stories', 'open')
on conflict (pillar, name) do nothing;
