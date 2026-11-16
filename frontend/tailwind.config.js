/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Outfit', 'Plus Jakarta Sans', 'Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        brand: {
          50: '#fffdf0',
          100: '#fef9c3', // soft light yellow
          200: '#fef08a', // sunny light yellow
          300: '#fde047', // bright light yellow
          400: '#facc15', // Aptech gold yellow
          500: '#f59e0b', // Aptech signature warm yellow
          600: '#d97706', // amber gold
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
          950: '#451a03',
        },
        slate: {
          850: '#15171e',
          900: '#0f1117',
          950: '#090a0f',
        },
        aptech: {
          yellow: '#f59e0b',
          lightYellow: '#fef08a',
          softCream: '#fffdf0',
          gold: '#d97706',
          dark: '#16171d',
          charcoal: '#22232a',
        }
      },
    },
  },
  plugins: [],
}

