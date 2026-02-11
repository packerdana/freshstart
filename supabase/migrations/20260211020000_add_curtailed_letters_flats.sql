-- Add per-day curtailed volumes (in feet) so carriers can subtract mail that didn't go.
-- These are used in office-time casing math (feet -> pieces) and should persist for Fix-a-Day.

alter table public.route_history
  add column if not exists curtailed_letters double precision not null default 0,
  add column if not exists curtailed_flats double precision not null default 0;
