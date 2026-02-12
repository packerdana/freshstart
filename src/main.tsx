import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import * as Sentry from '@sentry/react';
import App from './App.tsx';
import './index.css';

// Sentry (errors + optional performance). Configure DSN via Vercel/Env:
//   VITE_SENTRY_DSN=https://....@o0.ingest.sentry.io/0
const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN;

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: import.meta.env.MODE,

    // Keep sampling conservative by default (cost control). Tune later.
    tracesSampleRate: 0.1,

    integrations: [
      // v8+ integration helpers live on the Sentry namespace
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({ maskAllText: true, blockAllMedia: true }),
    ],

    // Turn replays off for normal sessions; only capture when errors happen.
    replaysSessionSampleRate: 0.0,
    replaysOnErrorSampleRate: 0.1,
  });
}

const ErrorFallback = ({ error, resetError }: { error: unknown; resetError: () => void }) => {
  const msg = (() => {
    try {
      if (error && typeof error === 'object' && 'message' in error) {
        // @ts-ignore
        return String(error.message || 'Unknown error');
      }
      return String(error || 'Unknown error');
    } catch {
      return 'Unknown error';
    }
  })();
  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-6">
        <h2 className="text-lg font-bold text-red-700 mb-2">Something went wrong.</h2>
        <p className="text-sm text-gray-700 whitespace-pre-line break-words mb-4">{msg}</p>

        <div className="space-y-2">
          <button
            className="w-full px-4 py-2 rounded-lg bg-red-600 text-white font-semibold"
            onClick={() => {
              try {
                // Try a soft reset first
                resetError?.();
              } catch {}
              try {
                const url = new URL(window.location.href);
                url.searchParams.set('v', String(Date.now()));
                window.location.replace(url.toString());
              } catch {}
            }}
          >
            Reload
          </button>

          <a
            className="block w-full text-center px-4 py-2 rounded-lg bg-white border border-red-300 text-red-700 font-semibold"
            href="/?reset=1"
          >
            Reset login
          </a>

          <p className="text-xs text-gray-600">
            Tip: if this happens on weak cellular service, try toggling airplane mode or switching Wi‑Fi.
          </p>
        </div>
      </div>
    </div>
  );
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Sentry.ErrorBoundary fallback={ErrorFallback}>
      <App />
    </Sentry.ErrorBoundary>
  </StrictMode>
);

