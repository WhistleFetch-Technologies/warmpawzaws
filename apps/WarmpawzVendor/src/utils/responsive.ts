/**
 * Responsive Design Utilities
 * Helper functions for responsive sizing across different screen sizes
 */

import { Dimensions, PixelRatio } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Base dimensions (iPhone 12/13 Pro - 390x844)
const BASE_WIDTH = 390;
const BASE_HEIGHT = 844;

/**
 * Scale size based on screen width
 */
export function scale(size: number): number {
  const scale = SCREEN_WIDTH / BASE_WIDTH;
  return Math.round(size * scale);
}

/**
 * Scale size based on screen height
 */
export function verticalScale(size: number): number {
  const scale = SCREEN_HEIGHT / BASE_HEIGHT;
  return Math.round(size * scale);
}

/**
 * Moderate scale - less aggressive scaling
 */
export function moderateScale(size: number, factor: number = 0.5): number {
  return size + (scale(size) - size) * factor;
}

/**
 * Get responsive font size
 */
export function responsiveFontSize(size: number): number {
  const scale = SCREEN_WIDTH / BASE_WIDTH;
  const newSize = size * scale;
  return Math.round(PixelRatio.roundToNearestPixel(newSize));
}

/**
 * Check if device is small screen
 */
export function isSmallScreen(): boolean {
  return SCREEN_WIDTH < 375;
}

/**
 * Check if device is large screen
 */
export function isLargeScreen(): boolean {
  return SCREEN_WIDTH > 414;
}

/**
 * Get screen dimensions
 */
export function getScreenDimensions() {
  return {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    isSmall: isSmallScreen(),
    isLarge: isLargeScreen(),
  };
}

