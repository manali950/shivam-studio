/** Tenant colours are CSS variables (set by TenantProvider) so each studio can re-theme at runtime. */
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;
 
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: v('brand'), dark: v('brand-dark'), soft: v('brand-soft'), contrast: v('brand-contrast') },
        accent: { DEFAULT: v('accent'), soft: v('accent-soft') },
        ink: { DEFAULT: '#1d1b19', 2: '#3b3834', muted: '#6f6a63', faint: '#9a948b' },
        paper: { DEFAULT: '#faf8f4', 2: '#f3efe8', 3: '#e9e3d8' },
        line: '#e6e0d5',
      },
      fontFamily: {
        serif: ['"Cormorant Garamond"', '"Playfair Display"', 'Georgia', 'serif'],
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgb(29 27 25 / 0.05), 0 1px 1px rgb(29 27 25 / 0.03)',
        pop: '0 10px 30px -10px rgb(29 27 25 / 0.25)',
      },
      keyframes: {
        fadeUp: { from: { opacity: 0, transform: 'translateY(12px)' }, to: { opacity: 1, transform: 'none' } },
        fadeIn: { from: { opacity: 0 }, to: { opacity: 1 } },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        kenburns: { from: { transform: 'scale(1.06)' }, to: { transform: 'scale(1.16)' } },
        slideIn: { from: { transform: 'translateX(100%)' }, to: { transform: 'none' } },
      },
      animation: {
        'fade-up': 'fadeUp .6s cubic-bezier(.2,.7,.2,1) both',
        'fade-in': 'fadeIn .3s ease both',
        kenburns: 'kenburns 24s ease-in-out infinite alternate',
        'slide-in': 'slideIn .25s cubic-bezier(.2,.7,.2,1) both',
      },
    },
  },
  plugins: [],
};