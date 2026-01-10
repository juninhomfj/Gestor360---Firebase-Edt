/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",

    // ✅ projeto SEM /src: captura tudo na raiz
    "./*.{js,ts,jsx,tsx}",

    // ✅ e também subpastas comuns na raiz
    "./components/**/*.{js,ts,jsx,tsx}",
    "./services/**/*.{js,ts,jsx,tsx}",
    "./utils/**/*.{js,ts,jsx,tsx}",
    "./config/**/*.{js,ts,jsx,tsx}",
    "./data/**/*.{js,ts,jsx,tsx}",
    "./storage/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1'
        },
        basic: {
          50: '#ecfdf5',
          100: '#d1fae5',
          500: '#10b981',
          600: '#059669',
          700: '#047857'
        },
        natal: {
          50: '#fef2f2',
          100: '#fee2e2',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c'
        }
      },
      animation: {
        swing: 'swing 1s ease-in-out',
        float: 'float 4s ease-in-out infinite',
        aurora: 'aurora 12s ease infinite',
        'nav-pop': 'nav-pop 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards',
        'plane-takeoff': 'plane-takeoff 2.2s cubic-bezier(0.45, 0.05, 0.55, 0.95) forwards',
        'success-pop': 'success-pop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        countdown: 'countdown linear forwards'
      },
      keyframes: {
        swing: {
          '0%, 100%': { transform: 'rotate(0)' },
          '20%': { transform: 'rotate(10deg)' },
          '40%': { transform: 'rotate(-10deg)' },
          '60%': { transform: 'rotate(5deg)' },
          '80%': { transform: 'rotate(-5deg)' }
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' }
        },
        aurora: {
          '0%': { 'background-position': '0% 50%' },
          '50%': { 'background-position': '100% 50%' },
          '100%': { 'background-position': '0% 50%' }
        },
        'nav-pop': {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' }
        },
        'plane-takeoff': {
          '0%': { transform: 'translate(-150px, 150px) rotate(0deg) scale(0.5)', opacity: '0' },
          '30%': { transform: 'translate(0, 0) rotate(-15deg) scale(1)', opacity: '1' },
          '70%': { transform: 'translate(100px, -100px) rotate(-25deg) scale(1.1)', opacity: '1' },
          '100%': { transform: 'translate(300px, -300px) rotate(-35deg) scale(0.8)', opacity: '0' }
        },
        'success-pop': {
          '0%': { transform: 'scale(0.4)', opacity: '0' },
          '80%': { transform: 'scale(1.1)', opacity: '1' },
          '100%': { transform: 'scale(1)', opacity: '1' }
        },
        countdown: {
          from: { 'stroke-dashoffset': '0' },
          to: { 'stroke-dashoffset': '56.54' }
        }
      }
    }
  },
  plugins: []
};