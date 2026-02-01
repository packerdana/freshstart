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

function computeThresholds({ history, getValue, fallback }) {
  const rows = (history || [])
    .map(getValue)
    .filter((n) => Number.isFinite(n) && n > 0);

  // Need enough history to be meaningful; otherwise fall back.
  if (rows.length < 10) {
    return { ...fallback, basis: 'fallback' };
  }

  const aboveNormal = Math.round(percentile(rows, 0.80) || fallback.aboveNormal);
  const heavy = Math.round(percentile(rows, 0.90) || fallback.heavy);

  return {
    aboveNormal: Math.max(1, Math.min(heavy - 1, aboveNormal)),
    heavy: Math.max(aboveNormal + 1, heavy),
    basis: 'history',
  };
}

function computePackageThresholds(history) {
  return computeThresholds({
    history,
    fallback: { aboveNormal: 100, heavy: 150 },
    getValue: (d) => {
      const parcels = typeof d.parcels === 'string' ? parseInt(d.parcels, 10) : (d.parcels || 0);
      const sprs = (d.sprs ?? d.spurs ?? 0);
      const sprsN = typeof sprs === 'string' ? parseInt(sprs, 10) : sprs;
      return (Number.isFinite(parcels) ? parcels : 0) + (Number.isFinite(sprsN) ? sprsN : 0);
    },
  });
}

function computeDpsThresholds(history) {
  return computeThresholds({
    history,
    fallback: { aboveNormal: 2000, heavy: 3000 },
    getValue: (d) => {
      const v = typeof d.dps === 'string' ? parseInt(d.dps, 10) : (d.dps || 0);
      return Number.isFinite(v) ? v : 0;
    },
  });
}

function computeFeetThresholds(history, field, fallback) {
  return computeThresholds({
    history,
    fallback,
    getValue: (d) => {
      const raw = d[field];
      const v = typeof raw === 'string' ? parseFloat(raw) : (raw || 0);
      return Number.isFinite(v) ? v : 0;
    },
  });
}

function computeSafetyTalkThresholds(history) {
  return computeThresholds({
    history,
    fallback: { aboveNormal: 5, heavy: 10 },
    getValue: (d) => {
      const raw = d.safetyTalk ?? d.safety_talk;
      const v = typeof raw === 'string' ? parseInt(raw, 10) : (raw || 0);
      return Number.isFinite(v) ? v : 0;
    },
  });
}

function buildReasons({ todayInputs, prediction, history, baseParcels }) {
  const reasons = [];

  const dps = clampMinutes(todayInputs?.dps);
  const flatsFeet = typeof todayInputs?.flats === 'string' ? parseFloat(todayInputs.flats) : (todayInputs?.flats || 0);
  const lettersFeet = typeof todayInputs?.letters === 'string' ? parseFloat(todayInputs.letters) : (todayInputs?.letters || 0);
  const parcels = clampMinutes(todayInputs?.parcels);
  const sprs = clampMinutes(todayInputs?.sprs);
  const hasBoxholder = !!todayInputs?.hasBoxholder;
  const safetyTalkMin = clampMinutes(todayInputs?.safetyTalk);

  const log = todayInputs?.dailyLog || {};

  // Volume-based suggestions (route-relative when possible)
  const totalPkgs = parcels + sprs;

  const base = typeof baseParcels === 'string' ? parseInt(baseParcels, 10) : baseParcels;
  if (Number.isFinite(base) && base != null) {
    const overBase = parcels - base;
    if (overBase >= 1) {
      reasons.push(`Parcels over base: +${overBase}.`);
    }
  }

  const pkgThresholds = computePackageThresholds(history);
  if (totalPkgs >= pkgThresholds.heavy) reasons.push('Heavy parcel volume.');
  else if (totalPkgs >= pkgThresholds.aboveNormal) reasons.push('Parcel volume above normal.');

  const dpsThresholds = computeDpsThresholds(history);
  if (dps >= dpsThresholds.heavy) reasons.push('Heavy DPS volume.');
  else if (dps >= dpsThresholds.aboveNormal) reasons.push('DPS volume above normal.');

  const flatsThresholds = computeFeetThresholds(history, 'flats', { aboveNormal: 8, heavy: 12 });
  if (flatsFeet >= flatsThresholds.heavy) reasons.push('Heavy flats volume.');
  else if (flatsFeet >= flatsThresholds.aboveNormal) reasons.push('Flats volume above normal.');

  const lettersThresholds = computeFeetThresholds(history, 'letters', { aboveNormal: 6, heavy: 9 });
  if (lettersFeet >= lettersThresholds.heavy) reasons.push('Heavy letters volume.');
  else if (lettersFeet >= lettersThresholds.aboveNormal) reasons.push('Letters volume above normal.');

  if (hasBoxholder) reasons.push('Boxholder/coverage today.');

  const safetyThresholds = computeSafetyTalkThresholds(history);
  // Carriers often need to note even short talks on the 3996.
  if (safetyTalkMin > 0) {
    reasons.push(`Service/safety talk: ${safetyTalkMin} min.`);
  }
  if (safetyTalkMin >= safetyThresholds.heavy) reasons.push('Extended service/safety talk.');

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

export default function Reason3996Modal({ todayInputs, prediction, history, baseParcels = null, onClose }) {
  const reasons = useMemo(
    () => buildReasons({ todayInputs, prediction, history, baseParcels }),
    [todayInputs, prediction, history, baseParcels]
  );

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
