/**
 * 🇮🇳 EXPANDED INDIA MARKET SERVICE CATALOG - 210+ SERVICES
 * 
 * TRUE 200+ services with comprehensive market coverage
 * Includes base catalog (130) + 80 additional services
 * 
 * IMPORTANT: All veterinary services are automatically assigned to BOTH:
 * - veterinarian (individual practice)
 * - pet_clinic (multi-vet practice)
 */

import { INDIA_COMPREHENSIVE_CATALOG, ServiceCatalogItem } from './service-catalog-india-comprehensive.tsx';

/**
 * Ensures veterinarian and pet_clinic always have identical services
 * If a service has either role, it gets both
 */
function normalizeVetRoles(services: ServiceCatalogItem[]): ServiceCatalogItem[] {
  return services.map(service => {
    const hasVeterinarian = service.applicableRoles.includes('veterinarian');
    const hasPetClinic = service.applicableRoles.includes('pet_clinic');
    
    // If service has either vet role, give it both
    if (hasVeterinarian || hasPetClinic) {
      const otherRoles = service.applicableRoles.filter(
        role => role !== 'veterinarian' && role !== 'pet_clinic'
      );
      return {
        ...service,
        applicableRoles: ['veterinarian', 'pet_clinic', ...otherRoles]
      };
    }
    
    return service;
  });
}

