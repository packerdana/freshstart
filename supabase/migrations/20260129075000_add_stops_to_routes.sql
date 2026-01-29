-- Add optional number of stops to routes

ALTER TABLE public.routes
ADD COLUMN IF NOT EXISTS stops integer;

-- Optional: keep it non-negative when provided
ALTER TABLE public.routes
DROP CONSTRAINT IF EXISTS routes_stops_nonnegative;

ALTER TABLE public.routes
ADD CONSTRAINT routes_stops_nonnegative CHECK (stops IS NULL OR stops >= 0);
