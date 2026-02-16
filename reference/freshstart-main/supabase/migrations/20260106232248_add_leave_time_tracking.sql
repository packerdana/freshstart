/*
  # Add Leave Time Tracking to Route History

  1. Changes
    - Add `predicted_leave_time` column to `route_history` table (text, HH:MM format)
    - Add `actual_leave_time` column to `route_history` table (text, HH:MM format)
    - Add `predicted_office_time` column to `route_history` table (integer, minutes)
    - Add `actual_office_time` column to `route_history` table (integer, minutes)

  2. Purpose
    - Track predicted vs actual leave times for casing performance analysis
    - Enable historical comparison of office time predictions
    - Support casing stats feature on Stats page

  3. Notes
    - These fields are optional (nullable) for backward compatibility
    - Times are stored in HH:MM format (e.g., "09:45")
    - Office times are stored in minutes for calculations
*/

-- Add predicted_leave_time to route_history
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'route_history' AND column_name = 'predicted_leave_time'
  ) THEN
    ALTER TABLE route_history ADD COLUMN predicted_leave_time text;
  END IF;
END $$;

-- Add actual_leave_time to route_history
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'route_history' AND column_name = 'actual_leave_time'
  ) THEN
    ALTER TABLE route_history ADD COLUMN actual_leave_time text;
  END IF;
END $$;

-- Add predicted_office_time to route_history
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'route_history' AND column_name = 'predicted_office_time'
  ) THEN
    ALTER TABLE route_history ADD COLUMN predicted_office_time integer;
  END IF;
END $$;

-- Add actual_office_time to route_history
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'route_history' AND column_name = 'actual_office_time'
  ) THEN
    ALTER TABLE route_history ADD COLUMN actual_office_time integer;
  END IF;
END $$;
