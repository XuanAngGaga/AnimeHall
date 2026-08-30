/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary: { 50: '#f0f4ff', 100: '#dbe4ff', 200: '#bac8ff', 300: '#91a7ff', 400: '#748ffc', 500: '#5c7cfa', 600: '#4c6ef5', 700: '#4263eb', 800: '#3b5bdb', 900: '#364fc7' },
        dark: { 50: '#C1C2C5', 100: '#A6A7AB', 200: '#909296', 300: '#5C5F66', 400: '#373A40', 500: '#2C2E33', 600: '#25262B', 700: '#1A1B1E', 800: '#141517', 900: '#101113' },
      },
    },
  },
  plugins: [],
};