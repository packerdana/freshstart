-- Add optional base parcels benchmark to routes
-- Carriers can use this to reference parcel volume deltas for 3996 reasons.

ALTER TABLE public.routes
ADD COLUMN IF NOT EXISTS base_parcels integer;

ALTER TABLE public.routes
DROP CONSTRAINT IF EXISTS routes_base_parcels_nonnegative;

ALTER TABLE public.routes
ADD CONSTRAINT routes_base_parcels_nonnegative CHECK (base_parcels IS NULL OR base_parcels >= 0);
