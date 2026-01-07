/**
 * WARMPAWZ HIGH-FIDELITY DESIGN TOKENS
 * Based on the mobile design system assets
 */

// ==================== PRIMARY COLOR PALETTE ====================
export const WARM_ORANGE = '#FF8C42';      // Primary brand orange
export const WHITE = '#FFFFFF';
export const BLACK = '#000000';
export const DARK_ORANGE_GOLD = '#E67A2E';  // Darker orange/gold from palette

// ==================== LOGO ASSETS ====================
/**
 * Warmpawz Logo - Main brand logo
 * Located in public folder for Vite static asset serving
 */
export const LOGO_CIRCULAR_ORANGE = '/warmpawz-logo-1.svg';

// Fallback to base64 if file not found (for backward compatibility during transition)
export const LOGO_CIRCULAR_ORANGE_FALLBACK = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8Y2lyY2xlIGN4PSIyMCIgY3k9IjIwIiByPSIyMCIgZmlsbD0iI0ZGODNDMiIvPgogIDxwYXRoIGQ9Ik0yMCAxMkMxNi42ODYzIDEyIDE0IDE0LjY4NjMgMTQgMThDMTQgMTkuNTkxMyAxNC42MzIxIDIxLjAyNjEgMTUuNjU2OSAyMi4wNTE0QzE2LjY4NjMgMjMuMDc2NyAxOC4xMTY1IDIzLjcwODggMTkuNzA3NyAyMy43MDg4QzIxLjI5ODkgMjMuNzA4OCAyMi43MzM3IDIzLjA3NjcgMjMuNzU4NSAyMi4wNTE0QzI0Ljc4MzMgMjEuMDI2MSAyNS40MTU0IDE5LjU5MTMgMjUuNDE1NCAxOEMyNS40MTU0IDE0LjY4NjMgMjIuNzI5MSAxMiAxOS40MTU0IDEySDIwWk0yMCAxNEMyMS42NTY5IDE0IDIzIDE1LjM0MzEgMjMgMTdDMjMgMTguNjU2OSAyMS42NTY5IDIwIDIwIDIwQzE4LjM0MzEgMjAgMTcgMTguNjU2OSAxNyAxN0MxNyAxNS4zNDMxIDE4LjM0MzEgMTQgMjAgMTRaIiBmaWxsPSIjMDAwMDAwIi8+CiAgPHBhdGggZD0iTTEyIDI0QzEyIDI0LjU1MjMgMTIuNDQ3NyAyNSAxMyAyNUgyN0MyNy41NTIzIDI1IDI4IDI0LjU1MjMgMjggMjRDMjggMjIuMzQzMSAyNi42NTY5IDIxIDI1IDIxSDE1QzEzLjM0MzEgMjEgMTIgMjIuMzQzMSAxMiAyNFoiIGZpbGw9IiMwMDAwMDAiLz4KICA8Y2lyY2xlIGN4PSIzMCIgY3k9IjMwIiByPSI2IiBmaWxsPSIjMDAwMDAwIiBvcGFjaXR5PSIwLjciLz4KPC9zdmc+';

/**
 * Welcome Text Logo
 */
export const WELCOME_TEXT = 'Welcome to WARMPAWZ!';

