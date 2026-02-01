/*
  # Remove Office 722 Timer Table

  This migration removes the office_722_sessions table that was used for manual 722 timer tracking.
  The system now automatically calculates 722 office time based on the user's official start time
  and when they begin their street route.

  1. Changes
    - Drop `office_722_sessions` table and all associated data
  
  2. Important Notes
    - This removes the manual timer functionality
    - 722 time will now be automatically calculated
    - No data backup is needed as this was a temporary implementation
*/

DROP TABLE IF EXISTS office_722_sessions CASCADE;
