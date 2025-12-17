/**
 * Navigation Types for Customer Mobile App
 */

export type RootStackParamList = {
  Login: undefined;
  Onboarding: undefined;
  UserProfile: { journeyStage?: string };
  PetProfile: { prefillData?: any };
  PlanningJourney: { session: any };
  HavePetJourney: { session: any };
  MainTabs: undefined;
  ServiceDetail: { serviceId: string; vendorId?: string };
  BookingDetail: { bookingId: string };
  Cancellation: { bookingId: string; booking?: any };
  Reschedule: { bookingId: string; booking?: any };
  PrescriptionView: { prescriptionId: string };
  MedicalHistory: { petId: string };
  CafeBooking: { vendorId: string; vendorName: string };
  ResortBooking: { vendorId: string; vendorName: string };
  InsurancePlans: { vendorId?: string };
  InsurancePurchase: { planId: string; petId: string };
  InsuranceClaims: { policyId: string };
  HolidayPackages: undefined;
  HolidayPackageDetail: { packageId: string };
  HolidayBooking: { packageId: string };
  NutritionistMenu: { nutritionistId: string; nutritionistName: string };
  NutritionistOrder: { nutritionistId: string; items: any[] };
  TrainingProgress: { packageId: string };
  TrainingSessionDetail: { sessionId: string };
  ProviderProfile: { providerId: string; providerType: 'staff' | 'vendor' };
  Payment: { bookingId: string; amount: number };
  Chat: { chatId: string; recipientId: string };
  VideoCall: { 
    bookingId: string;
    userId: string;
    userName: string;
    otherUserName: string;
  };
  ProblemGrid: {
    roleId: string;
    roleName: string;
  };
  VendorDiscovery: {
    roleId: string;
    roleName: string;
    problemId: string;
    problem: any;
  };
  ServiceSelection: {
    vendorId: string;
    vendorName: string;
    roleId: string;
    problemId?: string;
  };
  TimeSlotSelection: {
    vendorId: string;
    serviceId: string;
    serviceType: 'center' | 'home' | 'tele';
    petId: string;
  };
  AddressSelection: {
    bookingData: any;
  };
  BookingConfirmation: {
    bookingId: string;
    bookingData?: any;
  };
  PetSelection: {
    vendorId: string;
    vendorName: string;
    roleId: string;
    problemId?: string;
    services: any[];
    insurancePlanId?: string;
  };
  StaffTracking: {
    bookingId: string;
    staffId: string;
    destination?: { latitude: number; longitude: number };
    staffName?: string;
  };
};

export type TabParamList = {
  Home: undefined;
  Search: undefined;
  Bookings: undefined;
  Profile: undefined;
};

