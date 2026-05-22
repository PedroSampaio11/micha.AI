/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
      },
      keyframes: {
        fadeIn: { from: { opacity: '0' }, to: { opacity: '1' } },
        slideUp: { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
      },
    },
  },
  safelist: [
    'bg-amber-50','bg-amber-100','border-amber-200','text-amber-700',
    'bg-blue-50','bg-blue-100','border-blue-200','text-blue-700',
    'bg-emerald-50','bg-emerald-100','border-emerald-200','text-emerald-700',
    'bg-violet-50','bg-violet-100','border-violet-200','text-violet-700',
    'bg-rose-50','bg-rose-100','border-rose-200','text-rose-700',
  ],
  plugins: [],
}
