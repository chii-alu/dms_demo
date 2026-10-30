-- Legacy import (AHC consolidated sheet): staging tables. These hold personal data, so admin only.
-- The original file is kept in a private Storage bucket; every row is parsed into legacy_import_rows
-- so cleaning and the dry run work from the database.

create table legacy_import_batches (
  id uuid primary key default gen_random_uuid(),
  source_file_name text not null,
  storage_path text,
  file_sha256 text not null,
  row_count int not null default 0,
  status text not null default 'staged' check (status in ('staged', 'dry_run_ok', 'imported', 'failed')),
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

create table legacy_import_rows (
  batch_id uuid not null references legacy_import_batches (id) on delete cascade,
  row_no int not null,
  raw jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'imported', 'rejected', 'duplicate_review')),
  issue text,
  chii_id text references beneficiary (chii_id),
  primary key (batch_id, row_no)
);

alter table legacy_import_batches enable row level security;
alter table legacy_import_rows enable row level security;

create policy legacy_import_batches_admin on legacy_import_batches for all
  using (public.is_admin()) with check (public.is_admin());
create policy legacy_import_rows_admin on legacy_import_rows for all
  using (public.is_admin()) with check (public.is_admin());

revoke all on legacy_import_batches, legacy_import_rows from anon;
