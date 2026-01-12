/**
 * =====================================================
 * WARMPAWZ MOCK DATA SYSTEM
 * =====================================================
 * Complete mock data for all entities in the platform
 * Replaces all Supabase/KV backend calls
 * 
 * Last Updated: January 2026
 * =====================================================
 */

// =====================================================
// TYPE DEFINITIONS
// =====================================================

export interface User {
  id: string;
  phone: string;
  name: string;
  email: string;
  type: 'customer' | 'vendor' | 'admin';
  created_at: string;
  profile_photo?: string;
}

export interface Customer extends User {
  type: 'customer';
  pets: string[]; // Pet IDs
  addresses: string[]; // Address IDs
  wallet_balance: number;
  loyalty_points: number;
}

export interface Vendor extends User {
  type: 'vendor';
  role_id: string;
  business_type: 'solo' | 'business';
  business_name?: string;
  license_number?: string;
  status: 'pending' | 'under_review' | 'clarification_requested' | 'approved' | 'rejected' | 'active' | 'suspended';
  rating: number;
  reviews_count: number;
  location: { lat: number; lng: number; address: string };
  service_radius?: number; // km
  services: string[]; // Service IDs
  staff?: string[]; // Staff IDs
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  verification_documents?: string[];
  admin_comments?: string;
  rejection_reason?: string;
}

export interface Admin extends User {
  type: 'admin';
  role: 'super_admin' | 'vendor_manager' | 'support';
  permissions: string[];
}

export interface Pet {
  id: string;
  owner_id: string;
  name: string;
  species: 'dog' | 'cat' | 'bird' | 'rabbit' | 'other';
  breed: string;
  age: number;
  gender: 'male' | 'female';
  weight: number;
  photo?: string;
  medical_history: MedicalRecord[];
  vaccinations: Vaccination[];
  allergies?: string[];
  special_notes?: string;
}

export interface MedicalRecord {
  id: string;
  pet_id: string;
  date: string;
  vet_id: string;
  diagnosis: string;
  treatment: string;
  prescription?: string;
  notes?: string;
}

export interface Vaccination {
  id: string;
  name: string;
  date: string;
  next_due?: string;
  batch_number?: string;
}

export interface Address {
  id: string;
  user_id: string;
  label: string; // 'Home', 'Office', etc.
  address_line1: string;
  address_line2?: string;
  city: string;
  state: string;
  pincode: string;
  landmark?: string;
  location: { lat: number; lng: number };
  is_default: boolean;
}

export interface Service {
  id: string;
  vendor_id: string;
  name: string;
  category: string;
  subcategory?: string;
  price: number;
  duration: number; // minutes
  description: string;
  service_styles: ('centre' | 'home' | 'tele')[];
  is_active: boolean;
  specializations?: string[];
  problem_tags?: string[];
}

export interface Package {
  id: string;
  vendor_id: string;
  name: string;
  description: string;
  services: string[]; // Service IDs
  total_sessions: number;
  price: number;
  validity_days: number;
  is_active: boolean;
}

export interface Booking {
  id: string;
  customer_id: string;
  vendor_id: string;
  service_id: string;
  pet_id: string;
  staff_id?: string;
  date: string;
  time: string;
  service_style: 'centre' | 'home' | 'tele';
  status: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'rescheduled';
  amount: number;
  payment_status: 'pending' | 'paid' | 'refunded';
  payment_method?: 'wallet' | 'card' | 'upi' | 'cash';
  address_id?: string;
  otp_start?: string;
  otp_complete?: string;
  notes?: string;
  prescription?: string;
  rating?: number;
  review?: string;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  seller_id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  original_price?: number;
  discount?: number;
  images: string[];
  stock: number;
  rating: number;
  reviews_count: number;
  specifications?: Record<string, string>;
  is_active: boolean;
}

