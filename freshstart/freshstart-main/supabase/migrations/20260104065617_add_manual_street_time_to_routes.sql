/*
  # Add Manual Street Time Override to Routes

  1. Changes
    - Add `manual_street_time` column to `routes` table
      - Stores the user's manual estimate of street time in minutes
      - Used for predictions when historical data is insufficient
      - Optional field (can be NULL)
      - Default value is NULL

  2. Purpose
    - Allows users to provide an estimated street time when first setting up a route
    - App will use this value for return time predictions until sufficient historical data is collected
    - Improves user experience for new routes
*/

-- Add manual_street_time column to routes table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'routes' AND column_name = 'manual_street_time'
  ) THEN
    ALTER TABLE routes ADD COLUMN manual_street_time integer;
  END IF;
END $$;

-- Add comment to document the column
COMMENT ON COLUMN routes.manual_street_time IS 'Manual street time override in minutes. Used for predictions when historical data is insufficient.';