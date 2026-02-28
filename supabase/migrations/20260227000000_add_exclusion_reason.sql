/*
  # Add exclusion_reason to route_history

  Allows users to specify WHY a day was excluded from averages.
  Helps with historical context and understanding patterns.
*/

ALTER TABLE route_history
ADD COLUMN IF NOT EXISTS exclusion_reason text DEFAULT NULL;

-- Optional: Add a comment explaining the valid values
COMMENT ON COLUMN route_history.exclusion_reason IS 
'Reason for excluding day from averages. Valid values: "maintenance", "unusual_conditions", "sick", "different_mail_volume", "other", or NULL if not excluded.';
