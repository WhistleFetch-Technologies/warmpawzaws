import { 
  Wifi, 
  ParkingCircle, 
  Clock, 
  Shield, 
  Camera,
  Wind,
  Droplets,
  Stethoscope,
  Pill,
  Heart,
  Zap,
  User,
  Users,
  Home,
  Scissors,
  Sparkles,
  ShowerHead,
  Bed,
  Dog,
  MapPin,
  Phone,
  Coffee,
  TrendingUp,
  Award,
  Leaf,
  Sun,
  Moon,
  Activity,
  Thermometer,
  ShieldCheck,
  AlertCircle,
  FileText,
  CreditCard,
  Play,
  Fence
} from 'lucide-react';

export interface Amenity {
  id: string;
  name: string;
  icon: any;
  category: 'basic' | 'medical' | 'grooming' | 'boarding' | 'safety' | 'comfort' | 'training' | 'specialty';
  applicableFor: string[]; // vendor types this amenity applies to
  description?: string;
}

/**
 * Master list of amenities categorized by vendor type
 * Admin can enable/disable these, and vendors can select from applicable ones
 */
export const MASTER_AMENITIES: Amenity[] = [
  // ============ BASIC AMENITIES (All Vendors) ============
  {
    id: 'wifi',
    name: 'Free Wi-Fi',
    icon: Wifi,
    category: 'basic',
    applicableFor: ['veterinarian', 'groomer', 'boarding', 'trainer', 'insurance'],
    description: 'Complimentary wireless internet'
  },
  {
    id: 'parking',
    name: 'Parking Available',
    icon: ParkingCircle,
    category: 'basic',
    applicableFor: ['veterinarian', 'groomer', 'boarding', 'trainer', 'insurance'],
    description: 'On-site parking facility'
  },
  {
    id: '24x7',
    name: '24/7 Available',
    icon: Clock,
    category: 'basic',
    applicableFor: ['veterinarian', 'boarding'],
    description: 'Round the clock service'
  },
  {
    id: 'ac',
    name: 'Air Conditioned',
    icon: Wind,
    category: 'comfort',
    applicableFor: ['veterinarian', 'groomer', 'boarding', 'trainer', 'insurance'],
    description: 'Climate controlled facility'
  },
  {
    id: 'waiting_area',
    name: 'Waiting Area',
    icon: Coffee,
    category: 'comfort',
    applicableFor: ['veterinarian', 'groomer', 'trainer', 'insurance'],
    description: 'Comfortable waiting lounge'
  },

  // ============ VETERINARY CLINIC AMENITIES ============
  {
    id: 'xray',
    name: 'X-Ray Facility',
    icon: Activity,
    category: 'medical',
    applicableFor: ['veterinarian'],
    description: 'Digital X-Ray imaging'
  },
  {
    id: 'lab',
    name: 'In-House Lab',
    icon: FileText,
    category: 'medical',
    applicableFor: ['veterinarian'],
    description: 'Laboratory for blood tests and diagnostics'
  },
  {
    id: 'surgery',
    name: 'Surgery Room',
    icon: Stethoscope,
    category: 'medical',
    applicableFor: ['veterinarian'],
    description: 'Equipped operation theatre'
  },
  {
    id: 'emergency',
    name: 'Emergency Care',
    icon: AlertCircle,
    category: 'medical',
    applicableFor: ['veterinarian'],
    description: '24/7 emergency services'
  },
  {
    id: 'pharmacy',
    name: 'Pharmacy',
    icon: Pill,
    category: 'medical',
    applicableFor: ['veterinarian'],
    description: 'On-site medication dispensary'
  },
  {
    id: 'isolation',
    name: 'Isolation Ward',
    icon: ShieldCheck,
    category: 'medical',
    applicableFor: ['veterinarian', 'boarding'],
    description: 'Separate area for sick pets'
  },
  {
    id: 'icu',
    name: 'ICU Facility',
    icon: Heart,
    category: 'medical',
    applicableFor: ['veterinarian'],
    description: 'Intensive care unit'
  },
  {
    id: 'ultrasound',
    name: 'Ultrasound',
    icon: Activity,
    category: 'medical',
    applicableFor: ['veterinarian'],
    description: 'Ultrasound imaging facility'
  },
  {
    id: 'dental',
    name: 'Dental Care',
    icon: Sparkles,
    category: 'medical',
    applicableFor: ['veterinarian'],
    description: 'Pet dental services'
  },
  {
    id: 'vaccination',
    name: 'Vaccination Services',
    icon: Pill,
    category: 'medical',
    applicableFor: ['veterinarian'],
    description: 'Complete vaccination programs'
  },

  // ============ GROOMING CENTER AMENITIES ============
  {
    id: 'bathing_area',
    name: 'Bathing Area',
    icon: Droplets,
    category: 'grooming',
    applicableFor: ['groomer'],
    description: 'Professional bathing stations'
  },
  {
    id: 'drying_station',
    name: 'Drying Station',
    icon: Wind,
    category: 'grooming',
    applicableFor: ['groomer'],
    description: 'High-velocity dryers'
  },
  {
    id: 'styling_area',
    name: 'Styling Area',
    icon: Scissors,
    category: 'grooming',
    applicableFor: ['groomer'],
    description: 'Professional grooming tables'
  },
  {
    id: 'nail_trimming',
    name: 'Nail Trimming',
    icon: Sparkles,
    category: 'grooming',
    applicableFor: ['groomer'],
    description: 'Nail care services'
  },
  {
    id: 'spa',
    name: 'Spa Services',
    icon: Sparkles,
    category: 'grooming',
    applicableFor: ['groomer'],
    description: 'Luxury spa treatments'
  },
  {
    id: 'organic_products',
    name: 'Organic Products',
    icon: Leaf,
    category: 'grooming',
    applicableFor: ['groomer'],
    description: 'Natural and organic grooming products'
  },
  {
    id: 'breed_specialist',
    name: 'Breed Specialist',
    icon: Award,
    category: 'specialty',
    applicableFor: ['groomer'],
    description: 'Breed-specific grooming expertise'
  },
  {
    id: 'creative_grooming',
    name: 'Creative Grooming',
    icon: Sparkles,
    category: 'specialty',
    applicableFor: ['groomer'],
    description: 'Artistic styling and coloring'
  },

  // ============ BOARDING FACILITY AMENITIES ============
  {
    id: 'individual_kennels',
    name: 'Individual Kennels',
    icon: Home,
    category: 'boarding',
    applicableFor: ['boarding'],
    description: 'Private spacious kennels'
  },
  {
    id: 'climate_control',
    name: 'Climate Control',
    icon: Thermometer,
    category: 'boarding',
    applicableFor: ['boarding'],
    description: 'Temperature regulated rooms'
  },
  {
    id: 'play_area',
    name: 'Play Area',
    icon: Play,
    category: 'boarding',
    applicableFor: ['boarding', 'trainer'],
    description: 'Outdoor/indoor play zones'
  },
  {
    id: 'cctv',
    name: 'CCTV Monitoring',
    icon: Camera,
    category: 'safety',
    applicableFor: ['boarding', 'trainer'],
    description: '24/7 video surveillance'
  },
  {
    id: 'staff_24x7',
    name: '24/7 Staff',
    icon: Users,
    category: 'safety',
    applicableFor: ['boarding', 'veterinarian'],
    description: 'Round-the-clock staff supervision'
  },
  {
    id: 'separate_cat_area',
    name: 'Separate Cat Area',
    icon: Home,
    category: 'boarding',
    applicableFor: ['boarding'],
    description: 'Dedicated space for cats'
  },
  {
    id: 'swimming_pool',
    name: 'Swimming Pool',
    icon: Droplets,
    category: 'boarding',
    applicableFor: ['boarding', 'trainer'],
    description: 'Pet swimming facility'
  },
  {
    id: 'grooming_included',
    name: 'Grooming Included',
    icon: Scissors,
    category: 'boarding',
    applicableFor: ['boarding'],
    description: 'Complimentary grooming service'
  },
  {
    id: 'meal_plan',
    name: 'Custom Meal Plans',
    icon: Coffee,
    category: 'boarding',
    applicableFor: ['boarding'],
    description: 'Personalized diet options'
  },
  {
    id: 'bedding',
    name: 'Premium Bedding',
    icon: Bed,
    category: 'comfort',
    applicableFor: ['boarding'],
    description: 'Comfortable beds and blankets'
  },
  {
    id: 'outdoor_space',
    name: 'Outdoor Space',
    icon: Sun,
    category: 'boarding',
    applicableFor: ['boarding', 'trainer'],
    description: 'Spacious outdoor area'
  },

  // ============ TRAINING CENTER AMENITIES ============
  {
    id: 'training_ground',
    name: 'Training Ground',
    icon: MapPin,
    category: 'training',
    applicableFor: ['trainer'],
    description: 'Dedicated training area'
  },
  {
    id: 'agility_equipment',
    name: 'Agility Equipment',
    icon: TrendingUp,
    category: 'training',
    applicableFor: ['trainer'],
    description: 'Professional agility course'
  },
  {
    id: 'indoor_arena',
    name: 'Indoor Arena',
    icon: Home,
    category: 'training',
    applicableFor: ['trainer'],
    description: 'Weather-proof training space'
  },
  {
    id: 'certified_trainer',
    name: 'Certified Trainer',
    icon: Award,
    category: 'specialty',
    applicableFor: ['trainer'],
    description: 'Professionally certified trainers'
  },
  {
    id: 'behavioral_specialist',
    name: 'Behavioral Specialist',
    icon: User,
    category: 'specialty',
    applicableFor: ['trainer', 'veterinarian'],
    description: 'Expert in pet behavior'
  },

  // ============ SAFETY & SECURITY (Multiple Vendor Types) ============
  {
    id: 'security_guard',
    name: 'Security Guard',
    icon: Shield,
    category: 'safety',
    applicableFor: ['boarding', 'veterinarian', 'groomer', 'trainer'],
    description: 'On-site security personnel'
  },
  {
    id: 'fire_safety',
    name: 'Fire Safety',
    icon: ShieldCheck,
    category: 'safety',
    applicableFor: ['veterinarian', 'groomer', 'boarding', 'trainer'],
    description: 'Fire extinguishers and safety measures'
  },
  {
    id: 'first_aid',
    name: 'First Aid Kit',
    icon: Heart,
    category: 'safety',
    applicableFor: ['dog walker', 'groomer', 'boarding', 'trainer'],
    description: 'Emergency first aid available'
  },
  {
    id: 'insurance_partner',
    name: 'Insurance Partner',
    icon: CreditCard,
    category: 'basic',
    applicableFor: ['veterinarian', 'boarding'],
    description: 'Direct insurance claim support'
  },

  // ============ DOG WALKER SPECIFIC ============
  {
    id: 'gps_tracking',
    name: 'GPS Tracking',
    icon: MapPin,
    category: 'safety',
    applicableFor: ['dog walker'],
    description: 'Live GPS walk tracking'
  },
  {
    id: 'multiple_leash',
    name: 'Multiple Leash Options',
    icon: Shield,
    category: 'basic',
    applicableFor: ['dog walker'],
    description: 'Various leash types available'
  },
  {
    id: 'waste_bags',
    name: 'Waste Disposal',
    icon: Leaf,
    category: 'basic',
    applicableFor: ['dog walker'],
    description: 'Eco-friendly waste bags'
  },
  {
    id: 'water_carrier',
    name: 'Water & Treats',
    icon: Droplets,
    category: 'basic',
    applicableFor: ['dog walker'],
    description: 'Hydration during walks'
  }
];

