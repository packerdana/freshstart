import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { sentryVitePlugin } from '@sentry/vite-plugin';

// https://vitejs.dev/config/
export default defineConfig(() => {
  const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN;
  const sentryOrg = process.env.SENTRY_ORG;
  const sentryProject = process.env.SENTRY_PROJECT;

  const sentryEnabled = !!(sentryAuthToken && sentryOrg && sentryProject);

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

    build: {
      // Required for readable stack traces in Sentry.
      sourcemap: true,
    },

    optimizeDeps: {
      exclude: ['lucide-react'],
    },
  };
});
