/**
 * Navigation Types for Customer Mobile App
 */

export type RootStackParamList = {
  MainTabs: undefined;
  ServiceDetail: { serviceId: string; vendorId?: string };
  BookingConfirmation: { bookingId: string };
  BookingDetail: { bookingId: string };
  ProviderProfile: { providerId: string; providerType: 'staff' | 'vendor' };
  Payment: { bookingId: string; amount: number };
  Chat: { chatId: string; recipientId: string };
};

export type TabParamList = {
  Home: undefined;
  Search: undefined;
  Bookings: undefined;
  Profile: undefined;
};

