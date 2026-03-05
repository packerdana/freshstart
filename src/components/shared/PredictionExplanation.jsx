import { getDayTypeLabel } from '../../utils/holidays';

/**
 * PredictionExplanation
 *
 * Renders a plain-language breakdown of HOW today's street time estimate was
 * computed. All the information already exists in the prediction object — this
 * component just makes it visible to the carrier.
 *
 * Props:
 *   prediction  — full return value from calculateFullDayPrediction()
 *   todayInputs — the mail-volume inputs entered by the carrier today
 */
export default function PredictionExplanation({ prediction, todayInputs }) {
  if (!prediction) return null;

  // The street-time prediction lives one level down when coming from
  // calculateFullDayPrediction(); unwrap it if needed.
  const p = prediction.prediction ?? prediction;
  if (!p) return null;

  const method        = p.method      || 'estimate';
  const dayType       = p.dayType     || 'normal';
  const dayTypeLabel  = getDayTypeLabel(dayType);
  const matchedDates  = p.matchedDates || [];
  const matchesUsed   = p.matchesUsed  || 0;
  const confidence    = p.confidence   || 'medium';
  const badge         = p.badge        || '📊';
  const boxholderMatched = !!p.boxholderMatched;
  const isBoxholderDay   = !!(todayInputs?.hasBoxholder);
  const isPostHoliday    = dayType === 'day-after-holiday';
  const isMonday         = dayType === 'monday';
  const isSaturday       = dayType === 'saturday';

  // ── Format helpers ────────────────────────────────────────────────────────

  function fmtDate(dateStr) {
    if (!dateStr) return '';
    try {
      const [y, m, d] = dateStr.split('-').map(Number);
      return new Date(y, m - 1, d).toLocaleDateString('en-US', {
        weekday: 'short', month: 'short', day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  }

  function fmtMins(mins) {
    if (!mins && mins !== 0) return '—';
    const h = Math.floor(mins / 60);
    const m = Math.round(mins % 60);
    return `${h}:${String(m).padStart(2, '0')}`;
  }

  function pct(score) {
    return `${Math.round((score || 0) * 100)}%`;
  }

  // ── Branch D — pre-history (evaluation / manual / default) ───────────────

  if (['evaluation', 'manual', 'estimate'].includes(method)) {
    const sourceLabel = {
      evaluation: `Route evaluation on file`,
      manual:     'Manually set by you',
      estimate:   'Default estimate — no personal history yet',
    }[method];

    return (
      <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-4 text-xs text-gray-700 space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">📬</span>
          <span className="font-semibold text-sm text-gray-900">How today's estimate was calculated</span>
        </div>

        <div className="flex items-start gap-2">
          <span>📋</span>
          <div>
            <span className="font-medium">Source: </span>{sourceLabel}
          </div>
        </div>

        {method === 'estimate' && (
          <div className="flex items-start gap-2 text-blue-700">
            <span>🌱</span>
            <span>
              Complete a few routes and the app will start learning your actual
              times instead of using this default.
            </span>
          </div>
        )}
      </div>
    );
  }

  // ── Branch C — simple average (not enough same-type days yet) ────────────

  if (method === 'simple') {
    const daysNeeded = Math.max(0, 3 - matchesUsed);

    return (
      <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-xs text-blue-900 space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">📬</span>
          <span className="font-semibold text-sm text-blue-900">How today's estimate was calculated</span>
        </div>

        <div className="flex items-start gap-2">
          <span>📊</span>
          <span>
            Simple average of your last{' '}
            <span className="font-medium">{matchesUsed} day(s)</span> of history.
          </span>
        </div>

        <div className="flex items-start gap-2 text-blue-700">
          <span>ℹ️</span>
          <span>
            Not enough <span className="font-medium">{dayTypeLabel}</span> days
            yet to use mail-volume matching.
          </span>
        </div>

        {daysNeeded > 0 && (
          <div className="flex items-start gap-2 text-blue-600">
            <span>🌱</span>
            <span>
              Accuracy improves after{' '}
              <span className="font-medium">{daysNeeded} more</span> similar day(s).
            </span>
          </div>
        )}
      </div>
    );
  }

  // ── Branch A / B — volume-similarity match ────────────────────────────────

  // Build a lookup so we can show the street time each matched day actually took.
  // matchedDates entries: { date, weight, matchScore }
  const top = matchedDates.slice(0, 5);

  const dayTypeDescription = isPostHoliday
    ? 'Day-after-holiday (heavy mail day)'
    : isMonday
    ? 'Monday — compared against your past Mondays only'
    : isSaturday
    ? 'Saturday'
    : 'Normal weekday';

  const confidenceColor = {
    high:       'text-green-700',
    good:       'text-green-600',
    medium:     'text-yellow-700',
    low:        'text-orange-700',
    evaluation: 'text-purple-700',
    manual:     'text-purple-700',
  }[confidence] || 'text-gray-600';

  return (
    <div className="mt-3 rounded-xl border border-green-200 bg-green-50 p-4 text-xs text-gray-800 space-y-3">

      {/* Header */}
      <div className="flex items-center gap-2">
        <span className="text-lg">📬</span>
        <span className="font-semibold text-sm text-gray-900">How today's estimate was calculated</span>
      </div>

      {/* Day type */}
      <div className="flex items-start gap-2">
        <span>📅</span>
        <div className="space-y-0.5">
          <div>
            <span className="font-medium">Day type: </span>
            {isPostHoliday
              ? <span className="font-semibold text-orange-700">⚠️ Day-after-holiday</span>
              : <span className="font-medium">{dayTypeDescription}</span>
            }
          </div>
          <div className="text-gray-600">
            Compared against{' '}
            <span className="font-medium">{matchesUsed}</span>{' '}
            similar <span className="font-medium">{dayTypeLabel}</span>{' '}
            day(s) from your history.
          </div>
        </div>
      </div>

      {/* Post-holiday override notice */}
      {isPostHoliday && (
        <div className="flex items-start gap-2 rounded-lg bg-orange-50 border border-orange-200 p-2">
          <span>⚠️</span>
          <span className="text-orange-800">
            <span className="font-medium">Post-holiday override active.</span>{' '}
            These days run longer because mail piles up during the holiday.
            Street time cap raised to 14 hrs for today's validation.
          </span>
        </div>
      )}

      {/* Boxholder notice */}
      {isBoxholderDay && (
        <div className="flex items-start gap-2 rounded-lg bg-yellow-50 border border-yellow-200 p-2">
          <span>📦</span>
          <div className="text-yellow-900">
            <span className="font-medium">Boxholder route today.</span>{' '}
            {boxholderMatched
              ? 'Only past days with boxholder mail were used — boxholder routes take longer due to door-to-door delivery.'
              : 'Not enough past boxholder days yet; used all recent days as a fallback.'}
          </div>
        </div>
      )}

      {/* Matched days table */}
      {top.length > 0 && (
        <div>
          <div className="flex items-center gap-1 mb-1.5 font-medium text-gray-700">
            <span>🗓️</span>
            <span>Best-matching past days used:</span>
          </div>
          <div className="rounded-lg border border-green-200 overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-green-100 text-green-800">
                  <th className="text-left px-2 py-1.5 font-semibold">Date</th>
                  <th className="text-right px-2 py-1.5 font-semibold">Mail similarity</th>
                  <th className="text-right px-2 py-1.5 font-semibold">Weight</th>
                </tr>
              </thead>
              <tbody>
                {top.map((m, i) => (
                  <tr
                    key={m.date}
                    className={i % 2 === 0 ? 'bg-white' : 'bg-green-50'}
                  >
                    <td className="px-2 py-1.5 text-gray-700">{fmtDate(m.date)}</td>
                    <td className="px-2 py-1.5 text-right font-medium text-green-700">
                      {pct(m.matchScore)}
                    </td>
                    <td className="px-2 py-1.5 text-right text-gray-500">
                      {pct(m.weight / (top.reduce((s, x) => s + x.weight, 0) || 1))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-1 text-gray-500 leading-snug">
            "Mail similarity" = how closely today's DPS, flats, letters, parcels,
            and SPRs matched that day. Closer = more weight in the average.
          </p>
        </div>
      )}

      {/* Confidence */}
      <div className="flex items-center gap-2 pt-1 border-t border-green-100">
        <span>{badge}</span>
        <span>
          Prediction confidence:{' '}
          <span className={`font-medium ${confidenceColor}`}>{confidence}</span>
        </span>
        <span className="text-gray-400">
          ({matchesUsed} day{matchesUsed !== 1 ? 's' : ''} matched)
        </span>
      </div>

    </div>
  );
}
