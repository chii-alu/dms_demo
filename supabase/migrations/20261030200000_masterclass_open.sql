-- Masterclass is an open intervention (MELA team catalogue). Corrects the live row, which was applied as selective.
update interventions set type = 'open' where pillar = 'HENT' and name = 'Masterclass';
