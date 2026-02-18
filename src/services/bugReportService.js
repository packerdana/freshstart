import { supabase } from '../lib/supabase';
import { getLocalDateString } from '../utils/time';

/**
 * Submit a bug report into the bug_reports table.
 * Optionally uploads a screenshot to the `bug-report-screenshots` storage bucket.
 */
export async function submitBugReport({
  category,
  description,
  routeId,
  routeName,
  testerName,
  testerEmail,
  screenshotFile,
  context = {},
}) {
  // 1) Upload screenshot if provided
  let screenshot_url = null;

  if (screenshotFile) {
    const ext = screenshotFile.name?.split('.').pop() || 'png';
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const path = `${getLocalDateString()}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('bug-report-screenshots')
      .upload(path, screenshotFile);

    if (uploadError) {
      console.warn('[BugReport] screenshot upload failed:', uploadError.message || uploadError);
    } else {
      screenshot_url = path;
    }
  }

  const app_version = import.meta.env.VITE_APP_VERSION || 'unknown';
  const environment = import.meta.env.MODE || import.meta.env.VITE_APP_ENV || 'unknown';
  const user_agent = typeof navigator !== 'undefined' ? navigator.userAgent : 'server';

  const payload = {
    category,
    description,
    tester_name: testerName || null,
    tester_email: testerEmail || null,
    route_id: routeId || null,
    route_name: routeName || null,
    route_date: context.routeDate || null,
    app_version,
    environment,
    user_agent,
    context,
    screenshot_url,
  };

  const { data, error } = await supabase
    .from('bug_reports')
    .insert(payload)
    .select()
    .maybeSingle();

  if (error) {
    console.error('[BugReport] insert failed:', error.message || error);
    throw error;
  }

  return data;
}
