-- Database constraints to prevent unrealistic data entry
-- These limits are carrier-realistic based on USPS standards

-- PM Office (744) should never exceed 1 hour
ALTER TABLE route_history
ADD CONSTRAINT check_pm_office_max_60 
  CHECK (pm_office_time IS NULL OR (pm_office_time >= 0 AND pm_office_time <= 60));

-- Street time (721) should never exceed 12 hours
ALTER TABLE route_history
ADD CONSTRAINT check_street_time_max_720 
  CHECK (street_time IS NULL OR (street_time > 0 AND street_time <= 720));

-- AM Office (722) should never exceed 3 hours
ALTER TABLE route_history
ADD CONSTRAINT check_office_time_max_180 
  CHECK (office_time IS NULL OR (office_time > 0 AND office_time <= 180));

-- Additional sanity check: if street_time is NULL or 0, pm_office_time should be low
-- (a day with 0 street time and high PM office is suspicious)
ALTER TABLE route_history
ADD CONSTRAINT check_suspicious_pm_only_day
  CHECK (street_time > 0 OR pm_office_time <= 30);
