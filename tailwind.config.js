/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  safelist: [
    // Heat map background classes - light mode
    'bg-blue-50',
    'bg-blue-100', 
    'bg-blue-200',
    'bg-blue-300',
    // Heat map background classes - dark mode
    'dark:bg-blue-900/30',
    'dark:bg-blue-800/40',
    'dark:bg-blue-700/50',
    'dark:bg-blue-600/60',
    // Heat map border classes - light mode
    'border-l-4',
    'border-l-blue-300',
    'border-l-blue-400',
    'border-l-blue-500',
    'border-l-blue-600',
    // Heat map border classes - dark mode
    'dark:border-l-blue-400',
    'dark:border-l-blue-300',
    'dark:border-l-blue-200',
    'dark:border-l-blue-100'
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          900: '#1e3a8a',
        },
        difficulty: {
          easy: '#22c55e',
          medium: '#f59e0b',
          hard: '#ef4444',
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Monaco', 'Consolas', 'monospace'],
      }
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}