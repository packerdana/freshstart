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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Sentry.ErrorBoundary fallback={<div className="p-4">Something went wrong.</div>}>
      <App />
    </Sentry.ErrorBoundary>
  </StrictMode>
);
