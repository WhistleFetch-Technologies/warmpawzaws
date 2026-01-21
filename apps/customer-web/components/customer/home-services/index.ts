/**
 * Home Services Module - Unified exports for all home service components
 * 
 * This module provides a comprehensive home services booking flow that includes:
 * - Hyperlocal provider discovery
 * - Real-time GPS tracking
 * - Package tracking and management
 * - OTP-based session start/end
 * - Route tracking for walkers
 */

export { HomeServiceRouter } from './HomeServiceRouter';
export type { HomeServiceType } from './HomeServiceRouter';

// Service-specific configurations
export const HOME_SERVICE_CONFIGS = {
  walking: {
    serviceName: 'Pet Walking',
    serviceIcon: '🚶',
    primaryColor: 'green',
    requiresRouteTracking: true,
    requiresSessionOtp: true,
    roleId: 'pet_walker'
  },
  grooming: {
    serviceName: 'Home Grooming',
    serviceIcon: '✂️',
    primaryColor: 'purple',
    requiresRouteTracking: false,
    requiresSessionOtp: false,
    roleId: 'groomer'
  },
  training: {
    serviceName: 'Home Training',
    serviceIcon: '🎓',
    primaryColor: 'blue',
    requiresRouteTracking: false,
    requiresSessionOtp: true,
    roleId: 'trainer'
  },
  veterinary: {
    serviceName: 'Home Vet Visit',
    serviceIcon: '🏥',
    primaryColor: 'orange',
    requiresRouteTracking: false,
    requiresSessionOtp: false,
    roleId: 'veterinarian'
  },
  sitting: {
    serviceName: 'Pet Sitting',
    serviceIcon: '🏠',
    primaryColor: 'green',
    requiresRouteTracking: false,
    requiresSessionOtp: true,
    roleId: 'pet_sitter'
  },
  nutrition: {
    serviceName: 'Nutritionist Visit',
    serviceIcon: '🥗',
    primaryColor: 'green',
    requiresRouteTracking: false,
    requiresSessionOtp: false,
    roleId: 'nutritionist'
  },
  // ✅ NEW: Added behaviourist and diagnostics
  behaviourist: {
    serviceName: 'Behaviourist Visit',
    serviceIcon: '🧠',
    primaryColor: 'orange',
    requiresRouteTracking: false,
    requiresSessionOtp: true,
    roleId: 'behaviourist'
  },
  diagnostics: {
    serviceName: 'Home Sample Collection',
    serviceIcon: '🧪',
    primaryColor: 'blue',
    requiresRouteTracking: true,
    requiresSessionOtp: false,
    roleId: 'diagnostics'
  }
} as const;
