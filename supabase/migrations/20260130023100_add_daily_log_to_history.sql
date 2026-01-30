/*
  # Add daily log JSON for carrier conditions

  RouteWise Daily Log captures day conditions that affect performance/predictions
  (late mail, parcel delays, casing interruptions, waiting, etc.).

  Stored as jsonb to keep schema flexible.
*/

ALTER TABLE route_history
ADD COLUMN IF NOT EXISTS daily_log jsonb;