export interface Order {
  id: string;
  customer_id: string;
  items: OrderItem[];
  subtotal: number;
  delivery_fee: number;
  tax: number;
  total: number;
  address_id: string;
  payment_method: string;
  payment_status: 'pending' | 'paid' | 'refunded';
  order_status: 'pending' | 'confirmed' | 'packed' | 'shipped' | 'out_for_delivery' | 'delivered' | 'cancelled';
  tracking_id?: string;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  product_id: string;
  quantity: number;
  price: number;
  seller_id: string;
}

export interface Staff {
  id: string;
  vendor_id: string;
  name: string;
  phone: string;
  email?: string;
  role: string;
  specializations?: string[];
  photo?: string;
  is_active: boolean;
  availability?: StaffAvailability[];
}

export interface StaffAvailability {
  day: string;
  slots: { start: string; end: string }[];
}

export interface VendorRole {
  id: string;
  name: string;
  display_name: string;
  category: string;
  capabilities: string[];
  service_styles: ('centre' | 'home' | 'tele')[];
  requires_license: boolean;
}

// =====================================================
// MOCK DATA - VENDOR ROLES
// =====================================================

export const MOCK_VENDOR_ROLES: VendorRole[] = [
  {
    id: 'role_veterinarian',
    name: 'veterinarian',
    display_name: 'Veterinarian',
    category: 'medical',
    capabilities: [
      'service_catalog', 'pricing', 'availability', 'profile', 'staff_management',
      'booking_alerts', 'accept_decline', 'calendar', 'reschedule', 'status_updates',
      'checkin_otp', 'gps_tracking', 'video_call', 'chat', 'progress_updates',
      'prescription', 'medical_history', 'vaccination', 'treatment_notes', 'lab_reports',
      'earnings', 'payment_collection', 'bank_account', 'settlement', 'tier_upgrades',
      'notifications', 'reviews_response', 'followup', 'package_creation', 'emergency_booking'
    ],
    service_styles: ['centre', 'home', 'tele'],
    requires_license: true
  },
  {
    id: 'role_groomer',
    name: 'groomer',
    display_name: 'Pet Groomer',
    category: 'grooming',
    capabilities: [
      'service_catalog', 'pricing', 'availability', 'profile', 'staff_management',
      'booking_alerts', 'accept_decline', 'calendar', 'reschedule', 'status_updates',
      'checkin_otp', 'gps_tracking', 'chat', 'progress_updates', 'photo_documentation',
      'earnings', 'payment_collection', 'bank_account', 'settlement', 'tier_upgrades',
      'notifications', 'reviews_response', 'package_creation', 'gallery_management'
    ],
    service_styles: ['centre', 'home'],
    requires_license: false
  },
  {
    id: 'role_trainer',
    name: 'trainer',
    display_name: 'Pet Trainer',
    category: 'training',
    capabilities: [
      'service_catalog', 'pricing', 'availability', 'profile', 'staff_management',
      'booking_alerts', 'accept_decline', 'calendar', 'reschedule', 'status_updates',
      'checkin_otp', 'gps_tracking', 'video_call', 'chat', 'progress_updates',
      'earnings', 'payment_collection', 'bank_account', 'settlement', 'tier_upgrades',
      'notifications', 'reviews_response', 'package_creation', 'progress_tracking',
      'video_library', 'session_notes'
    ],
    service_styles: ['centre', 'home', 'tele'],
    requires_license: false
  },
  {
    id: 'role_walker',
    name: 'walker',
    display_name: 'Pet Walker',
    category: 'walking',
    capabilities: [
      'service_catalog', 'pricing', 'availability', 'profile',
      'booking_alerts', 'accept_decline', 'calendar', 'reschedule', 'status_updates',
      'checkin_otp', 'gps_tracking', 'chat', 'progress_updates', 'photo_documentation',
      'earnings', 'payment_collection', 'bank_account', 'settlement', 'tier_upgrades',
      'notifications', 'reviews_response', 'package_creation', 'route_tracking'
    ],
    service_styles: ['home'],
    requires_license: false
  },
  {
    id: 'role_boarding',
    name: 'boarding',
    display_name: 'Boarding Center',
    category: 'boarding',
    capabilities: [
      'service_catalog', 'pricing', 'availability', 'profile', 'staff_management',
      'booking_alerts', 'accept_decline', 'calendar', 'reschedule', 'status_updates',
      'checkin_otp', 'chat', 'progress_updates', 'photo_documentation',
      'earnings', 'payment_collection', 'bank_account', 'settlement', 'tier_upgrades',
      'notifications', 'reviews_response', 'room_management', 'daily_updates', 'cctv_access',
      'policy_management'
    ],
    service_styles: ['centre'],
    requires_license: false
  },
  {
    id: 'role_nutritionist',
    name: 'nutritionist',
    display_name: 'Pet Nutritionist',
    category: 'nutrition',
    capabilities: [
      'service_catalog', 'pricing', 'availability', 'profile',
      'booking_alerts', 'accept_decline', 'calendar', 'reschedule', 'status_updates',
      'video_call', 'chat', 'progress_updates',
      'earnings', 'payment_collection', 'bank_account', 'settlement', 'tier_upgrades',
      'notifications', 'reviews_response', 'meal_plan_creation', 'diet_tracking',
      'food_delivery_management'
    ],
    service_styles: ['tele', 'home'],
    requires_license: false
  },
  {
    id: 'role_breeder',
    name: 'breeder',
    display_name: 'Pet Breeder',
    category: 'breeding',
    capabilities: [
      'service_catalog', 'pricing', 'profile',
      'chat',
      'earnings', 'payment_collection', 'bank_account', 'settlement',
      'notifications', 'pet_listing_management', 'lineage_documentation',
      'vaccination_records', 'gallery_management'
    ],
    service_styles: ['centre'],
    requires_license: true
  },
  {
    id: 'role_insurance',
    name: 'insurance',
    display_name: 'Pet Insurance Provider',
    category: 'insurance',
    capabilities: [
      'service_catalog', 'pricing', 'profile',
      'video_call', 'chat',
      'earnings', 'payment_collection', 'bank_account', 'settlement',
      'notifications', 'policy_management', 'claim_management', 'document_verification'
    ],
    service_styles: ['tele'],
    requires_license: true
  },
  {
    id: 'role_cafe',
    name: 'cafe',
    display_name: 'Pet Cafe',
    category: 'hospitality',
    capabilities: [
      'service_catalog', 'pricing', 'availability', 'profile', 'staff_management',
      'booking_alerts', 'accept_decline', 'calendar',
      'earnings', 'payment_collection', 'bank_account', 'settlement',
      'notifications', 'reviews_response', 'table_management', 'menu_management',
      'amenities_management', 'policy_management'
    ],
    service_styles: ['centre'],
    requires_license: false
  },
  {
    id: 'role_seller',
    name: 'seller',
    display_name: 'Product Seller',
    category: 'ecommerce',
    capabilities: [
      'product_catalog', 'pricing', 'inventory', 'profile',
      'order_management', 'shipping_management',
      'earnings', 'payment_collection', 'bank_account', 'settlement',
      'notifications', 'reviews_response', 'promotions', 'analytics',
      'bulk_operations', 'returns_management'
    ],
    service_styles: [],
    requires_license: false
  }
];

