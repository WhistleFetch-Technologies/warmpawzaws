/**
 * =====================================================
 * WARMPAWZ MOCK DATA SYSTEM - EXTENDED DATA
 * =====================================================
 * Extended mock data for Services, Bookings, Products, etc.
 * Includes specialized data for Cafes, Resorts, Insurance, etc.
 * =====================================================
 */

import type { Service, Booking, Product, Order, Staff, Package } from './mockData';

// =====================================================
// INTERFACES FOR NEW ENTITIES
// =====================================================

export interface InsurancePlan {
  id: string;
  provider_id: string;
  name: string;
  description: string;
  coverage_amount: number;
  premium_monthly: number;
  premium_yearly: number;
  deductible: number;
  co_pay: number; // percentage
  waiting_period: number; // days
  covered_conditions: string[];
  exclusions: string[];
  is_active: boolean;
}

export interface PetCafeTable {
  id: string;
  vendor_id: string;
  table_number: string;
  capacity: number;
  is_pet_friendly: boolean; // specific pet seating
  location: 'indoor' | 'outdoor' | 'rooftop';
  status: 'available' | 'occupied' | 'reserved';
}

export interface CafeMenuItem {
  id: string;
  vendor_id: string;
  name: string;
  description: string;
  price: number;
  category: 'beverage' | 'food' | 'dessert' | 'pet_menu';
  is_vegetarian: boolean;
  is_pet_safe: boolean;
  image?: string;
  is_available: boolean;
}

export interface ResortRoom {
  id: string;
  vendor_id: string;
  name: string;
  type: 'standard' | 'deluxe' | 'suite' | 'kennel';
  capacity: number; // number of pets
  price_per_night: number;
  amenities: string[]; // e.g., "CCTV", "AC", "Soft Bed"
  size_sqft: number;
  images: string[];
  is_available: boolean;
}

export interface Coupon {
  id: string;
  code: string;
  description: string;
  type: 'percentage' | 'flat' | 'first_time' | 'category_specific';
  value: number; // percentage or amount
  maxDiscount?: number;
  minOrderValue?: number;
  validUntil: string;
  isActive: boolean;
  applicableOn: 'services' | 'products' | 'both';
  category?: string; // specific category if applicable
  usedCount: number;
}

export interface BundleDeal {
  id: string;
  title: string;
  description: string;
  items: Array<{ type: 'service' | 'product', id: string }>;
  originalPrice: number;
  bundlePrice: number;
  savingsPercentage: number;
  category: string; // e.g., "Puppy Starter Kit"
  isActive: boolean;
  image?: string;
}

export interface PromoBanner {
  id: string;
  title: string;
  subtitle: string;
  image: string; // URL or Emoji/Color code
  link: string;
  type: 'hero' | 'feature' | 'category' | 'flash_sale';
  isActive: boolean;
  displayOrder: number;
}

// =====================================================
// MOCK DATA - SERVICES
// =====================================================

