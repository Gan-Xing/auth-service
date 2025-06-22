/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./views/**/*.hbs",
    "./src/**/*.{js,ts}",
    "./public/**/*.js"
  ],
  theme: {
    extend: {
      colors: {
        // 保持与现有 CSS 变量一致的颜色
        primary: {
          50: '#f0f4ff',
          100: '#e0ecff', 
          500: '#667eea',
          600: '#5a6fd8',
          700: '#4c63c2',
        },
        secondary: {
          500: '#764ba2',
          600: '#6b4190',
          700: '#5d3679',
        },
        success: {
          500: '#10b981',
          600: '#059669',
        },
        warning: {
          500: '#f59e0b',
          600: '#d97706',
        },
        error: {
          500: '#ef4444',
          600: '#dc2626',
        },
        info: {
          500: '#3b82f6',
          600: '#2563eb',
        }
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
      }
    },
  },
  plugins: [],
}