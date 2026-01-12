/**
 * WARMPAWZ BRANDING GUIDELINES & ASSETS
 * 
 * This file contains all brand assets, colors, typography, and design tokens
 * imported from Figma: https://www.figma.com/make/3iZpBgWT8zlJKMY9qC5cn0/Refine-UI-with-Branding-Guidelines
 */

// ==================== BRAND LOGO ====================
export const BRAND_LOGO = 'figma:asset/da6636b92da744b3db8eed5288ca6da9ab889afe.png';

// ==================== BRAND COLORS ====================

/**
 * PRIMARY COLORS
 * Orange palette - Warm, friendly, energetic
 */
export const COLORS = {
  primary: {
    main: '#FF8C42',      // Warm Orange - Primary brand color
    light: '#FFB380',     // Light Orange - Hover states
    lighter: '#FFD9BF',   // Lighter Orange - Backgrounds
    dark: '#E67A2E',      // Dark Orange - Active states
    darker: '#CC6A28',    // Darker Orange - Pressed states
  },
  
  /**
   * SECONDARY COLORS
   * Pink palette - Playful, caring, affectionate
   */
  secondary: {
    main: '#FF6B9D',      // Vibrant Pink
    light: '#FF99B8',     // Light Pink
    lighter: '#FFC7D9',   // Lighter Pink - Backgrounds
    dark: '#E65E8D',      // Dark Pink
    darker: '#CC4F7A',    // Darker Pink
  },
  
  /**
   * ACCENT COLORS
   * Used for specific features and highlights
   */
  accent: {
    yellow: '#FFC857',    // Golden Yellow - Loyalty/Rewards
    purple: '#9B59B6',    // Royal Purple - Premium features
    teal: '#26C6DA',      // Bright Teal - Notifications
    green: '#4CAF50',     // Success Green
    red: '#F44336',       // Error Red
    blue: '#2196F3',      // Info Blue
  },
  
  /**
   * NEUTRAL COLORS
   * Grays for text, borders, backgrounds
   */
  neutral: {
    white: '#FFFFFF',
    gray50: '#F9FAFB',
    gray100: '#F3F4F6',
    gray200: '#E5E7EB',
    gray300: '#D1D5DB',
    gray400: '#9CA3AF',
    gray500: '#6B7280',
    gray600: '#4B5563',
    gray700: '#374151',
    gray800: '#1F2937',
    gray900: '#111827',
    black: '#000000',
  },
  
  /**
   * SEMANTIC COLORS
   * Status and feedback colors
   */
  semantic: {
    success: '#10B981',       // Green for success
    successLight: '#D1FAE5',  // Light success background
    warning: '#F59E0B',       // Amber for warnings
    warningLight: '#FEF3C7',  // Light warning background
    error: '#EF4444',         // Red for errors
    errorLight: '#FEE2E2',    // Light error background
    info: '#3B82F6',          // Blue for information
    infoLight: '#DBEAFE',     // Light info background
  },
  
  /**
   * SERVICE TYPE COLORS
   * Specific colors for different pet services
   */
  services: {
    vet: '#26C6DA',           // Teal - Veterinary
    grooming: '#FF6B9D',      // Pink - Grooming
    training: '#9B59B6',      // Purple - Training
    boarding: '#FF8C42',      // Orange - Boarding
    walking: '#4CAF50',       // Green - Dog Walking
    nutrition: '#FFC857',     // Yellow - Nutrition
    pharmacy: '#2196F3',      // Blue - Pharmacy
    adoption: '#E91E63',      // Deep Pink - Adoption
    insurance: '#673AB7',     // Deep Purple - Insurance
  }
};

// ==================== TYPOGRAPHY ====================

/**
 * FONT FAMILIES
 */
export const FONTS = {
  heading: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  body: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  mono: 'JetBrains Mono, Menlo, Monaco, "Courier New", monospace',
};

/**
 * FONT SIZES
 * Based on 16px base with modular scale
 */
export const FONT_SIZES = {
  xs: '0.75rem',      // 12px
  sm: '0.875rem',     // 14px
  base: '1rem',       // 16px
  lg: '1.125rem',     // 18px
  xl: '1.25rem',      // 20px
  '2xl': '1.5rem',    // 24px
  '3xl': '1.875rem',  // 30px
  '4xl': '2.25rem',   // 36px
  '5xl': '3rem',      // 48px
  '6xl': '3.75rem',   // 60px
};

