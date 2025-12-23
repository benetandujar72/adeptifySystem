/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './index.html',
    './App.{ts,tsx}',
    './index.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './services/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
