-- Intervention catalogue as agreed with the MELA team (17 interventions, types as given).
-- Re-runnable: updates types and reactivates listed interventions, then deactivates any not in the list.
-- Deactivated rows are kept so existing sessions still link to them (sidebar shows active rows only).

insert into interventions (pillar, name, type, active) values
  ('HENT', 'Ventures', 'open', true),
  ('HENT', 'Venture Funding', 'selective', true),
  ('HENT', 'Masterclass', 'open', true),
  ('HENT', 'Hackathon', 'selective', true),
  ('HENT', 'Mentorship', 'selective', true),
  ('HENT', 'Exposure & Networking', 'selective', true),
  ('HENT', 'Study Trips', 'open', true),
  ('HEMP', 'Career Workshops', 'open', true),
  ('HEMP', 'Exposure Events', 'open', true),
  ('HEMP', 'Internships', 'selective', true),
  ('HEMP', 'SIE', 'selective', true),
  ('HEMP', 'Courses', 'open', true),
  ('HECO', 'Public Sector Fellowship', 'selective', true),
  ('HECO', 'Health Expert in Residence Programme', 'open', true),
  ('HECO', 'Research Activities', 'selective', true),
  ('HECO', 'Public Sector Innovation Hackathon', 'selective', true),
  ('HECO', 'Executive Courses', 'open', true)
on conflict (pillar, name) do update set
  type = excluded.type,
  active = true;

update interventions i
   set active = false
 where not exists (
   select 1 from (values
     ('HENT', 'Ventures'), ('HENT', 'Venture Funding'), ('HENT', 'Masterclass'), ('HENT', 'Hackathon'),
     ('HENT', 'Mentorship'), ('HENT', 'Exposure & Networking'), ('HENT', 'Study Trips'),
     ('HEMP', 'Career Workshops'), ('HEMP', 'Exposure Events'), ('HEMP', 'Internships'), ('HEMP', 'SIE'), ('HEMP', 'Courses'),
     ('HECO', 'Public Sector Fellowship'), ('HECO', 'Health Expert in Residence Programme'), ('HECO', 'Research Activities'),
     ('HECO', 'Public Sector Innovation Hackathon'), ('HECO', 'Executive Courses')
   ) as keep(pillar, name)
   where keep.pillar = i.pillar::text and keep.name = i.name
 );