// =====================================================
// MOCK DATA - CUSTOMERS
// =====================================================

export const MOCK_CUSTOMERS: Customer[] = [
  {
    id: 'cust_001',
    phone: '+919876543210',
    name: 'Rahul Kumar',
    email: 'rahul@example.com',
    type: 'customer',
    pets: ['pet_001', 'pet_002'],
    addresses: ['addr_001', 'addr_002'],
    wallet_balance: 1500,
    loyalty_points: 250,
    created_at: '2025-11-01T10:00:00Z',
    profile_photo: '/mock-images/customers/rahul.jpg'
  },
  {
    id: 'cust_002',
    phone: '+919876543211',
    name: 'Priya Sharma',
    email: 'priya@example.com',
    type: 'customer',
    pets: ['pet_003'],
    addresses: ['addr_003'],
    wallet_balance: 2500,
    loyalty_points: 480,
    created_at: '2025-10-15T14:30:00Z',
    profile_photo: '/mock-images/customers/priya.jpg'
  },
  {
    id: 'cust_003',
    phone: '+919876543212',
    name: 'Amit Patel',
    email: 'amit@example.com',
    type: 'customer',
    pets: ['pet_004', 'pet_005'],
    addresses: ['addr_004'],
    wallet_balance: 800,
    loyalty_points: 120,
    created_at: '2025-12-20T09:15:00Z',
    profile_photo: '/mock-images/customers/amit.jpg'
  }
];

