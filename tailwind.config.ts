import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: '#1a2b6b',
          mid: '#243580',
        },
        orange: {
          DEFAULT: '#e8431a',
          dark: '#c73510',
        },
        muted: '#5c6a80',
        'off-white': '#f5f7fb',
      },
      fontFamily: {
        syne: ['var(--font-syne)', 'sans-serif'],
        dm: ['var(--font-dm-sans)', 'sans-serif'],
        montserrat: ['var(--font-montserrat)', 'Montserrat', 'sans-serif'],
      },
      borderRadius: {
        card: '16px',
        sm: '10px',
      },
      boxShadow: {
        card: '0 18px 45px rgba(15,23,42,0.08)',
        'card-hover': '0 18px 45px rgba(15,23,42,0.12)',
        'orange-glow': '0 8px 28px rgba(232,67,26,0.35)',
      },
      backgroundImage: {
        'hero-grid':
          'linear-gradient(rgba(26,43,107,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(26,43,107,0.06) 1px, transparent 1px)',
      },
      backgroundSize: {
        grid: '56px 56px',
      },
      animation: {
        float: 'float 4s ease-in-out infinite',
        'modal-in': 'modalIn 0.25s ease',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-12px)' },
        },
        modalIn: {
          from: { opacity: '0', transform: 'scale(0.95)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
      },
    },
  },
  plugins: [],
}

export default config
