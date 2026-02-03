import { supabase } from '../lib/supabase';
import { USPS_STANDARDS, getWorkweekStart, calculatePenaltyOT } from '../utils/uspsConstants';
import { toLocalDateKey } from '../utils/dateKey';

export const routeProtectionService = {
  async check3of5Rule(routeId) {
    const { data: history, error } = await supabase
      .from('route_history')
      .select('*')
      .eq('route_id', routeId)
      .order('date', { ascending: false })
      .limit(5);

    if (error || !history || history.length === 0) {
      return {
        qualifies: false,
        violationCount: 0,
        daysCounted: 0,
        violations: [],
        message: 'Insufficient data to check 3/5 rule'
      };
    }

    const violations = history.filter(day =>
      day.overtime >= USPS_STANDARDS.SPECIAL_INSPECTION_OT ||
      day.auxiliary_assistance === true ||
      day.mail_not_delivered === true
    );

    return {
      qualifies: violations.length >= USPS_STANDARDS.SPECIAL_INSPECTION_DAYS,
      violationCount: violations.length,
      daysCounted: history.length,
      violations: violations,
      message: violations.length >= USPS_STANDARDS.SPECIAL_INSPECTION_DAYS
        ? '✅ Route qualifies for Special Inspection (M-39 271g)'
        : `${violations.length}/3 days - Need ${USPS_STANDARDS.SPECIAL_INSPECTION_DAYS - violations.length} more`
    };
  },

  async checkOverburdened(routeId) {
    const { data: route, error: routeError } = await supabase
      .from('routes')
      .select('evaluated_office_time, evaluated_street_time, evaluation_date')
      .eq('id', routeId)
      .maybeSingle();

    if (routeError || !route || !route.evaluated_street_time) {
      return {
        isOverburdened: false,
        hasEvaluation: false,
        variance: 0,
        message: 'No route evaluation on file'
      };
    }

    const { data: history, error: historyError } = await supabase
      .from('route_history')
      .select('street_time, street_time_normalized')
      .eq('route_id', routeId)
      .order('date', { ascending: false })
      .limit(10);

    if (historyError || !history || history.length === 0) {
      return {
        isOverburdened: false,
        hasEvaluation: true,
        variance: 0,
        message: 'Insufficient history data'
      };
    }

    const avgStreetTime = history.reduce((sum, day) => {
      const time = day.street_time_normalized || day.street_time || 0;
      return sum + time;
    }, 0) / history.length;

    const avgStreetHours = avgStreetTime / 60;
    const evaluatedStreetHours = route.evaluated_street_time;
    const variance = (avgStreetHours - evaluatedStreetHours) * 60;

    return {
      isOverburdened: variance >= USPS_STANDARDS.OVERBURDENED_THRESHOLD,
      hasEvaluation: true,
      variance: variance,
      actualStreetTime: avgStreetHours,
      evaluatedStreetTime: evaluatedStreetHours,
      evaluationDate: route.evaluation_date,
      threshold: USPS_STANDARDS.OVERBURDENED_THRESHOLD,
      message: variance >= USPS_STANDARDS.OVERBURDENED_THRESHOLD
        ? `⚠️ Route is overburdened by ${variance.toFixed(0)} minutes`
        : `✅ Route is within evaluation (${variance.toFixed(0)} min variance)`
    };
  },

  async getRouteProtectionStatus(routeId) {
    const [rule3of5, overburdened] = await Promise.all([
      this.check3of5Rule(routeId),
      this.checkOverburdened(routeId)
    ]);

    const needsAttention = rule3of5.qualifies || overburdened.isOverburdened;

    return {
      rule3of5,
      overburdened,
      needsAttention,
      summary: needsAttention
        ? '⚠️ Route Protection Alert: Documentation available for adjustment request'
        : '✅ Route within normal parameters'
    };
  },

  async calculateWeeklyStats(routeId, date = new Date()) {
    const weekStart = getWorkweekStart(date);
    const weekEnd = new Date(weekStart.getTime() + 7 * 86400000);

    const { data: history, error } = await supabase
      .from('route_history')
      .select('*')
      .eq('route_id', routeId)
      .gte('date', toLocalDateKey(weekStart))
      .lt('date', toLocalDateKey(weekEnd))
      .order('date', { ascending: true });

    if (error || !history) {
      return null;
    }

    const { data: route } = await supabase
      .from('routes')
      .select('tour_length')
      .eq('id', routeId)
      .maybeSingle();

    const tourLength = route?.tour_length || 8.5;

    let totalHours = 0;
    let totalRegularOT = 0;
    let totalPenaltyOT = 0;
    let daysWorked = 0;

    history.forEach(day => {
      const officeTime = (day.office_time || 0) + (day.pm_office_time || 0);
      const streetTime = day.street_time_normalized || day.street_time || 0;
      const dailyHours = (officeTime + streetTime) / 60;

      totalHours += dailyHours;
      daysWorked++;

      const penaltyCalc = calculatePenaltyOT(dailyHours, tourLength, totalHours, day.is_ns_day);

      totalRegularOT += penaltyCalc.regularOT;
      totalPenaltyOT += penaltyCalc.penaltyOT;
    });

    const approachingWeeklyPenalty = totalHours > (USPS_STANDARDS.WEEKLY_PENALTY_THRESHOLD - 4);

    return {
      weekStart,
      weekEnd,
      totalHours,
      totalRegularOT,
      totalPenaltyOT,
      daysWorked,
      approachingWeeklyPenalty,
      weeklyPenaltyThreshold: USPS_STANDARDS.WEEKLY_PENALTY_THRESHOLD
    };
  },

  async getOvertimeTrends(routeId, weeks = 4) {
    const today = new Date();
    const trends = [];

    for (let i = 0; i < weeks; i++) {
      const weekDate = new Date(today.getTime() - i * 7 * 86400000);
      const weekStart = getWorkweekStart(weekDate);
      const weekEnd = new Date(weekStart.getTime() + 7 * 86400000);

      const { data: history } = await supabase
        .from('route_history')
        .select('overtime, penalty_overtime')
        .eq('route_id', routeId)
        .gte('date', toLocalDateKey(weekStart))
        .lt('date', toLocalDateKey(weekEnd));

      if (history && history.length > 0) {
        const totalOT = history.reduce((sum, day) => sum + (day.overtime || 0), 0);
        const totalPenaltyOT = history.reduce((sum, day) => sum + (day.penalty_overtime || 0), 0);
        const avgDailyOT = totalOT / history.length;

        trends.push({
          weekStart: toLocalDateKey(weekStart),
          weekEnd: toLocalDateKey(weekEnd),
          totalOT,
          totalPenaltyOT,
          avgDailyOT,
          daysWorked: history.length
        });
      }
    }

    return trends;
  }
};
