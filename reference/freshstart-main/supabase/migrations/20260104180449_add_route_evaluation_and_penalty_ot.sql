/*
  # Add Route Evaluation and Penalty Overtime Fields

  ## Route Evaluation Fields

  1. New Columns in `routes` table
    - `evaluated_office_time` (numeric) - Official route evaluation office time in hours
    - `evaluated_street_time` (numeric) - Official route evaluation street time in hours
    - `evaluation_date` (date) - Date of the official route evaluation
    - `evaluation_notes` (text) - Notes from route evaluation

  ## Penalty Overtime Fields

  2. New Columns in `route_history` table
    - `penalty_overtime` (integer) - Penalty overtime minutes (work beyond 10 hours or 56 hours/week)
    - `is_ns_day` (boolean) - Whether this was a non-scheduled work day
    - `weekly_hours` (numeric) - Total hours worked in the workweek (for penalty calculation)

  ## Purpose

  - Track official route evaluations to compare actual vs. evaluated times
  - Implement 5-minute overburdened route threshold detection
  - Calculate penalty overtime (2.0x rate) separately from regular overtime (1.5x rate)
  - Support route protection documentation (M-39 Section 271g)
*/

ALTER TABLE routes
ADD COLUMN IF NOT EXISTS evaluated_office_time numeric,
ADD COLUMN IF NOT EXISTS evaluated_street_time numeric,
ADD COLUMN IF NOT EXISTS evaluation_date date,
ADD COLUMN IF NOT EXISTS evaluation_notes text;

ALTER TABLE route_history
ADD COLUMN IF NOT EXISTS penalty_overtime integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_ns_day boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS weekly_hours numeric DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_route_history_is_ns_day ON route_history(route_id, is_ns_day);
CREATE INDEX IF NOT EXISTS idx_route_history_date ON route_history(route_id, date);
CREATE INDEX IF NOT EXISTS idx_routes_evaluation_date ON routes(user_id, evaluation_date);
