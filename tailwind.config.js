/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        yellow: {
          50: '#FEF9E7',
          100: '#FDF0C4',
          200: '#FBE389',
          300: '#F9D14E',
          400: '#F5B400',
          500: '#E0A300',
          600: '#C08D00',
          700: '#9A6F00',
          800: '#7A5700',
          900: '#5C4200',
        },
        cream: {
          50: '#FFFEFA',
          100: '#FDF9F0',
          200: '#F8F0DC',
          300: '#F0E4C2',
          400: '#E8D5A5',
        },
        ink: {
          50: '#F6F6F4',
          100: '#E7E7E2',
          200: '#CFCFC7',
          300: '#A8A89E',
          400: '#7A7A6E',
          500: '#5A5A50',
          600: '#3F3F38',
          700: '#2A2A25',
          800: '#1A1A17',
          900: '#0F0F0D',
        },
        success: {
          50: '#F0FDF4',
          100: '#DCFCE7',
          500: '#22C55E',
          600: '#16A34A',
          700: '#15803D',
        },
        warning: {
          50: '#FFFBEB',
          100: '#FEF3C7',
          500: '#F59E0B',
          600: '#D97706',
        },
        error: {
          50: '#FEF2F2',
          100: '#FEE2E2',
          500: '#EF4444',
          600: '#DC2626',
          700: '#B91C1C',
        },
      },
      fontFamily: {
        serif: ['"Cormorant Garamond"', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'display': ['3.5rem', { lineHeight: '1.1', letterSpacing: '-0.02em' }],
        'heading': ['2.5rem', { lineHeight: '1.15', letterSpacing: '-0.01em' }],
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease-out',
        'slide-up': 'slideUp 0.5s ease-out',
        'slide-in': 'slideIn 0.4s ease-out',
        'scale-in': 'scaleIn 0.3s ease-out',
        'shimmer': 'shimmer 2s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideIn: {
          '0%': { opacity: '0', transform: 'translateX(20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      boxShadow: {
        'soft': '0 2px 8px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.03)',
        'card': '0 4px 24px rgba(0,0,0,0.06), 0 1px 4px rgba(0,0,0,0.04)',
        'elevated': '0 12px 40px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.05)',
        'yellow': '0 8px 24px rgba(245,180,0,0.25)',
      },
    },
  },
  plugins: [],
};
