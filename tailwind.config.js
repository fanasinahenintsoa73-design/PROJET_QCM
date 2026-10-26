/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#15201B',
        canvas: '#F5F7F3',
        surface: '#FFFFFF',
        cloud: '#EEF2ED',
        line: '#D7DED8',
        hairline: '#D7DED8',
        'hairline-soft': '#E5EAE5',
        mute: '#657069',
        stone: '#8C978F',
        charcoal: '#2C3A32',
        ash: '#405047',
        accent: '#0B6B4F',
        'accent-deep': '#084C39',
        'accent-soft': '#E4F0EA',
        sale: '#B42318',
        danger: '#B42318',
        'danger-soft': '#FBE9E7',
        success: '#0B6B4F',
        'success-bright': '#16845F',
        'success-soft': '#E4F0EA',
        warning: '#985B12',
        'warning-soft': '#F8ECD9',
        info: '#2F5FD0',
        'info-soft': '#E8EEFC',
        'accent-pink': '#ed1aa0',
        'accent-purple': '#beaffd',
        'accent-teal': '#0a7281',
      },
      fontFamily: {
        display: ['"Source Serif 4"', 'Georgia', 'serif'],
        serif: ['"Source Serif 4"', 'Georgia', 'serif'],
        sans: ['Inter', 'Helvetica', 'Arial', 'sans-serif'],
      },
      fontSize: {
        display: ['clamp(3.25rem, 7vw, 5.75rem)', { lineHeight: '0.98', letterSpacing: '-0.025em' }],
        'display-sm': ['clamp(2.5rem, 5vw, 4rem)', { lineHeight: '1', letterSpacing: '-0.02em' }],
        'heading-xl': ['2rem', { lineHeight: '1.2' }],
        'heading-lg': ['1.5rem', { lineHeight: '1.2' }],
      },
      borderRadius: {
        pill: '9999px',
        md2: '18px',
        lg2: '26px',
      },
      maxWidth: {
        content: '1280px',
      },
      boxShadow: {
        hairline: 'inset 0 -1px 0 #E5EAE5',
        soft: '0 18px 45px -32px rgba(21, 32, 27, 0.35)',
      },
      keyframes: {
        marquee: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
      animation: {
        marquee: 'marquee 30s linear infinite',
        'fade-up': 'fade-up .4s cubic-bezier(.2,.8,.2,1) both',
        'fade-in': 'fade-in .2s ease both',
      },
    },
  },
  plugins: [],
}