/**
 * FONT WEIGHTS
 */
export const FONT_WEIGHTS = {
  light: 300,
  normal: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
  extrabold: 800,
};

/**
 * LINE HEIGHTS
 */
export const LINE_HEIGHTS = {
  tight: 1.25,
  normal: 1.5,
  relaxed: 1.75,
  loose: 2,
};

// ==================== SPACING ====================

/**
 * SPACING SCALE
 * 4px base unit
 */
export const SPACING = {
  0: '0',
  1: '0.25rem',   // 4px
  2: '0.5rem',    // 8px
  3: '0.75rem',   // 12px
  4: '1rem',      // 16px
  5: '1.25rem',   // 20px
  6: '1.5rem',    // 24px
  8: '2rem',      // 32px
  10: '2.5rem',   // 40px
  12: '3rem',     // 48px
  16: '4rem',     // 64px
  20: '5rem',     // 80px
  24: '6rem',     // 96px
};

// ==================== BORDER RADIUS ====================

export const BORDER_RADIUS = {
  none: '0',
  sm: '0.25rem',    // 4px
  base: '0.5rem',   // 8px
  md: '0.75rem',    // 12px
  lg: '1rem',       // 16px
  xl: '1.5rem',     // 24px
  '2xl': '2rem',    // 32px
  full: '9999px',   // Fully rounded
};

// ==================== SHADOWS ====================

export const SHADOWS = {
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  base: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
  xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
  '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
  inner: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.05)',
  none: 'none',
};

// ==================== GRADIENTS ====================

export const GRADIENTS = {
  primary: 'linear-gradient(135deg, #FF8C42 0%, #FF6B9D 100%)',
  secondary: 'linear-gradient(135deg, #FF6B9D 0%, #9B59B6 100%)',
  loyalty: 'linear-gradient(135deg, #FFC857 0%, #FFB380 100%)',
  premium: 'linear-gradient(135deg, #9B59B6 0%, #673AB7 100%)',
  success: 'linear-gradient(135deg, #4CAF50 0%, #10B981 100%)',
  warm: 'linear-gradient(135deg, #FFD9BF 0%, #FFC7D9 100%)',
  cool: 'linear-gradient(135deg, #DBEAFE 0%, #D1FAE5 100%)',
};

// ==================== ANIMATIONS ====================

export const ANIMATIONS = {
  duration: {
    fast: '150ms',
    base: '300ms',
    slow: '500ms',
  },
  easing: {
    default: 'cubic-bezier(0.4, 0, 0.2, 1)',
    in: 'cubic-bezier(0.4, 0, 1, 1)',
    out: 'cubic-bezier(0, 0, 0.2, 1)',
    inOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
  },
};

// ==================== BREAKPOINTS ====================

export const BREAKPOINTS = {
  xs: '320px',
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
};

// ==================== Z-INDEX SCALE ====================

export const Z_INDEX = {
  base: 0,
  dropdown: 1000,
  sticky: 1100,
  fixed: 1200,
  modalBackdrop: 1300,
  modal: 1400,
  popover: 1500,
  tooltip: 1600,
  notification: 1700,
};

// ==================== COMPONENT TOKENS ====================

/**
 * BUTTONS
 */
export const BUTTON_STYLES = {
  primary: {
    background: COLORS.primary.main,
    color: COLORS.neutral.white,
    hover: COLORS.primary.light,
    active: COLORS.primary.dark,
    disabled: COLORS.neutral.gray300,
  },
  secondary: {
    background: COLORS.neutral.white,
    color: COLORS.primary.main,
    border: COLORS.primary.main,
    hover: COLORS.primary.lighter,
    active: COLORS.primary.light,
  },
  destructive: {
    background: COLORS.semantic.error,
    color: COLORS.neutral.white,
    hover: '#DC2626',
    active: '#B91C1C',
  },
};

/**
 * CARDS
 */
export const CARD_STYLES = {
  background: COLORS.neutral.white,
  border: COLORS.neutral.gray200,
  borderRadius: BORDER_RADIUS.lg,
  shadow: SHADOWS.base,
  hoverShadow: SHADOWS.md,
  padding: SPACING[6],
};

/**
 * INPUTS
 */
