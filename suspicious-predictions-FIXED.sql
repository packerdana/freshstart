-- Find RouteWise routes with suspicious prediction drivers (1AM+ finish times)
-- These are likely caused by bad historical data (outlier days) in route_history
-- FIXED: Calculate total_minutes dynamically instead of assuming column exists

-- PART 1: Identify routes with extreme values
SELECT 
  'PART 1: Extreme Values' as report_type,
  route_id,
  COUNT(*) as total_days,
  COUNT(CASE WHEN street_time > 800 THEN 1 END) as days_street_time_gt_800min,
  COUNT(CASE WHEN pm_office_time > 200 THEN 1 END) as days_pm_office_gt_200min,
  COUNT(CASE WHEN (COALESCE(office_time, 0) + COALESCE(street_time, 0) + COALESCE(pm_office_time, 0)) > 900 THEN 1 END) as days_total_gt_15h,
  MAX(street_time) as max_street_time_min,
  MAX(pm_office_time) as max_pm_office_time_min,
  MAX(COALESCE(office_time, 0) + COALESCE(street_time, 0) + COALESCE(pm_office_time, 0)) as max_total_minutes,
  ROUND(AVG(CASE WHEN street_time > 0 THEN street_time ELSE NULL END)::numeric, 0) as avg_street_time,
  ROUND(AVG(CASE WHEN pm_office_time > 0 THEN pm_office_time ELSE NULL END)::numeric, 0) as avg_pm_office_time
FROM route_history
GROUP BY route_id
HAVING 
  COUNT(CASE WHEN street_time > 800 THEN 1 END) > 0
  OR COUNT(CASE WHEN pm_office_time > 200 THEN 1 END) > 0
  OR COUNT(CASE WHEN (COALESCE(office_time, 0) + COALESCE(street_time, 0) + COALESCE(pm_office_time, 0)) > 900 THEN 1 END) > 0
ORDER BY max_total_minutes DESC;

-- PART 2: Show the actual outlier days (likely culprits)
SELECT 
  'PART 2: Outlier Days (likely causes of 1AM+ predictions)' as report_type,
  route_id,
  date,
  street_time as st_min,
  pm_office_time as pm_min,
  (COALESCE(office_time, 0) + COALESCE(street_time, 0) + COALESCE(pm_office_time, 0))::int as total_min,
  ROUND((street_time + COALESCE(pm_office_time, 0))::numeric / 60, 1) as hours_street_pm,
  auxiliary_assistance,
  mail_not_delivered,
  is_ns_day,
  CASE 
    WHEN street_time > 800 THEN '🚨 Street time > 13h'
    WHEN pm_office_time > 200 THEN '🚨 PM Office > 3.3h'
    WHEN (COALESCE(office_time, 0) + COALESCE(street_time, 0) + COALESCE(pm_office_time, 0)) > 900 THEN '🚨 Total > 15h'
    ELSE 'Outlier'
  END as reason
FROM route_history
WHERE 
  street_time > 800
  OR pm_office_time > 200
  OR (COALESCE(office_time, 0) + COALESCE(street_time, 0) + COALESCE(pm_office_time, 0)) > 900
ORDER BY (COALESCE(office_time, 0) + COALESCE(street_time, 0) + COALESCE(pm_office_time, 0)) DESC, route_id
LIMIT 50;

-- PART 3: Routes with unexcluded "help" days (should be filtered but check)
SELECT 
  'PART 3: Days That Should Be Auto-Excluded' as report_type,
  route_id,
  COUNT(*) as should_be_excluded_count,
  COUNT(CASE WHEN auxiliary_assistance THEN 1 END) as auxiliary_assistance_days,
  COUNT(CASE WHEN mail_not_delivered THEN 1 END) as mail_not_delivered_days,
  COUNT(CASE WHEN is_ns_day THEN 1 END) as ns_days,
  ROUND(AVG(CASE WHEN (COALESCE(office_time, 0) + COALESCE(street_time, 0) + COALESCE(pm_office_time, 0)) > 0 THEN (COALESCE(office_time, 0) + COALESCE(street_time, 0) + COALESCE(pm_office_time, 0)) ELSE NULL END)::numeric, 0) as avg_total_min_including_excluded
FROM route_history
WHERE auxiliary_assistance OR mail_not_delivered OR is_ns_day
GROUP BY route_id
HAVING COUNT(*) > 0
ORDER BY COUNT(*) DESC;

-- PART 4: Routes with very few clean days (prediction confidence issue)
SELECT 
  'PART 4: Routes With Low Clean History' as report_type,
  route_id,
  COUNT(*) as total_days_logged,
  COUNT(CASE WHEN NOT (COALESCE(auxiliary_assistance, false) OR COALESCE(mail_not_delivered, false) OR COALESCE(is_ns_day, false)) THEN 1 END) as clean_days,
  ROUND(
    100.0 * COUNT(CASE WHEN NOT (COALESCE(auxiliary_assistance, false) OR COALESCE(mail_not_delivered, false) OR COALESCE(is_ns_day, false)) THEN 1 END) / NULLIF(COUNT(*), 0)::numeric,
    1
  ) as pct_clean,
  ROUND(AVG(CASE WHEN NOT (COALESCE(auxiliary_assistance, false) OR COALESCE(mail_not_delivered, false) OR COALESCE(is_ns_day, false)) THEN street_time ELSE NULL END)::numeric, 0) as avg_clean_street_time
FROM route_history
GROUP BY route_id
HAVING COUNT(*) >= 5
ORDER BY pct_clean ASC, COUNT(*) DESC;

-- PART 5: Actionable cleanup recommendations
SELECT 
  'PART 5: Cleanup Recommendations' as report_type,
  route_id,
  COUNT(*) as total_history_days,
  CASE 
    WHEN MAX(street_time) > 1000 THEN 'DELETE or FIX rows where street_time > 1000 (data entry error likely)'
    WHEN MAX(pm_office_time) > 300 THEN 'DELETE or MARK rows where pm_office_time > 300 (outlier help days)'
    WHEN COUNT(CASE WHEN (COALESCE(office_time, 0) + COALESCE(street_time, 0) + COALESCE(pm_office_time, 0)) > 900 THEN 1 END) >= 3 THEN 'Review: Multiple 15h+ days. Mark with auxiliary_assistance=true if helping others'
    WHEN COUNT(CASE WHEN NOT (COALESCE(auxiliary_assistance, false) OR COALESCE(mail_not_delivered, false) OR COALESCE(is_ns_day, false)) THEN 1 END) < 5 THEN 'Need more clean days (< 5 logged)'
    ELSE 'Monitor: History looks reasonable but spot-check'
  END as recommended_action
FROM route_history
GROUP BY route_id
HAVING 
  MAX(street_time) > 800
  OR MAX(pm_office_time) > 200
  OR MAX(COALESCE(office_time, 0) + COALESCE(street_time, 0) + COALESCE(pm_office_time, 0)) > 900
  OR COUNT(CASE WHEN NOT (COALESCE(auxiliary_assistance, false) OR COALESCE(mail_not_delivered, false) OR COALESCE(is_ns_day, false)) THEN 1 END) < 5
ORDER BY route_id;
