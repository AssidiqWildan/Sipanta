/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: { navy: '#0c2340', ink: '#14283b', mut: '#5c6f80', line: '#dbe3ea', water: '#2f9bd6', brand: '#1668b8', ok: '#2f8f5b', warn: '#b77a06', fail: '#c8402f' },
      fontFamily: { display: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'], sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'], mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'] },
    },
  },
  plugins: [],
};
