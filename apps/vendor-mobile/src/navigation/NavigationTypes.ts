/**
 * Navigation Types and Helpers
 * Extended navigation types for vendor app
 */

import { RootStackParamList, TabParamList } from '../types/navigation';

// Re-export navigation types
export type { RootStackParamList, TabParamList };

// Navigation helper functions
export const navigationHelpers = {
  // Helper to navigate to service detail
  navigateToService: (navigation: any, serviceId: string) => {
    navigation.navigate('ServiceDetail', { serviceId });
  },

  // Helper to navigate to booking detail
  navigateToBookingDetail: (navigation: any, bookingId: string) => {
    navigation.navigate('BookingDetail', { bookingId });
  },

  // Helper to navigate to staff detail
  navigateToStaffDetail: (navigation: any, staffId: string) => {
    navigation.navigate('StaffDetail', { staffId });
  },
};

