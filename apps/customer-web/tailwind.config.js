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
      // App-specific overrides can go here
    },
  },
  
  plugins: [],
};
