/*
  # Fix Decimal Mail Volume Support

  1. Changes
    - Change `flats` column from integer to numeric to support decimal values (e.g., 2.5 feet)
    - Change `letters` column from integer to numeric to support decimal values
    - These fields represent feet of mail, which can be fractional

  2. Reason
    - Users enter flats and letters in feet, which can be decimal values
    - App UI allows decimal input but database rejected it with integer columns
    - This fixes the "invalid input syntax for type integer: '2.5'" error
*/

-- Change flats from integer to numeric
ALTER TABLE route_history 
ALTER COLUMN flats TYPE numeric USING flats::numeric;

-- Change letters from integer to numeric  
ALTER TABLE route_history 
ALTER COLUMN letters TYPE numeric USING letters::numeric;

-- Update default values to work with numeric
ALTER TABLE route_history 
ALTER COLUMN flats SET DEFAULT 0;

ALTER TABLE route_history 
ALTER COLUMN letters SET DEFAULT 0;
