/*
  # Add Waypoint Timing Data to Route History

  ## Changes
  1. Schema Updates
    - Add `waypoint_timings` JSONB column to `route_history` table
      - Stores array of waypoint completions with timing data
      - Format: [{ id, name, order, completedAt, elapsedMinutes }]
    - Add index on `waypoint_timings` for efficient queries
  
  ## Purpose
  - Enable historical waypoint timing analysis
  - Support waypoint-based predictions
  - Track real-time progress against predicted waypoint times
  - Build timing patterns for both default checkpoints and user-added waypoints
  
  ## Notes
  - Uses JSONB for flexible waypoint data storage
  - Supports both default checkpoints (Leaving PO, 1st Stop, etc.) and user-added waypoints
  - Data structure allows for future enhancements without schema changes
*/

-- Add waypoint_timings column to route_history
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'route_history' AND column_name = 'waypoint_timings'
  ) THEN
    ALTER TABLE route_history 
    ADD COLUMN waypoint_timings JSONB DEFAULT '[]'::jsonb;
  END IF;
END $$;

-- Create index for efficient waypoint timing queries
CREATE INDEX IF NOT EXISTS idx_route_history_waypoint_timings 
ON route_history USING gin(waypoint_timings);