export const MOCK_SERVICES: Service[] = [
  // Veterinarian Services
  {
    id: 'service_001',
    vendor_id: 'vendor_001',
    name: 'General Checkup',
    category: 'Veterinary',
    price: 500,
    duration: 30,
    description: 'Comprehensive health checkup for your pet',
    service_styles: ['centre', 'home', 'tele'],
    is_active: true,
    specializations: ['General Medicine'],
    problem_tags: ['checkup', 'health', 'general']
  },
  {
    id: 'service_002',
    vendor_id: 'vendor_001',
    name: 'Vaccination',
    category: 'Veterinary',
    price: 800,
    duration: 20,
    description: 'Complete vaccination services',
    service_styles: ['centre', 'home'],
    is_active: true,
    problem_tags: ['vaccination', 'preventive']
  },
  {
    id: 'service_003',
    vendor_id: 'vendor_001',
    name: 'Emergency Consultation',
    category: 'Veterinary',
    price: 1500,
    duration: 45,
    description: '24/7 emergency veterinary care',
    service_styles: ['centre', 'home', 'tele'],
    is_active: true,
    problem_tags: ['emergency', 'urgent']
  },
  {
    id: 'service_004',
    vendor_id: 'vendor_002',
    name: 'Surgery',
    category: 'Veterinary',
    subcategory: 'Surgical',
    price: 15000,
    duration: 180,
    description: 'Surgical procedures with post-op care',
    service_styles: ['centre'],
    is_active: true,
    specializations: ['Surgery'],
    problem_tags: ['surgery', 'operation']
  },
  {
    id: 'service_005',
    vendor_id: 'vendor_002',
    name: 'Dental Care',
    category: 'Veterinary',
    subcategory: 'Dental',
    price: 2500,
    duration: 60,
    description: 'Complete dental checkup and cleaning',
    service_styles: ['centre'],
    is_active: true,
    specializations: ['Dentistry'],
    problem_tags: ['dental', 'teeth', 'oral']
  },
  {
    id: 'service_006',
    vendor_id: 'vendor_002',
    name: 'Cardiology Consultation',
    category: 'Veterinary',
    subcategory: 'Cardiology',
    price: 3000,
    duration: 45,
    description: 'Heart health assessment and treatment',
    service_styles: ['centre', 'tele'],
    is_active: true,
    specializations: ['Cardiology'],
    problem_tags: ['heart', 'cardiology']
  },
  // Grooming Services
  {
    id: 'service_007',
    vendor_id: 'vendor_003',
    name: 'Full Grooming',
    category: 'Grooming',
    price: 800,
    duration: 90,
    description: 'Complete grooming with bath, haircut, and styling',
    service_styles: ['home'],
    is_active: true,
    problem_tags: ['grooming', 'full_grooming']
  },
  {
    id: 'service_008',
    vendor_id: 'vendor_003',
    name: 'Bath & Brush',
    category: 'Grooming',
    price: 500,
    duration: 60,
    description: 'Bath and brushing service',
    service_styles: ['home'],
    is_active: true,
    problem_tags: ['bath', 'brush']
  },
  {
    id: 'service_009',
    vendor_id: 'vendor_004',
    name: 'Premium Grooming Package',
    category: 'Grooming',
    price: 1200,
    duration: 120,
    description: 'Premium grooming with spa treatment',
    service_styles: ['centre'],
    is_active: true,
    problem_tags: ['grooming', 'spa', 'premium']
  },
  {
    id: 'service_010',
    vendor_id: 'vendor_004',
    name: 'De-shedding Treatment',
    category: 'Grooming',
    price: 700,
    duration: 75,
    description: 'Special de-shedding treatment for heavy shedders',
    service_styles: ['centre'],
    is_active: true,
    problem_tags: ['deshedding', 'hair']
  },
  {
    id: 'service_011',
    vendor_id: 'vendor_004',
    name: 'Nail Trimming',
    category: 'Grooming',
    price: 300,
    duration: 30,
    description: 'Professional nail trimming service',
    service_styles: ['centre'],
    is_active: true,
    problem_tags: ['nail', 'trimming']
  },
  // Training Services
  {
    id: 'service_012',
    vendor_id: 'vendor_005',
    name: 'Basic Obedience Training',
    category: 'Training',
    price: 2500,
    duration: 60,
    description: 'Basic commands and obedience training',
    service_styles: ['home', 'centre', 'tele'],
    is_active: true,
    problem_tags: ['obedience', 'basic_training']
  },
  {
    id: 'service_013',
    vendor_id: 'vendor_005',
    name: 'Behavioral Consultation',
    category: 'Training',
    price: 1500,
    duration: 45,
    description: 'Assessment and consultation for behavioral issues',
    service_styles: ['tele', 'home'],
    is_active: true,
    problem_tags: ['behavioral', 'consultation']
  }
];

// Expanded Services for Specialized Roles
export const EXPANDED_SERVICES: Service[] = [
  // Pet Walker
  {
    id: 'service_walk_001',
    vendor_id: 'vendor_walker_001',
    name: '30 Min Solo Walk',
    category: 'Walking',
    price: 300,
    duration: 30,
    description: 'One-on-one walk with GPS tracking',
    service_styles: ['home'],
    is_active: true,
    problem_tags: ['exercise', 'walking']
  },
  // Pet Nutritionist
  {
    id: 'service_nutri_001',
    vendor_id: 'vendor_nutri_001',
    name: 'Diet Consultation',
    category: 'Nutrition',
    price: 1500,
    duration: 45,
    description: 'Customized meal plan for your pet',
    service_styles: ['tele', 'home'],
    is_active: true,
    problem_tags: ['diet', 'weight', 'nutrition']
  },
  // Pet Insurance
  {
    id: 'service_ins_001',
    vendor_id: 'vendor_ins_001',
    name: 'Policy Consultation',
    category: 'Insurance',
    price: 0,
    duration: 20,
    description: 'Free consultation to choose the right plan',
    service_styles: ['tele'],
    is_active: true,
    problem_tags: ['insurance', 'protection']
  }
];

