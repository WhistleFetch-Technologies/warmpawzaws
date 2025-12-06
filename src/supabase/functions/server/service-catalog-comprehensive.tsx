/**
 * COMPREHENSIVE Service Catalog for AT_HOME, AT_CENTER, and TELE Service Styles
 * Includes 90+ services across all vendor roles with package/subscription support
 * Enterprise-grade catalog for Warmpawz platform
 */

export interface ServiceCatalogItem {
  categoryId: string;
  categoryName: string;
  subCategoryId?: string;
  subCategoryName?: string;
  serviceName: string;
  serviceStyle: 'at_home' | 'at_center' | 'tele';
  applicableRoles: string[];
  basePrice: number;
  isPackage: boolean;
  packageDetails?: {
    sessionsPerDay: number;
    sessionDuration: number; // minutes
    packageDuration: number; // days
    totalSessions: number;
    pricingBySize: {
      small: number;
      medium: number;
      large: number;
      extraLarge: number;
    };
  };
  description: string;
  duration?: number; // minutes for single services
}

export const COMPREHENSIVE_SERVICE_CATALOG: ServiceCatalogItem[] = [
  // ==================== GROOMER AT_HOME SERVICES ====================
  {
    categoryId: 'grooming',
    categoryName: 'Grooming',
    serviceName: 'Complete Home Grooming Session',
    serviceStyle: 'at_home',
    applicableRoles: ['pet_groomer'],
    basePrice: 1500,
    isPackage: false,
    duration: 90,
    description: 'Full grooming service at home including bath, haircut, nail trim, ear cleaning'
  },
  {
    categoryId: 'grooming',
    categoryName: 'Grooming',
    serviceName: 'Bath & Brush Service at Home',
    serviceStyle: 'at_home',
    applicableRoles: ['pet_groomer'],
    basePrice: 800,
    isPackage: false,
    duration: 60,
    description: 'Professional bath with premium shampoo, conditioning, and thorough brushing'
  },
  {
    categoryId: 'grooming',
    categoryName: 'Grooming',
    serviceName: 'Nail Trimming & Paw Care at Home',
    serviceStyle: 'at_home',
    applicableRoles: ['pet_groomer'],
    basePrice: 300,
    isPackage: false,
    duration: 30,
    description: 'Professional nail trimming, filing, and paw pad moisturizing'
  },
  {
    categoryId: 'grooming',
    categoryName: 'Grooming',
    serviceName: 'De-shedding Treatment at Home',
    serviceStyle: 'at_home',
    applicableRoles: ['pet_groomer'],
    basePrice: 700,
    isPackage: false,
    duration: 60,
    description: 'Specialized de-shedding treatment to reduce excessive shedding'
  },
  {
    categoryId: 'grooming',
    categoryName: 'Grooming',
    serviceName: 'Flea & Tick Treatment at Home',
    serviceStyle: 'at_home',
    applicableRoles: ['pet_groomer'],
    basePrice: 600,
    isPackage: false,
    duration: 45,
    description: 'Anti-parasitic bath and treatment for flea and tick removal'
  },

  // ==================== GROOMER AT_CENTER SERVICES ====================
  {
    categoryId: 'grooming',
    categoryName: 'Grooming',
    serviceName: 'Premium Salon Grooming',
    serviceStyle: 'at_center',
    applicableRoles: ['pet_groomer'],
    basePrice: 2000,
    isPackage: false,
    duration: 120,
    description: 'Complete salon grooming with professional equipment and styling'
  },
  {
    categoryId: 'grooming',
    categoryName: 'Grooming',
    serviceName: 'Spa Package at Salon',
    serviceStyle: 'at_center',
    applicableRoles: ['pet_groomer'],
    basePrice: 2500,
    isPackage: false,
    duration: 150,
    description: 'Luxury spa treatment including aromatherapy, deep conditioning, massage'
  },
  {
    categoryId: 'grooming',
    categoryName: 'Grooming',
    serviceName: 'Breed-Specific Styling at Salon',
    serviceStyle: 'at_center',
    applicableRoles: ['pet_groomer'],
    basePrice: 2200,
    isPackage: false,
    duration: 120,
    description: 'Professional breed-standard haircut and styling'
  },
  {
    categoryId: 'grooming',
    categoryName: 'Grooming',
    serviceName: 'Express Grooming at Center',
    serviceStyle: 'at_center',
    applicableRoles: ['pet_groomer'],
    basePrice: 1000,
    isPackage: false,
    duration: 45,
    description: 'Quick grooming service: bath, brush, nail trim'
  },
  {
    categoryId: 'grooming',
    categoryName: 'Grooming',
    serviceName: 'Teeth Cleaning at Salon',
    serviceStyle: 'at_center',
    applicableRoles: ['pet_groomer'],
    basePrice: 600,
    isPackage: false,
    duration: 30,
    description: 'Professional teeth brushing and oral hygiene'
  },

  // ==================== GROOMER TELE SERVICES ====================
  {
    categoryId: 'grooming',
    categoryName: 'Grooming',
    serviceName: 'Virtual Grooming Consultation',
    serviceStyle: 'tele',
    applicableRoles: ['pet_groomer'],
    basePrice: 200,
    isPackage: false,
    duration: 20,
    description: 'Virtual consultation for grooming needs and recommendations'
  },
  {
    categoryId: 'grooming',
    categoryName: 'Grooming',
    serviceName: 'DIY Grooming Guidance',
    serviceStyle: 'tele',
    applicableRoles: ['pet_groomer'],
    basePrice: 300,
    isPackage: false,
    duration: 30,
    description: 'Step-by-step guidance for grooming your pet at home'
  },

  // ==================== VET AT_HOME SERVICES ====================
  {
    categoryId: 'veterinary',
    categoryName: 'Veterinary',
    serviceName: 'General Health Checkup at Home',
    serviceStyle: 'at_home',
    applicableRoles: ['veterinarian', 'pet_clinic'],
    basePrice: 800,
    isPackage: false,
    duration: 45,
    description: 'Comprehensive physical examination at your home'
  },
  {
    categoryId: 'veterinary',
    categoryName: 'Veterinary',
    serviceName: 'Vaccination at Home',
    serviceStyle: 'at_home',
    applicableRoles: ['veterinarian', 'pet_clinic'],
    basePrice: 600,
    isPackage: false,
    duration: 30,
    description: 'Core and non-core vaccinations administered at home'
  },
  {
    categoryId: 'veterinary',
    categoryName: 'Veterinary',
    serviceName: 'Deworming at Home',
    serviceStyle: 'at_home',
    applicableRoles: ['veterinarian', 'pet_clinic'],
    basePrice: 400,
    isPackage: false,
    duration: 20,
    description: 'Deworming treatment and parasite prevention'
  },
  {
    categoryId: 'veterinary',
    categoryName: 'Veterinary',
    serviceName: 'Emergency Home Visit',
    serviceStyle: 'at_home',
    applicableRoles: ['veterinarian', 'pet_clinic'],
    basePrice: 2000,
    isPackage: false,
    duration: 90,
    description: 'Urgent veterinary care at your home for emergencies'
  },
  {
    categoryId: 'veterinary',
    categoryName: 'Veterinary',
    serviceName: 'Post-Surgery Home Care',
    serviceStyle: 'at_home',
    applicableRoles: ['veterinarian', 'pet_clinic'],
    basePrice: 1000,
    isPackage: false,
    duration: 60,
    description: 'Post-operative monitoring and wound care at home'
  },

  // ==================== VET AT_CENTER SERVICES ====================
  {
    categoryId: 'veterinary',
    categoryName: 'Veterinary',
    serviceName: 'Comprehensive Health Checkup at Clinic',
    serviceStyle: 'at_center',
    applicableRoles: ['veterinarian', 'pet_clinic'],
    basePrice: 1000,
    isPackage: false,
    duration: 60,
    description: 'Full medical examination with diagnostic equipment'
  },
  {
    categoryId: 'veterinary',
    categoryName: 'Veterinary',
    serviceName: 'Surgery - Minor Procedure',
    serviceStyle: 'at_center',
    applicableRoles: ['pet_clinic'],
    basePrice: 5000,
    isPackage: false,
    duration: 120,
    description: 'Minor surgical procedures at clinic facility'
  },
  {
    categoryId: 'veterinary',
    categoryName: 'Veterinary',
    serviceName: 'Surgery - Major Procedure',
    serviceStyle: 'at_center',
    applicableRoles: ['pet_clinic'],
    basePrice: 15000,
    isPackage: false,
    duration: 240,
    description: 'Major surgical procedures with full anesthesia'
  },
  {
    categoryId: 'veterinary',
    categoryName: 'Veterinary',
    serviceName: 'Dental Surgery at Clinic',
    serviceStyle: 'at_center',
    applicableRoles: ['pet_clinic'],
    basePrice: 8000,
    isPackage: false,
    duration: 180,
    description: 'Professional dental cleaning and tooth extraction'
  },
  {
    categoryId: 'veterinary',
    categoryName: 'Veterinary',
    serviceName: 'X-Ray Imaging',
    serviceStyle: 'at_center',
    applicableRoles: ['pet_clinic'],
    basePrice: 2000,
    isPackage: false,
    duration: 45,
    description: 'Digital X-ray imaging for diagnosis'
  },
  {
    categoryId: 'veterinary',
    categoryName: 'Veterinary',
    serviceName: 'Ultrasound Imaging',
    serviceStyle: 'at_center',
    applicableRoles: ['pet_clinic'],
    basePrice: 3000,
    isPackage: false,
    duration: 60,
    description: 'Ultrasound examination for internal organs'
  },
  {
    categoryId: 'veterinary',
    categoryName: 'Veterinary',
    serviceName: 'Blood Test Panel',
    serviceStyle: 'at_center',
    applicableRoles: ['pet_clinic'],
    basePrice: 1500,
    isPackage: false,
    duration: 30,
    description: 'Complete blood count and chemistry panel'
  },
  {
    categoryId: 'veterinary',
    categoryName: 'Veterinary',
    serviceName: 'Hospitalization - Day Care',
    serviceStyle: 'at_center',
    applicableRoles: ['pet_clinic'],
    basePrice: 2000,
    isPackage: false,
    duration: 480,
    description: 'Day hospitalization with medical monitoring'
  },
  {
    categoryId: 'veterinary',
    categoryName: 'Veterinary',
    serviceName: 'Spay/Neuter Surgery',
    serviceStyle: 'at_center',
    applicableRoles: ['pet_clinic'],
    basePrice: 6000,
    isPackage: false,
    duration: 180,
    description: 'Sterilization surgery with post-op care'
  },

  // ==================== VET TELE SERVICES ====================
  {
    categoryId: 'veterinary',
    categoryName: 'Veterinary',
    serviceName: 'General Tele-Consultation',
    serviceStyle: 'tele',
    applicableRoles: ['veterinarian', 'pet_clinic'],
    basePrice: 400,
    isPackage: false,
    duration: 20,
    description: 'Virtual consultation for general health concerns'
  },
  {
    categoryId: 'veterinary',
    categoryName: 'Veterinary',
    serviceName: 'Follow-up Consultation',
    serviceStyle: 'tele',
    applicableRoles: ['veterinarian', 'pet_clinic'],
    basePrice: 300,
    isPackage: false,
    duration: 15,
    description: 'Follow-up video call for ongoing treatment'
  },
  {
    categoryId: 'veterinary',
    categoryName: 'Veterinary',
    serviceName: 'Prescription Renewal',
    serviceStyle: 'tele',
    applicableRoles: ['veterinarian', 'pet_clinic'],
    basePrice: 200,
    isPackage: false,
    duration: 10,
    description: 'Remote prescription renewal for medications'
  },
  {
    categoryId: 'veterinary',
    categoryName: 'Veterinary',
    serviceName: 'Nutrition Consultation',
    serviceStyle: 'tele',
    applicableRoles: ['veterinarian', 'pet_clinic'],
    basePrice: 500,
    isPackage: false,
    duration: 30,
    description: 'Personalized diet plan and nutrition advice'
  },
  {
    categoryId: 'veterinary',
    categoryName: 'Veterinary',
    serviceName: 'Lab Report Review',
    serviceStyle: 'tele',
    applicableRoles: ['veterinarian', 'pet_clinic'],
    basePrice: 350,
    isPackage: false,
    duration: 20,
    description: 'Professional review of lab test results'
  },

  // ==================== TRAINER AT_HOME PACKAGES ====================
  {
    categoryId: 'training',
    categoryName: 'Training',
    serviceName: 'Basic Obedience - 14 Day Package',
    serviceStyle: 'at_home',
    applicableRoles: ['pet_trainer'],
    basePrice: 0,
    isPackage: true,
    packageDetails: {
      sessionsPerDay: 1,
      sessionDuration: 45,
      packageDuration: 14,
      totalSessions: 14,
      pricingBySize: { small: 6500, medium: 7800, large: 9100, extraLarge: 10400 }
    },
    description: 'Comprehensive basic obedience - 14 sessions'
  },
  {
    categoryId: 'training',
    categoryName: 'Training',
    serviceName: 'Puppy Training - 7 Day Package',
    serviceStyle: 'at_home',
    applicableRoles: ['pet_trainer'],
    basePrice: 0,
    isPackage: true,
    packageDetails: {
      sessionsPerDay: 1,
      sessionDuration: 30,
      packageDuration: 7,
      totalSessions: 7,
      pricingBySize: { small: 2800, medium: 3500, large: 4200, extraLarge: 4900 }
    },
    description: 'Puppy socialization and basic training'
  },
  {
    categoryId: 'training',
    categoryName: 'Training',
    serviceName: 'Aggression Management - 14 Day Package',
    serviceStyle: 'at_home',
    applicableRoles: ['pet_trainer'],
    basePrice: 0,
    isPackage: true,
    packageDetails: {
      sessionsPerDay: 1,
      sessionDuration: 60,
      packageDuration: 14,
      totalSessions: 14,
      pricingBySize: { small: 8400, medium: 10500, large: 12600, extraLarge: 14700 }
    },
    description: 'Specialized aggression behavior modification'
  },
  {
    categoryId: 'training',
    categoryName: 'Training',
    serviceName: 'Potty Training - 7 Day Package',
    serviceStyle: 'at_home',
    applicableRoles: ['pet_trainer'],
    basePrice: 0,
    isPackage: true,
    packageDetails: {
      sessionsPerDay: 2,
      sessionDuration: 20,
      packageDuration: 7,
      totalSessions: 14,
      pricingBySize: { small: 2800, medium: 3500, large: 4200, extraLarge: 4900 }
    },
    description: 'Intensive potty training - 2 sessions daily'
  },

  // ==================== TRAINER AT_CENTER SERVICES ====================
  {
    categoryId: 'training',
    categoryName: 'Training',
    serviceName: 'Group Training Class at Center',
    serviceStyle: 'at_center',
    applicableRoles: ['pet_trainer'],
    basePrice: 1500,
    isPackage: false,
    duration: 60,
    description: 'Group obedience training class at training center'
  },
  {
    categoryId: 'training',
    categoryName: 'Training',
    serviceName: 'Advanced Agility Training at Center',
    serviceStyle: 'at_center',
    applicableRoles: ['pet_trainer'],
    basePrice: 2000,
    isPackage: false,
    duration: 90,
    description: 'Professional agility equipment training'
  },
  {
    categoryId: 'training',
    categoryName: 'Training',
    serviceName: 'Board & Train - 7 Days',
    serviceStyle: 'at_center',
    applicableRoles: ['pet_trainer'],
    basePrice: 15000,
    isPackage: false,
    duration: 10080,
    description: 'Intensive boarding with daily training sessions'
  },

  // ==================== TRAINER TELE SERVICES ====================
  {
    categoryId: 'training',
    categoryName: 'Training',
    serviceName: 'Virtual Training Session',
    serviceStyle: 'tele',
    applicableRoles: ['pet_trainer'],
    basePrice: 400,
    isPackage: false,
    duration: 30,
    description: 'Live virtual training with real-time guidance'
  },
  {
    categoryId: 'training',
    categoryName: 'Training',
    serviceName: 'Behavioral Consultation',
    serviceStyle: 'tele',
    applicableRoles: ['pet_trainer'],
    basePrice: 500,
    isPackage: false,
    duration: 45,
    description: 'Virtual behavioral assessment and action plan'
  },

  // ==================== WALKER AT_HOME PACKAGES ====================
  {
    categoryId: 'walking',
    categoryName: 'Dog Walking',
    serviceName: 'Daily Walk - 1 Walk/Day - 7 Day Package',
    serviceStyle: 'at_home',
    applicableRoles: ['pet_walker'],
    basePrice: 0,
    isPackage: true,
    packageDetails: {
      sessionsPerDay: 1,
      sessionDuration: 30,
      packageDuration: 7,
      totalSessions: 7,
      pricingBySize: { small: 1400, medium: 1750, large: 2100, extraLarge: 2450 }
    },
    description: '30-minute daily walk - 1 session per day for 7 days'
  },
  {
    categoryId: 'walking',
    categoryName: 'Dog Walking',
    serviceName: 'Daily Walk - 1 Walk/Day - 14 Day Package',
    serviceStyle: 'at_home',
    applicableRoles: ['pet_walker'],
    basePrice: 0,
    isPackage: true,
    packageDetails: {
      sessionsPerDay: 1,
      sessionDuration: 30,
      packageDuration: 14,
      totalSessions: 14,
      pricingBySize: { small: 2600, medium: 3250, large: 3900, extraLarge: 4550 }
    },
    description: '30-minute daily walk - 1 session per day for 14 days'
  },
  {
    categoryId: 'walking',
    categoryName: 'Dog Walking',
    serviceName: 'Daily Walk - 1 Walk/Day - 30 Day Package',
    serviceStyle: 'at_home',
    applicableRoles: ['pet_walker'],
    basePrice: 0,
    isPackage: true,
    packageDetails: {
      sessionsPerDay: 1,
      sessionDuration: 30,
      packageDuration: 30,
      totalSessions: 30,
      pricingBySize: { small: 5400, medium: 6750, large: 8100, extraLarge: 9450 }
    },
    description: '30-minute daily walk - 1 session per day for 30 days'
  },
  {
    categoryId: 'walking',
    categoryName: 'Dog Walking',
    serviceName: 'Premium Walk - 2 Walks/Day - 7 Day Package',
    serviceStyle: 'at_home',
    applicableRoles: ['pet_walker'],
    basePrice: 0,
    isPackage: true,
    packageDetails: {
      sessionsPerDay: 2,
      sessionDuration: 30,
      packageDuration: 7,
      totalSessions: 14,
      pricingBySize: { small: 2600, medium: 3250, large: 3900, extraLarge: 4550 }
    },
    description: '30-minute walks - 2 sessions per day for 7 days'
  },
  {
    categoryId: 'walking',
    categoryName: 'Dog Walking',
    serviceName: 'Premium Walk - 2 Walks/Day - 14 Day Package',
    serviceStyle: 'at_home',
    applicableRoles: ['pet_walker'],
    basePrice: 0,
    isPackage: true,
    packageDetails: {
      sessionsPerDay: 2,
      sessionDuration: 30,
      packageDuration: 14,
      totalSessions: 28,
      pricingBySize: { small: 4900, medium: 6125, large: 7350, extraLarge: 8575 }
    },
    description: '30-minute walks - 2 sessions per day for 14 days'
  },
  {
    categoryId: 'walking',
    categoryName: 'Dog Walking',
    serviceName: 'One-Time Walk - 30 Minutes',
    serviceStyle: 'at_home',
    applicableRoles: ['pet_walker'],
    basePrice: 250,
    isPackage: false,
    duration: 30,
    description: 'Single 30-minute walk service'
  },
  {
    categoryId: 'walking',
    categoryName: 'Dog Walking',
    serviceName: 'One-Time Walk - 60 Minutes',
    serviceStyle: 'at_home',
    applicableRoles: ['pet_walker'],
    basePrice: 450,
    isPackage: false,
    duration: 60,
    description: 'Single 60-minute walk service'
  },

  // ==================== SITTER AT_HOME SERVICES ====================
  {
    categoryId: 'sitting',
    categoryName: 'Pet Sitting',
    serviceName: 'Daily Pet Sitting - 4 Hours',
    serviceStyle: 'at_home',
    applicableRoles: ['pet_boarder'],
    basePrice: 800,
    isPackage: false,
    duration: 240,
    description: '4-hour daily pet sitting at your home'
  },
  {
    categoryId: 'sitting',
    categoryName: 'Pet Sitting',
    serviceName: 'Daily Pet Sitting - 8 Hours',
    serviceStyle: 'at_home',
    applicableRoles: ['pet_boarder'],
    basePrice: 1400,
    isPackage: false,
    duration: 480,
    description: 'Full-day 8-hour pet sitting service'
  },
  {
    categoryId: 'sitting',
    categoryName: 'Pet Sitting',
    serviceName: 'Overnight Pet Sitting',
    serviceStyle: 'at_home',
    applicableRoles: ['pet_boarder'],
    basePrice: 2000,
    isPackage: false,
    duration: 720,
    description: 'Overnight pet sitting (12 hours) at your home'
  },
  {
    categoryId: 'sitting',
    categoryName: 'Pet Sitting',
    serviceName: 'Weekend Pet Sitting Package',
    serviceStyle: 'at_home',
    applicableRoles: ['pet_boarder'],
    basePrice: 5000,
    isPackage: false,
    duration: 2880,
    description: 'Full weekend pet care (48 hours)'
  },
  {
    categoryId: 'sitting',
    categoryName: 'Pet Sitting',
    serviceName: 'Pet Feeding Visit',
    serviceStyle: 'at_home',
    applicableRoles: ['pet_boarder'],
    basePrice: 300,
    isPackage: false,
    duration: 30,
    description: 'Quick visit to feed and check on your pet'
  },

  // ==================== BOARDING AT_CENTER PACKAGES ====================
  {
    categoryId: 'boarding',
    categoryName: 'Pet Boarding',
    serviceName: 'Standard Boarding - Per Night',
    serviceStyle: 'at_center',
    applicableRoles: ['pet_boarder'],
    basePrice: 0,
    isPackage: true,
    packageDetails: {
      sessionsPerDay: 1,
      sessionDuration: 1440,
      packageDuration: 1,
      totalSessions: 1,
      pricingBySize: { small: 600, medium: 800, large: 1000, extraLarge: 1300 }
    },
    description: 'Safe overnight boarding with care'
  },
  {
    categoryId: 'boarding',
    categoryName: 'Pet Boarding',
    serviceName: 'Weekly Boarding',
    serviceStyle: 'at_center',
    applicableRoles: ['pet_boarder'],
    basePrice: 0,
    isPackage: true,
    packageDetails: {
      sessionsPerDay: 1,
      sessionDuration: 1440,
      packageDuration: 7,
      totalSessions: 7,
      pricingBySize: { small: 3800, medium: 5000, large: 6500, extraLarge: 8500 }
    },
    description: '7-night boarding package'
  },
  {
    categoryId: 'boarding',
    categoryName: 'Pet Boarding',
    serviceName: 'Extended Boarding - 15 Days',
    serviceStyle: 'at_center',
    applicableRoles: ['pet_boarder'],
    basePrice: 0,
    isPackage: true,
    packageDetails: {
      sessionsPerDay: 1,
      sessionDuration: 1440,
      packageDuration: 15,
      totalSessions: 15,
      pricingBySize: { small: 7500, medium: 10000, large: 13000, extraLarge: 17000 }
    },
    description: '15-night extended boarding'
  }
];

console.log(`✅ Comprehensive Service Catalog loaded: ${COMPREHENSIVE_SERVICE_CATALOG.length} services`);