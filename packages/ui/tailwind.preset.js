/**
 * Warmpawz Design System - Tailwind Preset
 * 
 * Usage in app's tailwind.config.js:
 * module.exports = {
 *   presets: [require('@warmpawz/ui/tailwind.preset')],
 *   // ... app-specific overrides
 * }
 */

/** @type {import('tailwindcss').Config} */
module.exports = {
  theme: {
    extend: {
      // Colors - Synced from Warmpawz Ecosystem Development tokens.json
      colors: {
        // Primary Orange
        primary: {
          DEFAULT: '#FF8C42',
          light: '#FFA366',
          dark: '#FF6B35',
          50: '#FFF5EE',
          100: '#FFE8D6',
          500: '#FF8C42',
          600: '#FF6B35',
          700: '#E55A2B',
        },
        // Secondary Pink
        pink: {
          DEFAULT: '#FF6B9D',
          light: '#FFD1E3',
          50: '#FFF0F6',
          500: '#FF6B9D',
          600: '#E91E63',
        },
        // Service-Specific Colors
        service: {
          veterinary: '#26C6DA',
          grooming: '#FF6B9D',
          training: '#9B59B6',
          boarding: '#FF8C42',
          walking: '#4CAF50',
          nutrition: '#FFC857',
          pharmacy: '#2196F3',
          adoption: '#E91E63',
          insurance: '#673AB7',
        },
        // Accent Blue
        blue: {
          DEFAULT: '#2196F3',
          light: '#D9EBFF',
          50: '#EEF2FF',
          500: '#2196F3',
          600: '#1976D2',
        },
        // Accent Green
        green: {
          DEFAULT: '#4CAF50',
          light: '#EDFFEE',
          50: '#EDFFEE',
          500: '#4CAF50',
          600: '#388E3C',
        },
        // Accent Purple
        purple: {
          DEFAULT: '#9B59B6',
          light: '#F3EAFF',
          50: '#F3EAFF',
          500: '#9B59B6',
          600: '#673AB7',
        },
        // Accent Teal
        teal: {
          DEFAULT: '#26C6DA',
          light: '#E0F7FA',
          50: '#E0F7FA',
          500: '#26C6DA',
          600: '#00ACC1',
        },
        // Semantic
        success: '#4CAF50',
        error: '#EF4444',
        warning: '#FFC857',
        info: '#2196F3',
      },
      
      // Typography
      fontFamily: {
        sans: ['Baloo 2', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        mono: ['Fira Code', 'monospace'],
      },
      
      // Border Radius
      borderRadius: {
        'sm': '4px',
        'DEFAULT': '8px',
        'md': '8px',
        'lg': '12px',
        'xl': '16px',
        '2xl': '24px',
        '3xl': '32px',
      },
      
      // Box Shadow
      boxShadow: {
        'sm': '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        'DEFAULT': '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)',
        'md': '0 4px 6px -1px rgba(0, 0, 0, 0.07), 0 2px 4px -2px rgba(0, 0, 0, 0.05)',
        'lg': '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
        'xl': '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
        'primary': '0 4px 14px 0 rgba(255, 140, 66, 0.3)',
        'primaryHover': '0 6px 20px 0 rgba(255, 140, 66, 0.4)',
        'card': '0 4px 12px 0 rgba(0, 0, 0, 0.08)',
        'cardHover': '0 8px 24px 0 rgba(0, 0, 0, 0.12)',
      },
      
      // Height shortcuts
      height: {
        '13': '3.25rem', // 52px - lg button
      },
      
      // Animation
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
    },
  },
};

