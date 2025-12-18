/**
 * Brand Colors - Warmpawz Customer Mobile App
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
  service: {
    vet: '#26C6DA',        // Teal
    veterinary: '#26C6DA',  // Teal
    grooming: '#FF6B9D',   // Pink
    training: '#9B59B6',   // Purple
    boarding: '#FF8C42',   // Orange
    walking: '#4CAF50',    // Green
    nutrition: '#FFC857',  // Yellow
    pharmacy: '#2196F3',   // Blue
    adoption: '#E91E63',   // Deep Pink
    insurance: '#673AB7',  // Deep Purple
    ambulance: '#EF4444',  // Red (Emergency)
    cafe: '#D97706',       // Amber
    photography: '#8B5CF6', // Violet
    breeder: '#F59E0B',    // Orange
    relocation: '#06B6D4', // Cyan
    resort: '#14B8A6',     // Teal
    holiday: '#0891B2',    // Sky
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
 * Get service color by type
 */
export const getServiceColor = (serviceType: string): string => {
  const normalizedType = serviceType.toLowerCase().replace(/\s+/g, '_');
  return BrandColors.service[normalizedType as keyof typeof BrandColors.service] || BrandColors.primary.orange;
};

