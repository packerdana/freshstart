import { supabase } from '../lib/supabase';

export const CODE_NAMES = {
  '721': 'Street Time',
  '722': 'Office Time',
  '723': 'Route Protection',
  '724': 'Break',
  '725': 'Lunch',
  '726': 'Off Route',
};

export async function getStreetTimeSummaryByDate(sessionId) {
  try {
    const { data, error } = await supabase
      .from('operation_codes')
      .select('*')
      .order('date', { ascending: false })
      .order('start_time', { ascending: false });

    if (error) throw error;

    const summaryByDate = {};

    data.forEach((record) => {
      const date = record.date;

      if (!summaryByDate[date]) {
        summaryByDate[date] = {
          date,
          total_minutes: 0,
          route_id: record.route_id,
          codes: {},
        };
      }

      const durationMinutes = record.duration_minutes || 0;
      summaryByDate[date].total_minutes += durationMinutes;

      if (!summaryByDate[date].codes[record.code]) {
        summaryByDate[date].codes[record.code] = 0;
      }
      summaryByDate[date].codes[record.code] += durationMinutes;
    });

    return Object.values(summaryByDate);
  } catch (error) {
    console.error('Error fetching street time summary:', error);
    return [];
  }
}

export async function getOperationCodesForDate(sessionId, date) {
  try {
    const { data, error } = await supabase
      .from('operation_codes')
      .select('*')
      .eq('date', date)
      .order('start_time', { ascending: true });

    if (error) throw error;

    return data || [];
  } catch (error) {
    console.error('Error fetching operation codes for date:', error);
    return [];
  }
}

export function formatDuration(minutes) {
  if (typeof minutes !== 'number' || minutes < 0) return '0:00';

  const hours = Math.floor(minutes / 60);
  const mins = Math.floor(minutes % 60);

  if (hours > 0) {
    return `${hours}:${String(mins).padStart(2, '0')}`;
  }
  return `${mins}m`;
}
