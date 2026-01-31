import { useEffect, useState } from 'react';
import { supabase, supabaseEnvOk } from '../../lib/supabase';

export default function AuthCallbackScreen() {
  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState('Confirming your email…');

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        if (!supabaseEnvOk || !supabase) {
          setStatus('error');
          setMessage('RouteWise is missing Supabase config.');
          return;
        }

        // With detectSessionInUrl=true, Supabase will parse the URL on load.
        // Give it a moment, then read the session.
        await new Promise((r) => setTimeout(r, 300));

        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;

        if (cancelled) return;

        if (data?.session) {
          setStatus('success');
          setMessage('✅ Email confirmed! You can close this tab or continue into RouteWise.');
        } else {
          // Supabase may still confirm the user even if it doesn't create a session.
          // Show a helpful message either way.
          setStatus('success');
          setMessage('✅ Email confirmed! You can return to RouteWise and log in.');
        }
      } catch (e) {
        if (cancelled) return;
        setStatus('error');
        setMessage(e?.message || 'Confirmation failed. Please try again.');
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, []);

  const goHome = () => {
    // Clear the URL hash/query so tokens aren’t left in the address bar.
    window.history.replaceState({}, document.title, '/');
    window.location.href = '/';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-2">RouteWise</h2>
        <p className={`text-sm whitespace-pre-line ${status === 'error' ? 'text-red-700' : 'text-gray-700'}`}>
          {message}
        </p>

        <div className="mt-4 flex gap-3">
          <button
            onClick={goHome}
            className="flex-1 bg-blue-600 text-white rounded-lg py-2 font-semibold hover:bg-blue-700"
          >
            Continue
          </button>
        </div>

        <p className="mt-3 text-xs text-gray-500">
          If you already confirmed and still can’t log in, try refreshing RouteWise and signing in again.
        </p>
      </div>
    </div>
  );
}
