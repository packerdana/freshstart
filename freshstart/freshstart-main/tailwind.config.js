/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        usps: {
          blue: '#2563EB',
          navy: '#1E3A8A',
        }
      },
      fontFamily: {
        mono: ['SF Mono', 'Monaco', 'Courier New', 'monospace'],
      }
    }
  },
  plugins: [],
};
