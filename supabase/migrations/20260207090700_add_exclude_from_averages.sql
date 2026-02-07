/*
  # Add exclude_from_averages to route_history

  Allows users to flag a day as "bad data" so it doesn't affect averages/predictions.
*/

ALTER TABLE route_history
ADD COLUMN IF NOT EXISTS exclude_from_averages boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_route_history_exclude ON route_history(route_id, exclude_from_averages, date DESC);
