/**
 * Comprehensive Service Catalog for HOME and TELE Service Styles
 * Includes package/subscription support for Walkers and Trainers
 */

export interface ServiceCatalogItem {
  categoryId: string;
  categoryName: string;
  subCategoryId?: string;
  subCategoryName?: string;
  serviceName: string;
  serviceStyle: 'home' | 'tele';
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

export const SERVICE_CATALOG: ServiceCatalogItem[] = [
  // ==================== GROOMER HOME SERVICES ====================
  {
    categoryId: 'grooming',
    categoryName: 'Grooming',
    subCategoryId: 'full_grooming',
    subCategoryName: 'Full Grooming',
    serviceName: 'Complete Home Grooming Session',
    serviceStyle: 'home',
    applicableRoles: ['groomer'],
    basePrice: 1500,
    isPackage: false,
    duration: 90,
    description: 'Full grooming service at your home including bath, haircut, nail trim, ear cleaning'
  },
  {
    categoryId: 'grooming',
    categoryName: 'Grooming',
    subCategoryId: 'bath',
    subCategoryName: 'Bath & Hygiene',
    serviceName: 'Bath & Brush Service',
    serviceStyle: 'home',
    applicableRoles: ['groomer'],
    basePrice: 800,
    isPackage: false,
    duration: 60,
    description: 'Professional bath with premium shampoo, conditioning, and thorough brushing'
  },
  {
    categoryId: 'grooming',
    categoryName: 'Grooming',
    subCategoryId: 'nail_care',
    subCategoryName: 'Nail & Paw Care',
    serviceName: 'Nail Trimming & Paw Care',
    serviceStyle: 'home',
    applicableRoles: ['groomer'],
    basePrice: 300,
    isPackage: false,
    duration: 30,
    description: 'Professional nail trimming, filing, and paw pad moisturizing'
  },
  {
    categoryId: 'grooming',
    categoryName: 'Grooming',
    subCategoryId: 'hygiene',
    subCategoryName: 'Hygiene Services',
    serviceName: 'Ear Cleaning Service',
    serviceStyle: 'home',
    applicableRoles: ['groomer'],
    basePrice: 250,
    isPackage: false,
    duration: 20,
    description: 'Gentle ear cleaning and inspection for ear health'
  },
  {
    categoryId: 'grooming',
    categoryName: 'Grooming',
    subCategoryId: 'hygiene',
    subCategoryName: 'Hygiene Services',
    serviceName: 'Teeth Cleaning',
    serviceStyle: 'home',
    applicableRoles: ['groomer'],
    basePrice: 500,
    isPackage: false,
    duration: 30,
    description: 'Professional teeth brushing and oral hygiene maintenance'
  },
  {
    categoryId: 'grooming',
    categoryName: 'Grooming',
    subCategoryId: 'treatment',
    subCategoryName: 'Special Treatments',
    serviceName: 'Flea & Tick Treatment',
    serviceStyle: 'home',
    applicableRoles: ['groomer'],
    basePrice: 600,
    isPackage: false,
    duration: 45,
    description: 'Anti-parasitic bath and treatment for flea and tick removal'
  },
  {
    categoryId: 'grooming',
    categoryName: 'Grooming',
    subCategoryId: 'treatment',
    subCategoryName: 'Special Treatments',
    serviceName: 'De-shedding Treatment',
    serviceStyle: 'home',
    applicableRoles: ['groomer'],
    basePrice: 700,
    isPackage: false,
    duration: 60,
    description: 'Specialized de-shedding treatment to reduce excessive shedding'
  },
  {
    categoryId: 'grooming',
    categoryName: 'Grooming',
    subCategoryId: 'styling',
    subCategoryName: 'Breed Styling',
    serviceName: 'Breed-Specific Styling',
    serviceStyle: 'home',
    applicableRoles: ['groomer'],
    basePrice: 2000,
    isPackage: false,
    duration: 120,
    description: 'Professional breed-standard haircut and styling'
  },

  // ==================== GROOMER TELE SERVICES ====================
  {
    categoryId: 'grooming',
    categoryName: 'Grooming',
    subCategoryId: 'consultation',
    subCategoryName: 'Consultation',
    serviceName: 'Grooming Consultation',
    serviceStyle: 'tele',
    applicableRoles: ['groomer'],
    basePrice: 200,
    isPackage: false,
    duration: 20,
    description: 'Virtual consultation for grooming needs and recommendations'
  },
  {
    categoryId: 'grooming',
    categoryName: 'Grooming',
    subCategoryId: 'consultation',
    subCategoryName: 'Consultation',
    serviceName: 'DIY Grooming Guidance',
    serviceStyle: 'tele',
    applicableRoles: ['groomer'],
    basePrice: 300,
    isPackage: false,
    duration: 30,
    description: 'Step-by-step guidance for grooming your pet at home'
  },
  {
    categoryId: 'grooming',
    categoryName: 'Grooming',
    subCategoryId: 'consultation',
    subCategoryName: 'Consultation',
    serviceName: 'Product Recommendation Session',
    serviceStyle: 'tele',
    applicableRoles: ['groomer'],
    basePrice: 150,
    isPackage: false,
    duration: 15,
    description: 'Expert recommendations for grooming products and tools'
  },
  {
    categoryId: 'grooming',
    categoryName: 'Grooming',
    subCategoryId: 'consultation',
    subCategoryName: 'Consultation',
    serviceName: 'Coat Care Advice',
    serviceStyle: 'tele',
    applicableRoles: ['groomer'],
    basePrice: 250,
    isPackage: false,
    duration: 25,
    description: 'Specialized advice for coat health and maintenance'
  },

  // ==================== VETERINARY HOME SERVICES ====================
  {
    categoryId: 'veterinary',
    categoryName: 'Veterinary',
    subCategoryId: 'checkup',
    subCategoryName: 'Health Checkup',
    serviceName: 'General Health Checkup at Home',
    serviceStyle: 'home',
    applicableRoles: ['vet', 'veterinary_clinic'],
    basePrice: 800,
    isPackage: false,
    duration: 45,
    description: 'Comprehensive physical examination at your home'
  },
  {
    categoryId: 'veterinary',
    categoryName: 'Veterinary',
    subCategoryId: 'vaccination',
    subCategoryName: 'Vaccination',
    serviceName: 'Vaccination at Home',
    serviceStyle: 'home',
    applicableRoles: ['vet', 'veterinary_clinic'],
    basePrice: 600,
    isPackage: false,
    duration: 30,
    description: 'Core and non-core vaccinations administered at home'
  },
  {
    categoryId: 'veterinary',
    categoryName: 'Veterinary',
    subCategoryId: 'preventive',
    subCategoryName: 'Preventive Care',
    serviceName: 'Deworming Service',
    serviceStyle: 'home',
    applicableRoles: ['vet', 'veterinary_clinic'],
    basePrice: 400,
    isPackage: false,
    duration: 20,
    description: 'Deworming treatment and parasite prevention'
  },
  {
    categoryId: 'veterinary',
    categoryName: 'Veterinary',
    subCategoryId: 'documentation',
    subCategoryName: 'Documentation',
    serviceName: 'Health Certificate Issuance',
    serviceStyle: 'home',
    applicableRoles: ['vet', 'veterinary_clinic'],
    basePrice: 500,
    isPackage: false,
    duration: 30,
    description: 'Official health certificate for travel or relocation'
  },
  {
    categoryId: 'veterinary',
    categoryName: 'Veterinary',
    subCategoryId: 'post_care',
    subCategoryName: 'Post-Care',
    serviceName: 'Post-Surgery Home Care',
    serviceStyle: 'home',
    applicableRoles: ['vet', 'veterinary_clinic'],
    basePrice: 1000,
    isPackage: false,
    duration: 60,
    description: 'Post-operative monitoring and wound care at home'
  },
  {
    categoryId: 'veterinary',
    categoryName: 'Veterinary',
    subCategoryId: 'chronic',
    subCategoryName: 'Chronic Care',
    serviceName: 'Chronic Disease Management Visit',
    serviceStyle: 'home',
    applicableRoles: ['vet', 'veterinary_clinic'],
    basePrice: 900,
    isPackage: false,
    duration: 50,
    description: 'Regular monitoring for chronic conditions like diabetes, kidney disease'
  },
  {
    categoryId: 'veterinary',
    categoryName: 'Veterinary',
    subCategoryId: 'senior',
    subCategoryName: 'Senior Pet Care',
    serviceName: 'Geriatric Care Home Visit',
    serviceStyle: 'home',
    applicableRoles: ['vet', 'veterinary_clinic'],
    basePrice: 1200,
    isPackage: false,
    duration: 60,
    description: 'Specialized care for senior pets with mobility or health issues'
  },
  {
    categoryId: 'veterinary',
    categoryName: 'Veterinary',
    subCategoryId: 'emergency',
    subCategoryName: 'Emergency',
    serviceName: 'Emergency Home Visit',
    serviceStyle: 'home',
    applicableRoles: ['vet', 'veterinary_clinic'],
    basePrice: 2000,
    isPackage: false,
    duration: 90,
    description: 'Urgent veterinary care at your home for emergencies'
  },

  // ==================== VETERINARY TELE SERVICES ====================
  {
    categoryId: 'veterinary',
    categoryName: 'Veterinary',
    subCategoryId: 'tele_consult',
    subCategoryName: 'Tele-Consultation',
    serviceName: 'General Tele-Consultation',
    serviceStyle: 'tele',
    applicableRoles: ['vet', 'veterinary_clinic'],
    basePrice: 400,
    isPackage: false,
    duration: 20,
    description: 'Virtual consultation for general health concerns'
  },
  {
    categoryId: 'veterinary',
    categoryName: 'Veterinary',
    subCategoryId: 'tele_consult',
    subCategoryName: 'Tele-Consultation',
    serviceName: 'Follow-up Consultation',
    serviceStyle: 'tele',
    applicableRoles: ['vet', 'veterinary_clinic'],
    basePrice: 300,
    isPackage: false,
    duration: 15,
    description: 'Follow-up video call for ongoing treatment monitoring'
  },
  {
    categoryId: 'veterinary',
    categoryName: 'Veterinary',
    subCategoryId: 'prescription',
    subCategoryName: 'Prescription',
    serviceName: 'Prescription Renewal',
    serviceStyle: 'tele',
    applicableRoles: ['vet', 'veterinary_clinic'],
    basePrice: 200,
    isPackage: false,
    duration: 10,
    description: 'Remote prescription renewal for ongoing medications'
  },
  {
    categoryId: 'veterinary',
    categoryName: 'Veterinary',
    subCategoryId: 'nutrition',
    subCategoryName: 'Nutrition',
    serviceName: 'Nutrition Consultation',
    serviceStyle: 'tele',
    applicableRoles: ['vet', 'veterinary_clinic'],
    basePrice: 500,
    isPackage: false,
    duration: 30,
    description: 'Personalized diet plan and nutrition advice'
  },
  {
    categoryId: 'veterinary',
    categoryName: 'Veterinary',
    subCategoryId: 'behavioral',
    subCategoryName: 'Behavioral Health',
    serviceName: 'Behavior & Wellness Advice',
    serviceStyle: 'tele',
    applicableRoles: ['vet', 'veterinary_clinic'],
    basePrice: 450,
    isPackage: false,
    duration: 25,
    description: 'Behavioral health consultation and wellness tips'
  },
  {
    categoryId: 'veterinary',
    categoryName: 'Veterinary',
    subCategoryId: 'lab_review',
    subCategoryName: 'Lab Reports',
    serviceName: 'Lab Report Review',
    serviceStyle: 'tele',
    applicableRoles: ['vet', 'veterinary_clinic'],
    basePrice: 350,
    isPackage: false,
    duration: 20,
    description: 'Professional review and explanation of lab test results'
  },
  {
    categoryId: 'veterinary',
    categoryName: 'Veterinary',
    subCategoryId: 'second_opinion',
    subCategoryName: 'Second Opinion',
    serviceName: 'Second Opinion Consultation',
    serviceStyle: 'tele',
    applicableRoles: ['vet', 'veterinary_clinic'],
    basePrice: 600,
    isPackage: false,
    duration: 30,
    description: 'Expert second opinion on diagnosis and treatment plans'
  },

  // ==================== TRAINER HOME SERVICES (WITH PACKAGES) ====================
  {
    categoryId: 'training',
    categoryName: 'Training',
    subCategoryId: 'obedience',
    subCategoryName: 'Obedience Training',
    serviceName: 'Basic Obedience Training - 7 Day Package',
    serviceStyle: 'home',
    applicableRoles: ['trainer'],
    basePrice: 0, // Base price not used for packages
    isPackage: true,
    packageDetails: {
      sessionsPerDay: 1,
      sessionDuration: 45,
      packageDuration: 7,
      totalSessions: 7,
      pricingBySize: {
        small: 3500,
        medium: 4200,
        large: 4900,
        extraLarge: 5600
      }
    },
    description: 'Basic commands: sit, stay, come, heel - 7 sessions over 7 days'
  },
  {
    categoryId: 'training',
    categoryName: 'Training',
    subCategoryId: 'obedience',
    subCategoryName: 'Obedience Training',
    serviceName: 'Basic Obedience Training - 14 Day Package',
    serviceStyle: 'home',
    applicableRoles: ['trainer'],
    basePrice: 0,
    isPackage: true,
    packageDetails: {
      sessionsPerDay: 1,
      sessionDuration: 45,
      packageDuration: 14,
      totalSessions: 14,
      pricingBySize: {
        small: 6500,
        medium: 7800,
        large: 9100,
        extraLarge: 10400
      }
    },
    description: 'Comprehensive basic obedience - 14 sessions over 14 days'
  },
  {
    categoryId: 'training',
    categoryName: 'Training',
    subCategoryId: 'puppy',
    subCategoryName: 'Puppy Training',
    serviceName: 'Puppy Training Program - 7 Day Package',
    serviceStyle: 'home',
    applicableRoles: ['trainer'],
    basePrice: 0,
    isPackage: true,
    packageDetails: {
      sessionsPerDay: 1,
      sessionDuration: 30,
      packageDuration: 7,
      totalSessions: 7,
      pricingBySize: {
        small: 2800,
        medium: 3500,
        large: 4200,
        extraLarge: 4900
      }
    },
    description: 'Puppy socialization and basic training - 7 sessions'
  },
  {
    categoryId: 'training',
    categoryName: 'Training',
    subCategoryId: 'puppy',
    subCategoryName: 'Puppy Training',
    serviceName: 'Puppy Training Program - 14 Day Package',
    serviceStyle: 'home',
    applicableRoles: ['trainer'],
    basePrice: 0,
    isPackage: true,
    packageDetails: {
      sessionsPerDay: 1,
      sessionDuration: 30,
      packageDuration: 14,
      totalSessions: 14,
      pricingBySize: {
        small: 5200,
        medium: 6500,
        large: 7800,
        extraLarge: 9100
      }
    },
    description: 'Complete puppy foundation training - 14 sessions'
  },
  {
    categoryId: 'training',
    categoryName: 'Training',
    subCategoryId: 'behavioral',
    subCategoryName: 'Behavioral Training',
    serviceName: 'Behavioral Consultation',
    serviceStyle: 'home',
    applicableRoles: ['trainer'],
    basePrice: 800,
    isPackage: false,
    duration: 60,
    description: 'One-time behavioral assessment and consultation'
  },
  {
    categoryId: 'training',
    categoryName: 'Training',
    subCategoryId: 'behavioral',
    subCategoryName: 'Behavioral Training',
    serviceName: 'Aggression Management - 14 Day Package',
    serviceStyle: 'home',
    applicableRoles: ['trainer'],
    basePrice: 0,
    isPackage: true,
    packageDetails: {
      sessionsPerDay: 1,
      sessionDuration: 60,
      packageDuration: 14,
      totalSessions: 14,
      pricingBySize: {
        small: 8400,
        medium: 10500,
        large: 12600,
        extraLarge: 14700
      }
    },
    description: 'Specialized aggression behavior modification program'
  },
  {
    categoryId: 'training',
    categoryName: 'Training',
    subCategoryId: 'socialization',
    subCategoryName: 'Socialization',
    serviceName: 'Socialization Training - 7 Day Package',
    serviceStyle: 'home',
    applicableRoles: ['trainer'],
    basePrice: 0,
    isPackage: true,
    packageDetails: {
      sessionsPerDay: 1,
      sessionDuration: 45,
      packageDuration: 7,
      totalSessions: 7,
      pricingBySize: {
        small: 3500,
        medium: 4200,
        large: 4900,
        extraLarge: 5600
      }
    },
    description: 'Dog and human socialization training program'
  },
  {
    categoryId: 'training',
    categoryName: 'Training',
    subCategoryId: 'anxiety',
    subCategoryName: 'Anxiety Management',
    serviceName: 'Anxiety & Fear Management - 7 Day Package',
    serviceStyle: 'home',
    applicableRoles: ['trainer'],
    basePrice: 0,
    isPackage: true,
    packageDetails: {
      sessionsPerDay: 1,
      sessionDuration: 45,
      packageDuration: 7,
      totalSessions: 7,
      pricingBySize: {
        small: 4200,
        medium: 5250,
        large: 6300,
        extraLarge: 7350
      }
    },
    description: 'Anxiety reduction and confidence building program'
  },
  {
    categoryId: 'training',
    categoryName: 'Training',
    subCategoryId: 'potty',
    subCategoryName: 'Potty Training',
    serviceName: 'Potty Training Program - 7 Day Package',
    serviceStyle: 'home',
    applicableRoles: ['trainer'],
    basePrice: 0,
    isPackage: true,
    packageDetails: {
      sessionsPerDay: 2,
      sessionDuration: 20,
      packageDuration: 7,
      totalSessions: 14,
      pricingBySize: {
        small: 2800,
        medium: 3500,
        large: 4200,
        extraLarge: 4900
      }
    },
    description: 'Intensive potty training - 2 sessions daily for 7 days'
  },
  {
    categoryId: 'training',
    categoryName: 'Training',
    subCategoryId: 'tricks',
    subCategoryName: 'Trick Training',
    serviceName: 'One-time Trick Training Session',
    serviceStyle: 'home',
    applicableRoles: ['trainer'],
    basePrice: 600,
    isPackage: false,
    duration: 45,
    description: 'Fun tricks and advanced commands - single session'
  },

  // ==================== TRAINER TELE SERVICES ====================
  {
    categoryId: 'training',
    categoryName: 'Training',
    subCategoryId: 'virtual',
    subCategoryName: 'Virtual Training',
    serviceName: 'Virtual Training Session',
    serviceStyle: 'tele',
    applicableRoles: ['trainer'],
    basePrice: 400,
    isPackage: false,
    duration: 30,
    description: 'Live virtual training session with real-time guidance'
  },
  {
    categoryId: 'training',
    categoryName: 'Training',
    subCategoryId: 'consultation',
    subCategoryName: 'Consultation',
    serviceName: 'Behavioral Consultation',
    serviceStyle: 'tele',
    applicableRoles: ['trainer'],
    basePrice: 500,
    isPackage: false,
    duration: 45,
    description: 'Virtual behavioral assessment and action plan'
  },
  {
    categoryId: 'training',
    categoryName: 'Training',
    subCategoryId: 'review',
    subCategoryName: 'Review',
    serviceName: 'Training Plan Review',
    serviceStyle: 'tele',
    applicableRoles: ['trainer'],
    basePrice: 300,
    isPackage: false,
    duration: 20,
    description: 'Review progress and adjust training plan'
  },
  {
    categoryId: 'training',
    categoryName: 'Training',
    subCategoryId: 'assessment',
    subCategoryName: 'Assessment',
    serviceName: 'Progress Assessment',
    serviceStyle: 'tele',
    applicableRoles: ['trainer'],
    basePrice: 350,
    isPackage: false,
    duration: 25,
    description: 'Evaluate training progress and provide recommendations'
  },
  {
    categoryId: 'training',
    categoryName: 'Training',
    subCategoryId: 'education',
    subCategoryName: 'Owner Education',
    serviceName: 'Owner Education Session',
    serviceStyle: 'tele',
    applicableRoles: ['trainer'],
    basePrice: 400,
    isPackage: false,
    duration: 30,
    description: 'Learn training techniques and theory for pet owners'
  },

  // ==================== WALKER HOME SERVICES (WITH PACKAGES) ====================
  {
    categoryId: 'walking',
    categoryName: 'Dog Walking',
    subCategoryId: 'daily_walk',
    subCategoryName: 'Daily Walks',
    serviceName: 'Daily Walk - 1 Walk/Day - 7 Day Package',
    serviceStyle: 'home',
    applicableRoles: ['walker'],
    basePrice: 0,
    isPackage: true,
    packageDetails: {
      sessionsPerDay: 1,
      sessionDuration: 30,
      packageDuration: 7,
      totalSessions: 7,
      pricingBySize: {
        small: 1400,
        medium: 1750,
        large: 2100,
        extraLarge: 2450
      }
    },
    description: '30-minute daily walk - 1 session per day for 7 days'
  },
  {
    categoryId: 'walking',
    categoryName: 'Dog Walking',
    subCategoryId: 'daily_walk',
    subCategoryName: 'Daily Walks',
    serviceName: 'Daily Walk - 1 Walk/Day - 14 Day Package',
    serviceStyle: 'home',
    applicableRoles: ['walker'],
    basePrice: 0,
    isPackage: true,
    packageDetails: {
      sessionsPerDay: 1,
      sessionDuration: 30,
      packageDuration: 14,
      totalSessions: 14,
      pricingBySize: {
        small: 2600,
        medium: 3250,
        large: 3900,
        extraLarge: 4550
      }
    },
    description: '30-minute daily walk - 1 session per day for 14 days'
  },
  {
    categoryId: 'walking',
    categoryName: 'Dog Walking',
    subCategoryId: 'daily_walk',
    subCategoryName: 'Daily Walks',
    serviceName: 'Daily Walk - 1 Walk/Day - 30 Day Package',
    serviceStyle: 'home',
    applicableRoles: ['walker'],
    basePrice: 0,
    isPackage: true,
    packageDetails: {
      sessionsPerDay: 1,
      sessionDuration: 30,
      packageDuration: 30,
      totalSessions: 30,
      pricingBySize: {
        small: 5400,
        medium: 6750,
        large: 8100,
        extraLarge: 9450
      }
    },
    description: '30-minute daily walk - 1 session per day for 30 days'
  },
  {
    categoryId: 'walking',
    categoryName: 'Dog Walking',
    subCategoryId: 'premium_walk',
    subCategoryName: 'Premium Walks',
    serviceName: 'Premium Walk - 2 Walks/Day - 7 Day Package',
    serviceStyle: 'home',
    applicableRoles: ['walker'],
    basePrice: 0,
    isPackage: true,
    packageDetails: {
      sessionsPerDay: 2,
      sessionDuration: 30,
      packageDuration: 7,
      totalSessions: 14,
      pricingBySize: {
        small: 2600,
        medium: 3250,
        large: 3900,
        extraLarge: 4550
      }
    },
    description: '30-minute walks - 2 sessions per day for 7 days'
  },
  {
    categoryId: 'walking',
    categoryName: 'Dog Walking',
    subCategoryId: 'premium_walk',
    subCategoryName: 'Premium Walks',
    serviceName: 'Premium Walk - 2 Walks/Day - 14 Day Package',
    serviceStyle: 'home',
    applicableRoles: ['walker'],
    basePrice: 0,
    isPackage: true,
    packageDetails: {
      sessionsPerDay: 2,
      sessionDuration: 30,
      packageDuration: 14,
      totalSessions: 28,
      pricingBySize: {
        small: 4900,
        medium: 6125,
        large: 7350,
        extraLarge: 8575
      }
    },
    description: '30-minute walks - 2 sessions per day for 14 days'
  },
  {
    categoryId: 'walking',
    categoryName: 'Dog Walking',
    subCategoryId: 'premium_walk',
    subCategoryName: 'Premium Walks',
    serviceName: 'Premium Walk - 2 Walks/Day - 30 Day Package',
    serviceStyle: 'home',
    applicableRoles: ['walker'],
    basePrice: 0,
    isPackage: true,
    packageDetails: {
      sessionsPerDay: 2,
      sessionDuration: 30,
      packageDuration: 30,
      totalSessions: 60,
      pricingBySize: {
        small: 10200,
        medium: 12750,
        large: 15300,
        extraLarge: 17850
      }
    },
    description: '30-minute walks - 2 sessions per day for 30 days'
  },
  {
    categoryId: 'walking',
    categoryName: 'Dog Walking',
    subCategoryId: 'extended_walk',
    subCategoryName: 'Extended Walks',
    serviceName: 'Extended Walk - 1 Walk/Day - 7 Day Package',
    serviceStyle: 'home',
    applicableRoles: ['walker'],
    basePrice: 0,
    isPackage: true,
    packageDetails: {
      sessionsPerDay: 1,
      sessionDuration: 60,
      packageDuration: 7,
      totalSessions: 7,
      pricingBySize: {
        small: 2100,
        medium: 2625,
        large: 3150,
        extraLarge: 3675
      }
    },
    description: '60-minute extended walk - 1 session per day for 7 days'
  },
  {
    categoryId: 'walking',
    categoryName: 'Dog Walking',
    subCategoryId: 'exercise',
    subCategoryName: 'Exercise Sessions',
    serviceName: 'Exercise & Play - 7 Day Package',
    serviceStyle: 'home',
    applicableRoles: ['walker'],
    basePrice: 0,
    isPackage: true,
    packageDetails: {
      sessionsPerDay: 1,
      sessionDuration: 45,
      packageDuration: 7,
      totalSessions: 7,
      pricingBySize: {
        small: 1750,
        medium: 2188,
        large: 2625,
        extraLarge: 3063
      }
    },
    description: '45-minute exercise and playtime session for 7 days'
  },
  {
    categoryId: 'walking',
    categoryName: 'Dog Walking',
    subCategoryId: 'potty',
    subCategoryName: 'Potty Breaks',
    serviceName: 'Potty Break - 15 Min - 7 Day Package',
    serviceStyle: 'home',
    applicableRoles: ['walker'],
    basePrice: 0,
    isPackage: true,
    packageDetails: {
      sessionsPerDay: 1,
      sessionDuration: 15,
      packageDuration: 7,
      totalSessions: 7,
      pricingBySize: {
        small: 700,
        medium: 875,
        large: 1050,
        extraLarge: 1225
      }
    },
    description: 'Quick 15-minute potty break - 1 per day for 7 days'
  },
  {
    categoryId: 'walking',
    categoryName: 'Dog Walking',
    subCategoryId: 'onetime',
    subCategoryName: 'One-Time Walk',
    serviceName: 'One-Time Walk - 30 Minutes',
    serviceStyle: 'home',
    applicableRoles: ['walker'],
    basePrice: 250,
    isPackage: false,
    duration: 30,
    description: 'Single 30-minute walk service - no package'
  },
  {
    categoryId: 'walking',
    categoryName: 'Dog Walking',
    subCategoryId: 'onetime',
    subCategoryName: 'One-Time Walk',
    serviceName: 'One-Time Walk - 45 Minutes',
    serviceStyle: 'home',
    applicableRoles: ['walker'],
    basePrice: 350,
    isPackage: false,
    duration: 45,
    description: 'Single 45-minute walk service - no package'
  },
  {
    categoryId: 'walking',
    categoryName: 'Dog Walking',
    subCategoryId: 'onetime',
    subCategoryName: 'One-Time Walk',
    serviceName: 'One-Time Walk - 60 Minutes',
    serviceStyle: 'home',
    applicableRoles: ['walker'],
    basePrice: 450,
    isPackage: false,
    duration: 60,
    description: 'Single 60-minute walk service - no package'
  },

  // ==================== SITTER HOME SERVICES ====================
  {
    categoryId: 'sitting',
    categoryName: 'Pet Sitting',
    subCategoryId: 'daily',
    subCategoryName: 'Daily Sitting',
    serviceName: 'Daily Pet Sitting - 4 Hours',
    serviceStyle: 'home',
    applicableRoles: ['sitter'],
    basePrice: 800,
    isPackage: false,
    duration: 240,
    description: '4-hour daily pet sitting at your home'
  },
  {
    categoryId: 'sitting',
    categoryName: 'Pet Sitting',
    subCategoryId: 'daily',
    subCategoryName: 'Daily Sitting',
    serviceName: 'Daily Pet Sitting - 8 Hours',
    serviceStyle: 'home',
    applicableRoles: ['sitter'],
    basePrice: 1400,
    isPackage: false,
    duration: 480,
    description: 'Full-day 8-hour pet sitting service'
  },
  {
    categoryId: 'sitting',
    categoryName: 'Pet Sitting',
    subCategoryId: 'overnight',
    subCategoryName: 'Overnight Care',
    serviceName: 'Overnight Pet Sitting',
    serviceStyle: 'home',
    applicableRoles: ['sitter'],
    basePrice: 2000,
    isPackage: false,
    duration: 720,
    description: 'Overnight pet sitting (12 hours) at your home'
  },
  {
    categoryId: 'sitting',
    categoryName: 'Pet Sitting',
    subCategoryId: 'overnight',
    subCategoryName: 'Overnight Care',
    serviceName: '24-Hour Pet Sitting',
    serviceStyle: 'home',
    applicableRoles: ['sitter'],
    basePrice: 3500,
    isPackage: false,
    duration: 1440,
    description: 'Full 24-hour continuous pet care'
  },
  {
    categoryId: 'sitting',
    categoryName: 'Pet Sitting',
    subCategoryId: 'weekend',
    subCategoryName: 'Weekend Care',
    serviceName: 'Weekend Care Package',
    serviceStyle: 'home',
    applicableRoles: ['sitter'],
    basePrice: 6000,
    isPackage: false,
    duration: 2880,
    description: '48-hour weekend pet care (Saturday-Sunday)'
  },
  {
    categoryId: 'sitting',
    categoryName: 'Pet Sitting',
    subCategoryId: 'holiday',
    subCategoryName: 'Holiday Care',
    serviceName: 'Holiday Care Package - 7 Days',
    serviceStyle: 'home',
    applicableRoles: ['sitter'],
    basePrice: 18000,
    isPackage: false,
    duration: 10080,
    description: 'Complete care while you\'re on vacation - 7 days'
  },
  {
    categoryId: 'sitting',
    categoryName: 'Pet Sitting',
    subCategoryId: 'medication',
    subCategoryName: 'Medical Care',
    serviceName: 'Medication Administration Visit',
    serviceStyle: 'home',
    applicableRoles: ['sitter'],
    basePrice: 300,
    isPackage: false,
    duration: 30,
    description: 'Scheduled visit for medication administration'
  },
  {
    categoryId: 'sitting',
    categoryName: 'Pet Sitting',
    subCategoryId: 'multi_pet',
    subCategoryName: 'Multi-Pet Care',
    serviceName: 'Multi-Pet Daily Care (2-3 Pets)',
    serviceStyle: 'home',
    applicableRoles: ['sitter'],
    basePrice: 2000,
    isPackage: false,
    duration: 480,
    description: 'Daily care for 2-3 pets at your home'
  },

  // ==================== PET HOTEL TELE SERVICES ====================
  {
    categoryId: 'boarding',
    categoryName: 'Boarding',
    subCategoryId: 'consultation',
    subCategoryName: 'Consultation',
    serviceName: 'Virtual Facility Tour',
    serviceStyle: 'tele',
    applicableRoles: ['pet_hotel', 'boarding'],
    basePrice: 200,
    isPackage: false,
    duration: 20,
    description: 'Live virtual tour of boarding facilities'
  },
  {
    categoryId: 'boarding',
    categoryName: 'Boarding',
    subCategoryId: 'consultation',
    subCategoryName: 'Consultation',
    serviceName: 'Booking Consultation',
    serviceStyle: 'tele',
    applicableRoles: ['pet_hotel', 'boarding'],
    basePrice: 150,
    isPackage: false,
    duration: 15,
    description: 'Discuss your pet\'s needs and boarding options'
  },
  {
    categoryId: 'boarding',
    categoryName: 'Boarding',
    subCategoryId: 'assessment',
    subCategoryName: 'Assessment',
    serviceName: 'Pre-Boarding Assessment',
    serviceStyle: 'tele',
    applicableRoles: ['pet_hotel', 'boarding'],
    basePrice: 300,
    isPackage: false,
    duration: 25,
    description: 'Virtual assessment of pet\'s temperament and needs'
  }
];

/**
 * Get services for a specific role and service style
 */
export function getServicesForRole(roleId: string, serviceStyle?: 'home' | 'tele'): ServiceCatalogItem[] {
  return SERVICE_CATALOG.filter(service => {
    const roleMatch = service.applicableRoles.includes(roleId);
    const styleMatch = !serviceStyle || service.serviceStyle === serviceStyle;
    return roleMatch && styleMatch;
  });
}

/**
 * Get service categories for a role
 */
export function getCategoriesForRole(roleId: string): Array<{ categoryId: string; categoryName: string }> {
  const services = getServicesForRole(roleId);
  const uniqueCategories = new Map<string, string>();
  
  services.forEach(service => {
    if (!uniqueCategories.has(service.categoryId)) {
      uniqueCategories.set(service.categoryId, service.categoryName);
    }
  });
  
  return Array.from(uniqueCategories.entries()).map(([categoryId, categoryName]) => ({
    categoryId,
    categoryName
  }));
}

/**
 * Get sub-categories for a category and role
 */
export function getSubCategoriesForCategory(categoryId: string, roleId: string): Array<{ subCategoryId: string; subCategoryName: string }> {
  const services = getServicesForRole(roleId).filter(s => s.categoryId === categoryId);
  const uniqueSubCategories = new Map<string, string>();
  
  services.forEach(service => {
    if (service.subCategoryId && service.subCategoryName && !uniqueSubCategories.has(service.subCategoryId)) {
      uniqueSubCategories.set(service.subCategoryId, service.subCategoryName);
    }
  });
  
  return Array.from(uniqueSubCategories.entries()).map(([subCategoryId, subCategoryName]) => ({
    subCategoryId,
    subCategoryName
  }));
}
