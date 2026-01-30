/*
  # Add casing/withdrawal minutes for % to Standard

  DOIS % to Standard is based on time to CASE + WITHDRAW mail.
  RouteWise stores 722 office_time, which includes other tasks.
  This column allows users to record casing+withdrawal minutes separately.
*/

ALTER TABLE route_history
ADD COLUMN IF NOT EXISTS casing_withdrawal_minutes integer;

CREATE INDEX IF NOT EXISTS idx_route_history_casing_withdrawal
  ON route_history(route_id, date DESC);