// =====================================================
// MOCK DATA - PETS
// =====================================================

export const MOCK_PETS: Pet[] = [
  {
    id: 'pet_001',
    owner_id: 'cust_001',
    name: 'Max',
    species: 'dog',
    breed: 'Golden Retriever',
    age: 3,
    gender: 'male',
    weight: 28,
    photo: '/mock-images/pets/max.jpg',
    medical_history: [],
    vaccinations: [
      { id: 'vax_001', name: 'Rabies', date: '2025-01-15', next_due: '2026-01-15', batch_number: 'RB2025-001' },
      { id: 'vax_002', name: 'DHPP', date: '2025-01-15', next_due: '2026-01-15', batch_number: 'DH2025-002' }
    ],
    allergies: ['Chicken'],
    special_notes: 'Very friendly, loves to play fetch'
  },
  {
    id: 'pet_002',
    owner_id: 'cust_001',
    name: 'Bella',
    species: 'dog',
    breed: 'Labrador',
    age: 2,
    gender: 'female',
    weight: 25,
    photo: '/mock-images/pets/bella.jpg',
    medical_history: [],
    vaccinations: [
      { id: 'vax_003', name: 'Rabies', date: '2025-03-20', next_due: '2026-03-20' }
    ]
  },
  {
    id: 'pet_003',
    owner_id: 'cust_002',
    name: 'Luna',
    species: 'cat',
    breed: 'Persian',
    age: 1,
    gender: 'female',
    weight: 4,
    photo: '/mock-images/pets/luna.jpg',
    medical_history: [],
    vaccinations: []
  },
  {
    id: 'pet_004',
    owner_id: 'cust_003',
    name: 'Rocky',
    species: 'dog',
    breed: 'German Shepherd',
    age: 5,
    gender: 'male',
    weight: 35,
    photo: '/mock-images/pets/rocky.jpg',
    medical_history: [],
    vaccinations: []
  },
  {
    id: 'pet_005',
    owner_id: 'cust_003',
    name: 'Milo',
    species: 'dog',
    breed: 'Beagle',
    age: 1,
    gender: 'male',
    weight: 12,
    photo: '/mock-images/pets/milo.jpg',
    medical_history: [],
    vaccinations: []
  }
];

// =====================================================
// MOCK DATA - ADDRESSES
// =====================================================

export const MOCK_ADDRESSES: Address[] = [
  {
    id: 'addr_001',
    user_id: 'cust_001',
    label: 'Home',
    address_line1: '123, MG Road',
    city: 'Bangalore',
    state: 'Karnataka',
    pincode: '560001',
    landmark: 'Near Trinity Metro Station',
    location: { lat: 12.9716, lng: 77.5946 },
    is_default: true
  },
  {
    id: 'addr_002',
    user_id: 'cust_001',
    label: 'Office',
    address_line1: '456, Whitefield Main Road',
    city: 'Bangalore',
    state: 'Karnataka',
    pincode: '560066',
    location: { lat: 12.9698, lng: 77.7499 },
    is_default: false
  },
  {
    id: 'addr_003',
    user_id: 'cust_002',
    label: 'Home',
    address_line1: '789, Koramangala 4th Block',
    city: 'Bangalore',
    state: 'Karnataka',
    pincode: '560034',
    location: { lat: 12.9352, lng: 77.6245 },
    is_default: true
  },
  {
    id: 'addr_004',
    user_id: 'cust_003',
    label: 'Home',
    address_line1: '321, Indiranagar',
    city: 'Bangalore',
    state: 'Karnataka',
    pincode: '560038',
    location: { lat: 12.9784, lng: 77.6408 },
    is_default: true
  }
];

