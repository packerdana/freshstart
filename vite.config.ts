import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { sentryVitePlugin } from '@sentry/vite-plugin';

// https://vitejs.dev/config/
export default defineConfig(() => {
  const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN;
  const sentryOrg = process.env.SENTRY_ORG;
  const sentryProject = process.env.SENTRY_PROJECT;

  const sentryEnabled = !!(sentryAuthToken && sentryOrg && sentryProject);

  const appVersion = (
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.GITHUB_SHA ||
    process.env.COMMIT_SHA ||
    'dev'
  ).slice(0, 8);

  return {
    plugins: [
      react(),
      ...(sentryEnabled
        ? [
            sentryVitePlugin({
              org: sentryOrg,
              project: sentryProject,
              authToken: sentryAuthToken,

              // These defaults work well on Vercel builds.
              sourcemaps: {
                assets: './dist/**',
              },
            }),
          ]
        : []),
    ],

    define: {
      __APP_VERSION__: JSON.stringify(appVersion),
    },

    build: {
      // Required for readable stack traces in Sentry.
      sourcemap: true,
    },

    optimizeDeps: {
      exclude: ['lucide-react'],
    },
  };
});
