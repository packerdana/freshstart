/*
  # Add predicted return + actual clock-out to route_history

  Enables Stats screen chart: predicted vs actual time.

  - predicted_return_time: text (HH:MM)
  - actual_clock_out: text (HH:MM)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'route_history' AND column_name = 'predicted_return_time'
  ) THEN
    ALTER TABLE route_history ADD COLUMN predicted_return_time text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'route_history' AND column_name = 'actual_clock_out'
  ) THEN
    ALTER TABLE route_history ADD COLUMN actual_clock_out text;
  END IF;
END $$;
