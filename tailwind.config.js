/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#090d16',
        surface: '#0f172a',
        'surface-elevated': '#1e293b',
        'surface-card': '#131e33',
        border: '#1e293b',
        'border-highlight': '#334155',
        primary: {
          DEFAULT: '#06b6d4', // cyan-500
          hover: '#0891b2',
          light: '#22d3ee',
          dark: '#0e7490',
        },
        accent: {
          DEFAULT: '#6366f1', // indigo-500
          hover: '#4f46e5',
        },
        success: '#10b981',
        warning: '#f59e0b',
        danger: '#ef4444',
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
    },
  },
  plugins: [],
};