// =====================================================
// MOCK DATA - STAFF
// =====================================================

export const MOCK_STAFF: Staff[] = [
  {
    id: 'staff_001',
    vendor_id: 'vendor_002',
    name: 'Dr. Priya Menon',
    phone: '+919876543230',
    email: 'priya.menon@happypaws.com',
    role: 'Veterinarian',
    specializations: ['Surgery', 'Emergency Care'],
    photo: '/mock-images/staff/priya.jpg',
    is_active: true,
    availability: [
      {
        day: 'Monday',
        slots: [{ start: '09:00', end: '17:00' }]
      },
      {
        day: 'Tuesday',
        slots: [{ start: '09:00', end: '17:00' }]
      },
      {
        day: 'Wednesday',
        slots: [{ start: '09:00', end: '17:00' }]
      },
      {
        day: 'Thursday',
        slots: [{ start: '09:00', end: '17:00' }]
      },
      {
        day: 'Friday',
        slots: [{ start: '09:00', end: '17:00' }]
      }
    ]
  },
  {
    id: 'staff_002',
    vendor_id: 'vendor_002',
    name: 'Dr. Rajesh Iyer',
    phone: '+919876543231',
    email: 'rajesh.iyer@happypaws.com',
    role: 'Veterinarian',
    specializations: ['Cardiology', 'Internal Medicine'],
    photo: '/mock-images/staff/rajesh.jpg',
    is_active: true,
    availability: [
      {
        day: 'Monday',
        slots: [{ start: '14:00', end: '20:00' }]
      },
      {
        day: 'Wednesday',
        slots: [{ start: '14:00', end: '20:00' }]
      },
      {
        day: 'Friday',
        slots: [{ start: '14:00', end: '20:00' }]
      },
      {
        day: 'Saturday',
        slots: [{ start: '09:00', end: '17:00' }]
      }
    ]
  },
  {
    id: 'staff_003',
    vendor_id: 'vendor_004',
    name: 'Anjali Verma',
    phone: '+919876543232',
    role: 'Groomer',
    photo: '/mock-images/staff/anjali.jpg',
    is_active: true
  },
  {
    id: 'staff_004',
    vendor_id: 'vendor_004',
    name: 'Suresh Nair',
    phone: '+919876543233',
    role: 'Groomer',
    photo: '/mock-images/staff/suresh.jpg',
    is_active: true
  }
];

// =====================================================
// MOCK DATA - BOOKINGS
// =====================================================

export const MOCK_BOOKINGS: Booking[] = [
  {
    id: 'booking_001',
    customer_id: 'cust_001',
    vendor_id: 'vendor_001',
    service_id: 'service_001',
    pet_id: 'pet_001',
    date: '2026-01-15',
    time: '09:00',
    service_style: 'centre',
    status: 'confirmed',
    amount: 500,
    payment_status: 'paid',
    payment_method: 'wallet',
    otp_start: '123456',
    otp_complete: '654321',
    created_at: '2026-01-10T10:00:00Z',
    updated_at: '2026-01-10T10:00:00Z'
  },
  {
    id: 'booking_002',
    customer_id: 'cust_001',
    vendor_id: 'vendor_003',
    service_id: 'service_007',
    pet_id: 'pet_001',
    date: '2026-01-16',
    time: '10:00',
    service_style: 'home',
    status: 'confirmed',
    amount: 800,
    payment_status: 'paid',
    payment_method: 'upi',
    address_id: 'addr_001',
    otp_start: '234567',
    otp_complete: '765432',
    created_at: '2026-01-11T14:00:00Z',
    updated_at: '2026-01-11T14:00:00Z'
  },
  {
    id: 'booking_003',
    customer_id: 'cust_002',
    vendor_id: 'vendor_002',
    service_id: 'service_005',
    pet_id: 'pet_003',
    staff_id: 'staff_001',
    date: '2026-01-17',
    time: '14:00',
    service_style: 'centre',
    status: 'pending',
    amount: 2500,
    payment_status: 'paid',
    payment_method: 'card',
    created_at: '2026-01-12T09:00:00Z',
    updated_at: '2026-01-12T09:00:00Z'
  },
  {
    id: 'booking_004',
    customer_id: 'cust_001',
    vendor_id: 'vendor_005',
    service_id: 'service_012',
    pet_id: 'pet_002',
    date: '2026-01-18',
    time: '16:00',
    service_style: 'tele',
    status: 'confirmed',
    amount: 2500,
    payment_status: 'paid',
    payment_method: 'wallet',
    created_at: '2026-01-13T11:00:00Z',
    updated_at: '2026-01-13T11:00:00Z'
  },
  {
    id: 'booking_005',
    customer_id: 'cust_003',
    vendor_id: 'vendor_001',
    service_id: 'service_002',
    pet_id: 'pet_004',
    date: '2026-01-12',
    time: '11:00',
    service_style: 'home',
    status: 'completed',
    amount: 800,
    payment_status: 'paid',
    payment_method: 'cash',
    address_id: 'addr_004',
    rating: 5,
    review: 'Excellent service! Dr. Sharma was very professional.',
    created_at: '2026-01-08T10:00:00Z',
    updated_at: '2026-01-12T12:00:00Z'
  }
];