// Additional 80+ services to reach 210+ total
const ADDITIONAL_SERVICES: ServiceCatalogItem[] = [
  
  // ========================================================================
  // ADDITIONAL VETERINARY SERVICES (30 services)
  // ========================================================================
  
  // Cat-Specific Vaccinations At Home
  {
    categoryId: 'veterinary',
    categoryName: 'Veterinary',
    subCategoryId: 'vaccination',
    subCategoryName: 'Vaccination',
    serviceName: 'Cat Vaccination - Feline Distemper (FVRCP) at Home',
    serviceStyle: 'at_home',
    applicableRoles: ['veterinarian', 'pet_clinic'],
    basePrice: 600,
    isPackage: false,
    duration: 20,
    description: 'Feline viral rhinotracheitis, calicivirus, panleukopenia vaccination'
  },
  {
    categoryId: 'veterinary',
    categoryName: 'Veterinary',
    subCategoryId: 'vaccination',
    subCategoryName: 'Vaccination',
    serviceName: 'Cat Vaccination - FeLV at Home',
    serviceStyle: 'at_home',
    applicableRoles: ['veterinarian', 'pet_clinic'],
    basePrice: 700,
    isPackage: false,
    duration: 20,
    description: 'Feline leukemia virus vaccination'
  },
  {
    categoryId: 'veterinary',
    categoryName: 'Veterinary',
    subCategoryId: 'vaccination',
    subCategoryName: 'Vaccination',
    serviceName: 'Kitten Vaccination Package - Full Course at Home',
    serviceStyle: 'at_home',
    applicableRoles: ['veterinarian', 'pet_clinic'],
    basePrice: 3200,
    isPackage: false,
    duration: 120,
    description: 'Complete kitten vaccination series (3 doses + rabies)'
  },
  
  // IV Fluid Therapy
  {
    categoryId: 'veterinary',
    categoryName: 'Veterinary',
    subCategoryId: 'postcare',
    subCategoryName: 'Post-Operative Care',
    serviceName: 'IV Fluid Therapy at Home',
    serviceStyle: 'at_home',
    applicableRoles: ['veterinarian', 'pet_clinic'],
    basePrice: 1200,
    isPackage: false,
    duration: 60,
    description: 'Intravenous fluid administration for dehydration'
  },
  {
    categoryId: 'veterinary',
    categoryName: 'Veterinary',
    subCategoryId: 'postcare',
    subCategoryName: 'Post-Operative Care',
    serviceName: 'Subcutaneous Fluid Therapy at Home',
    serviceStyle: 'at_home',
    applicableRoles: ['veterinarian', 'pet_clinic'],
    basePrice: 800,
    isPackage: false,
    duration: 30,
    description: 'Subcutaneous fluid administration'
  },
  
  // Specialized Clinic Services
  {
    categoryId: 'veterinary',
    categoryName: 'Veterinary',
    subCategoryId: 'surgery',
    subCategoryName: 'Surgery',
    serviceName: 'Cat Spay Surgery',
    serviceStyle: 'at_center',
    applicableRoles: ['pet_clinic'],
    basePrice: 4500,
    isPackage: false,
    duration: 90,
    description: 'Ovariohysterectomy for female cats'
  },
  {
    categoryId: 'veterinary',
    categoryName: 'Veterinary',
    subCategoryId: 'surgery',
    subCategoryName: 'Surgery',
    serviceName: 'Cat Neuter Surgery',
    serviceStyle: 'at_center',
    applicableRoles: ['pet_clinic'],
    basePrice: 3500,
    isPackage: false,
    duration: 60,
    description: 'Castration for male cats'
  },
  {
    categoryId: 'veterinary',
    categoryName: 'Veterinary',
    subCategoryId: 'surgery',
    subCategoryName: 'Surgery',
    serviceName: 'Ear Hematoma Surgery',
    serviceStyle: 'at_center',
    applicableRoles: ['pet_clinic'],
    basePrice: 6000,
    isPackage: false,
    duration: 90,
    description: 'Surgical drainage and repair of ear hematoma'
  },
  {
    categoryId: 'veterinary',
    categoryName: 'Veterinary',
    subCategoryId: 'surgery',
    subCategoryName: 'Surgery',
    serviceName: 'Cystotomy - Bladder Surgery',
    serviceStyle: 'at_center',
    applicableRoles: ['pet_clinic'],
    basePrice: 18000,
    isPackage: false,
    duration: 240,
    description: 'Bladder surgery for stone removal or mass'
  },
  {
    categoryId: 'veterinary',
    categoryName: 'Veterinary',
    subCategoryId: 'surgery',
    subCategoryName: 'Surgery',
    serviceName: 'Gastropexy - Bloat Prevention',
    serviceStyle: 'at_center',
    applicableRoles: ['pet_clinic'],
    basePrice: 16000,
    isPackage: false,
    duration: 180,
    description: 'Preventive stomach tacking surgery for large breeds'
  },
  {
    categoryId: 'veterinary',
    categoryName: 'Veterinary',
    subCategoryId: 'surgery',
    subCategoryName: 'Surgery',
    serviceName: 'Amputation - Limb',
    serviceStyle: 'at_center',
    applicableRoles: ['pet_clinic'],
    basePrice: 20000,
    isPackage: false,
    duration: 240,
    description: 'Limb amputation surgery'
  },
  {
    categoryId: 'veterinary',
    categoryName: 'Veterinary',
    subCategoryId: 'surgery',
    subCategoryName: 'Surgery',
    serviceName: 'Cruciate Ligament Surgery (CCL/ACL)',
    serviceStyle: 'at_center',
    applicableRoles: ['pet_clinic'],
    basePrice: 35000,
    isPackage: false,
    duration: 300,
    description: 'Cranial cruciate ligament repair surgery'
  },
  {
    categoryId: 'veterinary',
    categoryName: 'Veterinary',
    subCategoryId: 'surgery',
    subCategoryName: 'Surgery',
    serviceName: 'Luxating Patella Surgery',
    serviceStyle: 'at_center',
    applicableRoles: ['pet_clinic'],
    basePrice: 28000,
    isPackage: false,
    duration: 240,
    description: 'Kneecap stabilization surgery'
  },
  
  // Additional Lab Tests
  {
    categoryId: 'veterinary',
    categoryName: 'Veterinary',
    subCategoryId: 'laboratory',
    subCategoryName: 'Laboratory Services',
    serviceName: 'FeLV/FIV Test - Cat',
    serviceStyle: 'at_center',
    applicableRoles: ['pet_clinic'],
    basePrice: 1200,
    isPackage: false,
    duration: 20,
    description: 'Feline leukemia and immunodeficiency virus test'
  },
  {
    categoryId: 'veterinary',
    categoryName: 'Veterinary',
    subCategoryId: 'laboratory',
    subCategoryName: 'Laboratory Services',
    serviceName: 'Giardia Test',
    serviceStyle: 'at_center',
    applicableRoles: ['pet_clinic'],
    basePrice: 600,
    isPackage: false,
    duration: 15,
    description: 'Fecal test for giardia parasite'
  },
  {
    categoryId: 'veterinary',
    categoryName: 'Veterinary',
    subCategoryId: 'laboratory',
    subCategoryName: 'Laboratory Services',
    serviceName: 'Tick-Borne Disease Panel',
    serviceStyle: 'at_center',
    applicableRoles: ['pet_clinic'],
    basePrice: 2000,
    isPackage: false,
    duration: 20,
    description: 'Ehrlichia, anaplasmosis, lyme disease testing'
  },
  {
    categoryId: 'veterinary',
    categoryName: 'Veterinary',
    subCategoryId: 'laboratory',
    subCategoryName: 'Laboratory Services',
    serviceName: 'Allergy Testing Panel',
    serviceStyle: 'at_center',
    applicableRoles: ['pet_clinic'],
    basePrice: 5000,
    isPackage: false,
    duration: 30,
    description: 'Comprehensive allergy blood test'
  },
  {
    categoryId: 'veterinary',
    categoryName: 'Veterinary',
    subCategoryId: 'laboratory',
    subCategoryName: 'Laboratory Services',
    serviceName: 'Progesterone Test - Breeding',
    serviceStyle: 'at_center',
    applicableRoles: ['pet_clinic'],
    basePrice: 1500,
    isPackage: false,
    duration: 20,
    description: 'Progesterone level testing for breeding timing'
  },
  {
    categoryId: 'veterinary',
    categoryName: 'Veterinary',
    subCategoryId: 'laboratory',
    subCategoryName: 'Laboratory Services',
    serviceName: 'Cytology - Fine Needle Aspirate',
    serviceStyle: 'at_center',
    applicableRoles: ['pet_clinic'],
    basePrice: 1200,
    isPackage: false,
    duration: 30,
    description: 'Microscopic examination of cells from masses/lumps'
  },
  {
    categoryId: 'veterinary',
    categoryName: 'Veterinary',
    subCategoryId: 'laboratory',
    subCategoryName: 'Laboratory Services',
    serviceName: 'Biopsy & Histopathology',
    serviceStyle: 'at_center',
    applicableRoles: ['pet_clinic'],
    basePrice: 4000,
    isPackage: false,
    duration: 30,
    description: 'Tissue biopsy and microscopic examination'
  },
  
  // Wellness & Preventive
  {
    categoryId: 'veterinary',
    categoryName: 'Veterinary',
    subCategoryId: 'preventive',
    subCategoryName: 'Preventive Care',
    serviceName: 'Microchipping Service',
    serviceStyle: 'at_center',
    applicableRoles: ['veterinarian', 'pet_clinic'],
    basePrice: 1500,
    isPackage: false,
    duration: 15,
    description: 'Permanent identification microchip implantation'
  },
  {
    categoryId: 'veterinary',
    categoryName: 'Veterinary',
    subCategoryId: 'preventive',
    subCategoryName: 'Preventive Care',
    serviceName: 'Puppy Wellness Package - First Year',
    serviceStyle: 'at_center',
    applicableRoles: ['pet_clinic'],
    basePrice: 8000,
    isPackage: false,
    duration: 180,
    description: 'Comprehensive first year puppy care: vaccines, exams, dewormings'
  },
  {
    categoryId: 'veterinary',
    categoryName: 'Veterinary',
    subCategoryId: 'preventive',
    subCategoryName: 'Preventive Care',
    serviceName: 'Kitten Wellness Package - First Year',
    serviceStyle: 'at_center',
    applicableRoles: ['pet_clinic'],
    basePrice: 7500,
    isPackage: false,
    duration: 180,
    description: 'Comprehensive first year kitten care: vaccines, exams, dewormings'
  },
  {
    categoryId: 'veterinary',
    categoryName: 'Veterinary',
    subCategoryId: 'preventive',
    subCategoryName: 'Preventive Care',
    serviceName: 'Geriatric Pet Screening',
    serviceStyle: 'at_center',
    applicableRoles: ['pet_clinic'],
    basePrice: 4500,
    isPackage: false,
    duration: 90,
    description: 'Senior pet comprehensive health screening (7+ years)'
  },
  
  // Specialized Tele Consultations
  {
    categoryId: 'veterinary',
    categoryName: 'Veterinary',
    subCategoryId: 'teleconsult',
    subCategoryName: 'Tele Consultation',
    serviceName: 'Dermatology Tele Consultation',
    serviceStyle: 'tele',
    applicableRoles: ['veterinarian', 'pet_clinic'],
    basePrice: 600,
    isPackage: false,
    duration: 25,
    description: 'Skin and allergy virtual consultation'
  },
  {
    categoryId: 'veterinary',
    categoryName: 'Veterinary',
    subCategoryId: 'teleconsult',
    subCategoryName: 'Tele Consultation',
    serviceName: 'Cardiology Tele Consultation',
    serviceStyle: 'tele',
    applicableRoles: ['pet_clinic'],
    basePrice: 800,
    isPackage: false,
    duration: 30,
    description: 'Heart condition virtual consultation'
  },
  {
    categoryId: 'veterinary',
    categoryName: 'Veterinary',
    subCategoryId: 'teleconsult',
    subCategoryName: 'Tele Consultation',
    serviceName: 'End-of-Life Care Consultation',
    serviceStyle: 'tele',
    applicableRoles: ['veterinarian', 'pet_clinic'],
    basePrice: 700,
    isPackage: false,
    duration: 30,
    description: 'Palliative and hospice care guidance'
  },
  {
    categoryId: 'veterinary',
    categoryName: 'Veterinary',
    subCategoryId: 'teleconsult',
    subCategoryName: 'Tele Consultation',
    serviceName: 'New Pet Parent Consultation',
    serviceStyle: 'tele',
    applicableRoles: ['veterinarian', 'pet_clinic'],
    basePrice: 400,
    isPackage: false,
    duration: 25,
    description: 'First-time pet owner guidance and tips'
  },
  {
    categoryId: 'veterinary',
    categoryName: 'Veterinary',
    subCategoryId: 'teleconsult',
    subCategoryName: 'Tele Consultation',
    serviceName: 'Pre-Adoption Consultation',
    serviceStyle: 'tele',
    applicableRoles: ['veterinarian', 'pet_clinic'],
    basePrice: 350,
    isPackage: false,
    duration: 20,
    description: 'Guidance before adopting a new pet'
  },
  
  // ========================================================================
  // ADDITIONAL GROOMING SERVICES (20 services)
  // ========================================================================
  
  {
    categoryId: 'grooming',
    categoryName: 'Grooming',
    subCategoryId: 'bath',
    subCategoryName: 'Bathing Services',
    serviceName: 'Oatmeal Soothing Bath at Home',
    serviceStyle: 'at_home',
    applicableRoles: ['pet_groomer'],
    basePrice: 850,
    isPackage: false,
    duration: 60,
    description: 'Gentle oatmeal bath for sensitive skin'
  },
  {
    categoryId: 'grooming',
    categoryName: 'Grooming',
    subCategoryId: 'bath',
    subCategoryName: 'Bathing Services',
    serviceName: 'Coconut Oil Treatment Bath at Home',
    serviceStyle: 'at_home',
    applicableRoles: ['pet_groomer'],
    basePrice: 950,
    isPackage: false,
    duration: 70,
    description: 'Moisturizing coconut oil bath and massage'
  },
  {
    categoryId: 'grooming',
    categoryName: 'Grooming',
    subCategoryId: 'haircut',
    subCategoryName: 'Haircut & Styling',
    serviceName: 'Summer Cut - Full Body Clip at Home',
    serviceStyle: 'at_home',
    applicableRoles: ['pet_groomer'],
    basePrice: 1000,
    isPackage: false,
    duration: 75,
    description: 'Short summer haircut for hot weather comfort'
  },
  {
    categoryId: 'grooming',
    categoryName: 'Grooming',
    subCategoryId: 'haircut',
    subCategoryName: 'Haircut & Styling',
    serviceName: 'Face & Feet Trim at Home',
    serviceStyle: 'at_home',
    applicableRoles: ['pet_groomer'],
    basePrice: 500,
    isPackage: false,
    duration: 30,
    description: 'Tidy face and paw hair trimming'
  },
  {
    categoryId: 'grooming',
    categoryName: 'Grooming',
    subCategoryId: 'nail',
    subCategoryName: 'Nail Care',
    serviceName: 'Nail Painting Service at Home',
    serviceStyle: 'at_home',
    applicableRoles: ['pet_groomer'],
    basePrice: 400,
    isPackage: false,
    duration: 25,
    description: 'Pet-safe nail polish application'
  },
  {
    categoryId: 'grooming',
    categoryName: 'Grooming',
    subCategoryId: 'deshed',
    subCategoryName: 'De-shedding',
    serviceName: 'FURminator Treatment at Home',
    serviceStyle: 'at_home',
    applicableRoles: ['pet_groomer'],
    basePrice: 900,
    isPackage: false,
    duration: 60,
    description: 'Professional de-shedding with FURminator tool'
  },
  {
    categoryId: 'grooming',
    categoryName: 'Grooming',
    subCategoryId: 'package',
    subCategoryName: 'Package Services',
    serviceName: 'Cat Grooming Package at Home',
    serviceStyle: 'at_home',
    applicableRoles: ['pet_groomer'],
    basePrice: 1500,
    isPackage: false,
    duration: 90,
    description: 'Complete cat grooming: bath, brush, nails, ears'
  },
  {
    categoryId: 'grooming',
    categoryName: 'Grooming',
    subCategoryId: 'bath',
    subCategoryName: 'Bathing Services',
    serviceName: 'Show Dog Preparation Bath at Salon',
    serviceStyle: 'at_center',
    applicableRoles: ['pet_groomer'],
    basePrice: 3000,
    isPackage: false,
    duration: 180,
    description: 'Professional show preparation grooming'
  },
  {
    categoryId: 'grooming',
    categoryName: 'Grooming',
    subCategoryId: 'bath',
    subCategoryName: 'Bathing Services',
    serviceName: 'Blueberry Facial Treatment at Salon',
    serviceStyle: 'at_center',
    applicableRoles: ['pet_groomer'],
    basePrice: 600,
    isPackage: false,
    duration: 20,
    description: 'Brightening blueberry facial for white fur'
  },
  {
    categoryId: 'grooming',
    categoryName: 'Grooming',
    subCategoryId: 'haircut',
    subCategoryName: 'Haircut & Styling',
    serviceName: 'Creative Grooming & Coloring at Salon',
    serviceStyle: 'at_center',
    applicableRoles: ['pet_groomer'],
    basePrice: 3500,
    isPackage: false,
    duration: 180,
    description: 'Creative styling with pet-safe temporary colors'
  },
  {
    categoryId: 'grooming',
    categoryName: 'Grooming',
    subCategoryId: 'haircut',
    subCategoryName: 'Haircut & Styling',
    serviceName: 'Hand Stripping Service at Salon',
    serviceStyle: 'at_center',
    applicableRoles: ['pet_groomer'],
    basePrice: 2500,
    isPackage: false,
    duration: 150,
    description: 'Hand stripping for wire-coated breeds'
  },
  {
    categoryId: 'grooming',
    categoryName: 'Grooming',
    subCategoryId: 'haircut',
    subCategoryName: 'Haircut & Styling',
    serviceName: 'Lion Cut for Cats at Salon',
    serviceStyle: 'at_center',
    applicableRoles: ['pet_groomer'],
    basePrice: 1800,
    isPackage: false,
    duration: 90,
    description: 'Professional lion cut styling for long-haired cats'
  },
  {
    categoryId: 'grooming',
    categoryName: 'Grooming',
    subCategoryId: 'dental',
    subCategoryName: 'Dental Care',
    serviceName: 'Breath Freshening Treatment at Salon',
    serviceStyle: 'at_center',
    applicableRoles: ['pet_groomer'],
    basePrice: 500,
    isPackage: false,
    duration: 15,
    description: 'Dental spray and breath freshening'
  },
  {
    categoryId: 'grooming',
    categoryName: 'Grooming',
    subCategoryId: 'package',
    subCategoryName: 'Package Services',
    serviceName: 'Puppy Introduction Package at Salon',
    serviceStyle: 'at_center',
    applicableRoles: ['pet_groomer'],
    basePrice: 1200,
    isPackage: false,
    duration: 90,
    description: 'Gentle first grooming experience for puppies'
  },
  {
    categoryId: 'grooming',
    categoryName: 'Grooming',
    subCategoryId: 'package',
    subCategoryName: 'Package Services',
    serviceName: 'Senior Pet Gentle Grooming at Salon',
    serviceStyle: 'at_center',
    applicableRoles: ['pet_groomer'],
    basePrice: 1400,
    isPackage: false,
    duration: 90,
    description: 'Gentle grooming for senior/anxious pets'
  },
  {
    categoryId: 'grooming',
    categoryName: 'Grooming',
    subCategoryId: 'package',
    subCategoryName: 'Package Services',
    serviceName: 'Wedding/Event Grooming at Salon',
    serviceStyle: 'at_center',
    applicableRoles: ['pet_groomer'],
    basePrice: 2800,
    isPackage: false,
    duration: 150,
    description: 'Premium grooming for special occasions'
  },
  {
    categoryId: 'grooming',
    categoryName: 'Grooming',
    subCategoryId: 'package',
    subCategoryName: 'Package Services',
    serviceName: 'Matting Removal & Dematting at Salon',
    serviceStyle: 'at_center',
    applicableRoles: ['pet_groomer'],
    basePrice: 2000,
    isPackage: false,
    duration: 120,
    description: 'Professional matting and tangle removal'
  },
  {
    categoryId: 'grooming',
    categoryName: 'Grooming',
    subCategoryId: 'package',
    subCategoryName: 'Package Services',
    serviceName: 'Skunk Odor Removal Treatment at Salon',
    serviceStyle: 'at_center',
    applicableRoles: ['pet_groomer'],
    basePrice: 1800,
    isPackage: false,
    duration: 90,
    description: 'Specialized treatment for skunk encounters'
  },
  {
    categoryId: 'grooming',
    categoryName: 'Grooming',
    subCategoryId: 'teleconsult',
    subCategoryName: 'Consultation',
    serviceName: 'Breed-Specific Grooming Advice',
    serviceStyle: 'tele',
    applicableRoles: ['pet_groomer'],
    basePrice: 200,
    isPackage: false,
    duration: 20,
    description: 'Virtual consultation for breed-specific grooming needs'
  },
  {
    categoryId: 'grooming',
    categoryName: 'Grooming',
    subCategoryId: 'teleconsult',
    subCategoryName: 'Consultation',
    serviceName: 'Product Recommendation Consultation',
    serviceStyle: 'tele',
    applicableRoles: ['pet_groomer'],
    basePrice: 150,
    isPackage: false,
    duration: 15,
    description: 'Grooming product recommendations for home care'
  },
  
  // ========================================================================
  // ADDITIONAL TRAINING SERVICES (15 services)
  // ========================================================================
  
  {
    categoryId: 'training',
    categoryName: 'Training',
    subCategoryId: 'obedience',
    subCategoryName: 'Obedience Training',
    serviceName: 'CGC Preparation - 30 Day Package',
    serviceStyle: 'at_home',
    applicableRoles: ['pet_trainer'],
    basePrice: 0,
    isPackage: true,
    packageDetails: {
      sessionsPerDay: 1,
      sessionDuration: 60,
      packageDuration: 30,
      totalSessions: 30,
      pricingBySize: { small: 15000, medium: 17000, large: 19000, extraLarge: 21000 }
    },
    description: 'Canine Good Citizen certification preparation'
  },
  {
    categoryId: 'training',
    categoryName: 'Training',
    subCategoryId: 'behavioral',
    subCategoryName: 'Behavioral Training',
    serviceName: 'Separation Anxiety - 21 Day Package',
    serviceStyle: 'at_home',
    applicableRoles: ['pet_trainer'],
    basePrice: 0,
    isPackage: true,
    packageDetails: {
      sessionsPerDay: 1,
      sessionDuration: 45,
      packageDuration: 21,
      totalSessions: 21,
      pricingBySize: { small: 10500, medium: 12000, large: 13500, extraLarge: 15000 }
    },
    description: 'Behavior modification for separation anxiety'
  },
  {
    categoryId: 'training',
    categoryName: 'Training',
    subCategoryId: 'behavioral',
    subCategoryName: 'Behavioral Training',
    serviceName: 'Reactivity Training - 21 Day Package',
    serviceStyle: 'at_home',
    applicableRoles: ['pet_trainer'],
    basePrice: 0,
    isPackage: true,
    packageDetails: {
      sessionsPerDay: 1,
      sessionDuration: 60,
      packageDuration: 21,
      totalSessions: 21,
      pricingBySize: { small: 11000, medium: 13000, large: 15000, extraLarge: 17000 }
    },
    description: 'Training for reactive dogs (leash/barrier reactivity)'
  },
  {
    categoryId: 'training',
    categoryName: 'Training',
    subCategoryId: 'behavioral',
    subCategoryName: 'Behavioral Training',
    serviceName: 'Resource Guarding - 14 Day Package',
    serviceStyle: 'at_home',
    applicableRoles: ['pet_trainer'],
    basePrice: 0,
    isPackage: true,
    packageDetails: {
      sessionsPerDay: 1,
      sessionDuration: 45,
      packageDuration: 14,
      totalSessions: 14,
      pricingBySize: { small: 8000, medium: 9000, large: 10000, extraLarge: 11000 }
    },
    description: 'Addressing food/toy guarding behavior'
  },
  {
    categoryId: 'training',
    categoryName: 'Training',
    subCategoryId: 'puppy',
    subCategoryName: 'Puppy Training',
    serviceName: 'Puppy Socialization - 14 Day Package',
    serviceStyle: 'at_home',
    applicableRoles: ['pet_trainer'],
    basePrice: 0,
    isPackage: true,
    packageDetails: {
      sessionsPerDay: 1,
      sessionDuration: 45,
      packageDuration: 14,
      totalSessions: 14,
      pricingBySize: { small: 5600, medium: 6300, large: 7000, extraLarge: 7700 }
    },
    description: 'Critical period socialization for puppies'
  },
  {
    categoryId: 'training',
    categoryName: 'Training',
    subCategoryId: 'specialized',
    subCategoryName: 'Specialized Training',
    serviceName: 'Service Dog Foundation - 60 Day Package',
    serviceStyle: 'at_home',
    applicableRoles: ['pet_trainer'],
    basePrice: 0,
    isPackage: true,
    packageDetails: {
      sessionsPerDay: 1,
      sessionDuration: 90,
      packageDuration: 60,
      totalSessions: 60,
      pricingBySize: { small: 36000, medium: 40000, large: 44000, extraLarge: 48000 }
    },
    description: 'Foundation training for service dog candidates'
  },
  {
    categoryId: 'training',
    categoryName: 'Training',
    subCategoryId: 'specialized',
    subCategoryName: 'Specialized Training',
    serviceName: 'Therapy Dog Preparation - 30 Day Package',
    serviceStyle: 'at_home',
    applicableRoles: ['pet_trainer'],
    basePrice: 0,
    isPackage: true,
    packageDetails: {
      sessionsPerDay: 1,
      sessionDuration: 60,
      packageDuration: 30,
      totalSessions: 30,
      pricingBySize: { small: 18000, medium: 20000, large: 22000, extraLarge: 24000 }
    },
    description: 'Preparation for therapy dog certification'
  },
  {
    categoryId: 'training',
    categoryName: 'Training',
    subCategoryId: 'specialized',
    subCategoryName: 'Specialized Training',
    serviceName: 'Trick Training - 7 Day Package',
    serviceStyle: 'at_home',
    applicableRoles: ['pet_trainer'],
    basePrice: 0,
    isPackage: true,
    packageDetails: {
      sessionsPerDay: 1,
      sessionDuration: 30,
      packageDuration: 7,
      totalSessions: 7,
      pricingBySize: { small: 3500, medium: 4000, large: 4500, extraLarge: 5000 }
    },
    description: 'Fun trick training: shake, spin, play dead, etc.'
  },
  {
    categoryId: 'training',
    categoryName: 'Training',
    subCategoryId: 'agility',
    subCategoryName: 'Agility Training',
    serviceName: 'Competition Agility - 30 Day at Center',
    serviceStyle: 'at_center',
    applicableRoles: ['pet_trainer'],
    basePrice: 24000,
    isPackage: false,
    duration: 2700,
    description: 'Advanced agility for competition preparation'
  },
  {
    categoryId: 'training',
    categoryName: 'Training',
    subCategoryId: 'specialized',
    subCategoryName: 'Specialized Training',
    serviceName: 'Scent Detection Basics - 14 Days at Center',
    serviceStyle: 'at_center',
    applicableRoles: ['pet_trainer'],
    basePrice: 15000,
    isPackage: false,
    duration: 1260,
    description: 'Introduction to scent work and detection'
  },
  {
    categoryId: 'training',
    categoryName: 'Training',
    subCategoryId: 'group',
    subCategoryName: 'Group Classes',
    serviceName: 'Puppy Kindergarten Class at Center',
    serviceStyle: 'at_center',
    applicableRoles: ['pet_trainer'],
    basePrice: 1000,
    isPackage: false,
    duration: 60,
    description: 'Group socialization class for puppies 8-16 weeks'
  },
  {
    categoryId: 'training',
    categoryName: 'Training',
    subCategoryId: 'group',
    subCategoryName: 'Group Classes',
    serviceName: 'Rally Obedience Class at Center',
    serviceStyle: 'at_center',
    applicableRoles: ['pet_trainer'],
    basePrice: 1400,
    isPackage: false,
    duration: 75,
    description: 'Group rally obedience training'
  },
  {
    categoryId: 'training',
    categoryName: 'Training',
    subCategoryId: 'teleconsult',
    subCategoryName: 'Virtual Training',
    serviceName: 'Puppy Biting Prevention Consultation',
    serviceStyle: 'tele',
    applicableRoles: ['pet_trainer'],
    basePrice: 400,
    isPackage: false,
    duration: 30,
    description: 'Virtual guidance for puppy mouthing/biting'
  },
  {
    categoryId: 'training',
    categoryName: 'Training',
    subCategoryId: 'teleconsult',
    subCategoryName: 'Virtual Training',
    serviceName: 'Multi-Pet Household Consultation',
    serviceStyle: 'tele',
    applicableRoles: ['pet_trainer'],
    basePrice: 500,
    isPackage: false,
    duration: 35,
    description: 'Managing multiple pets and inter-pet dynamics'
  },
  {
    categoryId: 'training',
    categoryName: 'Training',
    subCategoryId: 'teleconsult',
    subCategoryName: 'Virtual Training',
    serviceName: 'Pre-Baby Pet Preparation',
    serviceStyle: 'tele',
    applicableRoles: ['pet_trainer'],
    basePrice: 600,
    isPackage: false,
    duration: 40,
    description: 'Preparing your pet for a new baby'
  },
  
  // ========================================================================
  // ADDITIONAL WALKING SERVICES (5 services)
  // ========================================================================
  
  {
    categoryId: 'walking',
    categoryName: 'Dog Walking',
    subCategoryId: 'extended',
    subCategoryName: 'Extended Walks',
    serviceName: 'Extended Walk - 90 Minutes',
    serviceStyle: 'at_home',
    applicableRoles: ['pet_walker'],
    basePrice: 650,
    isPackage: false,
    duration: 90,
    description: 'Single 90-minute extended walk'
  },
  {
    categoryId: 'walking',
    categoryName: 'Dog Walking',
    subCategoryId: 'premium',
    subCategoryName: 'Premium Walks',
    serviceName: 'Adventure Walk - 2 Hours with Hiking',
    serviceStyle: 'at_home',
    applicableRoles: ['pet_walker'],
    basePrice: 900,
    isPackage: false,
    duration: 120,
    description: 'Extended nature/hiking adventure walk'
  },
  {
    categoryId: 'walking',
    categoryName: 'Dog Walking',
    subCategoryId: 'specialized',
    subCategoryName: 'Specialized Walks',
    serviceName: 'Reactive Dog Walk - Private',
    serviceStyle: 'at_home',
    applicableRoles: ['pet_walker'],
    basePrice: 400,
    isPackage: false,
    duration: 30,
    description: 'Specialized walk for reactive/anxious dogs'
  },
  {
    categoryId: 'walking',
    categoryName: 'Dog Walking',
    subCategoryId: 'specialized',
    subCategoryName: 'Specialized Walks',
    serviceName: 'Senior/Special Needs Walk',
    serviceStyle: 'at_home',
    applicableRoles: ['pet_walker'],
    basePrice: 350,
    isPackage: false,
    duration: 20,
    description: 'Gentle pace walk for senior or special needs dogs'
  },
  {
    categoryId: 'walking',
    categoryName: 'Dog Walking',
    subCategoryId: 'group',
    subCategoryName: 'Group Walks',
    serviceName: 'Small Group Social Walk - 60 Minutes',
    serviceStyle: 'at_home',
    applicableRoles: ['pet_walker'],
    basePrice: 350,
    isPackage: false,
    duration: 60,
    description: 'Social group walk with 3-4 compatible dogs'
  },
  
  // ========================================================================
  // ADDITIONAL SITTING & BOARDING SERVICES (10 services)
  // ========================================================================
  
  {
    categoryId: 'sitting',
    categoryName: 'Pet Sitting',
    subCategoryId: 'specialized',
    subCategoryName: 'Specialized Sitting',
    serviceName: 'Diabetic Pet Care Sitting - 8 Hours',
    serviceStyle: 'at_home',
    applicableRoles: ['pet_boarder'],
    basePrice: 2000,
    isPackage: false,
    duration: 480,
    description: 'Specialized care for diabetic pets with insulin'
  },
  {
    categoryId: 'sitting',
    categoryName: 'Pet Sitting',
    subCategoryId: 'specialized',
    subCategoryName: 'Specialized Sitting',
    serviceName: 'Senior Pet Care Sitting - 12 Hours',
    serviceStyle: 'at_home',
    applicableRoles: ['pet_boarder'],
    basePrice: 2500,
    isPackage: false,
    duration: 720,
    description: 'Specialized sitting for senior pets with extra care'
  },
  {
    categoryId: 'sitting',
    categoryName: 'Pet Sitting',
    subCategoryId: 'specialized',
    subCategoryName: 'Specialized Sitting',
    serviceName: 'Multiple Pets Sitting - 8 Hours (3+ pets)',
    serviceStyle: 'at_home',
    applicableRoles: ['pet_boarder'],
    basePrice: 2400,
    isPackage: false,
    duration: 480,
    description: 'Care for 3 or more pets simultaneously'
  },
  {
    categoryId: 'sitting',
    categoryName: 'Pet Sitting',
    subCategoryId: 'visit',
    subCategoryName: 'Quick Visits',
    serviceName: 'Plant Watering + Pet Check Visit',
    serviceStyle: 'at_home',
    applicableRoles: ['pet_boarder'],
    basePrice: 400,
    isPackage: false,
    duration: 30,
    description: 'Pet care visit plus plant watering service'
  },
  {
    categoryId: 'sitting',
    categoryName: 'Pet Sitting',
    subCategoryId: 'visit',
    subCategoryName: 'Quick Visits',
    serviceName: 'Litter Box Cleaning Visit',
    serviceStyle: 'at_home',
    applicableRoles: ['pet_boarder'],
    basePrice: 350,
    isPackage: false,
    duration: 20,
    description: 'Quick visit for litter box cleaning and cat check'
  },
  {
    categoryId: 'boarding',
    categoryName: 'Pet Boarding',
    subCategoryId: 'premium',
    subCategoryName: 'Premium Boarding',
    serviceName: 'Luxury Suite Boarding - Per Night',
    serviceStyle: 'at_center',
    applicableRoles: ['pet_boarder'],
    basePrice: 0,
    isPackage: true,
    packageDetails: {
      sessionsPerDay: 1,
      sessionDuration: 1440,
      packageDuration: 1,
      totalSessions: 1,
      pricingBySize: { small: 1200, medium: 1500, large: 1800, extraLarge: 2200 }
    },
    description: 'Premium luxury suite with extra amenities'
  },
  {
    categoryId: 'boarding',
    categoryName: 'Pet Boarding',
    subCategoryId: 'specialized',
    subCategoryName: 'Specialized Boarding',
    serviceName: 'Medical Boarding - Per Night',
    serviceStyle: 'at_center',
    applicableRoles: ['pet_boarder'],
    basePrice: 0,
    isPackage: true,
    packageDetails: {
      sessionsPerDay: 1,
      sessionDuration: 1440,
      packageDuration: 1,
      totalSessions: 1,
      pricingBySize: { small: 1500, medium: 1800, large: 2200, extraLarge: 2600 }
    },
    description: 'Boarding with medication administration and monitoring'
  },
  {
    categoryId: 'boarding',
    categoryName: 'Pet Boarding',
    subCategoryId: 'specialized',
    subCategoryName: 'Specialized Boarding',
    serviceName: 'Puppy Boarding - Per Night',
    serviceStyle: 'at_center',
    applicableRoles: ['pet_boarder'],
    basePrice: 0,
    isPackage: true,
    packageDetails: {
      sessionsPerDay: 1,
      sessionDuration: 1440,
      packageDuration: 1,
      totalSessions: 1,
      pricingBySize: { small: 900, medium: 1100, large: 1300, extraLarge: 1500 }
    },
    description: 'Specialized boarding for puppies under 6 months'
  },
  {
    categoryId: 'boarding',
    categoryName: 'Pet Boarding',
    subCategoryId: 'specialized',
    subCategoryName: 'Specialized Boarding',
    serviceName: 'Cat Only Boarding - Per Night',
    serviceStyle: 'at_center',
    applicableRoles: ['pet_boarder'],
    basePrice: 0,
    isPackage: true,
    packageDetails: {
      sessionsPerDay: 1,
      sessionDuration: 1440,
      packageDuration: 1,
      totalSessions: 1,
      pricingBySize: { small: 600, medium: 600, large: 600, extraLarge: 600 }
    },
    description: 'Cat-only facility boarding (no dogs)'
  },
  {
    categoryId: 'boarding',
    categoryName: 'Pet Boarding',
    subCategoryId: 'daycare',
    subCategoryName: 'Day Care',
    serviceName: 'Socialization Daycare with Training',
    serviceStyle: 'at_center',
    applicableRoles: ['pet_boarder'],
    basePrice: 0,
    isPackage: true,
    packageDetails: {
      sessionsPerDay: 1,
      sessionDuration: 480,
      packageDuration: 1,
      totalSessions: 1,
      pricingBySize: { small: 800, medium: 1000, large: 1200, extraLarge: 1400 }
    },
    description: 'Daycare with socialization and basic training'
  }
];

// Normalize veterinary roles
const normalizedAdditionalServices = normalizeVetRoles(ADDITIONAL_SERVICES);

// Combine base catalog with additional services and normalize ALL services
export const INDIA_200PLUS_CATALOG: ServiceCatalogItem[] = normalizeVetRoles([
  ...INDIA_COMPREHENSIVE_CATALOG,
  ...normalizedAdditionalServices
]);

console.log(`✅ India 200+ Service Catalog loaded: ${INDIA_200PLUS_CATALOG.length} services`);
console.log(`   📊 Base catalog: ${INDIA_COMPREHENSIVE_CATALOG.length}`);
console.log(`   📊 Additional: ${ADDITIONAL_SERVICES.length}`);
console.log(`   📊 Total: ${INDIA_200PLUS_CATALOG.length}`);
console.log(`   🏥 Veterinarian & Clinic roles normalized - all vet services available to both`);