export const INPUT_STYLES = {
  background: COLORS.neutral.white,
  border: COLORS.neutral.gray300,
  borderRadius: BORDER_RADIUS.base,
  focusBorder: COLORS.primary.main,
  errorBorder: COLORS.semantic.error,
  disabled: COLORS.neutral.gray100,
  height: '2.5rem',
  padding: SPACING[3],
};

/**
 * BADGES
 */
export const BADGE_STYLES = {
  success: {
    background: COLORS.semantic.successLight,
    color: COLORS.semantic.success,
  },
  warning: {
    background: COLORS.semantic.warningLight,
    color: COLORS.semantic.warning,
  },
  error: {
    background: COLORS.semantic.errorLight,
    color: COLORS.semantic.error,
  },
  info: {
    background: COLORS.semantic.infoLight,
    color: COLORS.semantic.info,
  },
  primary: {
    background: COLORS.primary.lighter,
    color: COLORS.primary.dark,
  },
};

// ==================== ICONS & ILLUSTRATIONS ====================

/**
 * ICON SIZES
 */
export const ICON_SIZES = {
  xs: '1rem',     // 16px
  sm: '1.25rem',  // 20px
  base: '1.5rem', // 24px
  lg: '2rem',     // 32px
  xl: '3rem',     // 48px
};

/**
 * PET TYPE ICONS
 * Map to lucide-react icons
 */
export const PET_ICONS = {
  dog: 'Dog',
  cat: 'Cat',
  bird: 'Bird',
  fish: 'Fish',
  rabbit: 'Rabbit',
  hamster: 'Circle',  // Placeholder
  other: 'PawPrint',
};

/**
 * SERVICE ICONS
 * Map to lucide-react icons
 */
export const SERVICE_ICONS = {
  vet: 'Stethoscope',
  grooming: 'Scissors',
  training: 'GraduationCap',
  boarding: 'Home',
  walking: 'Footprints',
  nutrition: 'Apple',
  pharmacy: 'Pill',
  adoption: 'Heart',
  insurance: 'Shield',
  emergency: 'Siren',
  tele: 'Video',
};

// ==================== DESIGN PRINCIPLES ====================

/**
 * ACCESSIBILITY
 */
export const A11Y = {
  minTouchTarget: '44px',  // Minimum touch target size
  minContrast: 4.5,        // WCAG AA minimum contrast ratio
  focusRingWidth: '2px',
  focusRingColor: COLORS.primary.main,
  focusRingOffset: '2px',
};

/**
 * LAYOUT GRID
 */
export const GRID = {
  columns: 12,
  gutter: SPACING[4],  // 16px
  margin: SPACING[4],  // 16px
  maxWidth: '1280px',
};

/**
 * CONTENT MAX WIDTHS
 */
export const MAX_WIDTHS = {
  text: '65ch',       // Optimal reading width
  container: '1280px',
  narrow: '640px',
  wide: '1536px',
};

// ==================== BRAND VOICE & TONE ====================

export const BRAND_VOICE = {
  personality: [
    'Warm and caring',
    'Professional yet friendly',
    'Trustworthy and reliable',
    'Playful but not childish',
    'Knowledgeable and helpful',
  ],
  
  tonePrinciples: [
    'Use simple, clear language',
    'Be empathetic and understanding',
    'Avoid jargon unless necessary',
    'Be encouraging and supportive',
    'Show genuine care for pets and owners',
  ],
  
  writingStyle: {
    headings: 'Clear, benefit-focused, action-oriented',
    body: 'Conversational, informative, easy to scan',
    buttons: 'Action verbs, specific outcomes',
    errors: 'Helpful, solution-oriented, never blaming',
    success: 'Celebratory, reinforcing, encouraging',
  },
};

// ==================== EXPORT ALL ====================

export default {
  BRAND_LOGO,
  COLORS,
  FONTS,
  FONT_SIZES,
  FONT_WEIGHTS,
  LINE_HEIGHTS,
  SPACING,
  BORDER_RADIUS,
  SHADOWS,
  GRADIENTS,
  ANIMATIONS,
  BREAKPOINTS,
  Z_INDEX,
  BUTTON_STYLES,
  CARD_STYLES,
  INPUT_STYLES,
  BADGE_STYLES,
  ICON_SIZES,
  PET_ICONS,
  SERVICE_ICONS,
  A11Y,
  GRID,
  MAX_WIDTHS,
  BRAND_VOICE,
};