// =====================================================
// MOCK DATA - PACKAGES
// =====================================================

export const MOCK_PACKAGES: Package[] = [
  {
    id: 'package_001',
    vendor_id: 'vendor_005',
    name: 'Basic Obedience Training Package',
    description: '10-session basic training package',
    services: ['service_012'],
    total_sessions: 10,
    price: 20000,
    validity_days: 60,
    is_active: true
  },
  {
    id: 'package_002',
    vendor_id: 'vendor_004',
    name: 'Monthly Grooming Package',
    description: '4 grooming sessions per month',
    services: ['service_009', 'service_010'],
    total_sessions: 4,
    price: 4000,
    validity_days: 30,
    is_active: true
  }
];

// =====================================================
// MOCK DATA - PRODUCTS
// =====================================================

export const MOCK_PRODUCTS: Product[] = [
  {
    id: 'product_001',
    seller_id: 'seller_001',
    name: 'Royal Canin Adult Dog Food',
    description: 'Premium quality dog food for adult dogs (1-7 years)',
    category: 'Food',
    price: 2499,
    original_price: 3499,
    discount: 30,
    images: ['/mock-images/products/royal-canin-1.jpg', '/mock-images/products/royal-canin-2.jpg'],
    stock: 50,
    rating: 4.8,
    reviews_count: 1240,
    specifications: {
      'Weight': '3 kg',
      'Age Group': 'Adult (1-7 years)',
      'Breed Size': 'All sizes',
      'Ingredients': 'Chicken, Rice, Vitamins'
    },
    is_active: true
  },
  {
    id: 'product_002',
    seller_id: 'seller_001',
    name: 'Automatic Pet Feeder',
    description: 'Smart automatic pet feeder with timer and portion control',
    category: 'Accessories',
    price: 3999,
    original_price: 5999,
    discount: 35,
    images: ['/mock-images/products/feeder-1.jpg'],
    stock: 25,
    rating: 4.6,
    reviews_count: 856,
    specifications: {
      'Capacity': '6L',
      'Power': 'Battery/AC',
      'Features': 'Timer, Portion Control, Voice Recording'
    },
    is_active: true
  },
  {
    id: 'product_003',
    seller_id: 'seller_002',
    name: 'GPS Pet Collar Tracker',
    description: 'Real-time GPS tracking collar for pets',
    category: 'Accessories',
    price: 4299,
    original_price: 6999,
    discount: 40,
    images: ['/mock-images/products/gps-collar-1.jpg'],
    stock: 15,
    rating: 4.9,
    reviews_count: 2103,
    specifications: {
      'Battery Life': '7 days',
      'Water Resistance': 'IP67',
      'Connectivity': '4G LTE'
    },
    is_active: true
  },
  {
    id: 'product_004',
    seller_id: 'seller_001',
    name: 'Kong Classic Dog Toy',
    description: 'Durable rubber toy for dogs',
    category: 'Toys',
    price: 899,
    images: ['/mock-images/products/kong-toy.jpg'],
    stock: 100,
    rating: 4.9,
    reviews_count: 3421,
    is_active: true
  },
  {
    id: 'product_005',
    seller_id: 'seller_002',
    name: 'Orthopedic Pet Bed',
    description: 'Memory foam orthopedic bed for senior pets',
    category: 'Beds',
    price: 3499,
    original_price: 5999,
    images: ['/mock-images/products/pet-bed.jpg'],
    stock: 30,
    rating: 4.7,
    reviews_count: 892,
    is_active: true
  }
];

