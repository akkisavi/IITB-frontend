import daisyui from 'daisyui';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Bricolage Grotesque"', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [daisyui],
  daisyui: {
    logs: false,
    themes: [
      {
        depot: {
          // Warm industrial greys (stone) + clay accent for logistics; green/red reserved for slot state.
          primary: '#B45309',
          'primary-content': '#FFFFFF',
          secondary: '#44403C',
          'secondary-content': '#FFFFFF',
          accent: '#B45309',
          'accent-content': '#FFFFFF',
          neutral: '#292524',
          'neutral-content': '#F5F5F4',
          'base-100': '#FFFFFF',
          'base-200': '#F5F5F4',
          'base-300': '#E7E5E4',
          'base-content': '#1C1917',
          info: '#1D4ED8',
          'info-content': '#FFFFFF',
          success: '#15803D',
          'success-content': '#FFFFFF',
          warning: '#A16207',
          'warning-content': '#FFFFFF',
          error: '#B91C1C',
          'error-content': '#FFFFFF',
          '--rounded-box': '0.5rem',
          '--rounded-btn': '0.375rem',
          '--rounded-badge': '0.125rem',
          '--animation-btn': '0',
          '--animation-input': '0',
          '--btn-focus-scale': '1',
        },
      },
    ],
    darkTheme: false,
  },
};
