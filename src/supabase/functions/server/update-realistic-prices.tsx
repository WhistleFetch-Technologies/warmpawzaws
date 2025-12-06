/**
 * REALISTIC PRICING UPDATE FOR INDIAN PET SERVICE MARKET (2024-2025)
 * 
 * Research Sources:
 * - PetSutra, Wiggles.in, Zigly, Supertails pricing
 * - Local vet clinics in Mumbai, Bangalore, Delhi NCR
 * - Urban Company pet services
 * - Justdial pet service listings
 * 
 * Pricing Strategy:
 * - Tier 1 cities (Mumbai, Delhi, Bangalore): Base price
 * - Tier 2 cities: 80% of base
 * - Tier 3 cities: 60% of base
 * - Platform takes 18-22% commission
 * - Vendors receive 78-82% of booking value
 * 
 * UPDATED: December 2024
 */

export const REALISTIC_PRICING = {
  
  // ==========================================
  // VETERINARY SERVICES
  // ==========================================
  VETERINARY: {
    
    // Preventive & Wellness Care
    PREVENTIVE_WELLNESS: {
      'VET-GEN-001': { price: 400, name: 'General Health Check-up' },
      'VET-ANN-002': { price: 800, name: 'Annual Wellness Exam' },
      'VET-PUP-003': { price: 1500, name: 'Puppy/Kitten Wellness Program' },
      'VET-SEN-004': { price: 1000, name: 'Senior Pet Wellness' },
      'VET-VAC-005': { price: 500, name: 'Vaccination' },
      'VET-DEW-006': { price: 250, name: 'Deworming' },
      'VET-FTP-007': { price: 350, name: 'Flea/Tick/Parasite Prevention' },
      'VET-HW-008': { price: 450, name: 'Heartworm Prevention' },
      'VET-NUT-009': { price: 500, name: 'Nutritional Counselling' },
      'VET-BEH-010': { price: 600, name: 'Behavior Consultation' },
      'VET-WGT-011': { price: 400, name: 'Weight Management Consultation' }
    },
    
    // General Consultation
    GENERAL_CONSULTATION: {
      'VET-CONS-001': { price: 400, name: 'In-Clinic Consultation' },
      'VET-CONS-002': { price: 300, name: 'Tele-Consultation' },
      'VET-CONS-003': { price: 600, name: 'Home Visit Consultation' },
      'VET-CONS-004': { price: 1200, name: 'Emergency Consultation' },
      'VET-CONS-005': { price: 500, name: 'Follow-up Consultation' }
    },
    
    // Dermatology (Skin & Fur)
    DERMATOLOGY: {
      'VET-DERM-001': { price: 600, name: 'Dermatology Consultation' },
      'VET-DERM-002': { price: 800, name: 'Allergy Testing' },
      'VET-DERM-003': { price: 500, name: 'Skin Scraping Test' },
      'VET-DERM-004': { price: 1200, name: 'Fungal Culture' },
      'VET-DERM-005': { price: 700, name: 'Skin Biopsy' }
    },
    
    // Cardiology
    CARDIOLOGY: {
      'VET-CARD-001': { price: 800, name: 'Cardiology Consultation' },
      'VET-CARD-002': { price: 1500, name: 'ECG (Electrocardiography)' },
      'VET-CARD-003': { price: 2500, name: 'Echocardiography' },
      'VET-CARD-004': { price: 1800, name: 'Blood Pressure Monitoring' },
      'VET-CARD-005': { price: 3000, name: 'Holter Monitoring (24hr)' }
    },
    
    // Orthopedics
    ORTHOPEDICS: {
      'VET-ORTH-001': { price: 700, name: 'Orthopedic Consultation' },
      'VET-ORTH-002': { price: 1500, name: 'X-Ray (Single View)' },
      'VET-ORTH-003': { price: 2500, name: 'X-Ray (Multiple Views)' },
      'VET-ORTH-004': { price: 1200, name: 'Joint Fluid Analysis' },
      'VET-ORTH-005': { price: 15000, name: 'Fracture Repair Surgery' },
      'VET-ORTH-006': { price: 25000, name: 'ACL Surgery' },
      'VET-ORTH-007': { price: 8000, name: 'Splinting/Casting' }
    },
    
    // Neurology
    NEUROLOGY: {
      'VET-NEUR-001': { price: 1000, name: 'Neurology Consultation' },
      'VET-NEUR-002': { price: 2000, name: 'Neurological Examination' },
      'VET-NEUR-003': { price: 1500, name: 'Seizure Management' },
      'VET-NEUR-004': { price: 30000, name: 'MRI Scan (if available)' }
    },
    
    // Ophthalmology
    OPHTHALMOLOGY: {
      'VET-OPHT-001': { price: 700, name: 'Ophthalmology Consultation' },
      'VET-OPHT-002': { price: 1000, name: 'Eye Pressure Test' },
      'VET-OPHT-003': { price: 1200, name: 'Corneal Staining' },
      'VET-OPHT-004': { price: 8000, name: 'Cataract Surgery' },
      'VET-OPHT-005': { price: 1500, name: 'Eye Ulcer Treatment' }
    },
    
    // Dentistry
    DENTISTRY: {
      'VET-DENT-001': { price: 600, name: 'Dental Consultation' },
      'VET-DENT-002': { price: 2500, name: 'Dental Cleaning (Scaling)' },
      'VET-DENT-003': { price: 800, name: 'Tooth Extraction (Simple)' },
      'VET-DENT-004': { price: 1500, name: 'Tooth Extraction (Surgical)' },
      'VET-DENT-005': { price: 1200, name: 'Dental X-Ray' }
    },
    
    // Oncology
    ONCOLOGY: {
      'VET-ONCO-001': { price: 1200, name: 'Oncology Consultation' },
      'VET-ONCO-002': { price: 2500, name: 'Tumor Biopsy' },
      'VET-ONCO-003': { price: 25000, name: 'Tumor Removal Surgery' },
      'VET-ONCO-004': { price: 8000, name: 'Chemotherapy Session' }
    },
    
    // Surgery
    SURGERY: {
      'VET-SURG-001': { price: 8000, name: 'Spay (Female Sterilization)' },
      'VET-SURG-002': { price: 6000, name: 'Neuter (Male Castration)' },
      'VET-SURG-003': { price: 5000, name: 'Minor Soft Tissue Surgery' },
      'VET-SURG-004': { price: 15000, name: 'Major Soft Tissue Surgery' },
      'VET-SURG-005': { price: 12000, name: 'Cesarean Section' },
      'VET-SURG-006': { price: 18000, name: 'Abdominal Surgery' },
      'VET-SURG-007': { price: 10000, name: 'Mass Removal' }
    },
    
    // Diagnostics
    DIAGNOSTICS: {
      'VET-DIAG-001': { price: 800, name: 'Complete Blood Count (CBC)' },
      'VET-DIAG-002': { price: 1200, name: 'Biochemistry Panel' },
      'VET-DIAG-003': { price: 600, name: 'Urinalysis' },
      'VET-DIAG-004': { price: 700, name: 'Fecal Examination' },
      'VET-DIAG-005': { price: 1500, name: 'Thyroid Function Test' },
      'VET-DIAG-006': { price: 2000, name: 'Ultrasound' },
      'VET-DIAG-007': { price: 1500, name: 'X-Ray (Single)' },
      'VET-DIAG-008': { price: 2500, name: 'X-Ray (Full Body)' },
      'VET-DIAG-009': { price: 1000, name: 'Blood Glucose Test' }
    },
    
    // Reproductive Services
    REPRODUCTIVE: {
      'VET-REPR-001': { price: 800, name: 'Breeding Consultation' },
      'VET-REPR-002': { price: 3000, name: 'Artificial Insemination' },
      'VET-REPR-003': { price: 1200, name: 'Pregnancy Diagnosis' },
      'VET-REPR-004': { price: 2000, name: 'Pre-natal Care Package' },
      'VET-REPR-005': { price: 1500, name: 'Post-natal Care' }
    },
    
    // Emergency Services
    EMERGENCY: {
      'VET-EMER-001': { price: 1500, name: 'Emergency Consultation' },
      'VET-EMER-002': { price: 2500, name: 'Critical Care (per hour)' },
      'VET-EMER-003': { price: 3000, name: 'Emergency Surgery' },
      'VET-EMER-004': { price: 2000, name: 'Trauma Care' },
      'VET-EMER-005': { price: 1800, name: 'Poisoning Treatment' }
    },
    
    // Hospitalization
    HOSPITALIZATION: {
      'VET-HOSP-001': { price: 1500, name: 'Day Hospitalization' },
      'VET-HOSP-002': { price: 2500, name: 'Overnight Hospitalization' },
      'VET-HOSP-003': { price: 3500, name: 'ICU Care (per day)' },
      'VET-HOSP-004': { price: 500, name: 'IV Fluid Therapy' }
    },
    
    // Exotic Pets
    EXOTIC_PETS: {
      'VET-EXOT-001': { price: 800, name: 'Exotic Pet Consultation' },
      'VET-EXOT-002': { price: 1200, name: 'Bird Health Check' },
      'VET-EXOT-003': { price: 1000, name: 'Rabbit Care' },
      'VET-EXOT-004': { price: 1500, name: 'Reptile Care' }
    }
  },
  
  // ==========================================
  // GROOMING SERVICES
  // ==========================================
  GROOMING: {
    
    // Basic Grooming
    BASIC: {
      'GRM-BATH-001': { price: 500, name: 'Basic Bath & Brush' },
      'GRM-BATH-002': { price: 800, name: 'Premium Bath & Brush' },
      'GRM-DBATH-003': { price: 900, name: 'De-shedding Bath' },
      'GRM-MBATH-004': { price: 1000, name: 'Medicated Bath' },
      'GRM-HAIR-005': { price: 1200, name: 'Full Body Haircut' },
      'GRM-TRIM-006': { price: 600, name: 'Sanitary Trim' },
      'GRM-FACE-007': { price: 400, name: 'Face & Feet Trim' }
    },
    
    // Nail & Paw Care
    NAIL_PAW: {
      'GRM-NAIL-008': { price: 200, name: 'Nail Trimming' },
      'GRM-NAIL-009': { price: 300, name: 'Nail Grinding' },
      'GRM-PAW-010': { price: 250, name: 'Paw Pad Moisturizing' }
    },
    
    // Ear & Eye Care
    EAR_EYE: {
      'GRM-EAR-011': { price: 200, name: 'Ear Cleaning' },
      'GRM-EYE-012': { price: 200, name: 'Eye Cleaning' },
      'GRM-TEAR-013': { price: 300, name: 'Tear Stain Removal' }
    },
    
    // Dental
    DENTAL: {
      'GRM-DENT-014': { price: 300, name: 'Teeth Brushing' },
      'GRM-DENT-015': { price: 500, name: 'Dental Spray Treatment' }
    },
    
    // Premium Services
    PREMIUM: {
      'GRM-SPA-016': { price: 2000, name: 'Full Spa Package' },
      'GRM-STYLE-017': { price: 1800, name: 'Show Grooming' },
      'GRM-COLOR-018': { price: 1500, name: 'Fur Coloring/Styling' }
    },
    
    // Day-care
    DAYCARE: {
      'GRM-DAY-019': { price: 600, name: 'Pet Daycare (per day)' }
    }
  },
  
  // ==========================================
  // TRAINING & BEHAVIOR SERVICES
  // ==========================================
  TRAINING: {
    
    // Basic Obedience
    BASIC_OBEDIENCE: {
      'TRN-BASIC-001': { price: 800, name: 'Basic Obedience (Single Session)' },
      'TRN-BASIC-002': { price: 6000, name: 'Basic Obedience Package (8 sessions)' },
      'TRN-PUP-003': { price: 8000, name: 'Puppy Training Program (10 sessions)' }
    },
    
    // Advanced Training
    ADVANCED: {
      'TRN-ADV-004': { price: 1200, name: 'Advanced Training (Single Session)' },
      'TRN-ADV-005': { price: 10000, name: 'Advanced Training Package (10 sessions)' },
      'TRN-AGIL-006': { price: 1500, name: 'Agility Training (Single Session)' }
    },
    
    // Behavior Modification
    BEHAVIOR: {
      'TRN-BEH-007': { price: 1200, name: 'Behavior Consultation' },
      'TRN-BEH-008': { price: 1500, name: 'Aggression Management' },
      'TRN-BEH-009': { price: 1200, name: 'Anxiety/Fear Treatment' },
      'TRN-BEH-010': { price: 1000, name: 'Socialization Training' }
    },
    
    // Specialized Training
    SPECIALIZED: {
      'TRN-SPEC-011': { price: 2000, name: 'Protection Training' },
      'TRN-SPEC-012': { price: 1800, name: 'Service Dog Training' },
      'TRN-SPEC-013': { price: 1500, name: 'Therapy Dog Training' }
    },
    
    // Private Sessions
    PRIVATE: {
      'TRN-PRIV-014': { price: 1500, name: 'Private Training Session' },
      'TRN-PRIV-015': { price: 2000, name: 'In-Home Private Training' }
    },
    
    // Group Classes
    GROUP: {
      'TRN-GRP-016': { price: 600, name: 'Group Training Class' },
      'TRN-GRP-017': { price: 4000, name: 'Group Class Package (8 sessions)' }
    }
  },
  
  // ==========================================
  // WALKING & SITTING SERVICES
  // ==========================================
  WALKING_SITTING: {
    
    // Dog Walking (Single Sessions)
    WALKING: {
      'WALK-30-001': { price: 250, name: 'Dog Walk (30 minutes)' },
      'WALK-60-002': { price: 400, name: 'Dog Walk (60 minutes)' },
      'WALK-MULTI-003': { price: 600, name: 'Multiple Dogs Walk' }
    },
    
    // Walking Packages
    WALKING_PACKAGES: {
      'WALK-PKG-004': {
        price: 1400,
        name: 'Dog Walking Package (7 days, 1x/day, 30min)',
        pricingBySize: { small: 1400, medium: 1600, large: 1800, extraLarge: 2000 }
      },
      'WALK-PKG-005': {
        price: 2500,
        name: 'Dog Walking Package (7 days, 2x/day, 30min)',
        pricingBySize: { small: 2500, medium: 2800, large: 3200, extraLarge: 3500 }
      },
      'WALK-PKG-006': {
        price: 5500,
        name: 'Dog Walking Package (30 days, 1x/day, 30min)',
        pricingBySize: { small: 5500, medium: 6000, large: 6500, extraLarge: 7000 }
      }
    },
    
    // Pet Sitting
    SITTING: {
      'SIT-DAY-001': { price: 800, name: 'Daytime Pet Sitting (8 hours)' },
      'SIT-HALF-002': { price: 600, name: 'Half-Day Pet Sitting (4 hours)' },
      'SIT-OVER-003': { price: 2000, name: 'Overnight Pet Sitting (24 hours)' }
    },
    
    // Boarding
    BOARDING: {
      'BOARD-DAY-001': { price: 800, name: 'Pet Boarding (per day)' },
      'BOARD-WEEK-002': { price: 5000, name: 'Pet Boarding (per week)' }
    }
  }
};

/**
 * Helper function to get price by service code
 */
export function getRealisticPrice(serviceCode: string): number | null {
  if (!serviceCode) return null;
  
  // Search through all categories
  for (const categoryData of Object.values(REALISTIC_PRICING)) {
    for (const subcategoryData of Object.values(categoryData)) {
      // subcategoryData is an object where keys are service codes
      if (typeof subcategoryData === 'object' && subcategoryData !== null) {
        const serviceData = subcategoryData[serviceCode as keyof typeof subcategoryData];
        if (serviceData && typeof serviceData === 'object' && 'price' in serviceData) {
          return (serviceData as any).price;
        }
      }
    }
  }
  
  return null;
}

/**
 * Get all service codes with updated prices
 */
export function getAllPriceUpdates(): { code: string; price: number; name: string }[] {
  const updates: { code: string; price: number; name: string }[] = [];
  
  for (const category of Object.values(REALISTIC_PRICING)) {
    for (const subcategory of Object.values(category)) {
      for (const [code, data] of Object.entries(subcategory)) {
        updates.push({
          code,
          price: (data as any).price,
          name: (data as any).name
        });
      }
    }
  }
  
  return updates;
}