// =====================================================
// MOCK DATA - VENDORS
// =====================================================

export const MOCK_VENDORS: Vendor[] = [
  {
    id: 'vendor_001',
    phone: '+919876543220',
    name: 'Dr. Amit Sharma',
    email: 'amit.sharma@example.com',
    type: 'vendor',
    role_id: 'role_veterinarian',
    business_type: 'solo',
    license_number: 'VET/2020/12345',
    status: 'active',
    rating: 4.8,
    reviews_count: 234,
    location: { lat: 12.9716, lng: 77.5946, address: '123, MG Road, Bangalore' },
    service_radius: 10,
    services: ['service_001', 'service_002', 'service_003'],
    tier: 'gold',
    created_at: '2025-01-01T00:00:00Z'
  },
  {
    id: 'vendor_002',
    phone: '+919876543221',
    name: 'Happy Paws Clinic',
    email: 'info@happypaws.com',
    type: 'vendor',
    role_id: 'role_veterinarian',
    business_type: 'business',
    business_name: 'Happy Paws Veterinary Clinic',
    license_number: 'VET/2019/54321',
    status: 'active',
    rating: 4.9,
    reviews_count: 567,
    location: { lat: 12.9352, lng: 77.6245, address: '456, Koramangala, Bangalore' },
    services: ['service_004', 'service_005', 'service_006'],
    staff: ['staff_001', 'staff_002'],
    tier: 'platinum',
    created_at: '2024-06-15T00:00:00Z'
  },
  {
    id: 'vendor_003',
    phone: '+919876543222',
    name: 'Rajesh Kumar',
    email: 'rajesh@example.com',
    type: 'vendor',
    role_id: 'role_groomer',
    business_type: 'solo',
    status: 'active',
    rating: 4.7,
    reviews_count: 189,
    location: { lat: 12.9698, lng: 77.7499, address: '789, Whitefield, Bangalore' },
    service_radius: 15,
    services: ['service_007', 'service_008'],
    tier: 'silver',
    created_at: '2025-03-10T00:00:00Z'
  },
  {
    id: 'vendor_004',
    phone: '+919876543223',
    name: 'Paws & Claws Grooming',
    email: 'info@pawsclaws.com',
    type: 'vendor',
    role_id: 'role_groomer',
    business_type: 'business',
    business_name: 'Paws & Claws Grooming Center',
    status: 'active',
    rating: 4.6,
    reviews_count: 312,
    location: { lat: 12.9784, lng: 77.6408, address: '234, Indiranagar, Bangalore' },
    services: ['service_009', 'service_010', 'service_011'],
    staff: ['staff_003', 'staff_004'],
    tier: 'gold',
    created_at: '2024-11-20T00:00:00Z'
  },
  {
    id: 'vendor_005',
    phone: '+919876543224',
    name: 'Meera Patel',
    email: 'meera@example.com',
    type: 'vendor',
    role_id: 'role_trainer',
    business_type: 'solo',
    status: 'active',
    rating: 4.9,
    reviews_count: 145,
    location: { lat: 12.9716, lng: 77.5946, address: '567, MG Road, Bangalore' },
    service_radius: 12,
    services: ['service_012', 'service_013'],
    tier: 'gold',
    created_at: '2025-02-05T00:00:00Z'
  }
];

// Continue in next part due to length...