/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          DEFAULT: '#2563eb',
          dark: '#1d4ed8',
          light: '#bfdbfe',
        },
        slate: {
          950: '#020617',
        },
      },
      boxShadow: {
        card: '0 20px 45px -24px rgba(15,23,42,0.45)',
      },
    },
  },
  plugins: [],
};