// ==================== BUTTON STYLES ====================
export const BUTTON_VARIANTS = {
  solid: {
    background: WARM_ORANGE,
    color: WHITE,
    border: 'none',
    borderRadius: '8px',
    padding: '12px 24px',
    hover: '#FF7A2E',
    active: DARK_ORANGE_GOLD,
  },
  outlined: {
    background: 'transparent',
    color: WARM_ORANGE,
    border: `2px solid ${WARM_ORANGE}`,
    borderRadius: '8px',
    padding: '12px 24px',
    hover: '#FFF5F0',
    active: '#FFE5D6',
  },
  disabled: {
    background: '#FFD9BF',
    color: WHITE,
    border: 'none',
    borderRadius: '8px',
    padding: '12px 24px',
    opacity: 0.6,
  },
  icon: {
    background: 'transparent',
    color: WARM_ORANGE,
    border: `2px solid ${WARM_ORANGE}`,
    borderRadius: '8px',
    padding: '12px 16px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
};

// ==================== SERVICE CARD STYLES ====================
export const SERVICE_CARD_STYLES = {
  default: {
    background: WHITE,
    border: '1px solid #E5E7EB',
    borderRadius: '12px',
    padding: '16px',
    indicator: '#9CA3AF', // Gray circle
  },
  selected: {
    background: WHITE,
    border: `2px solid ${WARM_ORANGE}`,
    borderRadius: '12px',
    padding: '16px',
    indicator: WARM_ORANGE, // Orange circle
  },
};

// ==================== NAVIGATION BAR STYLES ====================
export const NAV_BAR_STYLES = {
  background: WHITE,
  height: '64px',
  borderTop: '1px solid #E5E7EB',
  item: {
    default: {
      color: '#6B7280',
      background: 'transparent',
    },
    active: {
      color: WHITE,
      background: WARM_ORANGE,
      borderRadius: '8px',
    },
  },
};

// ==================== SERVICE CONFIGURATION CARD STYLES ====================
export const SERVICE_CONFIG_STYLES = {
  background: WHITE,
  border: '1px solid #E5E7EB',
  borderRadius: '12px',
  padding: '16px',
  activeBorder: `2px solid ${WARM_ORANGE}`,
  toggle: {
    on: WARM_ORANGE,
    off: '#D1D5DB',
  },
  badge: {
    background: '#FFF5F0',
    color: WARM_ORANGE,
    borderRadius: '6px',
    padding: '4px 8px',
    fontSize: '12px',
  },
};

// ==================== LOCATION/MAP STYLES ====================
export const MAP_STYLES = {
  background: WHITE,
  border: '1px solid #E5E7EB',
  borderRadius: '12px',
  placeholder: {
    background: '#F3F4F6',
    text: '#9CA3AF',
  },
  pin: {
    color: '#EF4444', // Red pin
    size: '24px',
  },
  selected: {
    background: '#F0FDF4',
    border: `2px solid #10B981`,
    borderRadius: '12px',
    checkmark: '#10B981',
  },
};

// ==================== DATE/TIME SELECTOR STYLES ====================
export const DATE_SELECTOR_STYLES = {
  container: {
    display: 'flex',
    gap: '8px',
  },
  button: {
    default: {
      background: WHITE,
      color: '#6B7280',
      border: '1px solid #E5E7EB',
      borderRadius: '8px',
      padding: '8px 16px',
    },
    active: {
      background: WARM_ORANGE,
      color: WHITE,
      border: 'none',
      borderRadius: '8px',
      padding: '8px 16px',
    },
  },
};

// ==================== INPUT FIELD STYLES ====================
export const INPUT_STYLES = {
  background: WHITE,
  border: '1px solid #D1D5DB',
  borderRadius: '8px',
  padding: '12px 16px',
  focus: {
    border: `2px solid ${WARM_ORANGE}`,
    outline: 'none',
  },
  placeholder: '#9CA3AF',
};

// ==================== TYPOGRAPHY ====================
export const TYPOGRAPHY = {
  heading: {
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontWeight: 600,
    color: BLACK,
  },
  body: {
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontWeight: 400,
    color: '#374151',
  },
  caption: {
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontWeight: 400,
    fontSize: '12px',
    color: '#6B7280',
  },
};

// ==================== SPACING ====================
export const SPACING = {
  xs: '4px',
  sm: '8px',
  md: '16px',
  lg: '24px',
  xl: '32px',
  '2xl': '48px',
};

// ==================== BORDER RADIUS ====================
export const RADIUS = {
  sm: '4px',
  md: '8px',
  lg: '12px',
  xl: '16px',
  full: '9999px',
};

// ==================== SHADOWS ====================
export const SHADOWS = {
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
};

// ==================== EXPORT ALL ====================
export default {
  WARM_ORANGE,
  WHITE,
  BLACK,
  DARK_ORANGE_GOLD,
  LOGO_CIRCULAR_ORANGE,
  WELCOME_TEXT,
  BUTTON_VARIANTS,
  SERVICE_CARD_STYLES,
  NAV_BAR_STYLES,
  SERVICE_CONFIG_STYLES,
  MAP_STYLES,
  DATE_SELECTOR_STYLES,
  INPUT_STYLES,
  TYPOGRAPHY,
  SPACING,
  RADIUS,
  SHADOWS,
};

