/**
 * Navigation Types for Vendor Mobile App
 */

export type RootStackParamList = {
  MainTabs: undefined;
  ServiceDetail: { serviceId: string };
  BookingDetail: { bookingId: string };
  StaffDetail: { staffId: string };
  AddService: undefined;
  EditService: { serviceId: string };
  AddStaff: undefined;
  EditStaff: { staffId: string };
};

export type TabParamList = {
  Dashboard: undefined;
  Bookings: undefined;
  Services: undefined;
  Staff: undefined;
  Profile: undefined;
};

