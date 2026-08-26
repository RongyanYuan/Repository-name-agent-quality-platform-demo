import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#17202b',
        muted: '#667085',
        line: '#e5e7eb',
        panel: '#ffffff',
        canvas: '#f5f7fa',
        pass: '#138a5b',
        fail: '#c43d4b',
        warn: '#bd6b13',
        derived: '#8b6b38',
        accent: '#1d5fd1'
      },
      boxShadow: {
        panel: '0 1px 2px rgba(16, 24, 40, 0.05), 0 4px 14px rgba(16, 24, 40, 0.04)'
      }
    }
  },
  plugins: []
} satisfies Config
