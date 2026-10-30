-- Intervention catalogue for a fresh database. Same content as the 20261030190000 migration.
insert into interventions (pillar, name, type) values
  ('HENT', 'Ventures', 'open'),
  ('HENT', 'Venture Funding', 'selective'),
  ('HENT', 'Masterclass', 'open'),
  ('HENT', 'Hackathon', 'selective'),
  ('HENT', 'Mentorship', 'selective'),
  ('HENT', 'Exposure & Networking', 'selective'),
  ('HENT', 'Study Trips', 'open'),
  ('HEMP', 'Career Workshops', 'open'),
  ('HEMP', 'Exposure Events', 'open'),
  ('HEMP', 'Internships', 'selective'),
  ('HEMP', 'SIE', 'selective'),
  ('HEMP', 'Courses', 'open'),
  ('HECO', 'Public Sector Fellowship', 'selective'),
  ('HECO', 'Health Expert in Residence Programme', 'open'),
  ('HECO', 'Research Activities', 'selective'),
  ('HECO', 'Public Sector Innovation Hackathon', 'selective'),
  ('HECO', 'Executive Courses', 'open')
on conflict (pillar, name) do update set type = excluded.type, active = true;