export const EXPANDED_PRODUCTS: Product[] = [
  // Add more products here if needed
];

// =====================================================
// MOCK DATA - ORDERS
// =====================================================

export const MOCK_ORDERS: Order[] = [
  {
    id: 'order_001',
    customer_id: 'cust_001',
    items: [
      {
        product_id: 'product_001',
        quantity: 1,
        price: 2499,
        seller_id: 'seller_001'
      },
      {
        product_id: 'product_004',
        quantity: 2,
        price: 899,
        seller_id: 'seller_001'
      }
    ],
    subtotal: 4297,
    delivery_fee: 0,
    tax: 773,
    total: 5070,
    address_id: 'addr_001',
    payment_method: 'upi',
    payment_status: 'paid',
    order_status: 'delivered',
    tracking_id: 'TRK2026001',
    created_at: '2026-01-05T10:00:00Z',
    updated_at: '2026-01-08T15:00:00Z'
  },
  {
    id: 'order_002',
    customer_id: 'cust_002',
    items: [
      {
        product_id: 'product_003',
        quantity: 1,
        price: 4299,
        seller_id: 'seller_002'
      }
    ],
    subtotal: 4299,
    delivery_fee: 0,
    tax: 774,
    total: 5073,
    address_id: 'addr_003',
    payment_method: 'card',
    payment_status: 'paid',
    order_status: 'out_for_delivery',
    tracking_id: 'TRK2026002',
    created_at: '2026-01-14T14:00:00Z',
    updated_at: '2026-01-15T09:00:00Z'
  },
  {
    id: 'order_003',
    customer_id: 'cust_003',
    items: [
      {
        product_id: 'product_005',
        quantity: 1,
        price: 3499,
        seller_id: 'seller_002'
      }
    ],
    subtotal: 3499,
    delivery_fee: 0,
    tax: 630,
    total: 4129,
    address_id: 'addr_004',
    payment_method: 'wallet',
    payment_status: 'paid',
    order_status: 'confirmed',
    tracking_id: 'TRK2026003',
    created_at: '2026-01-13T16:00:00Z',
    updated_at: '2026-01-13T16:30:00Z'
  }
];

// =====================================================
// MOCK DATA - ADMIN
// =====================================================

export const MOCK_ADMINS = [
  {
    id: 'admin_001',
    phone: '+919876543240',
    name: 'Super Admin',
    email: 'admin@warmpawz.com',
    type: 'admin' as const,
    role: 'super_admin' as const,
    permissions: ['*'], // All permissions
    created_at: '2024-01-01T00:00:00Z'
  }
];

// =====================================================
// MOCK DATA - INSURANCE PLANS
// =====================================================

export const MOCK_INSURANCE_PLANS: InsurancePlan[] = [
  {
    id: 'plan_gold',
    provider_id: 'vendor_ins_001',
    name: 'Gold Paw Protection',
    description: 'Comprehensive coverage for illness and accidents',
    coverage_amount: 50000,
    premium_monthly: 499,
    premium_yearly: 5499,
    deductible: 1000,
    co_pay: 10,
    waiting_period: 15,
    covered_conditions: ['Surgery', 'Hospitalization', 'Diagnostics', 'Medications'],
    exclusions: ['Pre-existing conditions', 'Cosmetic procedures'],
    is_active: true
  },
  {
    id: 'plan_platinum',
    provider_id: 'vendor_ins_001',
    name: 'Platinum Shield',
    description: 'Premium coverage including dental and wellness',
    coverage_amount: 100000,
    premium_monthly: 999,
    premium_yearly: 10999,
    deductible: 500,
    co_pay: 0,
    waiting_period: 0,
    covered_conditions: ['Everything in Gold', 'Dental', 'Vaccinations', 'Annual Checkup'],
    exclusions: ['Breeding costs'],
    is_active: true
  }
];

// =====================================================
// MOCK DATA - PET CAFE
// =====================================================

