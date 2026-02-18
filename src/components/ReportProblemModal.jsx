import React, { useState } from 'react';
import useRouteStore from '../stores/routeStore';
import { submitBugReport } from '../services/bugReportService';
import { getLocalDateString } from '../utils/time';

export default function ReportProblemModal({ onClose }) {
  const { currentRoute, currentRouteId, todayInputs, history } = useRouteStore();

  const [category, setCategory] = useState('prediction');
  const [description, setDescription] = useState('');
  const [testerName, setTesterName] = useState('');
  const [testerEmail, setTesterEmail] = useState('');
  const [screenshotFile, setScreenshotFile] = useState(null);
  const [includeContext, setIncludeContext] = useState(true);
  const [sending, setSending] = useState(false);
  const [sentId, setSentId] = useState(null);
  const [error, setError] = useState(null);

  const today = getLocalDateString();
  const recentHistory = Array.isArray(history) ? history.slice(0, 30) : [];

  const context = includeContext
    ? {
        routeDate: today,
        routeId: currentRouteId || null,
        routeName: currentRoute?.name || null,
        todayInputs: todayInputs || {},
        recentHistorySummary: recentHistory.map((d) => ({
          date: d.date,
          dps: d.dps,
          flats: d.flats,
          letters: d.letters,
          parcels: d.parcels,
          sprs: d.sprs,
          streetTime: d.streetTime,
          dayType: d.dayType || null,
        })),
      }
    : {};

  async function handleSubmit(e) {
    e.preventDefault();
    if (!description.trim()) {
      setError('Please describe what went wrong.');
      return;
    }
    setError(null);
    setSending(true);
    try {
      const report = await submitBugReport({
        category,
        description: description.trim(),
        testerName: testerName.trim() || null,
        testerEmail: testerEmail.trim() || null,
        screenshotFile,
        routeId: currentRouteId,
        routeName: currentRoute?.name || null,
        context,
      });
      setSentId(report?.id || null);
    } catch (err) {
      setError(err?.message || 'Failed to send report. Please try again later.');
    } finally {
      setSending(false);
    }
  }

  if (sentId) {
    return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
        <div className="bg-slate-900 border border-slate-700 rounded-lg p-6 max-w-md w-full">
          <h2 className="text-lg font-semibold mb-3">Thank you</h2>
          <p className="text-sm text-slate-300 mb-4">
            Your report was sent. Reference ID:
            <span className="font-mono text-xs ml-1">{sentId}</span>
          </p>
          <button
            type="button"
            className="px-3 py-1.5 rounded bg-slate-700 text-sm"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-slate-900 border border-slate-700 rounded-lg p-6 max-w-lg w-full">
        <h2 className="text-lg font-semibold mb-3">Report a problem</h2>
        <p className="text-xs text-slate-400 mb-4">
          This sends us a bug report with optional app details so we can reproduce and fix it.
          It is not shared with USPS or management.
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full text-sm rounded bg-slate-800 border border-slate-700 px-2 py-1.5"
            >
              <option value="prediction">Wrong prediction</option>
              <option value="data-loss">Data disappeared / saved wrong</option>
              <option value="ui">UI confusing / unclear</option>
              <option value="crash">App crashed / froze</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-xs mb-1">What went wrong? *</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full text-sm rounded bg-slate-800 border border-slate-700 px-2 py-1.5"
              placeholder="In your own words. What did you expect instead?"
            />
          </div>

          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-xs mb-1">Your name (optional)</label>
              <input
                value={testerName}
                onChange={(e) => setTesterName(e.target.value)}
                className="w-full text-sm rounded bg-slate-800 border border-slate-700 px-2 py-1.5"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs mb-1">Email (optional)</label>
              <input
                value={testerEmail}
                onChange={(e) => setTesterEmail(e.target.value)}
                className="w-full text-sm rounded bg-slate-800 border border-slate-700 px-2 py-1.5"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs mb-1">Screenshot (optional)</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setScreenshotFile(e.target.files?.[0] || null)}
              className="w-full text-xs text-slate-300"
            />
          </div>

          <label className="flex items-start gap-2 text-xs text-slate-300">
            <input
              type="checkbox"
              checked={includeContext}
              onChange={(e) => setIncludeContext(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              Include technical details (today&apos;s volumes, route/date, prediction data)
              to help reproduce the problem.
            </span>
          </label>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex justify-end gap-2 mt-4">
            <button
              type="button"
              className="px-3 py-1.5 text-xs rounded border border-slate-700 text-slate-300"
              onClick={onClose}
              disabled={sending}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-3 py-1.5 text-xs rounded bg-sky-600 text-white disabled:bg-sky-900"
              disabled={sending}
            >
              {sending ? 'Sending…' : 'Send report'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
