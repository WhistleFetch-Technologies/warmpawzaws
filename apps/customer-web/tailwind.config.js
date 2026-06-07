/** @type {import('tailwindcss').Config} */
module.exports = {
  // Use Warmpawz design system preset
  presets: [require('../../packages/ui/tailwind.preset')],
  
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    '../../packages/ui/src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  
  theme: {
    extend: {
      /** Fluid app column: full width on phones, capped on tablet/desktop; avoids hard 430px clipping */
      maxWidth: {
        /** Full width on narrow viewports; cap ~512px on large screens; pair with mx-auto + w-full */
        customer: 'min(100%, 32rem)',
        /** Cart / checkout two-column layout on desktop (pair with max-w-customer on mobile) */
        ecommerce: 'min(100%, 72rem)',
      },
      minHeight: {
        'screen-dynamic': '100dvh',
      },
    },
  },
  
  plugins: [],
};
