/**
 * Navigation Types for Vendor Mobile App
 * Matches web app vendor flow structure
 */

export type RootStackParamList = {
  Login: undefined;
  RoleSelection: undefined;
  Onboarding: { roleId?: string; vendorType?: string; isMultiStaff?: boolean; roleName?: string; applicationId?: string; mode?: 'new' | 'clarification' | 'resubmit' };
  BusinessTypeSelector: { roleName?: string };
  SoloProviderOnboarding: { roleId?: string; roleName?: string; phone?: string };
  ApplicationSubmitted: { applicationId: string };
  ApplicationPending: undefined;
  ApplicationClarification: { applicationId: string; notes: string };
  ApplicationRejected: { applicationId: string; reason?: string };
  SetupServices: { vendorId: string; roleId?: string };
  SetupAvailability: { vendorId: string };
  SetupCompleted: undefined;
  MainTabs: undefined;
  Dashboard: undefined;
  Bookings: undefined;
  Services: undefined;
  Staff: undefined;
  Schedule: undefined;
  Profile: undefined;
  EditProfile: undefined;
  BookingDetail: { bookingId: string };
  StartService: {
    bookingId: string;
    booking?: any;
  };
  ServiceDetail: { serviceId?: string; service?: any; mode?: 'create' | 'edit' };
  Staff: undefined;
  StaffList: undefined;
  AddStaff: { mode?: 'create' | 'edit'; staffId?: string };
  StaffDetail: { staffId: string; mode?: 'edit' };
  ScheduleManagement: undefined;
  PrescriptionBuilder: { bookingId: string; booking?: any };
  Consultation: { bookingId: string };
  VideoCall: { 
    bookingId: string;
    userId: string;
    userName: string;
    otherUserName: string;
  };
  Chat: { chatId: string; recipientId: string };
};

export type TabParamList = {
  Dashboard: undefined;
  Bookings: undefined;
  Services: undefined;
  Profile: undefined;
};

