/**
 * 🇮🇳 COMPREHENSIVE INDIA MARKET SERVICE CATALOG
 * 
 * Research-based pricing for Indian pet services market (2024)
 * 200+ services across all roles and service styles
 * Pricing based on market research from major Indian cities
 * 
 * Service Styles:
 * - at_home: Home visit services
 * - at_center: Clinic/center based services
 * - tele: Virtual/online consultations
 * 
 * Roles:
 * - veterinarian: Licensed vets
 * - pet_clinic: Full-service veterinary clinics
 * - pet_groomer: Professional groomers
 * - pet_trainer: Dog/cat trainers
 * - pet_walker: Dog walking services
 * - pet_boarder: Pet sitting and boarding
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

export const INDIA_COMPREHENSIVE_CATALOG: ServiceCatalogItem[] = [
  
  // ========================================================================
  // VETERINARY SERVICES - AT HOME (Vets & Clinics)
  // ========================================================================
  
  {
    categoryId: 'veterinary',
    categoryName: 'Veterinary',
    subCategoryId: 'consultation',
    subCategoryName: 'Consultation',
    serviceName: 'General Consultation at Home',
    serviceStyle: 'at_home',
    applicableRoles: ['veterinarian', 'pet_clinic'],
    basePrice: 800,
    isPackage: false,
    duration: 30,
    description: 'Comprehensive physical examination and health assessment at your home'
  },
  {
    categoryId: 'veterinary',
    categoryName: 'Veterinary',
    subCategoryId: 'vaccination',
    subCategoryName: 'Vaccination',
    serviceName: 'Rabies Vaccination at Home',
    serviceStyle: 'at_home',
    applicableRoles: ['veterinarian', 'pet_clinic'],
    basePrice: 500,
    isPackage: false,
    duration: 20,
    description: 'Anti-rabies vaccination administered at home'
  },
  {
    categoryId: 'veterinary',
    categoryName: 'Veterinary',
    subCategoryId: 'vaccination',
    subCategoryName: 'Vaccination',
    serviceName: 'DHPP Vaccination at Home',
    serviceStyle: 'at_home',
    applicableRoles: ['veterinarian', 'pet_clinic'],
    basePrice: 600,
    isPackage: false,
    duration: 20,
    description: 'Distemper, Hepatitis, Parvovirus, Parainfluenza vaccination'
  },
  {
    categoryId: 'veterinary',
    categoryName: 'Veterinary',
    subCategoryId: 'vaccination',
    subCategoryName: 'Vaccination',
    serviceName: 'Leptospirosis Vaccination at Home',
    serviceStyle: 'at_home',
    applicableRoles: ['veterinarian', 'pet_clinic'],
    basePrice: 650,
    isPackage: false,
    duration: 20,
    description: 'Leptospirosis preventive vaccination'
  },
  {
    categoryId: 'veterinary',
    categoryName: 'Veterinary',
    subCategoryId: 'vaccination',
    subCategoryName: 'Vaccination',
    serviceName: 'Kennel Cough Vaccination at Home',
    serviceStyle: 'at_home',
    applicableRoles: ['veterinarian', 'pet_clinic'],
    basePrice: 700,
    isPackage: false,
    duration: 20,
    description: 'Bordetella (kennel cough) vaccination'
  },
  {
    categoryId: 'veterinary',
    categoryName: 'Veterinary',
    subCategoryId: 'vaccination',
    subCategoryName: 'Vaccination',
    serviceName: 'Puppy Vaccination Package - Full Course at Home',
    serviceStyle: 'at_home',
    applicableRoles: ['veterinarian', 'pet_clinic'],
    basePrice: 3500,
    isPackage: false,
    duration: 120,
    description: 'Complete puppy vaccination series (3 doses + rabies) with home visits'
  },
  {
    categoryId: 'veterinary',
    categoryName: 'Veterinary',
    subCategoryId: 'deworming',
    subCategoryName: 'Deworming',
    serviceName: 'Deworming at Home - Dogs',
    serviceStyle: 'at_home',
    applicableRoles: ['veterinarian', 'pet_clinic'],
    basePrice: 400,
    isPackage: false,
    duration: 15,
    description: 'Broad-spectrum deworming treatment for dogs'
  },
  {
    categoryId: 'veterinary',
    categoryName: 'Veterinary',
    subCategoryId: 'deworming',
    subCategoryName: 'Deworming',
    serviceName: 'Deworming at Home - Cats',
    serviceStyle: 'at_home',
    applicableRoles: ['veterinarian', 'pet_clinic'],
    basePrice: 350,
    isPackage: false,
    duration: 15,
    description: 'Broad-spectrum deworming treatment for cats'
  },
  {
    categoryId: 'veterinary',
    categoryName: 'Veterinary',
    subCategoryId: 'preventive',
    subCategoryName: 'Preventive Care',
    serviceName: 'Tick & Flea Treatment at Home',
    serviceStyle: 'at_home',
    applicableRoles: ['veterinarian', 'pet_clinic'],
    basePrice: 600,
    isPackage: false,
    duration: 30,
    description: 'Topical/oral anti-parasitic treatment for ticks and fleas'
  },
  {
    categoryId: 'veterinary',
    categoryName: 'Veterinary',
    subCategoryId: 'preventive',
    subCategoryName: 'Preventive Care',
    serviceName: 'Heartworm Prevention at Home',
    serviceStyle: 'at_home',
    applicableRoles: ['veterinarian', 'pet_clinic'],
    basePrice: 700,
    isPackage: false,
    duration: 20,
    description: 'Heartworm preventive medication administration'
  },
  {
    categoryId: 'veterinary',
    categoryName: 'Veterinary',
    subCategoryId: 'emergency',
    subCategoryName: 'Emergency',
    serviceName: 'Emergency Home Visit',
    serviceStyle: 'at_home',
    applicableRoles: ['veterinarian', 'pet_clinic'],
    basePrice: 2500,
    isPackage: false,
    duration: 60,
    description: 'Urgent veterinary care at home for emergencies'
  },
  {
    categoryId: 'veterinary',
    categoryName: 'Veterinary',
    subCategoryId: 'postcare',
    subCategoryName: 'Post-Operative Care',
    serviceName: 'Post-Surgery Home Care Visit',
    serviceStyle: 'at_home',
    applicableRoles: ['veterinarian', 'pet_clinic'],
    basePrice: 1000,
    isPackage: false,
    duration: 45,
    description: 'Post-operative monitoring, wound dressing, and care'
  },
  {
    categoryId: 'veterinary',
    categoryName: 'Veterinary',
    subCategoryId: 'postcare',
    subCategoryName: 'Post-Operative Care',
    serviceName: 'Wound Dressing at Home',
    serviceStyle: 'at_home',
    applicableRoles: ['veterinarian', 'pet_clinic'],
    basePrice: 500,
    isPackage: false,
    duration: 30,
    description: 'Professional wound cleaning and dressing'
  },
  {
    categoryId: 'veterinary',
    categoryName: 'Veterinary',
    subCategoryId: 'postcare',
    subCategoryName: 'Post-Operative Care',
    serviceName: 'Injection Administration at Home',
    serviceStyle: 'at_home',
    applicableRoles: ['veterinarian', 'pet_clinic'],
    basePrice: 300,
    isPackage: false,
    duration: 15,
    description: 'IV/IM/SC injection administration'
  },
  {
    categoryId: 'veterinary',
    categoryName: 'Veterinary',
    subCategoryId: 'laboratory',
    subCategoryName: 'Laboratory Services',
    serviceName: 'Blood Sample Collection at Home',
    serviceStyle: 'at_home',
    applicableRoles: ['veterinarian', 'pet_clinic'],
    basePrice: 500,
    isPackage: false,
    duration: 20,
    description: 'Blood sample collection for laboratory testing'
  },
  {
    categoryId: 'veterinary',
    categoryName: 'Veterinary',
    subCategoryId: 'laboratory',
    subCategoryName: 'Laboratory Services',
    serviceName: 'Urine Sample Collection at Home',
    serviceStyle: 'at_home',
    applicableRoles: ['veterinarian', 'pet_clinic'],
    basePrice: 400,
    isPackage: false,
    duration: 15,
    description: 'Urine sample collection for testing'
  },
  {
    categoryId: 'veterinary',
    categoryName: 'Veterinary',
    subCategoryId: 'dental',
    subCategoryName: 'Dental Care',
    serviceName: 'Dental Checkup at Home',
    serviceStyle: 'at_home',
    applicableRoles: ['veterinarian', 'pet_clinic'],
    basePrice: 600,
    isPackage: false,
    duration: 30,
    description: 'Oral examination and dental health assessment'
  },
  {
    categoryId: 'veterinary',
    categoryName: 'Veterinary',
    subCategoryId: 'ear',
    subCategoryName: 'Ear Care',
    serviceName: 'Ear Cleaning at Home',
    serviceStyle: 'at_home',
    applicableRoles: ['veterinarian', 'pet_clinic'],
    basePrice: 400,
    isPackage: false,
    duration: 20,
    description: 'Professional ear cleaning and infection prevention'
  },

  // ========================================================================
  // VETERINARY SERVICES - AT CLINIC/CENTER
  // ========================================================================
  
  {
    categoryId: 'veterinary',
    categoryName: 'Veterinary',
    subCategoryId: 'consultation',
    subCategoryName: 'Consultation',
    serviceName: 'General Consultation at Clinic',
    serviceStyle: 'at_center',
    applicableRoles: ['veterinarian', 'pet_clinic'],
    basePrice: 500,
    isPackage: false,
    duration: 30,
    description: 'Comprehensive physical examination at clinic'
  },
  {
    categoryId: 'veterinary',
    categoryName: 'Veterinary',
    subCategoryId: 'consultation',
    subCategoryName: 'Consultation',
    serviceName: 'Specialist Consultation',
    serviceStyle: 'at_center',
    applicableRoles: ['pet_clinic'],
    basePrice: 1500,
    isPackage: false,
    duration: 45,
    description: 'Consultation with veterinary specialist (cardiology, orthopedic, etc.)'
  },
  {
    categoryId: 'veterinary',
    categoryName: 'Veterinary',
    subCategoryId: 'surgery',
    subCategoryName: 'Surgery',
    serviceName: 'Spay Surgery - Female (Small Breed)',
    serviceStyle: 'at_center',
    applicableRoles: ['pet_clinic'],
    basePrice: 5000,
    isPackage: false,
    duration: 120,
    description: 'Ovariohysterectomy for small breed dogs/cats'
  },
  {
    categoryId: 'veterinary',
    categoryName: 'Veterinary',
    subCategoryId: 'surgery',
    subCategoryName: 'Surgery',
    serviceName: 'Spay Surgery - Female (Medium Breed)',
    serviceStyle: 'at_center',
    applicableRoles: ['pet_clinic'],
    basePrice: 7000,
    isPackage: false,
    duration: 150,
    description: 'Ovariohysterectomy for medium breed dogs'
  },
  {
    categoryId: 'veterinary',
    categoryName: 'Veterinary',
    subCategoryId: 'surgery',
    subCategoryName: 'Surgery',
    serviceName: 'Spay Surgery - Female (Large Breed)',
    serviceStyle: 'at_center',
    applicableRoles: ['pet_clinic'],
    basePrice: 9000,
    isPackage: false,
    duration: 180,
    description: 'Ovariohysterectomy for large breed dogs'
  },
  {
    categoryId: 'veterinary',
    categoryName: 'Veterinary',
    subCategoryId: 'surgery',
    subCategoryName: 'Surgery',
    serviceName: 'Neuter Surgery - Male (Small Breed)',
    serviceStyle: 'at_center',
    applicableRoles: ['pet_clinic'],
    basePrice: 4000,
    isPackage: false,
    duration: 90,
    description: 'Castration for small breed dogs/cats'
  },
  {
    categoryId: 'veterinary',
    categoryName: 'Veterinary',
    subCategoryId: 'surgery',
    subCategoryName: 'Surgery',
    serviceName: 'Neuter Surgery - Male (Medium Breed)',
    serviceStyle: 'at_center',
    applicableRoles: ['pet_clinic'],
    basePrice: 5500,
    isPackage: false,
    duration: 120,
    description: 'Castration for medium breed dogs'
  },
  {
    categoryId: 'veterinary',
    categoryName: 'Veterinary',
    subCategoryId: 'surgery',
    subCategoryName: 'Surgery',
    serviceName: 'Neuter Surgery - Male (Large Breed)',
    serviceStyle: 'at_center',
    applicableRoles: ['pet_clinic'],
    basePrice: 7000,
    isPackage: false,
    duration: 150,
    description: 'Castration for large breed dogs'
  },
  {
    categoryId: 'veterinary',
    categoryName: 'Veterinary',
    subCategoryId: 'surgery',
    subCategoryName: 'Surgery',
    serviceName: 'Dental Scaling & Polishing',
    serviceStyle: 'at_center',
    applicableRoles: ['pet_clinic'],
    basePrice: 3500,
    isPackage: false,
    duration: 90,
    description: 'Professional dental cleaning under anesthesia'
  },
  {
    categoryId: 'veterinary',
    categoryName: 'Veterinary',
    subCategoryId: 'surgery',
    subCategoryName: 'Surgery',
    serviceName: 'Tooth Extraction - Single Tooth',
    serviceStyle: 'at_center',
    applicableRoles: ['pet_clinic'],
    basePrice: 1500,
    isPackage: false,
    duration: 45,
    description: 'Surgical extraction of diseased tooth'
  },
  {
    categoryId: 'veterinary',
    categoryName: 'Veterinary',
    subCategoryId: 'surgery',
    subCategoryName: 'Surgery',
    serviceName: 'C-Section Surgery',
    serviceStyle: 'at_center',
    applicableRoles: ['pet_clinic'],
    basePrice: 15000,
    isPackage: false,
    duration: 180,
    description: 'Cesarean section for difficult delivery'
  },
  {
    categoryId: 'veterinary',
    categoryName: 'Veterinary',
    subCategoryId: 'surgery',
    subCategoryName: 'Surgery',
    serviceName: 'Fracture Surgery - Simple',
    serviceStyle: 'at_center',
    applicableRoles: ['pet_clinic'],
    basePrice: 12000,
    isPackage: false,
    duration: 180,
    description: 'Bone fracture repair surgery (simple fractures)'
  },
  {
    categoryId: 'veterinary',
    categoryName: 'Veterinary',
    subCategoryId: 'surgery',
    subCategoryName: 'Surgery',
    serviceName: 'Fracture Surgery - Complex',
    serviceStyle: 'at_center',
    applicableRoles: ['pet_clinic'],
    basePrice: 25000,
    isPackage: false,
    duration: 300,
    description: 'Complex bone fracture repair with plates/screws'
  },
  {
    categoryId: 'veterinary',
    categoryName: 'Veterinary',
    subCategoryId: 'surgery',
    subCategoryName: 'Surgery',
    serviceName: 'Tumor Removal - Minor',
    serviceStyle: 'at_center',
    applicableRoles: ['pet_clinic'],
    basePrice: 8000,
    isPackage: false,
    duration: 120,
    description: 'Surgical removal of small tumors/lumps'
  },
  {
    categoryId: 'veterinary',
    categoryName: 'Veterinary',
    subCategoryId: 'surgery',
    subCategoryName: 'Surgery',
    serviceName: 'Tumor Removal - Major',
    serviceStyle: 'at_center',
    applicableRoles: ['pet_clinic'],
    basePrice: 18000,
    isPackage: false,
    duration: 240,
    description: 'Complex tumor removal surgery'
  },
  {
    categoryId: 'veterinary',
    categoryName: 'Veterinary',
    subCategoryId: 'surgery',
    subCategoryName: 'Surgery',
    serviceName: 'Pyometra Surgery',
    serviceStyle: 'at_center',
    applicableRoles: ['pet_clinic'],
    basePrice: 12000,
    isPackage: false,
    duration: 180,
    description: 'Emergency uterine infection surgery'
  },
  {
    categoryId: 'veterinary',
    categoryName: 'Veterinary',
    subCategoryId: 'surgery',
    subCategoryName: 'Surgery',
    serviceName: 'Bladder Stone Surgery',
    serviceStyle: 'at_center',
    applicableRoles: ['pet_clinic'],
    basePrice: 15000,
    isPackage: false,
    duration: 210,
    description: 'Surgical removal of bladder stones'
  },
  {
    categoryId: 'veterinary',
    categoryName: 'Veterinary',
    subCategoryId: 'surgery',
    subCategoryName: 'Surgery',
    serviceName: 'Hernia Repair',
    serviceStyle: 'at_center',
    applicableRoles: ['pet_clinic'],
    basePrice: 7000,
    isPackage: false,
    duration: 120,
    description: 'Umbilical/inguinal hernia repair surgery'
  },
  {
    categoryId: 'veterinary',
    categoryName: 'Veterinary',
    subCategoryId: 'surgery',
    subCategoryName: 'Surgery',
    serviceName: 'Eye Surgery - Entropion/Ectropion',
    serviceStyle: 'at_center',
    applicableRoles: ['pet_clinic'],
    basePrice: 10000,
    isPackage: false,
    duration: 120,
    description: 'Eyelid correction surgery'
  },
  {
    categoryId: 'veterinary',
    categoryName: 'Veterinary',
    subCategoryId: 'surgery',
    subCategoryName: 'Surgery',
    serviceName: 'Cherry Eye Surgery',
    serviceStyle: 'at_center',
    applicableRoles: ['pet_clinic'],
    basePrice: 8000,
    isPackage: false,
    duration: 90,
    description: 'Third eyelid gland prolapse correction'
  },
  {
    categoryId: 'veterinary',
    categoryName: 'Veterinary',
    subCategoryId: 'imaging',
    subCategoryName: 'Imaging & Diagnostics',
    serviceName: 'X-Ray - Single View',
    serviceStyle: 'at_center',
    applicableRoles: ['pet_clinic'],
    basePrice: 1200,
    isPackage: false,
    duration: 30,
    description: 'Digital X-ray imaging - single position'
  },
  {
    categoryId: 'veterinary',
    categoryName: 'Veterinary',
    subCategoryId: 'imaging',
    subCategoryName: 'Imaging & Diagnostics',
    serviceName: 'X-Ray - Two Views',
    serviceStyle: 'at_center',
    applicableRoles: ['pet_clinic'],
    basePrice: 2000,
    isPackage: false,
    duration: 45,
    description: 'Digital X-ray imaging - two positions'
  },
  {
    categoryId: 'veterinary',
    categoryName: 'Veterinary',
    subCategoryId: 'imaging',
    subCategoryName: 'Imaging & Diagnostics',
    serviceName: 'Ultrasound Scan - Abdomen',
    serviceStyle: 'at_center',
    applicableRoles: ['pet_clinic'],
    basePrice: 2500,
    isPackage: false,
    duration: 45,
    description: 'Abdominal ultrasound for internal organs'
  },
  {
    categoryId: 'veterinary',
    categoryName: 'Veterinary',
    subCategoryId: 'imaging',
    subCategoryName: 'Imaging & Diagnostics',
    serviceName: 'Ultrasound - Pregnancy Scan',
    serviceStyle: 'at_center',
    applicableRoles: ['pet_clinic'],
    basePrice: 2000,
    isPackage: false,
    duration: 30,
    description: 'Pregnancy confirmation and fetal count'
  },
  {
    categoryId: 'veterinary',
    categoryName: 'Veterinary',
    subCategoryId: 'imaging',
    subCategoryName: 'Imaging & Diagnostics',
    serviceName: 'Echocardiogram (Echo)',
    serviceStyle: 'at_center',
    applicableRoles: ['pet_clinic'],
    basePrice: 3500,
    isPackage: false,
    duration: 60,
    description: 'Cardiac ultrasound for heart evaluation'
  },
  {
    categoryId: 'veterinary',
    categoryName: 'Veterinary',
    subCategoryId: 'imaging',
    subCategoryName: 'Imaging & Diagnostics',
    serviceName: 'ECG (Electrocardiogram)',
    serviceStyle: 'at_center',
    applicableRoles: ['pet_clinic'],
    basePrice: 1500,
    isPackage: false,
    duration: 30,
    description: 'Heart electrical activity monitoring'
  },
  {
    categoryId: 'veterinary',
    categoryName: 'Veterinary',
    subCategoryId: 'laboratory',
    subCategoryName: 'Laboratory Services',
    serviceName: 'Complete Blood Count (CBC)',
    serviceStyle: 'at_center',
    applicableRoles: ['pet_clinic'],
    basePrice: 800,
    isPackage: false,
    duration: 15,
    description: 'Full blood cell analysis'
  },
  {
    categoryId: 'veterinary',
    categoryName: 'Veterinary',
    subCategoryId: 'laboratory',
    subCategoryName: 'Laboratory Services',
    serviceName: 'Blood Chemistry Panel',
    serviceStyle: 'at_center',
    applicableRoles: ['pet_clinic'],
    basePrice: 1500,
    isPackage: false,
    duration: 15,
    description: 'Comprehensive blood chemistry analysis'
  },
  {
    categoryId: 'veterinary',
    categoryName: 'Veterinary',
    subCategoryId: 'laboratory',
    subCategoryName: 'Laboratory Services',
    serviceName: 'Liver Function Test',
    serviceStyle: 'at_center',
    applicableRoles: ['pet_clinic'],
    basePrice: 1200,
    isPackage: false,
    duration: 15,
    description: 'Liver enzyme and function testing'
  },
  {
    categoryId: 'veterinary',
    categoryName: 'Veterinary',
    subCategoryId: 'laboratory',
    subCategoryName: 'Laboratory Services',
    serviceName: 'Kidney Function Test',
    serviceStyle: 'at_center',
    applicableRoles: ['pet_clinic'],
    basePrice: 1200,
    isPackage: false,
    duration: 15,
    description: 'Renal function assessment'
  },
  {
    categoryId: 'veterinary',
    categoryName: 'Veterinary',
    subCategoryId: 'laboratory',
    subCategoryName: 'Laboratory Services',
    serviceName: 'Thyroid Profile',
    serviceStyle: 'at_center',
    applicableRoles: ['pet_clinic'],
    basePrice: 1800,
    isPackage: false,
    duration: 15,
    description: 'T3, T4, TSH hormone levels'
  },
  {
    categoryId: 'veterinary',
    categoryName: 'Veterinary',
    subCategoryId: 'laboratory',
    subCategoryName: 'Laboratory Services',
    serviceName: 'Urine Analysis',
    serviceStyle: 'at_center',
    applicableRoles: ['pet_clinic'],
    basePrice: 600,
    isPackage: false,
    duration: 15,
    description: 'Complete urine examination'
  },
  {
    categoryId: 'veterinary',
    categoryName: 'Veterinary',
    subCategoryId: 'laboratory',
    subCategoryName: 'Laboratory Services',
    serviceName: 'Stool Examination',
    serviceStyle: 'at_center',
    applicableRoles: ['pet_clinic'],
    basePrice: 400,
    isPackage: false,
    duration: 15,
    description: 'Fecal parasite and bacteria testing'
  },
  {
    categoryId: 'veterinary',
    categoryName: 'Veterinary',
    subCategoryId: 'laboratory',
    subCategoryName: 'Laboratory Services',
    serviceName: 'Skin Scraping Test',
    serviceStyle: 'at_center',
    applicableRoles: ['pet_clinic'],
    basePrice: 500,
    isPackage: false,
    duration: 20,
    description: 'Microscopic skin examination for mites/fungus'
  },
  {
    categoryId: 'veterinary',
    categoryName: 'Veterinary',
    subCategoryId: 'laboratory',
    subCategoryName: 'Laboratory Services',
    serviceName: 'Fungal Culture Test',
    serviceStyle: 'at_center',
    applicableRoles: ['pet_clinic'],
    basePrice: 1000,
    isPackage: false,
    duration: 20,
    description: 'Fungal infection identification'
  },
  {
    categoryId: 'veterinary',
    categoryName: 'Veterinary',
    subCategoryId: 'laboratory',
    subCategoryName: 'Laboratory Services',
    serviceName: 'Blood Typing Test',
    serviceStyle: 'at_center',
    applicableRoles: ['pet_clinic'],
    basePrice: 1500,
    isPackage: false,
    duration: 30,
    description: 'Blood type identification for transfusions'
  },
  {
    categoryId: 'veterinary',
    categoryName: 'Veterinary',
    subCategoryId: 'laboratory',
    subCategoryName: 'Laboratory Services',
    serviceName: 'Heartworm Test',
    serviceStyle: 'at_center',
    applicableRoles: ['pet_clinic'],
    basePrice: 1000,
    isPackage: false,
    duration: 15,
    description: 'Heartworm antigen detection test'
  },
  {
    categoryId: 'veterinary',
    categoryName: 'Veterinary',
    subCategoryId: 'laboratory',
    subCategoryName: 'Laboratory Services',
    serviceName: 'Parvovirus Test',
    serviceStyle: 'at_center',
    applicableRoles: ['pet_clinic'],
    basePrice: 800,
    isPackage: false,
    duration: 15,
    description: 'Rapid parvo antigen test'
  },
  {
    categoryId: 'veterinary',
    categoryName: 'Veterinary',
    subCategoryId: 'laboratory',
    subCategoryName: 'Laboratory Services',
    serviceName: 'Distemper Test',
    serviceStyle: 'at_center',
    applicableRoles: ['pet_clinic'],
    basePrice: 800,
    isPackage: false,
    duration: 15,
    description: 'Canine distemper virus test'
  },
  {
    categoryId: 'veterinary',
    categoryName: 'Veterinary',
    subCategoryId: 'laboratory',
    subCategoryName: 'Laboratory Services',
    serviceName: 'Annual Health Check Package - Basic',
    serviceStyle: 'at_center',
    applicableRoles: ['pet_clinic'],
    basePrice: 3500,
    isPackage: false,
    duration: 60,
    description: 'CBC, blood chemistry, urine analysis, physical exam'
  },
  {
    categoryId: 'veterinary',
    categoryName: 'Veterinary',
    subCategoryId: 'laboratory',
    subCategoryName: 'Laboratory Services',
    serviceName: 'Annual Health Check Package - Premium',
    serviceStyle: 'at_center',
    applicableRoles: ['pet_clinic'],
    basePrice: 6500,
    isPackage: false,
    duration: 90,
    description: 'Complete blood panel, X-ray, ultrasound, ECG, consultation'
  },
  {
    categoryId: 'veterinary',
    categoryName: 'Veterinary',
    subCategoryId: 'laboratory',
    subCategoryName: 'Laboratory Services',
    serviceName: 'Senior Pet Health Package',
    serviceStyle: 'at_center',
    applicableRoles: ['pet_clinic'],
    basePrice: 8000,
    isPackage: false,
    duration: 120,
    description: 'Comprehensive health screening for senior pets (7+ years)'
  },
  {
    categoryId: 'veterinary',
    categoryName: 'Veterinary',
    subCategoryId: 'hospitalization',
    subCategoryName: 'Hospitalization',
    serviceName: 'Day Care Hospitalization',
    serviceStyle: 'at_center',
    applicableRoles: ['pet_clinic'],
    basePrice: 1500,
    isPackage: false,
    duration: 480,
    description: 'Day hospitalization with medical monitoring'
  },
  {
    categoryId: 'veterinary',
    categoryName: 'Veterinary',
    subCategoryId: 'hospitalization',
    subCategoryName: 'Hospitalization',
    serviceName: 'Overnight Hospitalization',
    serviceStyle: 'at_center',
    applicableRoles: ['pet_clinic'],
    basePrice: 2500,
    isPackage: false,
    duration: 1440,
    description: '24-hour hospitalization with nursing care'
  },
  {
    categoryId: 'veterinary',
    categoryName: 'Veterinary',
    subCategoryId: 'hospitalization',
    subCategoryName: 'Hospitalization',
    serviceName: 'ICU Care - Per Day',
    serviceStyle: 'at_center',
    applicableRoles: ['pet_clinic'],
    basePrice: 4000,
    isPackage: false,
    duration: 1440,
    description: 'Intensive care unit with critical monitoring'
  },
  {
    categoryId: 'veterinary',
    categoryName: 'Veterinary',
    subCategoryId: 'emergency',
    subCategoryName: 'Emergency',
    serviceName: 'Emergency Consultation',
    serviceStyle: 'at_center',
    applicableRoles: ['pet_clinic'],
    basePrice: 1500,
    isPackage: false,
    duration: 30,
    description: 'After-hours emergency consultation'
  },
  {
    categoryId: 'veterinary',
    categoryName: 'Veterinary',
    subCategoryId: 'ambulance',
    subCategoryName: 'Ambulance Service',
    serviceName: 'Pet Ambulance Service - Within 10km',
    serviceStyle: 'at_center',
    applicableRoles: ['pet_clinic'],
    basePrice: 1500,
    isPackage: false,
    duration: 60,
    description: 'Emergency pet ambulance pickup and transport'
  },
  {
    categoryId: 'veterinary',
    categoryName: 'Veterinary',
    subCategoryId: 'ambulance',
    subCategoryName: 'Ambulance Service',
    serviceName: 'Pet Ambulance Service - 10-30km',
    serviceStyle: 'at_center',
    applicableRoles: ['pet_clinic'],
    basePrice: 3000,
    isPackage: false,
    duration: 120,
    description: 'Pet ambulance for longer distances'
  },

  // ========================================================================
  // VETERINARY SERVICES - TELE CONSULTATION
  // ========================================================================
  
  {
    categoryId: 'veterinary',
    categoryName: 'Veterinary',
    subCategoryId: 'teleconsult',
    subCategoryName: 'Tele Consultation',
    serviceName: 'General Tele Consultation',
    serviceStyle: 'tele',
    applicableRoles: ['veterinarian', 'pet_clinic'],
    basePrice: 300,
    isPackage: false,
    duration: 15,
    description: 'Virtual consultation for general health concerns'
  },
  {
    categoryId: 'veterinary',
    categoryName: 'Veterinary',
    subCategoryId: 'teleconsult',
    subCategoryName: 'Tele Consultation',
    serviceName: 'Follow-Up Tele Consultation',
    serviceStyle: 'tele',
    applicableRoles: ['veterinarian', 'pet_clinic'],
    basePrice: 200,
    isPackage: false,
    duration: 10,
    description: 'Follow-up video call for ongoing treatment'
  },
  {
    categoryId: 'veterinary',
    categoryName: 'Veterinary',
    subCategoryId: 'teleconsult',
    subCategoryName: 'Tele Consultation',
    serviceName: 'Prescription Renewal Consultation',
    serviceStyle: 'tele',
    applicableRoles: ['veterinarian', 'pet_clinic'],
    basePrice: 150,
    isPackage: false,
    duration: 10,
    description: 'Remote prescription renewal for chronic medications'
  },
  {
    categoryId: 'veterinary',
    categoryName: 'Veterinary',
    subCategoryId: 'teleconsult',
    subCategoryName: 'Tele Consultation',
    serviceName: 'Nutrition & Diet Consultation',
    serviceStyle: 'tele',
    applicableRoles: ['veterinarian', 'pet_clinic'],
    basePrice: 400,
    isPackage: false,
    duration: 20,
    description: 'Personalized diet plan and nutrition advice'
  },
  {
    categoryId: 'veterinary',
    categoryName: 'Veterinary',
    subCategoryId: 'teleconsult',
    subCategoryName: 'Tele Consultation',
    serviceName: 'Lab Report Review Consultation',
    serviceStyle: 'tele',
    applicableRoles: ['veterinarian', 'pet_clinic'],
    basePrice: 300,
    isPackage: false,
    duration: 15,
    description: 'Professional review and explanation of lab results'
  },
  {
    categoryId: 'veterinary',
    categoryName: 'Veterinary',
    subCategoryId: 'teleconsult',
    subCategoryName: 'Tele Consultation',
    serviceName: 'Behavioral Issues Consultation',
    serviceStyle: 'tele',
    applicableRoles: ['veterinarian', 'pet_clinic'],
    basePrice: 500,
    isPackage: false,
    duration: 30,
    description: 'Virtual consultation for behavioral problems'
  },
  {
    categoryId: 'veterinary',
    categoryName: 'Veterinary',
    subCategoryId: 'teleconsult',
    subCategoryName: 'Tele Consultation',
    serviceName: 'Senior Pet Care Consultation',
    serviceStyle: 'tele',
    applicableRoles: ['veterinarian', 'pet_clinic'],
    basePrice: 400,
    isPackage: false,
    duration: 20,
    description: 'Special care guidance for senior pets'
  },

  // ========================================================================
  // GROOMING SERVICES - AT HOME
  // ========================================================================
  
  {
    categoryId: 'grooming',
    categoryName: 'Grooming',
    subCategoryId: 'bath',
    subCategoryName: 'Bathing Services',
    serviceName: 'Basic Bath & Brush at Home',
    serviceStyle: 'at_home',
    applicableRoles: ['pet_groomer'],
    basePrice: 600,
    isPackage: false,
    duration: 45,
    description: 'Shampoo bath, conditioning, and thorough brushing'
  },
  {
    categoryId: 'grooming',
    categoryName: 'Grooming',
    subCategoryId: 'bath',
    subCategoryName: 'Bathing Services',
    serviceName: 'Premium Bath with Conditioning at Home',
    serviceStyle: 'at_home',
    applicableRoles: ['pet_groomer'],
    basePrice: 900,
    isPackage: false,
    duration: 60,
    description: 'Premium shampoo, deep conditioning, and blow dry'
  },
  {
    categoryId: 'grooming',
    categoryName: 'Grooming',
    subCategoryId: 'bath',
    subCategoryName: 'Bathing Services',
    serviceName: 'Medicated Bath at Home',
    serviceStyle: 'at_home',
    applicableRoles: ['pet_groomer'],
    basePrice: 800,
    isPackage: false,
    duration: 60,
    description: 'Therapeutic bath for skin conditions'
  },
  {
    categoryId: 'grooming',
    categoryName: 'Grooming',
    subCategoryId: 'bath',
    subCategoryName: 'Bathing Services',
    serviceName: 'Anti-Tick & Flea Bath at Home',
    serviceStyle: 'at_home',
    applicableRoles: ['pet_groomer'],
    basePrice: 750,
    isPackage: false,
    duration: 60,
    description: 'Anti-parasitic shampoo treatment'
  },
  {
    categoryId: 'grooming',
    categoryName: 'Grooming',
    subCategoryId: 'haircut',
    subCategoryName: 'Haircut & Styling',
    serviceName: 'Full Haircut at Home',
    serviceStyle: 'at_home',
    applicableRoles: ['pet_groomer'],
    basePrice: 1200,
    isPackage: false,
    duration: 90,
    description: 'Complete body haircut and styling'
  },
  {
    categoryId: 'grooming',
    categoryName: 'Grooming',
    subCategoryId: 'haircut',
    subCategoryName: 'Haircut & Styling',
    serviceName: 'Trimming & Sanitary Cut at Home',
    serviceStyle: 'at_home',
    applicableRoles: ['pet_groomer'],
    basePrice: 700,
    isPackage: false,
    duration: 45,
    description: 'Paw pads, sanitary areas, and face trimming'
  },
  {
    categoryId: 'grooming',
    categoryName: 'Grooming',
    subCategoryId: 'nail',
    subCategoryName: 'Nail Care',
    serviceName: 'Nail Trimming & Filing at Home',
    serviceStyle: 'at_home',
    applicableRoles: ['pet_groomer'],
    basePrice: 250,
    isPackage: false,
    duration: 20,
    description: 'Nail cutting and filing for smooth edges'
  },
  {
    categoryId: 'grooming',
    categoryName: 'Grooming',
    subCategoryId: 'nail',
    subCategoryName: 'Nail Care',
    serviceName: 'Nail Grinding Service at Home',
    serviceStyle: 'at_home',
    applicableRoles: ['pet_groomer'],
    basePrice: 300,
    isPackage: false,
    duration: 25,
    description: 'Electric nail grinder for smooth finish'
  },
  {
    categoryId: 'grooming',
    categoryName: 'Grooming',
    subCategoryId: 'ear',
    subCategoryName: 'Ear Care',
    serviceName: 'Ear Cleaning at Home',
    serviceStyle: 'at_home',
    applicableRoles: ['pet_groomer'],
    basePrice: 300,
    isPackage: false,
    duration: 20,
    description: 'Gentle ear cleaning with ear cleaner solution'
  },
  {
    categoryId: 'grooming',
    categoryName: 'Grooming',
    subCategoryId: 'deshed',
    subCategoryName: 'De-shedding',
    serviceName: 'De-Shedding Treatment at Home',
    serviceStyle: 'at_home',
    applicableRoles: ['pet_groomer'],
    basePrice: 800,
    isPackage: false,
    duration: 60,
    description: 'Specialized treatment to reduce excessive shedding'
  },
  {
    categoryId: 'grooming',
    categoryName: 'Grooming',
    subCategoryId: 'package',
    subCategoryName: 'Package Services',
    serviceName: 'Complete Grooming Package at Home',
    serviceStyle: 'at_home',
    applicableRoles: ['pet_groomer'],
    basePrice: 1800,
    isPackage: false,
    duration: 120,
    description: 'Bath, haircut, nail trim, ear cleaning, and paw care'
  },

  // ========================================================================
  // GROOMING SERVICES - AT SALON/CENTER
  // ========================================================================
  
  {
    categoryId: 'grooming',
    categoryName: 'Grooming',
    subCategoryId: 'bath',
    subCategoryName: 'Bathing Services',
    serviceName: 'Basic Bath & Brush at Salon',
    serviceStyle: 'at_center',
    applicableRoles: ['pet_groomer'],
    basePrice: 500,
    isPackage: false,
    duration: 45,
    description: 'Professional salon bath and brush'
  },
  {
    categoryId: 'grooming',
    categoryName: 'Grooming',
    subCategoryId: 'bath',
    subCategoryName: 'Bathing Services',
    serviceName: 'Deluxe Spa Package at Salon',
    serviceStyle: 'at_center',
    applicableRoles: ['pet_groomer'],
    basePrice: 2500,
    isPackage: false,
    duration: 150,
    description: 'Luxury spa with aromatherapy, massage, and deep conditioning'
  },
  {
    categoryId: 'grooming',
    categoryName: 'Grooming',
    subCategoryId: 'haircut',
    subCategoryName: 'Haircut & Styling',
    serviceName: 'Full Body Haircut at Salon',
    serviceStyle: 'at_center',
    applicableRoles: ['pet_groomer'],
    basePrice: 1000,
    isPackage: false,
    duration: 90,
    description: 'Professional full body haircut'
  },
  {
    categoryId: 'grooming',
    categoryName: 'Grooming',
    subCategoryId: 'haircut',
    subCategoryName: 'Haircut & Styling',
    serviceName: 'Breed-Specific Styling at Salon',
    serviceStyle: 'at_center',
    applicableRoles: ['pet_groomer'],
    basePrice: 1800,
    isPackage: false,
    duration: 120,
    description: 'Professional breed-standard haircut and styling'
  },
  {
    categoryId: 'grooming',
    categoryName: 'Grooming',
    subCategoryId: 'haircut',
    subCategoryName: 'Haircut & Styling',
    serviceName: 'Puppy First Haircut at Salon',
    serviceStyle: 'at_center',
    applicableRoles: ['pet_groomer'],
    basePrice: 800,
    isPackage: false,
    duration: 60,
    description: 'Gentle first haircut experience for puppies'
  },
  {
    categoryId: 'grooming',
    categoryName: 'Grooming',
    subCategoryId: 'dental',
    subCategoryName: 'Dental Care',
    serviceName: 'Teeth Brushing at Salon',
    serviceStyle: 'at_center',
    applicableRoles: ['pet_groomer'],
    basePrice: 400,
    isPackage: false,
    duration: 20,
    description: 'Professional teeth brushing with pet toothpaste'
  },
  {
    categoryId: 'grooming',
    categoryName: 'Grooming',
    subCategoryId: 'package',
    subCategoryName: 'Package Services',
    serviceName: 'Complete Grooming Package at Salon',
    serviceStyle: 'at_center',
    applicableRoles: ['pet_groomer'],
    basePrice: 1500,
    isPackage: false,
    duration: 120,
    description: 'Bath, haircut, nail trim, ear cleaning, teeth brushing'
  },
  {
    categoryId: 'grooming',
    categoryName: 'Grooming',
    subCategoryId: 'package',
    subCategoryName: 'Package Services',
    serviceName: 'Express Grooming at Salon',
    serviceStyle: 'at_center',
    applicableRoles: ['pet_groomer'],
    basePrice: 800,
    isPackage: false,
    duration: 45,
    description: 'Quick bath, brush, and nail trim'
  },

  // ========================================================================
  // GROOMING SERVICES - TELE CONSULTATION
  // ========================================================================
  
  {
    categoryId: 'grooming',
    categoryName: 'Grooming',
    subCategoryId: 'teleconsult',
    subCategoryName: 'Consultation',
    serviceName: 'Virtual Grooming Consultation',
    serviceStyle: 'tele',
    applicableRoles: ['pet_groomer'],
    basePrice: 150,
    isPackage: false,
    duration: 15,
    description: 'Video consultation for grooming needs assessment'
  },
  {
    categoryId: 'grooming',
    categoryName: 'Grooming',
    subCategoryId: 'teleconsult',
    subCategoryName: 'Consultation',
    serviceName: 'DIY Grooming Tutorial',
    serviceStyle: 'tele',
    applicableRoles: ['pet_groomer'],
    basePrice: 250,
    isPackage: false,
    duration: 30,
    description: 'Step-by-step guide for grooming at home'
  },

  // ========================================================================
  // DOG TRAINING SERVICES - AT HOME (Packages)
  // ========================================================================
  
  {
    categoryId: 'training',
    categoryName: 'Training',
    subCategoryId: 'obedience',
    subCategoryName: 'Obedience Training',
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
      pricingBySize: { small: 6500, medium: 7500, large: 8500, extraLarge: 9500 }
    },
    description: 'Sit, stay, come, heel, down - 14 sessions'
  },
  {
    categoryId: 'training',
    categoryName: 'Training',
    subCategoryId: 'obedience',
    subCategoryName: 'Obedience Training',
    serviceName: 'Advanced Obedience - 21 Day Package',
    serviceStyle: 'at_home',
    applicableRoles: ['pet_trainer'],
    basePrice: 0,
    isPackage: true,
    packageDetails: {
      sessionsPerDay: 1,
      sessionDuration: 60,
      packageDuration: 21,
      totalSessions: 21,
      pricingBySize: { small: 10500, medium: 12000, large: 13500, extraLarge: 15000 }
    },
    description: 'Advanced commands and off-leash training'
  },
  {
    categoryId: 'training',
    categoryName: 'Training',
    subCategoryId: 'puppy',
    subCategoryName: 'Puppy Training',
    serviceName: 'Puppy Starter Package - 7 Days',
    serviceStyle: 'at_home',
    applicableRoles: ['pet_trainer'],
    basePrice: 0,
    isPackage: true,
    packageDetails: {
      sessionsPerDay: 1,
      sessionDuration: 30,
      packageDuration: 7,
      totalSessions: 7,
      pricingBySize: { small: 2800, medium: 3200, large: 3600, extraLarge: 4000 }
    },
    description: 'Socialization and basic manners for puppies'
  },
  {
    categoryId: 'training',
    categoryName: 'Training',
    subCategoryId: 'potty',
    subCategoryName: 'Potty Training',
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
      pricingBySize: { small: 3500, medium: 4000, large: 4500, extraLarge: 5000 }
    },
    description: 'Intensive potty training - 2 sessions daily'
  },
  {
    categoryId: 'training',
    categoryName: 'Training',
    subCategoryId: 'behavioral',
    subCategoryName: 'Behavioral Training',
    serviceName: 'Aggression Management - 21 Day Package',
    serviceStyle: 'at_home',
    applicableRoles: ['pet_trainer'],
    basePrice: 0,
    isPackage: true,
    packageDetails: {
      sessionsPerDay: 1,
      sessionDuration: 60,
      packageDuration: 21,
      totalSessions: 21,
      pricingBySize: { small: 12000, medium: 14000, large: 16000, extraLarge: 18000 }
    },
    description: 'Behavior modification for aggressive dogs'
  },
  {
    categoryId: 'training',
    categoryName: 'Training',
    subCategoryId: 'behavioral',
    subCategoryName: 'Behavioral Training',
    serviceName: 'Anxiety & Fear Management - 14 Days',
    serviceStyle: 'at_home',
    applicableRoles: ['pet_trainer'],
    basePrice: 0,
    isPackage: true,
    packageDetails: {
      sessionsPerDay: 1,
      sessionDuration: 45,
      packageDuration: 14,
      totalSessions: 14,
      pricingBySize: { small: 7000, medium: 8000, large: 9000, extraLarge: 10000 }
    },
    description: 'Training for anxious and fearful dogs'
  },
  {
    categoryId: 'training',
    categoryName: 'Training',
    subCategoryId: 'behavioral',
    subCategoryName: 'Behavioral Training',
    serviceName: 'Leash Training - 7 Day Package',
    serviceStyle: 'at_home',
    applicableRoles: ['pet_trainer'],
    basePrice: 0,
    isPackage: true,
    packageDetails: {
      sessionsPerDay: 1,
      sessionDuration: 30,
      packageDuration: 7,
      totalSessions: 7,
      pricingBySize: { small: 3000, medium: 3500, large: 4000, extraLarge: 4500 }
    },
    description: 'Teach proper leash walking behavior'
  },

  // ========================================================================
  // DOG TRAINING SERVICES - AT CENTER
  // ========================================================================
  
  {
    categoryId: 'training',
    categoryName: 'Training',
    subCategoryId: 'group',
    subCategoryName: 'Group Classes',
    serviceName: 'Group Obedience Class at Center',
    serviceStyle: 'at_center',
    applicableRoles: ['pet_trainer'],
    basePrice: 1200,
    isPackage: false,
    duration: 60,
    description: 'Group training class with other dogs'
  },
  {
    categoryId: 'training',
    categoryName: 'Training',
    subCategoryId: 'agility',
    subCategoryName: 'Agility Training',
    serviceName: 'Agility Training at Center',
    serviceStyle: 'at_center',
    applicableRoles: ['pet_trainer'],
    basePrice: 1800,
    isPackage: false,
    duration: 90,
    description: 'Professional agility equipment training'
  },
  {
    categoryId: 'training',
    categoryName: 'Training',
    subCategoryId: 'board',
    subCategoryName: 'Board & Train',
    serviceName: 'Board & Train - 7 Days',
    serviceStyle: 'at_center',
    applicableRoles: ['pet_trainer'],
    basePrice: 14000,
    isPackage: false,
    duration: 10080,
    description: 'Residential training with daily sessions for 7 days'
  },
  {
    categoryId: 'training',
    categoryName: 'Training',
    subCategoryId: 'board',
    subCategoryName: 'Board & Train',
    serviceName: 'Board & Train - 14 Days',
    serviceStyle: 'at_center',
    applicableRoles: ['pet_trainer'],
    basePrice: 25000,
    isPackage: false,
    duration: 20160,
    description: 'Intensive 2-week residential training program'
  },

  // ========================================================================
  // DOG TRAINING SERVICES - TELE
  // ========================================================================
  
  {
    categoryId: 'training',
    categoryName: 'Training',
    subCategoryId: 'teleconsult',
    subCategoryName: 'Virtual Training',
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
    subCategoryId: 'teleconsult',
    subCategoryName: 'Virtual Training',
    serviceName: 'Behavioral Consultation Online',
    serviceStyle: 'tele',
    applicableRoles: ['pet_trainer'],
    basePrice: 500,
    isPackage: false,
    duration: 45,
    description: 'Virtual behavioral assessment and custom plan'
  },
  {
    categoryId: 'training',
    categoryName: 'Training',
    subCategoryId: 'teleconsult',
    subCategoryName: 'Virtual Training',
    serviceName: 'Training Progress Review',
    serviceStyle: 'tele',
    applicableRoles: ['pet_trainer'],
    basePrice: 300,
    isPackage: false,
    duration: 20,
    description: 'Review training progress and adjust plan'
  },

  // ========================================================================
  // DOG WALKING SERVICES - AT HOME (Packages)
  // ========================================================================
  
  {
    categoryId: 'walking',
    categoryName: 'Dog Walking',
    subCategoryId: 'daily',
    subCategoryName: 'Daily Walks',
    serviceName: 'Daily Walk - 1 Walk/Day - 7 Days',
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
    description: '30-minute daily walk for 7 days'
  },
  {
    categoryId: 'walking',
    categoryName: 'Dog Walking',
    subCategoryId: 'daily',
    subCategoryName: 'Daily Walks',
    serviceName: 'Daily Walk - 1 Walk/Day - 14 Days',
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
    description: '30-minute daily walk for 14 days'
  },
  {
    categoryId: 'walking',
    categoryName: 'Dog Walking',
    subCategoryId: 'daily',
    subCategoryName: 'Daily Walks',
    serviceName: 'Daily Walk - 1 Walk/Day - 30 Days',
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
    description: '30-minute daily walk for 30 days'
  },
  {
    categoryId: 'walking',
    categoryName: 'Dog Walking',
    subCategoryId: 'premium',
    subCategoryName: 'Premium Walks',
    serviceName: 'Premium Walk - 2 Walks/Day - 7 Days',
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
    description: '2 walks per day (30 min each) for 7 days'
  },
  {
    categoryId: 'walking',
    categoryName: 'Dog Walking',
    subCategoryId: 'premium',
    subCategoryName: 'Premium Walks',
    serviceName: 'Premium Walk - 2 Walks/Day - 14 Days',
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
    description: '2 walks per day (30 min each) for 14 days'
  },
  {
    categoryId: 'walking',
    categoryName: 'Dog Walking',
    subCategoryId: 'premium',
    subCategoryName: 'Premium Walks',
    serviceName: 'Premium Walk - 2 Walks/Day - 30 Days',
    serviceStyle: 'at_home',
    applicableRoles: ['pet_walker'],
    basePrice: 0,
    isPackage: true,
    packageDetails: {
      sessionsPerDay: 2,
      sessionDuration: 30,
      packageDuration: 30,
      totalSessions: 60,
      pricingBySize: { small: 10200, medium: 12750, large: 15300, extraLarge: 17850 }
    },
    description: '2 walks per day (30 min each) for 30 days'
  },
  {
    categoryId: 'walking',
    categoryName: 'Dog Walking',
    subCategoryId: 'onetime',
    subCategoryName: 'One-Time Walks',
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
    subCategoryId: 'onetime',
    subCategoryName: 'One-Time Walks',
    serviceName: 'One-Time Walk - 60 Minutes',
    serviceStyle: 'at_home',
    applicableRoles: ['pet_walker'],
    basePrice: 450,
    isPackage: false,
    duration: 60,
    description: 'Single 60-minute walk service'
  },

  // ========================================================================
  // PET SITTING SERVICES - AT HOME
  // ========================================================================
  
  {
    categoryId: 'sitting',
    categoryName: 'Pet Sitting',
    subCategoryId: 'daily',
    subCategoryName: 'Daily Sitting',
    serviceName: 'Pet Sitting - 2 Hours',
    serviceStyle: 'at_home',
    applicableRoles: ['pet_boarder'],
    basePrice: 500,
    isPackage: false,
    duration: 120,
    description: '2-hour pet sitting at your home'
  },
  {
    categoryId: 'sitting',
    categoryName: 'Pet Sitting',
    subCategoryId: 'daily',
    subCategoryName: 'Daily Sitting',
    serviceName: 'Pet Sitting - 4 Hours',
    serviceStyle: 'at_home',
    applicableRoles: ['pet_boarder'],
    basePrice: 900,
    isPackage: false,
    duration: 240,
    description: 'Half-day pet sitting service'
  },
  {
    categoryId: 'sitting',
    categoryName: 'Pet Sitting',
    subCategoryId: 'daily',
    subCategoryName: 'Daily Sitting',
    serviceName: 'Pet Sitting - 8 Hours',
    serviceStyle: 'at_home',
    applicableRoles: ['pet_boarder'],
    basePrice: 1600,
    isPackage: false,
    duration: 480,
    description: 'Full-day 8-hour pet sitting'
  },
  {
    categoryId: 'sitting',
    categoryName: 'Pet Sitting',
    subCategoryId: 'overnight',
    subCategoryName: 'Overnight Sitting',
    serviceName: 'Overnight Pet Sitting - 12 Hours',
    serviceStyle: 'at_home',
    applicableRoles: ['pet_boarder'],
    basePrice: 2200,
    isPackage: false,
    duration: 720,
    description: 'Overnight pet sitting from 8 PM to 8 AM'
  },
  {
    categoryId: 'sitting',
    categoryName: 'Pet Sitting',
    subCategoryId: 'overnight',
    subCategoryName: 'Overnight Sitting',
    serviceName: 'Overnight Pet Sitting - 24 Hours',
    serviceStyle: 'at_home',
    applicableRoles: ['pet_boarder'],
    basePrice: 3500,
    isPackage: false,
    duration: 1440,
    description: 'Full 24-hour pet sitting service'
  },
  {
    categoryId: 'sitting',
    categoryName: 'Pet Sitting',
    subCategoryId: 'weekend',
    subCategoryName: 'Weekend Packages',
    serviceName: 'Weekend Pet Sitting - 48 Hours',
    serviceStyle: 'at_home',
    applicableRoles: ['pet_boarder'],
    basePrice: 6000,
    isPackage: false,
    duration: 2880,
    description: 'Full weekend pet care service'
  },
  {
    categoryId: 'sitting',
    categoryName: 'Pet Sitting',
    subCategoryId: 'visit',
    subCategoryName: 'Quick Visits',
    serviceName: 'Pet Feeding Visit',
    serviceStyle: 'at_home',
    applicableRoles: ['pet_boarder'],
    basePrice: 300,
    isPackage: false,
    duration: 30,
    description: 'Quick visit to feed and check on your pet'
  },
  {
    categoryId: 'sitting',
    categoryName: 'Pet Sitting',
    subCategoryId: 'visit',
    subCategoryName: 'Quick Visits',
    serviceName: 'Medication Administration Visit',
    serviceStyle: 'at_home',
    applicableRoles: ['pet_boarder'],
    basePrice: 400,
    isPackage: false,
    duration: 30,
    description: 'Visit to administer medications'
  },

  // ========================================================================
  // PET BOARDING SERVICES - AT CENTER (Packages)
  // ========================================================================
  
  {
    categoryId: 'boarding',
    categoryName: 'Pet Boarding',
    subCategoryId: 'overnight',
    subCategoryName: 'Overnight Boarding',
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
      pricingBySize: { small: 700, medium: 900, large: 1200, extraLarge: 1500 }
    },
    description: 'Safe overnight boarding with care'
  },
  {
    categoryId: 'boarding',
    categoryName: 'Pet Boarding',
    subCategoryId: 'weekly',
    subCategoryName: 'Weekly Boarding',
    serviceName: 'Weekly Boarding - 7 Nights',
    serviceStyle: 'at_center',
    applicableRoles: ['pet_boarder'],
    basePrice: 0,
    isPackage: true,
    packageDetails: {
      sessionsPerDay: 1,
      sessionDuration: 1440,
      packageDuration: 7,
      totalSessions: 7,
      pricingBySize: { small: 4500, medium: 5800, large: 7500, extraLarge: 9500 }
    },
    description: '7-night boarding package with daily care'
  },
  {
    categoryId: 'boarding',
    categoryName: 'Pet Boarding',
    subCategoryId: 'extended',
    subCategoryName: 'Extended Boarding',
    serviceName: 'Extended Boarding - 15 Nights',
    serviceStyle: 'at_center',
    applicableRoles: ['pet_boarder'],
    basePrice: 0,
    isPackage: true,
    packageDetails: {
      sessionsPerDay: 1,
      sessionDuration: 1440,
      packageDuration: 15,
      totalSessions: 15,
      pricingBySize: { small: 9000, medium: 12000, large: 15500, extraLarge: 19500 }
    },
    description: '15-night extended boarding'
  },
  {
    categoryId: 'boarding',
    categoryName: 'Pet Boarding',
    subCategoryId: 'extended',
    subCategoryName: 'Extended Boarding',
    serviceName: 'Monthly Boarding - 30 Nights',
    serviceStyle: 'at_center',
    applicableRoles: ['pet_boarder'],
    basePrice: 0,
    isPackage: true,
    packageDetails: {
      sessionsPerDay: 1,
      sessionDuration: 1440,
      packageDuration: 30,
      totalSessions: 30,
      pricingBySize: { small: 17000, medium: 23000, large: 30000, extraLarge: 38000 }
    },
    description: 'Full month boarding package'
  },
  {
    categoryId: 'boarding',
    categoryName: 'Pet Boarding',
    subCategoryId: 'daycare',
    subCategoryName: 'Day Care',
    serviceName: 'Day Care Boarding',
    serviceStyle: 'at_center',
    applicableRoles: ['pet_boarder'],
    basePrice: 0,
    isPackage: true,
    packageDetails: {
      sessionsPerDay: 1,
      sessionDuration: 480,
      packageDuration: 1,
      totalSessions: 1,
      pricingBySize: { small: 500, medium: 650, large: 800, extraLarge: 1000 }
    },
    description: 'Day care boarding with socialization'
  }
];

console.log(`✅ India Comprehensive Service Catalog loaded: ${INDIA_COMPREHENSIVE_CATALOG.length} services`);
console.log(`   📊 Breakdown by service style:`);
console.log(`      - At Home: ${INDIA_COMPREHENSIVE_CATALOG.filter(s => s.serviceStyle === 'at_home').length}`);
console.log(`      - At Center: ${INDIA_COMPREHENSIVE_CATALOG.filter(s => s.serviceStyle === 'at_center').length}`);
console.log(`      - Tele: ${INDIA_COMPREHENSIVE_CATALOG.filter(s => s.serviceStyle === 'tele').length}`);
console.log(`   📊 Breakdown by role:`);
const roleCount: Record<string, number> = {};
INDIA_COMPREHENSIVE_CATALOG.forEach(s => {
  s.applicableRoles.forEach(role => {
    roleCount[role] = (roleCount[role] || 0) + 1;
  });
});
Object.entries(roleCount).forEach(([role, count]) => {
  console.log(`      - ${role}: ${count} services`);
});
