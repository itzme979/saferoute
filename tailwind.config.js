/**
 * Colours are CSS variables (see src/index.css) so the whole app switches to
 * dark mode by toggling the `dark` class on <html>, without per-component
 * `dark:` variants. Where a colour plays different roles (e.g. `bg-white` is a
 * card surface but `text-white` sits on a filled button), the role-specific
 * overrides below keep each one readable in both themes.
 */
const v = (name) => `rgb(var(--c-${name}) / <alpha-value>)`;
const scale = (name, shades) => Object.fromEntries(shades.map((s) => [s, v(`${name}-${s}`)]));

const navy = { DEFAULT: v('navy'), ...scale('navy', [50, 100, 600, 700, 800, 900]) };
const teal = { DEFAULT: v('teal-500'), ...scale('teal', [50, 100, 200, 500, 600, 700, 800]) };
const coral = scale('coral', [50, 100, 500, 600, 700]);
const sky = { DEFAULT: v('sky-100'), ...scale('sky', [50, 100, 200]) };

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        white: v('surface'),
        navy,
        sky,
        teal,
        warm: v('warm'),
        mist: v('mist'),
        charcoal: v('charcoal'),
        amber: scale('amber', [50, 100, 500, 700]),
        coral,
        slate: scale('slate', [200, 300, 400, 500, 600, 700]),
      },
      // Text on filled buttons and navy panels stays light in both themes.
      textColor: {
        white: '#ffffff',
        sky: { DEFAULT: '#DCEBFA', 50: '#F2F8FE', 100: '#DCEBFA', 200: '#BFD9F3' },
        teal: { ...teal, 200: '#A6DCD4' },
      },
      // Filled navy/teal/coral buttons stay saturated in both themes.
      backgroundColor: {
        navy: { ...navy, DEFAULT: v('navy-fill'), 600: v('navy-fill-hover') },
        teal: { ...teal, 700: '#2E776D' },
        coral: { ...coral, 700: '#963C2B' },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      boxShadow: {
        soft: 'var(--shadow-soft)',
        lift: 'var(--shadow-lift)',
      },
      borderRadius: { xl2: '1.25rem' },
      keyframes: {
        // End states use `transform: none` so animated wrappers don't become
        // containing blocks for position:fixed descendants.
        'fade-up': { from: { opacity: 0, transform: 'translateY(6px)' }, to: { opacity: 1, transform: 'none' } },
        'fade-in': { from: { opacity: 0 }, to: { opacity: 1 } },
        'scale-in': { from: { opacity: 0, transform: 'scale(0.97)' }, to: { opacity: 1, transform: 'none' } },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        'slide-in': { from: { opacity: 0, transform: 'translateY(-8px)' }, to: { opacity: 1, transform: 'none' } },
        pulse_ring: { '0%': { transform: 'scale(0.8)', opacity: 0.6 }, '100%': { transform: 'scale(2.2)', opacity: 0 } },
      },
      animation: {
        'fade-up': 'fade-up 220ms ease-out both',
        'fade-in': 'fade-in 180ms ease-out both',
        'scale-in': 'scale-in 180ms ease-out both',
        'slide-in': 'slide-in 200ms ease-out both',
        shimmer: 'shimmer 1.4s infinite',
        'pulse-ring': 'pulse_ring 1.8s ease-out infinite',
      },
    },
  },
  plugins: [],
};
