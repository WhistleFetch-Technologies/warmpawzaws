/**
 * Navigation Types and Helpers
 * Extended navigation types for customer app
 */

import { RootStackParamList, TabParamList } from '../types/navigation';

// Re-export navigation types
export type { RootStackParamList, TabParamList };

// Navigation helper functions
export const navigationHelpers = {
  // Helper to navigate to service detail
  navigateToService: (navigation: any, serviceId: string, vendorId?: string) => {
    navigation.navigate('ServiceDetail', { serviceId, vendorId });
  },

  // Helper to navigate to booking confirmation
  navigateToBookingConfirmation: (navigation: any, bookingId: string) => {
    navigation.navigate('BookingConfirmation', { bookingId });
  },

  // Helper to navigate to booking detail
  navigateToBookingDetail: (navigation: any, bookingId: string) => {
    navigation.navigate('BookingDetail', { bookingId });
  },
};

