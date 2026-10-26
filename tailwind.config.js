/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#111111',
        canvas: '#ffffff',
        cloud: '#f5f5f5',
        hairline: '#cacacb',
        'hairline-soft': '#e5e5e5',
        mute: '#707072',
        stone: '#9e9ea0',
        charcoal: '#39393b',
        ash: '#4b4b4d',
        sale: '#d30005',
        success: '#007d48',
        'success-bright': '#1eaa52',
        info: '#1151ff',
        'accent-pink': '#ed1aa0',
        'accent-purple': '#beaffd',
        'accent-teal': '#0a7281',
      },
      fontFamily: {
        display: ['"Bebas Neue"', '"Arial Narrow"', 'Impact', 'sans-serif'],
        sans: ['Inter', 'Helvetica', 'Arial', 'sans-serif'],
      },
      fontSize: {
        display: ['clamp(4rem, 11vw, 9.5rem)', { lineHeight: '0.86', letterSpacing: '0.005em' }],
        'display-sm': ['clamp(3rem, 7vw, 5.5rem)', { lineHeight: '0.9' }],
        'heading-xl': ['2rem', { lineHeight: '1.2' }],
        'heading-lg': ['1.5rem', { lineHeight: '1.2' }],
      },
      borderRadius: {
        pill: '9999px',
        md2: '24px',
        lg2: '30px',
      },
      maxWidth: {
        content: '100%',
      },
      boxShadow: {
        hairline: 'inset 0 -1px 0 #e5e5e5',
      },
      keyframes: {
        marquee: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
      animation: {
        marquee: 'marquee 30s linear infinite',
        'fade-up': 'fade-up .5s cubic-bezier(.2,.8,.2,1) both',
        'fade-in': 'fade-in .25s ease both',
      },
    },
  },
  plugins: [],
}
