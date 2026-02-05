/*
  # Add assistance_minutes to route_history

  Tracks minutes of auxiliary assistance / route given away.
  Used to keep "clean" history separate from assisted days.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'route_history' AND column_name = 'assistance_minutes'
  ) THEN
    ALTER TABLE route_history ADD COLUMN assistance_minutes integer;
  END IF;
END $$;