/**
 * Get amenities applicable for a specific vendor type
 */
export function getAmenitiesForVendorType(vendorType: string): Amenity[] {
  if (!vendorType) {
    console.warn('[AMENITIES] No vendor type provided');
    return [];
  }

  // ✅ IMPROVED: Normalize vendor type to match amenity applicableFor values
  const normalizedType = vendorType
    .toLowerCase()
    .replace('role_', '')
    .replace('pet_', '')
    .replace('_clinic', '')
    .replace('_center', '')
    .replace('_trainer', '')
    .replace('dog_walker', 'dog walker');
  
  console.log('[AMENITIES] Original vendorType:', vendorType);
  console.log('[AMENITIES] Normalized type:', normalizedType);
  
  const filteredAmenities = MASTER_AMENITIES.filter(amenity => {
    // Check if the amenity is applicable for this vendor type
    const isApplicable = amenity.applicableFor.some(type => 
      normalizedType.includes(type.toLowerCase()) || type.toLowerCase().includes(normalizedType)
    );
    return isApplicable;
  });
  
  console.log(`[AMENITIES] Found ${filteredAmenities.length} amenities for ${vendorType}`);
  
  return filteredAmenities;
}

/**
 * Get amenities by category
 */
export function getAmenitiesByCategory(category: string): Amenity[] {
  return MASTER_AMENITIES.filter(amenity => amenity.category === category);
}

/**
 * Get amenity by ID
 */
export function getAmenityById(id: string): Amenity | undefined {
  return MASTER_AMENITIES.find(amenity => amenity.id === id);
}

/**
 * Get all unique categories
 */
export function getAmenityCategories(): string[] {
  const categories = new Set(MASTER_AMENITIES.map(a => a.category));
  return Array.from(categories);
}
