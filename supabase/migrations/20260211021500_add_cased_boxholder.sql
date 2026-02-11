-- Cased boxholder support (credit route stops into letters/flats piece counts)

alter table public.route_history
  add column if not exists cased_boxholder boolean not null default false,
  add column if not exists cased_boxholder_type text;

-- Optional sanity constraint (allows null when not cased)
-- Values: 'letters' | 'flats'
