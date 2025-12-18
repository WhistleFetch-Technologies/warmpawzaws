/**
 * Brand Colors - Warmpawz Vendor Mobile App
 * Matches web app branding guidelines exactly
 */

export const BrandColors = {
  // Primary Colors
  primary: {
    orange: '#FF8C42',      // Primary brand color
    pink: '#FF6B9D',       // Secondary brand color
    yellow: '#FFC857',     // Loyalty/Rewards
    purple: '#9B59B6',     // Premium features
  },
  
  // Service Colors (matching web app)
  services: {
    veterinary: '#26C6DA',   // Teal
    grooming: '#FF6B9D',    // Pink
    training: '#9B59B6',    // Purple
    boarding: '#FF8C42',    // Orange
    walking: '#4CAF50',     // Green
    nutrition: '#FFC857',   // Yellow
    pharmacy: '#2196F3',    // Blue
    adoption: '#E91E63',    // Deep Pink
    insurance: '#673AB7',   // Deep Purple
    ambulance: '#EF4444',   // Red (Emergency)
    cafe: '#D97706',        // Amber
    photography: '#8B5CF6',  // Violet
    breeder: '#F59E0B',     // Orange
    relocation: '#06B6D4',  // Cyan
    resort: '#14B8A6',      // Teal
    holiday: '#0891B2',     // Sky
    sunset: '#9333EA',     // Purple
  },
  
  // Semantic Colors
  semantic: {
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    info: '#3B82F6',
  },
  
  // Neutral Colors
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
};

/**
 * Get service color by service type
 */
export const getServiceColor = (serviceType: string): string => {
  const normalizedType = serviceType.toLowerCase().replace(/\s+/g, '');
  return BrandColors.services[normalizedType as keyof typeof BrandColors.services] || BrandColors.primary.orange;
};

/**
 * Get service color with opacity for backgrounds
 */
export const getServiceColorWithOpacity = (serviceType: string, opacity: number = 0.1): string => {
  const color = getServiceColor(serviceType);
  // Convert hex to rgba
  const hex = color.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

