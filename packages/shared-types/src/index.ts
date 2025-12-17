/**
 * Shared TypeScript Types for Warmpawz Mobile Apps
 */

// User Types
export interface User {
  id: string;
  phone: string;
  email?: string;
  name?: string;
  avatar?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Customer extends User {
  pets: Pet[];
  addresses: Address[];
}

export interface Vendor extends User {
  vendorId: string;
  vendorType: string;
  serviceStyle: string[];
  roleId: string;
  status: 'pending' | 'approved' | 'rejected' | 'suspended';
  isActive: boolean;
  setupCompleted: boolean;
}

// Pet Types
export interface Pet {
  id: string;
  customerId: string;
  name: string;
  type: string;
  breed?: string;
  age?: number;
  gender?: 'male' | 'female' | 'other';
  weight?: number;
  photo?: string;
  medicalHistory?: string[];
  createdAt: string;
  updatedAt: string;
}

// Service Types
export interface Service {
  id: string;
  vendorId: string;
  name: string;
  description: string;
  price: number;
  duration?: number;
  category: string;
  serviceStyle: string[];
  isActive: boolean;
  images?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CustomService extends Service {
  isCustom: true;
  needsApproval: boolean;
  publishStatus: 'draft' | 'pending' | 'approved' | 'rejected';
}

// Booking Types
export interface Booking {
  id: string;
  customerId: string;
  vendorId?: string;
  staffId?: string;
  serviceId: string;
  serviceName: string;
  status: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
  date: string;
  time: string;
  duration?: number;
  price: number;
  serviceStyle: 'at_center' | 'at_home' | 'tele' | 'delivery' | 'pickup';
  location?: Address;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// Staff Types
export interface Staff {
  id: string;
  vendorId: string;
  name: string;
  phone: string;
  email?: string;
  role: string;
  services: string[];
  isActive: boolean;
  location?: {
    lat: number;
    lng: number;
  };
  maxDistance?: number;
  createdAt: string;
  updatedAt: string;
}

// Address Types
export interface Address {
  id: string;
  customerId: string;
  type: 'home' | 'work' | 'other';
  label: string;
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  lat?: number;
  lng?: number;
  isDefault: boolean;
}

// GPS Tracking Types
export interface GPSTracking {
  id: string;
  bookingId: string;
  staffId: string;
  status: 'started' | 'in_transit' | 'arrived' | 'completed';
  currentLocation?: {
    lat: number;
    lng: number;
  };
  destination?: {
    lat: number;
    lng: number;
  };
  distance?: number;
  eta?: number;
  startedAt: string;
  arrivedAt?: string;
  completedAt?: string;
}

// Notification Types
export interface Notification {
  id: string;
  userId: string;
  type: 'booking' | 'payment' | 'reminder' | 'system';
  title: string;
  message: string;
  data?: any;
  read: boolean;
  createdAt: string;
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// Navigation Types
export type RootStackParamList = {
  MainTabs: undefined;
  ServiceDetail: { serviceId: string; vendorId?: string };
  BookingDetail: { bookingId: string };
  BookingConfirmation: { bookingId: string };
  ProviderProfile: { providerId: string; providerType: 'staff' | 'vendor' };
  Payment: { bookingId: string; amount: number };
  Chat: { chatId: string; recipientId: string };
};

export type CustomerTabParamList = {
  Home: undefined;
  Search: undefined;
  Bookings: undefined;
  Profile: undefined;
};

export type VendorTabParamList = {
  Dashboard: undefined;
  Bookings: undefined;
  Services: undefined;
  Staff: undefined;
  Profile: undefined;
};

