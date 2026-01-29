-- Add route type to routes (mounted/walking/mixed)

ALTER TABLE public.routes
ADD COLUMN IF NOT EXISTS route_type text NOT NULL DEFAULT 'mixed';

ALTER TABLE public.routes
DROP CONSTRAINT IF EXISTS routes_route_type_valid;

ALTER TABLE public.routes
ADD CONSTRAINT routes_route_type_valid CHECK (route_type IN ('mounted','walking','mixed'));