export const MOCK_CAFE_TABLES: PetCafeTable[] = [
  { id: 'table_1', vendor_id: 'vendor_cafe_001', table_number: 'T1', capacity: 2, is_pet_friendly: true, location: 'indoor', status: 'available' },
  { id: 'table_2', vendor_id: 'vendor_cafe_001', table_number: 'T2', capacity: 4, is_pet_friendly: true, location: 'outdoor', status: 'reserved' },
  { id: 'table_3', vendor_id: 'vendor_cafe_001', table_number: 'T3', capacity: 6, is_pet_friendly: true, location: 'rooftop', status: 'available' }
];

export const MOCK_CAFE_MENU: CafeMenuItem[] = [
  { id: 'menu_1', vendor_id: 'vendor_cafe_001', name: 'Puppaccino', description: 'Whipped cream cup for dogs', price: 150, category: 'pet_menu', is_vegetarian: true, is_pet_safe: true, is_available: true },
  { id: 'menu_2', vendor_id: 'vendor_cafe_001', name: 'Chicken Jerky', description: 'Dehydrated chicken strips', price: 250, category: 'pet_menu', is_vegetarian: false, is_pet_safe: true, is_available: true },
  { id: 'menu_3', vendor_id: 'vendor_cafe_001', name: 'Cappuccino', description: 'Human coffee', price: 200, category: 'beverage', is_vegetarian: true, is_pet_safe: false, is_available: true }
];

// =====================================================
// MOCK DATA - RESORT
// =====================================================

export const MOCK_RESORT_ROOMS: ResortRoom[] = [
  { id: 'room_101', vendor_id: 'vendor_resort_001', name: 'Standard Kennel', type: 'kennel', capacity: 1, price_per_night: 800, amenities: ['Soft Bed', '2 Walks'], size_sqft: 20, images: [], is_available: true },
  { id: 'room_201', vendor_id: 'vendor_resort_001', name: 'Deluxe Suite', type: 'suite', capacity: 2, price_per_night: 2500, amenities: ['CCTV', 'AC', 'Private Play Area', 'Gourmet Meals'], size_sqft: 80, images: [], is_available: true }
];

// =====================================================
// MOCK DATA - PROMOTIONS
// =====================================================

export const MOCK_COUPONS: Coupon[] = [
  { id: 'cpn_welcome', code: 'WELCOME50', description: '50% off your first service', type: 'first_time', value: 50, maxDiscount: 500, validUntil: '2030-12-31', isActive: true, applicableOn: 'services', usedCount: 120 },
  { id: 'cpn_summer', code: 'SUMMER20', description: '20% off on grooming', type: 'percentage', value: 20, maxDiscount: 200, validUntil: '2026-06-30', isActive: true, applicableOn: 'services', category: 'Grooming', usedCount: 45 },
  { id: 'cpn_food', code: 'YUMMY10', description: 'Flat ₹100 off on food orders > ₹1000', type: 'flat', value: 100, minOrderValue: 1000, validUntil: '2026-12-31', isActive: true, applicableOn: 'products', category: 'Food', usedCount: 89 }
];

export const MOCK_BUNDLE_DEALS: BundleDeal[] = [
  {
    id: 'bundle_puppy',
    title: 'New Puppy Starter Kit',
    description: 'Essentials for your new friend',
    items: [
      { type: 'product', id: 'product_004' }, // Toy
      { type: 'product', id: 'product_001' }  // Food
    ],
    originalPrice: 3398,
    bundlePrice: 2999,
    savingsPercentage: 12,
    category: 'Starter Kits',
    isActive: true
  }
];

export const PROMO_BANNERS: PromoBanner[] = [
  { id: 'ban_1', title: 'Monsoon Care', subtitle: 'Keep them dry & safe', image: '🌧️', link: 'services/grooming', type: 'hero', isActive: true, displayOrder: 1 },
  { id: 'ban_2', title: 'Tick & Flea Alert', subtitle: 'Preventive treatments', image: '🛡️', link: 'products/health', type: 'feature', isActive: true, displayOrder: 2 }
];

// =====================================================
// EXPORTS
// =====================================================

export const EXPANDED_MOCK_DATA = {
  services: [...MOCK_SERVICES, ...EXPANDED_SERVICES],
  insurancePlans: MOCK_INSURANCE_PLANS,
  cafeTables: MOCK_CAFE_TABLES,
  cafeMenu: MOCK_CAFE_MENU,
  resortRooms: MOCK_RESORT_ROOMS,
  coupons: MOCK_COUPONS,
  bundles: MOCK_BUNDLE_DEALS,
  banners: PROMO_BANNERS
};
