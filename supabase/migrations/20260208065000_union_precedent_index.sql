/*
  # Union precedent index (external links)

  Stores metadata + links to external grievance resources (e.g., From A to Arbitration).
  We DO NOT host or ingest the external PDFs/DOCX here.

  Security goals:
  - Authenticated users can read
  - No client-side writes (admin/service role only)
*/

begin;

create table if not exists public.union_precedent_index (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'fromatoarbitration',
  title text not null,
  article text,
  doc_type text not null default 'win',
  tags text[] not null default '{}'::text[],
  url text not null,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_union_precedent_article on public.union_precedent_index(article);
create index if not exists idx_union_precedent_doctype on public.union_precedent_index(doc_type);

alter table public.union_precedent_index enable row level security;

drop policy if exists "union_precedent_read_auth" on public.union_precedent_index;
drop policy if exists "union_precedent_insert_none" on public.union_precedent_index;
drop policy if exists "union_precedent_update_none" on public.union_precedent_index;
drop policy if exists "union_precedent_delete_none" on public.union_precedent_index;

create policy "union_precedent_read_auth"
on public.union_precedent_index
for select
to authenticated
using (true);

create policy "union_precedent_insert_none"
on public.union_precedent_index
for insert
to authenticated
with check (false);

create policy "union_precedent_update_none"
on public.union_precedent_index
for update
to authenticated
using (false);

create policy "union_precedent_delete_none"
on public.union_precedent_index
for delete
to authenticated
using (false);

-- Seed: small starter pack (high-impact, broad topics). Links point to the original files.
-- Note: This is intentionally a limited set to start; we can expand later.
insert into public.union_precedent_index (source, title, article, doc_type, tags, url, notes)
values
  (
    'fromatoarbitration',
    'HIPP Training (RFI / HERO file)',
    'Article 14',
    'resource',
    array['heat','safety','hipp','hero','training'],
    'https://fromatoarbitration.com/wp-content/uploads/2023/05/RFI-HERO-File.pdf',
    'Training/resource packet related to heat safety / HIPP.'
  ),
  (
    'fromatoarbitration',
    'Step B Heat Casefile',
    'Article 14',
    'win',
    array['heat','safety','step-b'],
    'https://fromatoarbitration.com/wp-content/uploads/2022/05/Step-B-Heat.pdf',
    'Example heat-related Step B file; useful for building similar grievances.'
  ),
  (
    'fromatoarbitration',
    'Step B Decision – HIPP',
    'Article 14',
    'win',
    array['hipp','heat','safety','step-b'],
    'https://fromatoarbitration.com/wp-content/uploads/2023/07/Step-B-Decision-HIPP.pdf',
    'Step B decision related to HIPP/heat training.'
  ),
  (
    'fromatoarbitration',
    'Mandatory Load Truck (Class Action) – Case File',
    'Article 19',
    'win',
    array['load-truck','scanner','m-41','case-file'],
    'https://fromatoarbitration.com/wp-content/uploads/2023/04/203-22-Class-Action-West-Case-File.pdf',
    'Case file re: mandatory load truck / instructions vs manuals.'
  ),
  (
    'fromatoarbitration',
    'Stationary Events – Email',
    'Article 19',
    'resource',
    array['stationary','scanner','m-41','email'],
    'https://fromatoarbitration.com/wp-content/uploads/2023/07/Stationary-Event-Email.pdf',
    'Reference email often cited in stationary event disputes.'
  ),
  (
    'fromatoarbitration',
    'One Hour Office Time – Contentions (Article 5/19/34)',
    'Article 34',
    'resource',
    array['one-hour-office','office-time','contentions'],
    'https://fromatoarbitration.com/wp-content/uploads/2024/02/One-Hour-Office-Time-Contentions.docx',
    'Contentions template for disputes involving a 1-hour office time instruction.'
  ),
  (
    'fromatoarbitration',
    'One Hour Office Time – Step B Decision',
    'Article 34',
    'win',
    array['one-hour-office','office-time','step-b'],
    'https://fromatoarbitration.com/wp-content/uploads/2022/12/Decision-1.pdf',
    'Step B decision tied to One Hour Office Time contentions/case file.'
  ),
  (
    'fromatoarbitration',
    'Package Delivery Instructions Inconsistent with Handbooks & Manuals (Class) – M-41 Parcels',
    'Article 19',
    'win',
    array['m-41','parcels','instructions','handbooks'],
    'https://fromatoarbitration.com/wp-content/uploads/2022/06/Class-M-41-Parcels-B4-00077-19.pdf',
    'Class grievance / decision material referencing M-41 parcel delivery instructions.'
  ),
  (
    'fromatoarbitration',
    'Taking Photos of Carriers (Article 19) – Green Hills',
    'Article 19',
    'win',
    array['privacy','photos','article-19'],
    'https://fromatoarbitration.com/wp-content/uploads/2024/09/Green-Hills-Article-19-B4-00349-21.pdf',
    'Example case about taking photos of carriers; Article 19/handbooks-manuals angle.'
  )

on conflict do nothing;

commit;
