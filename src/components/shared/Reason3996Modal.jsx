import { useMemo } from 'react';
import Card from './Card';
import Button from './Button';

function clampMinutes(n) {
  const v = typeof n === 'string' ? parseInt(n, 10) : n;
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.round(v));
}

function percentile(values, p) {
  if (!values || values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  const w = idx - lo;
  return sorted[lo] * (1 - w) + sorted[hi] * w;
}

function computePackageThresholds(history) {
  const rows = (history || [])
    .map((d) => {
      const parcels = typeof d.parcels === 'string' ? parseInt(d.parcels, 10) : (d.parcels || 0);
      const sprs = (d.sprs ?? d.spurs ?? 0);
      const sprsN = typeof sprs === 'string' ? parseInt(sprs, 10) : sprs;
      return (Number.isFinite(parcels) ? parcels : 0) + (Number.isFinite(sprsN) ? sprsN : 0);
    })
    .filter((n) => Number.isFinite(n) && n > 0);

  // Need enough history to be meaningful; otherwise fall back to fixed thresholds.
  if (rows.length < 10) {
    return { aboveNormal: 100, heavy: 150, basis: 'fallback' };
  }

  const aboveNormal = Math.round(percentile(rows, 0.80) || 100);
  const heavy = Math.round(percentile(rows, 0.90) || 150);

  // Ensure sensible ordering.
  return {
    aboveNormal: Math.max(1, Math.min(heavy - 1, aboveNormal)),
    heavy: Math.max(aboveNormal + 1, heavy),
    basis: 'history',
  };
}

function buildReasons({ todayInputs, prediction, history }) {
  const reasons = [];

  const dps = clampMinutes(todayInputs?.dps);
  const parcels = clampMinutes(todayInputs?.parcels);
  const sprs = clampMinutes(todayInputs?.sprs);

  const log = todayInputs?.dailyLog || {};

  // Volume-based suggestions (route-relative when possible)
  const totalPkgs = parcels + sprs;
  const pkgThresholds = computePackageThresholds(history);
  if (totalPkgs >= pkgThresholds.heavy) reasons.push('Heavy parcel volume.');
  else if (totalPkgs >= pkgThresholds.aboveNormal) reasons.push('Parcel volume above normal.');

  if (dps >= 3000) reasons.push('Heavy DPS volume.');
  else if (dps >= 2000) reasons.push('DPS volume above normal.');

  // Daily log-based suggestions
  if (log.lateMail) reasons.push('Late mail / delayed distribution.');
  if (log.lateParcels) reasons.push('Late parcels / delayed Amazon.');

  const waiting = clampMinutes(log.waitingOnParcelsMinutes);
  if (waiting > 0) reasons.push(`Waiting on parcels: ${waiting} min.`);

  const acct = clampMinutes(log.accountablesMinutes);
  if (acct > 0) reasons.push(`Accountables/clerks: ${acct} min.`);

  const interruptions = clampMinutes(log.casingInterruptionsMinutes);
  if (interruptions > 0) reasons.push(`Casing interruptions: ${interruptions} min.`);

  const other = clampMinutes(log.otherDelayMinutes);
  if (other > 0) reasons.push(`Other delays: ${other} min.`);

  const notes = String(log.notes || '').trim();
  if (notes) reasons.push(`Other: ${notes}`);

  // Prediction-based nudge (if we have it)
  if (prediction?.overtime > 0) {
    reasons.unshift('Overtime needed to complete route safely and accurately.');
  }

  // De-dupe and keep short
  const cleaned = Array.from(new Set(reasons)).slice(0, 8);

  if (cleaned.length === 0) {
    return [
      'Workload conditions require additional time to complete the route safely and accurately.',
      'Unanticipated conditions encountered during the workday.',
    ];
  }

  return cleaned;
}

export default function Reason3996Modal({ todayInputs, prediction, history, onClose }) {
  const reasons = useMemo(() => buildReasons({ todayInputs, prediction, history }), [todayInputs, prediction, history]);

  const text = useMemo(() => reasons.map(r => `• ${r}`).join('\n'), [reasons]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      alert('Copied 3996 reasons to clipboard');
    } catch (e) {
      // Fallback: show prompt
      window.prompt('Copy these 3996 reasons:', text);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="w-full max-w-lg">
        <Card>
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <h3 className="text-lg font-bold text-gray-900">3996 Reason Builder</h3>
              <p className="text-xs text-gray-600 mt-1">
                Suggested reasons based on today’s inputs. Edit as needed and keep it factual.
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-xl leading-none"
              aria-label="Close"
            >
              ×
            </button>
          </div>

          <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-800 whitespace-pre-line">
            {text}
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button onClick={handleCopy} className="w-full">Copy</Button>
            <Button onClick={onClose} variant="secondary" className="w-full">Close</Button>
          </div>

          <p className="text-xs text-gray-500 mt-3">
            Reminder: RouteWise is a personal planning/log tool. Follow local instructions and use accurate reasons.
          </p>
        </Card>
      </div>
    </div>
  );
}
