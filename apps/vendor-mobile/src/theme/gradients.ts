/**
 * Gradient System - Warmpawz Vendor Mobile App
 * Matches web app gradients
 */

export const Gradients = {
  primary: ['#FF8C42', '#FF6B9D'],           // Orange → Pink
  loyalty: ['#FFC857', '#FF8C42'],          // Yellow → Orange
  premium: ['#9B59B6', '#673AB7'],          // Purple → Deep Purple
  success: ['#10B981', '#059669'],          // Green → Emerald
};

/**
 * Get gradient colors for LinearGradient
 */
export const getGradient = (type: keyof typeof Gradients): string[] => {
  return Gradients[type];
};

