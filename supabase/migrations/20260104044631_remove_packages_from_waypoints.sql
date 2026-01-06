/*
  # Remove packages column from waypoints table

  1. Changes
    - Drop the `packages` column from the `waypoints` table
    - Packages are not part of waypoint tracking logic
    
  2. Notes
    - This change removes package counting from individual waypoints
    - Waypoints are now focused on location and delivery status only
*/

-- Remove packages column from waypoints table
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'waypoints' AND column_name = 'packages'
  ) THEN
    ALTER TABLE waypoints DROP COLUMN packages;
  END IF;
END $$;