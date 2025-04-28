/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './src/app/**/*.{js,ts,jsx,tsx}',
    './src/components/**/*.{js,ts,jsx,tsx}',
  ],
  safelist: ['animate-aurora', 'after:animate-aurora'],
  theme: {
    extend: {
      keyframes: {
        aurora: {
          '0%, 100%': { 'background-position': '50% 50%' },
          '50%': { 'background-position': '50% 100%' },
        },
      },
      animation: {
        aurora: 'aurora 10s ease infinite',
      },
    },
  },
  plugins: [require('tw-animate-css')],
};
