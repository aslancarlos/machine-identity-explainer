/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'bg':       '#050d1a',
        'bg-card':  '#0c1828',
        'bg-muted': '#0f1e30',
        'border':   '#1a3050',
        'mi-red':   '#e63946',
        'mi-cyan':  '#00d9ff',
        'mi-gold':  '#ffc107',
        'spiffe':   '#10b981',
        'pki':      '#7b5cf6',
        'k8s':      '#1f6feb',
        'mtls':     '#f97316',
      },
      fontFamily: {
        'sans': ['Inter', 'system-ui', 'sans-serif'],
        'mono': ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-up':    'fadeUp 0.6s ease-out',
      },
      keyframes: {
        fadeUp: {
          '0%':   { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)'    },
        },
      },
    },
  },
  plugins: [],
}
