/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#faf6ee',
          100: '#f4ecd9',
          200: '#e9d7ae',
          300: '#dbbd7d',
          400: '#cda456',
          500: '#bf8b41',
          600: '#a8712f',
          700: '#865a28',
          800: '#6b4822',
          900: '#573c1f',
        },
        paper: {
          50: '#fdfbf5',
          100: '#f8f3e7',
          200: '#efe5cf',
          300: '#e3d3b4',
        },
      },
      fontFamily: {
        display: [
          '"Noto Serif SC"',
          '"Songti SC"',
          '"STSong"',
          'STZhongsong',
          'SimSun',
          'serif',
        ],
      },
    },
  },
  plugins: [],
};