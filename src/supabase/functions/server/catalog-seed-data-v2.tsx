/**
 * COMPREHENSIVE SERVICE CATALOG SEED DATA V2
 * 360° Pet Service Ecosystem - Cradle to Grave Services
 * 
 * ✅ CORRECT ARCHITECTURE:
 * - Seeds services into: platform:service_catalog
 * - Seeds categories into: catalog:categories (structure only, no nested services)
 * - Services reference categoryId, subCategoryId
 * - Services have applicableRoles[] array
 * 
 * ✅ CORRECT ROLE IDs (matching platform roles):
 * - veterinarian, pet_groomer, pet_trainer, pet_walker, pet_boarder, pet_sitter, pet_transporter, pet_photographer
 */

/**
 * CATEGORIES - Organizational structure only
 */
export const SEED_CATEGORIES = [
  // 1. Veterinary & Healthcare
  {
    id: "cat_veterinary",
    icon: "healthcare",
    name: "Veterinary Services",
    status: "active",
    description: "Professional veterinary healthcare services",
    itemCount: 0,
    subCategories: [
      { id: "sub_vet_consultation", name: "Consultation & Checkup", status: "active", description: "General health checkups" },
      { id: "sub_vet_vaccination", name: "Vaccination", status: "active", description: "Vaccines and immunization" },
      { id: "sub_vet_surgery", name: "Surgery & Procedures", status: "active", description: "Surgical interventions" },
      { id: "sub_vet_emergency", name: "Emergency Care", status: "active", description: "24/7 emergency services" },
      { id: "sub_vet_dental", name: "Dental Care", status: "active", description: "Oral health services" }
    ]
  },
  
  // 2. Grooming
  {
    id: "cat_grooming",
    icon: "grooming",
    name: "Grooming Services",
    status: "active",
    description: "Professional pet grooming services",
    itemCount: 0,
    subCategories: [
      { id: "sub_grooming_basic", name: "Basic Grooming", status: "active", description: "Essential grooming" },
      { id: "sub_grooming_full", name: "Full Grooming", status: "active", description: "Complete grooming packages" },
      { id: "sub_grooming_specialty", name: "Specialty Services", status: "active", description: "Premium grooming" }
    ]
  },
  
  // 3. Training
  {
    id: "cat_training",
    icon: "training",
    name: "Training Services",
    status: "active",
    description: "Professional dog training programs",
    itemCount: 0,
    subCategories: [
      { id: "sub_training_basic", name: "Basic Obedience", status: "active", description: "Foundation training" },
      { id: "sub_training_advanced", name: "Advanced Training", status: "active", description: "Specialized training" },
      { id: "sub_training_packages", name: "Training Packages", status: "active", description: "Multi-session programs" }
    ]
  },
  
  // 4. Walking
  {
    id: "cat_walking",
    icon: "walking",
    name: "Pet Walking Services",
    status: "active",
    description: "Professional dog walking services",
    itemCount: 0,
    subCategories: [
      { id: "sub_walking_daily", name: "Daily Walks", status: "active", description: "Regular walking service" },
      { id: "sub_walking_group", name: "Group Walks", status: "active", description: "Social group walking" },
      { id: "sub_walking_packages", name: "Walking Packages", status: "active", description: "Subscription packages" }
    ]
  },
  
  // 5. Boarding & Daycare
  {
    id: "cat_boarding",
    icon: "boarding",
    name: "Boarding & Daycare",
    status: "active",
    description: "Pet boarding and daycare facilities",
    itemCount: 0,
    subCategories: [
      { id: "sub_boarding_daycare", name: "Daycare", status: "active", description: "Daytime supervision" },
      { id: "sub_boarding_overnight", name: "Overnight Boarding", status: "active", description: "Extended stay" },
      { id: "sub_boarding_luxury", name: "Luxury Boarding", status: "active", description: "Premium accommodations" }
    ]
  },
  
  // 6. Pet Sitting
  {
    id: "cat_sitting",
    icon: "sitting",
    name: "Pet Sitting Services",
    status: "active",
    description: "Pet care while you're away",
    itemCount: 0,
    subCategories: [
      { id: "sub_sitting_visits", name: "Home Visits", status: "active", description: "Drop-in care visits" },
      { id: "sub_sitting_overnight", name: "Overnight Care", status: "active", description: "Extended care" }
    ]
  },
  
  // 7. Transport
  {
    id: "cat_transport",
    icon: "transport",
    name: "Pet Transport Services",
    status: "active",
    description: "Safe pet transportation",
    itemCount: 0,
    subCategories: [
      { id: "sub_transport_local", name: "Local Transport", status: "active", description: "Within city" },
      { id: "sub_transport_airport", name: "Airport Transport", status: "active", description: "Airport transfers" },
      { id: "sub_transport_emergency", name: "Emergency Transport", status: "active", description: "Urgent vet transport" }
    ]
  },
  
  // 8. Photography
  {
    id: "cat_photography",
    icon: "photography",
    name: "Pet Photography",
    status: "active",
    description: "Professional pet photography",
    itemCount: 0,
    subCategories: [
      { id: "sub_photo_portrait", name: "Portrait Sessions", status: "active", description: "Studio portraits" },
      { id: "sub_photo_special", name: "Special Occasions", status: "active", description: "Event photography" },
      { id: "sub_photo_outdoor", name: "Outdoor Sessions", status: "active", description: "Natural outdoor photos" }
    ]
  },
  
  // 9. Pet Insurance
  {
    id: "cat_insurance",
    icon: "insurance",
    name: "Pet Insurance",
    status: "active",
    description: "Comprehensive pet insurance coverage & protection plans",
    itemCount: 0,
    subCategories: [
      { id: "sub_insurance_health", name: "Health Insurance", status: "active", description: "Medical & surgical coverage" },
      { id: "sub_insurance_accident", name: "Accident Coverage", status: "active", description: "Accidental injury protection" },
      { id: "sub_insurance_wellness", name: "Wellness Plans", status: "active", description: "Preventive care packages" },
      { id: "sub_insurance_liability", name: "Third-Party Liability", status: "active", description: "Legal liability coverage" },
      { id: "sub_insurance_comprehensive", name: "Comprehensive Plans", status: "active", description: "All-inclusive coverage" }
    ]
  },
  
  // 10. Pet Cafe
  {
    id: "cat_pet_cafe",
    icon: "cafe",
    name: "Pet Cafe Services",
    status: "active",
    description: "Pet-friendly cafe services with reservations and social experiences",
    itemCount: 0,
    subCategories: [
      { id: "sub_cafe_dining", name: "Dining & Treats", status: "active", description: "Food & beverages for pets and owners" },
      { id: "sub_cafe_playtime", name: "Playtime Sessions", status: "active", description: "Supervised play areas" },
      { id: "sub_cafe_events", name: "Special Events", status: "active", description: "Birthday parties & celebrations" },
      { id: "sub_cafe_daycare", name: "Cafe Daycare", status: "active", description: "Extended cafe daycare" }
    ]
  },
  
  // 11. Sunset Services
  {
    id: "cat_sunset_services",
    icon: "sunset",
    name: "Pet Sunset Services",
    status: "active",
    description: "Compassionate end-of-life care, cremation, and memorial services",
    itemCount: 0,
    subCategories: [
      { id: "sub_sunset_cremation", name: "Cremation Services", status: "active", description: "Individual & communal cremation" },
      { id: "sub_sunset_burial", name: "Burial Services", status: "active", description: "Pet cemetery & burial arrangements" },
      { id: "sub_sunset_memorial", name: "Memorial Services", status: "active", description: "Memorial ceremonies & keepsakes" },
      { id: "sub_sunset_transport", name: "Transport Services", status: "active", description: "Dignified pet transportation" },
      { id: "sub_sunset_grief", name: "Grief Support", status: "active", description: "Pet loss counseling" }
    ]
  }
];

/**
 * SERVICES - Stored in platform:service_catalog
 * Clean role IDs: veterinarian, pet_groomer, pet_trainer, pet_walker, pet_boarder, pet_sitter, pet_transporter, pet_photographer
 */
export const SEED_SERVICES = [
  // ========================================
  // VETERINARY SERVICES
  // ========================================
  {
    serviceName: "General Health Checkup",
    categoryId: "cat_veterinary",
    categoryName: "Veterinary Services",
    subCategoryId: "sub_vet_consultation",
    subCategoryName: "Consultation & Checkup",
    serviceStyle: "at_center",
    applicableRoles: ["veterinarian"],
    basePrice: 800,
    duration: 30,
    description: "Comprehensive health examination and consultation",
    isPackage: false
  },
  {
    serviceName: "Vaccination - Rabies",
    categoryId: "cat_veterinary",
    categoryName: "Veterinary Services",
    subCategoryId: "sub_vet_vaccination",
    subCategoryName: "Vaccination",
    serviceStyle: "at_center",
    applicableRoles: ["veterinarian"],
    basePrice: 500,
    duration: 15,
    description: "Rabies vaccination with health certificate",
    isPackage: false
  },
  {
    serviceName: "Vaccination - DHPP (5-in-1)",
    categoryId: "cat_veterinary",
    categoryName: "Veterinary Services",
    subCategoryId: "sub_vet_vaccination",
    subCategoryName: "Vaccination",
    serviceStyle: "at_center",
    applicableRoles: ["veterinarian"],
    basePrice: 1200,
    duration: 20,
    description: "Comprehensive 5-in-1 vaccine for dogs",
    isPackage: false
  },
  {
    serviceName: "Spay/Neuter Surgery",
    categoryId: "cat_veterinary",
    categoryName: "Veterinary Services",
    subCategoryId: "sub_vet_surgery",
    subCategoryName: "Surgery & Procedures",
    serviceStyle: "at_center",
    applicableRoles: ["veterinarian"],
    basePrice: 8000,
    duration: 180,
    description: "Safe spay or neuter surgery with post-op care",
    isPackage: false
  },
  {
    serviceName: "Dental Cleaning & Scaling",
    categoryId: "cat_veterinary",
    categoryName: "Veterinary Services",
    subCategoryId: "sub_vet_dental",
    subCategoryName: "Dental Care",
    serviceStyle: "at_center",
    applicableRoles: ["veterinarian"],
    basePrice: 3500,
    duration: 60,
    description: "Professional dental cleaning under sedation",
    isPackage: false
  },
  {
    serviceName: "Emergency Consultation",
    categoryId: "cat_veterinary",
    categoryName: "Veterinary Services",
    subCategoryId: "sub_vet_emergency",
    subCategoryName: "Emergency Care",
    serviceStyle: "at_center",
    applicableRoles: ["veterinarian"],
    basePrice: 2000,
    duration: 45,
    description: "24/7 emergency veterinary consultation",
    isPackage: false
  },
  {
    serviceName: "Home Visit Consultation",
    categoryId: "cat_veterinary",
    categoryName: "Veterinary Services",
    subCategoryId: "sub_vet_consultation",
    subCategoryName: "Consultation & Checkup",
    serviceStyle: "at_home",
    applicableRoles: ["veterinarian"],
    basePrice: 1500,
    duration: 45,
    description: "Veterinarian visits your home for checkup",
    isPackage: false
  },

  // ========================================
  // GROOMING SERVICES
  // ========================================
  {
    serviceName: "Bath & Brush",
    categoryId: "cat_grooming",
    categoryName: "Grooming Services",
    subCategoryId: "sub_grooming_basic",
    subCategoryName: "Basic Grooming",
    serviceStyle: "at_home",
    applicableRoles: ["pet_groomer"],
    basePrice: 800,
    duration: 45,
    description: "Complete bath with premium shampoo and thorough brushing",
    isPackage: false
  },
  {
    serviceName: "Nail Trimming",
    categoryId: "cat_grooming",
    categoryName: "Grooming Services",
    subCategoryId: "sub_grooming_basic",
    subCategoryName: "Basic Grooming",
    serviceStyle: "at_home",
    applicableRoles: ["pet_groomer"],
    basePrice: 300,
    duration: 15,
    description: "Safe and gentle nail trimming service",
    isPackage: false
  },
  {
    serviceName: "Ear Cleaning",
    categoryId: "cat_grooming",
    categoryName: "Grooming Services",
    subCategoryId: "sub_grooming_basic",
    subCategoryName: "Basic Grooming",
    serviceStyle: "at_home",
    applicableRoles: ["pet_groomer"],
    basePrice: 250,
    duration: 15,
    description: "Gentle ear cleaning to prevent infections",
    isPackage: false
  },
  {
    serviceName: "Full Grooming - Small Breed",
    categoryId: "cat_grooming",
    categoryName: "Grooming Services",
    subCategoryId: "sub_grooming_full",
    subCategoryName: "Full Grooming",
    serviceStyle: "at_home",
    applicableRoles: ["pet_groomer"],
    basePrice: 1500,
    duration: 90,
    description: "Complete grooming: bath, brush, nail trim, ear cleaning, styling",
    isPackage: false
  },
  {
    serviceName: "Full Grooming - Medium Breed",
    categoryId: "cat_grooming",
    categoryName: "Grooming Services",
    subCategoryId: "sub_grooming_full",
    subCategoryName: "Full Grooming",
    serviceStyle: "at_home",
    applicableRoles: ["pet_groomer"],
    basePrice: 2000,
    duration: 120,
    description: "Complete grooming: bath, brush, nail trim, ear cleaning, styling",
    isPackage: false
  },
  {
    serviceName: "Full Grooming - Large Breed",
    categoryId: "cat_grooming",
    categoryName: "Grooming Services",
    subCategoryId: "sub_grooming_full",
    subCategoryName: "Full Grooming",
    serviceStyle: "at_home",
    applicableRoles: ["pet_groomer"],
    basePrice: 2500,
    duration: 150,
    description: "Complete grooming: bath, brush, nail trim, ear cleaning, styling",
    isPackage: false
  },
  {
    serviceName: "De-shedding Treatment",
    categoryId: "cat_grooming",
    categoryName: "Grooming Services",
    subCategoryId: "sub_grooming_specialty",
    subCategoryName: "Specialty Services",
    serviceStyle: "at_home",
    applicableRoles: ["pet_groomer"],
    basePrice: 1200,
    duration: 60,
    description: "Specialized treatment to reduce excessive shedding",
    isPackage: false
  },
  {
    serviceName: "Flea & Tick Treatment",
    categoryId: "cat_grooming",
    categoryName: "Grooming Services",
    subCategoryId: "sub_grooming_specialty",
    subCategoryName: "Specialty Services",
    serviceStyle: "at_home",
    applicableRoles: ["pet_groomer"],
    basePrice: 1000,
    duration: 60,
    description: "Anti-flea and tick treatment bath",
    isPackage: false
  },
  
  // Grooming At-Center
  {
    serviceName: "Salon Bath & Brush",
    categoryId: "cat_grooming",
    categoryName: "Grooming Services",
    subCategoryId: "sub_grooming_basic",
    subCategoryName: "Basic Grooming",
    serviceStyle: "at_center",
    applicableRoles: ["pet_groomer"],
    basePrice: 700,
    duration: 45,
    description: "Professional bath and brush at our salon",
    isPackage: false
  },
  
  // ========================================
  // TRAINING SERVICES
  // ========================================
  {
    serviceName: "Basic Obedience - Single Session",
    categoryId: "cat_training",
    categoryName: "Training Services",
    subCategoryId: "sub_training_basic",
    subCategoryName: "Basic Obedience",
    serviceStyle: "at_home",
    applicableRoles: ["pet_trainer"],
    basePrice: 1500,
    duration: 60,
    description: "Sit, stay, come, heel - foundation commands",
    isPackage: false
  },
  {
    serviceName: "Potty Training Session",
    categoryId: "cat_training",
    categoryName: "Training Services",
    subCategoryId: "sub_training_basic",
    subCategoryName: "Basic Obedience",
    serviceStyle: "at_home",
    applicableRoles: ["pet_trainer"],
    basePrice: 1200,
    duration: 60,
    description: "House training and potty behavior correction",
    isPackage: false
  },
  {
    serviceName: "Behavior Correction Session",
    categoryId: "cat_training",
    categoryName: "Training Services",
    subCategoryId: "sub_training_advanced",
    subCategoryName: "Advanced Training",
    serviceStyle: "at_home",
    applicableRoles: ["pet_trainer"],
    basePrice: 2000,
    duration: 90,
    description: "Address aggression, anxiety, excessive barking",
    isPackage: false
  },
  {
    serviceName: "Agility Training",
    categoryId: "cat_training",
    categoryName: "Training Services",
    subCategoryId: "sub_training_advanced",
    subCategoryName: "Advanced Training",
    serviceStyle: "at_home",
    applicableRoles: ["pet_trainer"],
    basePrice: 1800,
    duration: 60,
    description: "Fun agility exercises and obstacle training",
    isPackage: false
  },
  {
    serviceName: "Puppy Training Package (5 Sessions)",
    categoryId: "cat_training",
    categoryName: "Training Services",
    subCategoryId: "sub_training_packages",
    subCategoryName: "Training Packages",
    serviceStyle: "at_home",
    applicableRoles: ["pet_trainer"],
    basePrice: 6000,
    duration: 300,
    description: "Complete puppy training program - 5 sessions",
    isPackage: true
  },
  {
    serviceName: "Group Basic Obedience Class",
    categoryId: "cat_training",
    categoryName: "Training Services",
    subCategoryId: "sub_training_basic",
    subCategoryName: "Basic Obedience",
    serviceStyle: "at_center",
    applicableRoles: ["pet_trainer"],
    basePrice: 800,
    duration: 60,
    description: "Weekly group class for socialization",
    isPackage: false
  },
  
  // ========================================
  // WALKING SERVICES
  // ========================================
  {
    serviceName: "30-Minute Walk",
    categoryId: "cat_walking",
    categoryName: "Pet Walking Services",
    subCategoryId: "sub_walking_daily",
    subCategoryName: "Daily Walks",
    serviceStyle: "at_home",
    applicableRoles: ["pet_walker"],
    basePrice: 300,
    duration: 30,
    description: "Daily 30-minute neighborhood walk",
    isPackage: false
  },
  {
    serviceName: "60-Minute Walk",
    categoryId: "cat_walking",
    categoryName: "Pet Walking Services",
    subCategoryId: "sub_walking_daily",
    subCategoryName: "Daily Walks",
    serviceStyle: "at_home",
    applicableRoles: ["pet_walker"],
    basePrice: 500,
    duration: 60,
    description: "Extended 1-hour exercise walk",
    isPackage: false
  },
  {
    serviceName: "Group Walk Session",
    categoryId: "cat_walking",
    categoryName: "Pet Walking Services",
    subCategoryId: "sub_walking_group",
    subCategoryName: "Group Walks",
    serviceStyle: "at_home",
    applicableRoles: ["pet_walker"],
    basePrice: 400,
    duration: 45,
    description: "Social group walk with other friendly dogs",
    isPackage: false
  },
  {
    serviceName: "Weekly Walking Package (5 walks)",
    categoryId: "cat_walking",
    categoryName: "Pet Walking Services",
    subCategoryId: "sub_walking_packages",
    subCategoryName: "Walking Packages",
    serviceStyle: "at_home",
    applicableRoles: ["pet_walker"],
    basePrice: 2000,
    duration: 150,
    description: "5 walks per week subscription package",
    isPackage: true
  },
  
  // ========================================
  // BOARDING & DAYCARE SERVICES
  // ========================================
  {
    serviceName: "Full Day Daycare",
    categoryId: "cat_boarding",
    categoryName: "Boarding & Daycare",
    subCategoryId: "sub_boarding_daycare",
    subCategoryName: "Daycare",
    serviceStyle: "at_center",
    applicableRoles: ["pet_boarder"],
    basePrice: 1000,
    duration: 480,
    description: "8-hour supervised daycare with playtime",
    isPackage: false
  },
  {
    serviceName: "Half Day Daycare",
    categoryId: "cat_boarding",
    categoryName: "Boarding & Daycare",
    subCategoryId: "sub_boarding_daycare",
    subCategoryName: "Daycare",
    serviceStyle: "at_center",
    applicableRoles: ["pet_boarder"],
    basePrice: 600,
    duration: 240,
    description: "4-hour supervised daycare",
    isPackage: false
  },
  {
    serviceName: "Overnight Boarding - Standard",
    categoryId: "cat_boarding",
    categoryName: "Boarding & Daycare",
    subCategoryId: "sub_boarding_overnight",
    subCategoryName: "Overnight Boarding",
    serviceStyle: "at_center",
    applicableRoles: ["pet_boarder"],
    basePrice: 1500,
    duration: 1440,
    description: "24-hour boarding with meals and walks",
    isPackage: false
  },
  {
    serviceName: "Overnight Boarding - Premium",
    categoryId: "cat_boarding",
    categoryName: "Boarding & Daycare",
    subCategoryId: "sub_boarding_luxury",
    subCategoryName: "Luxury Boarding",
    serviceStyle: "at_center",
    applicableRoles: ["pet_boarder"],
    basePrice: 2500,
    duration: 1440,
    description: "Luxury suite with premium amenities",
    isPackage: false
  },
  {
    serviceName: "Extended Stay Package (7 nights)",
    categoryId: "cat_boarding",
    categoryName: "Boarding & Daycare",
    subCategoryId: "sub_boarding_overnight",
    subCategoryName: "Overnight Boarding",
    serviceStyle: "at_center",
    applicableRoles: ["pet_boarder"],
    basePrice: 9000,
    duration: 10080,
    description: "Weekly boarding package with discount",
    isPackage: true
  },
  
  // ========================================
  // PET SITTING SERVICES
  // ========================================
  {
    serviceName: "Single Visit - 30 Minutes",
    categoryId: "cat_sitting",
    categoryName: "Pet Sitting Services",
    subCategoryId: "sub_sitting_visits",
    subCategoryName: "Home Visits",
    serviceStyle: "at_home",
    applicableRoles: ["pet_sitter"],
    basePrice: 400,
    duration: 30,
    description: "Feeding, playtime, and basic care",
    isPackage: false
  },
  {
    serviceName: "Single Visit - 60 Minutes",
    categoryId: "cat_sitting",
    categoryName: "Pet Sitting Services",
    subCategoryId: "sub_sitting_visits",
    subCategoryName: "Home Visits",
    serviceStyle: "at_home",
    applicableRoles: ["pet_sitter"],
    basePrice: 700,
    duration: 60,
    description: "Extended care with walk and playtime",
    isPackage: false
  },
  {
    serviceName: "Overnight Pet Sitting",
    categoryId: "cat_sitting",
    categoryName: "Pet Sitting Services",
    subCategoryId: "sub_sitting_overnight",
    subCategoryName: "Overnight Care",
    serviceStyle: "at_home",
    applicableRoles: ["pet_sitter"],
    basePrice: 2500,
    duration: 720,
    description: "Overnight care at your home (8pm-8am)",
    isPackage: false
  },
  {
    serviceName: "24-Hour Pet Sitting",
    categoryId: "cat_sitting",
    categoryName: "Pet Sitting Services",
    subCategoryId: "sub_sitting_overnight",
    subCategoryName: "Overnight Care",
    serviceStyle: "at_home",
    applicableRoles: ["pet_sitter"],
    basePrice: 4000,
    duration: 1440,
    description: "Full day pet sitting service",
    isPackage: false
  },
  
  // ========================================
  // TRANSPORT SERVICES
  // ========================================
  {
    serviceName: "Local Transport - Up to 5km",
    categoryId: "cat_transport",
    categoryName: "Pet Transport Services",
    subCategoryId: "sub_transport_local",
    subCategoryName: "Local Transport",
    serviceStyle: "at_home",
    applicableRoles: ["pet_transporter"],
    basePrice: 500,
    duration: 30,
    description: "Pick up and drop within 5km radius",
    isPackage: false
  },
  {
    serviceName: "Local Transport - Up to 10km",
    categoryId: "cat_transport",
    categoryName: "Pet Transport Services",
    subCategoryId: "sub_transport_local",
    subCategoryName: "Local Transport",
    serviceStyle: "at_home",
    applicableRoles: ["pet_transporter"],
    basePrice: 800,
    duration: 45,
    description: "Pick up and drop within 10km radius",
    isPackage: false
  },
  {
    serviceName: "Local Transport - Up to 20km",
    categoryId: "cat_transport",
    categoryName: "Pet Transport Services",
    subCategoryId: "sub_transport_local",
    subCategoryName: "Local Transport",
    serviceStyle: "at_home",
    applicableRoles: ["pet_transporter"],
    basePrice: 1200,
    duration: 60,
    description: "Pick up and drop within 20km radius",
    isPackage: false
  },
  {
    serviceName: "Airport Pet Transfer",
    categoryId: "cat_transport",
    categoryName: "Pet Transport Services",
    subCategoryId: "sub_transport_airport",
    subCategoryName: "Airport Transport",
    serviceStyle: "at_home",
    applicableRoles: ["pet_transporter"],
    basePrice: 2500,
    duration: 120,
    description: "Safe airport transfer with documentation",
    isPackage: false
  },
  {
    serviceName: "Emergency Vet Transport",
    categoryId: "cat_transport",
    categoryName: "Pet Transport Services",
    subCategoryId: "sub_transport_emergency",
    subCategoryName: "Emergency Transport",
    serviceStyle: "at_home",
    applicableRoles: ["pet_transporter"],
    basePrice: 1500,
    duration: 60,
    description: "Immediate transport to nearest vet clinic",
    isPackage: false
  },
  
  // ========================================
  // PHOTOGRAPHY SERVICES
  // ========================================
  {
    serviceName: "Basic Photo Session",
    categoryId: "cat_photography",
    categoryName: "Pet Photography",
    subCategoryId: "sub_photo_portrait",
    subCategoryName: "Portrait Sessions",
    serviceStyle: "at_home",
    applicableRoles: ["pet_photographer"],
    basePrice: 3000,
    duration: 60,
    description: "1-hour session with 10 edited photos",
    isPackage: false
  },
  {
    serviceName: "Premium Photo Session",
    categoryId: "cat_photography",
    categoryName: "Pet Photography",
    subCategoryId: "sub_photo_portrait",
    subCategoryName: "Portrait Sessions",
    serviceStyle: "at_home",
    applicableRoles: ["pet_photographer"],
    basePrice: 5000,
    duration: 120,
    description: "2-hour session with 25 edited photos and props",
    isPackage: false
  },
  {
    serviceName: "Pet Birthday Photoshoot",
    categoryId: "cat_photography",
    categoryName: "Pet Photography",
    subCategoryId: "sub_photo_special",
    subCategoryName: "Special Occasions",
    serviceStyle: "at_home",
    applicableRoles: ["pet_photographer"],
    basePrice: 4000,
    duration: 90,
    description: "Birthday themed photography with decorations",
    isPackage: false
  },
  {
    serviceName: "Family + Pet Portrait",
    categoryId: "cat_photography",
    categoryName: "Pet Photography",
    subCategoryId: "sub_photo_special",
    subCategoryName: "Special Occasions",
    serviceStyle: "at_home",
    applicableRoles: ["pet_photographer"],
    basePrice: 4500,
    duration: 90,
    description: "Family portraits including your pets",
    isPackage: false
  },
  {
    serviceName: "Outdoor Photo Session",
    categoryId: "cat_photography",
    categoryName: "Pet Photography",
    subCategoryId: "sub_photo_outdoor",
    subCategoryName: "Outdoor Sessions",
    serviceStyle: "at_center",
    applicableRoles: ["pet_photographer"],
    basePrice: 4000,
    duration: 120,
    description: "Outdoor photography at park or beach",
    isPackage: false
  },
  
  // ========================================
  // PET INSURANCE PLANS
  // ========================================
  {
    serviceName: "Basic Health Insurance - Dogs",
    categoryId: "cat_insurance",
    categoryName: "Pet Insurance",
    subCategoryId: "sub_insurance_health",
    subCategoryName: "Health Insurance",
    serviceStyle: "tele",
    applicableRoles: ["pet_insurance"],
    basePrice: 5000,
    duration: 0,
    description: "Annual health coverage up to ₹50,000 - OPD, IPD, Surgery",
    isPackage: true
  },
  {
    serviceName: "Premium Health Insurance - Dogs",
    categoryId: "cat_insurance",
    categoryName: "Pet Insurance",
    subCategoryId: "sub_insurance_health",
    subCategoryName: "Health Insurance",
    serviceStyle: "tele",
    applicableRoles: ["pet_insurance"],
    basePrice: 12000,
    duration: 0,
    description: "Annual health coverage up to ₹2,00,000 - OPD, IPD, Surgery, Emergency",
    isPackage: true
  },
  {
    serviceName: "Gold Health Insurance - Dogs",
    categoryId: "cat_insurance",
    categoryName: "Pet Insurance",
    subCategoryId: "sub_insurance_health",
    subCategoryName: "Health Insurance",
    serviceStyle: "tele",
    applicableRoles: ["pet_insurance"],
    basePrice: 20000,
    duration: 0,
    description: "Annual health coverage up to ₹5,00,000 - All-inclusive with pre-existing conditions",
    isPackage: true
  },
  {
    serviceName: "Basic Health Insurance - Cats",
    categoryId: "cat_insurance",
    categoryName: "Pet Insurance",
    subCategoryId: "sub_insurance_health",
    subCategoryName: "Health Insurance",
    serviceStyle: "tele",
    applicableRoles: ["pet_insurance"],
    basePrice: 4000,
    duration: 0,
    description: "Annual health coverage up to ₹40,000 - OPD, IPD, Surgery",
    isPackage: true
  },
  {
    serviceName: "Premium Health Insurance - Cats",
    categoryId: "cat_insurance",
    categoryName: "Pet Insurance",
    subCategoryId: "sub_insurance_health",
    subCategoryName: "Health Insurance",
    serviceStyle: "tele",
    applicableRoles: ["pet_insurance"],
    basePrice: 10000,
    duration: 0,
    description: "Annual health coverage up to ₹1,50,000 - OPD, IPD, Surgery, Emergency",
    isPackage: true
  },
  {
    serviceName: "Accident Coverage - Basic",
    categoryId: "cat_insurance",
    categoryName: "Pet Insurance",
    subCategoryId: "sub_insurance_accident",
    subCategoryName: "Accident Coverage",
    serviceStyle: "tele",
    applicableRoles: ["pet_insurance"],
    basePrice: 2500,
    duration: 0,
    description: "Annual accident coverage up to ₹30,000 - Fractures, injuries, emergency care",
    isPackage: true
  },
  {
    serviceName: "Accident Coverage - Premium",
    categoryId: "cat_insurance",
    categoryName: "Pet Insurance",
    subCategoryId: "sub_insurance_accident",
    subCategoryName: "Accident Coverage",
    serviceStyle: "tele",
    applicableRoles: ["pet_insurance"],
    basePrice: 5000,
    duration: 0,
    description: "Annual accident coverage up to ₹1,00,000 - All accidents, ambulance, ICU",
    isPackage: true
  },
  {
    serviceName: "Wellness Package - Annual",
    categoryId: "cat_insurance",
    categoryName: "Pet Insurance",
    subCategoryId: "sub_insurance_wellness",
    subCategoryName: "Wellness Plans",
    serviceStyle: "tele",
    applicableRoles: ["pet_insurance"],
    basePrice: 8000,
    duration: 0,
    description: "Preventive care package - Vaccinations, checkups, deworming, grooming credits",
    isPackage: true
  },
  {
    serviceName: "Wellness Package - Premium",
    categoryId: "cat_insurance",
    categoryName: "Pet Insurance",
    subCategoryId: "sub_insurance_wellness",
    subCategoryName: "Wellness Plans",
    serviceStyle: "tele",
    applicableRoles: ["pet_insurance"],
    basePrice: 15000,
    duration: 0,
    description: "Complete wellness - Health checks, vaccines, dental care, nutrition consultation",
    isPackage: true
  },
  {
    serviceName: "Third-Party Liability Insurance",
    categoryId: "cat_insurance",
    categoryName: "Pet Insurance",
    subCategoryId: "sub_insurance_liability",
    subCategoryName: "Third-Party Liability",
    serviceStyle: "tele",
    applicableRoles: ["pet_insurance"],
    basePrice: 3000,
    duration: 0,
    description: "Annual liability coverage up to ₹5,00,000 - Property damage, injury to others",
    isPackage: true
  },
  {
    serviceName: "Comprehensive Insurance - Basic",
    categoryId: "cat_insurance",
    categoryName: "Pet Insurance",
    subCategoryId: "sub_insurance_comprehensive",
    subCategoryName: "Comprehensive Plans",
    serviceStyle: "tele",
    applicableRoles: ["pet_insurance"],
    basePrice: 18000,
    duration: 0,
    description: "All-in-one coverage - Health, Accident, Wellness, Liability up to ₹2,00,000",
    isPackage: true
  },
  {
    serviceName: "Comprehensive Insurance - Premium",
    categoryId: "cat_insurance",
    categoryName: "Pet Insurance",
    subCategoryId: "sub_insurance_comprehensive",
    subCategoryName: "Comprehensive Plans",
    serviceStyle: "tele",
    applicableRoles: ["pet_insurance"],
    basePrice: 35000,
    duration: 0,
    description: "Ultimate protection - Health, Accident, Wellness, Liability up to ₹5,00,000",
    isPackage: true
  },
  {
    serviceName: "Comprehensive Insurance - Gold",
    categoryId: "cat_insurance",
    categoryName: "Pet Insurance",
    subCategoryId: "sub_insurance_comprehensive",
    subCategoryName: "Comprehensive Plans",
    serviceStyle: "tele",
    applicableRoles: ["pet_insurance"],
    basePrice: 50000,
    duration: 0,
    description: "Platinum coverage - Unlimited health, accidents, wellness, global coverage",
    isPackage: true
  },
  
  // ========================================
  // PET CAFE SERVICES
  // ========================================
  {
    serviceName: "Cafe Table Reservation - 2 Pax",
    categoryId: "cat_pet_cafe",
    categoryName: "Pet Cafe Services",
    subCategoryId: "sub_cafe_dining",
    subCategoryName: "Dining & Treats",
    serviceStyle: "at_center",
    applicableRoles: ["pet_cafe"],
    basePrice: 500,
    duration: 120,
    description: "2-hour table reservation for 2 people + 1 pet. Includes complimentary pet treats",
    isPackage: false
  },
  {
    serviceName: "Cafe Table Reservation - 4 Pax",
    categoryId: "cat_pet_cafe",
    categoryName: "Pet Cafe Services",
    subCategoryId: "sub_cafe_dining",
    subCategoryName: "Dining & Treats",
    serviceStyle: "at_center",
    applicableRoles: ["pet_cafe"],
    basePrice: 800,
    duration: 120,
    description: "2-hour table reservation for 4 people + 2 pets. Includes complimentary pet treats",
    isPackage: false
  },
  {
    serviceName: "Puppuccino & Owner Coffee Combo",
    categoryId: "cat_pet_cafe",
    categoryName: "Pet Cafe Services",
    subCategoryId: "sub_cafe_dining",
    subCategoryName: "Dining & Treats",
    serviceStyle: "at_center",
    applicableRoles: ["pet_cafe"],
    basePrice: 350,
    duration: 60,
    description: "Whipped cream puppuccino for your pet + coffee/tea for you",
    isPackage: false
  },
  {
    serviceName: "Pet Birthday Cake & Celebration",
    categoryId: "cat_pet_cafe",
    categoryName: "Pet Cafe Services",
    subCategoryId: "sub_cafe_dining",
    subCategoryName: "Dining & Treats",
    serviceStyle: "at_center",
    applicableRoles: ["pet_cafe"],
    basePrice: 1500,
    duration: 90,
    description: "Pet-safe birthday cake, party hat, photoshoot, and decorations",
    isPackage: false
  },
  {
    serviceName: "Gourmet Pet Meal Combo",
    categoryId: "cat_pet_cafe",
    categoryName: "Pet Cafe Services",
    subCategoryId: "sub_cafe_dining",
    subCategoryName: "Dining & Treats",
    serviceStyle: "at_center",
    applicableRoles: ["pet_cafe"],
    basePrice: 600,
    duration: 60,
    description: "Freshly prepared healthy meal for your pet with owner's meal",
    isPackage: false
  },
  {
    serviceName: "1-Hour Playtime Session",
    categoryId: "cat_pet_cafe",
    categoryName: "Pet Cafe Services",
    subCategoryId: "sub_cafe_playtime",
    subCategoryName: "Playtime Sessions",
    serviceStyle: "at_center",
    applicableRoles: ["pet_cafe"],
    basePrice: 400,
    duration: 60,
    description: "Supervised play area with toys and other friendly pets",
    isPackage: false
  },
  {
    serviceName: "2-Hour Playtime Session",
    categoryId: "cat_pet_cafe",
    categoryName: "Pet Cafe Services",
    subCategoryId: "sub_cafe_playtime",
    subCategoryName: "Playtime Sessions",
    serviceStyle: "at_center",
    applicableRoles: ["pet_cafe"],
    basePrice: 700,
    duration: 120,
    description: "Extended supervised play area session with refreshments",
    isPackage: false
  },
  {
    serviceName: "Puppy Socialization Session",
    categoryId: "cat_pet_cafe",
    categoryName: "Pet Cafe Services",
    subCategoryId: "sub_cafe_playtime",
    subCategoryName: "Playtime Sessions",
    serviceStyle: "at_center",
    applicableRoles: ["pet_cafe"],
    basePrice: 800,
    duration: 90,
    description: "Structured socialization for puppies under 1 year with guided play",
    isPackage: false
  },
  {
    serviceName: "Pet Birthday Party Package",
    categoryId: "cat_pet_cafe",
    categoryName: "Pet Cafe Services",
    subCategoryId: "sub_cafe_events",
    subCategoryName: "Special Events",
    serviceStyle: "at_center",
    applicableRoles: ["pet_cafe"],
    basePrice: 3500,
    duration: 180,
    description: "3-hour party: table for 6, cake, decorations, play area, photoshoot",
    isPackage: true
  },
  {
    serviceName: "Pet Meetup Event - Per Pet",
    categoryId: "cat_pet_cafe",
    categoryName: "Pet Cafe Services",
    subCategoryId: "sub_cafe_events",
    subCategoryName: "Special Events",
    serviceStyle: "at_center",
    applicableRoles: ["pet_cafe"],
    basePrice: 500,
    duration: 120,
    description: "Join our weekend pet meetup event with games and prizes",
    isPackage: false
  },
  {
    serviceName: "Pet Adoption Day Participation",
    categoryId: "cat_pet_cafe",
    categoryName: "Pet Cafe Services",
    subCategoryId: "sub_cafe_events",
    subCategoryName: "Special Events",
    serviceStyle: "at_center",
    applicableRoles: ["pet_cafe"],
    basePrice: 0,
    duration: 180,
    description: "Free entry to adoption events with refreshments for potential adopters",
    isPackage: false
  },
  {
    serviceName: "Full Day Cafe Daycare",
    categoryId: "cat_pet_cafe",
    categoryName: "Pet Cafe Services",
    subCategoryId: "sub_cafe_daycare",
    subCategoryName: "Cafe Daycare",
    serviceStyle: "at_center",
    applicableRoles: ["pet_cafe"],
    basePrice: 1200,
    duration: 480,
    description: "8-hour supervised daycare with play area, meals, and socialization",
    isPackage: false
  },
  {
    serviceName: "Half Day Cafe Daycare",
    categoryId: "cat_pet_cafe",
    categoryName: "Pet Cafe Services",
    subCategoryId: "sub_cafe_daycare",
    subCategoryName: "Cafe Daycare",
    serviceStyle: "at_center",
    applicableRoles: ["pet_cafe"],
    basePrice: 700,
    duration: 240,
    description: "4-hour supervised daycare with play and snacks",
    isPackage: false
  },
  {
    serviceName: "Weekly Cafe Daycare Package (5 days)",
    categoryId: "cat_pet_cafe",
    categoryName: "Pet Cafe Services",
    subCategoryId: "sub_cafe_daycare",
    subCategoryName: "Cafe Daycare",
    serviceStyle: "at_center",
    applicableRoles: ["pet_cafe"],
    basePrice: 5000,
    duration: 2400,
    description: "5 full days of daycare per week with meals and activities",
    isPackage: true
  },
  {
    serviceName: "Premium Cafe Experience - VIP Table",
    categoryId: "cat_pet_cafe",
    categoryName: "Pet Cafe Services",
    subCategoryId: "sub_cafe_dining",
    subCategoryName: "Dining & Treats",
    serviceStyle: "at_center",
    applicableRoles: ["pet_cafe"],
    basePrice: 1500,
    duration: 120,
    description: "VIP corner table, premium meals for owner and pet, dedicated staff",
    isPackage: false
  },
  
  // ========================================
  // SUNSET SERVICES (End-of-Life Care)
  // ========================================
  {
    serviceName: "Individual Pet Cremation",
    categoryId: "cat_sunset_services",
    categoryName: "Pet Sunset Services",
    subCategoryId: "sub_sunset_cremation",
    subCategoryName: "Cremation Services",
    serviceStyle: "at_center",
    applicableRoles: ["sunset_services"],
    basePrice: 8000,
    duration: 240,
    description: "Private cremation with ashes returned in decorative urn",
    isPackage: false
  },
  {
    serviceName: "Communal Pet Cremation",
    categoryId: "cat_sunset_services",
    categoryName: "Pet Sunset Services",
    subCategoryId: "sub_sunset_cremation",
    subCategoryName: "Cremation Services",
    serviceStyle: "at_center",
    applicableRoles: ["sunset_services"],
    basePrice: 3000,
    duration: 120,
    description: "Dignified communal cremation service",
    isPackage: false
  },
  {
    serviceName: "Premium Cremation with Viewing",
    categoryId: "cat_sunset_services",
    categoryName: "Pet Sunset Services",
    subCategoryId: "sub_sunset_cremation",
    subCategoryName: "Cremation Services",
    serviceStyle: "at_center",
    applicableRoles: ["sunset_services"],
    basePrice: 12000,
    duration: 300,
    description: "Private cremation with family viewing, premium urn, paw print keepsake",
    isPackage: false
  },
  {
    serviceName: "Pet Cemetery Burial - Standard Plot",
    categoryId: "cat_sunset_services",
    categoryName: "Pet Sunset Services",
    subCategoryId: "sub_sunset_burial",
    subCategoryName: "Burial Services",
    serviceStyle: "at_center",
    applicableRoles: ["sunset_services"],
    basePrice: 15000,
    duration: 180,
    description: "Individual burial plot in pet cemetery with marker",
    isPackage: false
  },
  {
    serviceName: "Pet Cemetery Burial - Premium Plot",
    categoryId: "cat_sunset_services",
    categoryName: "Pet Sunset Services",
    subCategoryId: "sub_sunset_burial",
    subCategoryName: "Burial Services",
    serviceStyle: "at_center",
    applicableRoles: ["sunset_services"],
    basePrice: 25000,
    duration: 240,
    description: "Premium burial plot with granite headstone and landscaping",
    isPackage: false
  },
  {
    serviceName: "Home Burial Arrangement Service",
    categoryId: "cat_sunset_services",
    categoryName: "Pet Sunset Services",
    subCategoryId: "sub_sunset_burial",
    subCategoryName: "Burial Services",
    serviceStyle: "at_home",
    applicableRoles: ["sunset_services"],
    basePrice: 5000,
    duration: 120,
    description: "Professional assistance for home burial with biodegradable casket",
    isPackage: false
  },
  {
    serviceName: "Memorial Service - Basic",
    categoryId: "cat_sunset_services",
    categoryName: "Pet Sunset Services",
    subCategoryId: "sub_sunset_memorial",
    subCategoryName: "Memorial Services",
    serviceStyle: "at_center",
    applicableRoles: ["sunset_services"],
    basePrice: 4000,
    duration: 90,
    description: "Small memorial gathering with candle lighting ceremony",
    isPackage: false
  },
  {
    serviceName: "Memorial Service - Premium",
    categoryId: "cat_sunset_services",
    categoryName: "Pet Sunset Services",
    subCategoryId: "sub_sunset_memorial",
    subCategoryName: "Memorial Services",
    serviceStyle: "at_center",
    applicableRoles: ["sunset_services"],
    basePrice: 8000,
    duration: 120,
    description: "Memorial ceremony with flowers, photo display, memory book",
    isPackage: false
  },
  {
    serviceName: "Paw Print & Fur Keepsake",
    categoryId: "cat_sunset_services",
    categoryName: "Pet Sunset Services",
    subCategoryId: "sub_sunset_memorial",
    subCategoryName: "Memorial Services",
    serviceStyle: "at_center",
    applicableRoles: ["sunset_services"],
    basePrice: 2500,
    duration: 60,
    description: "Clay paw print impression and fur clipping keepsake in frame",
    isPackage: false
  },
  {
    serviceName: "Custom Memorial Portrait",
    categoryId: "cat_sunset_services",
    categoryName: "Pet Sunset Services",
    subCategoryId: "sub_sunset_memorial",
    subCategoryName: "Memorial Services",
    serviceStyle: "at_center",
    applicableRoles: ["sunset_services"],
    basePrice: 5000,
    duration: 0,
    description: "Hand-painted memorial portrait from photo (delivered in 2 weeks)",
    isPackage: false
  },
  {
    serviceName: "Pet Transport to Crematorium",
    categoryId: "cat_sunset_services",
    categoryName: "Pet Sunset Services",
    subCategoryId: "sub_sunset_transport",
    subCategoryName: "Transport Services",
    serviceStyle: "at_home",
    applicableRoles: ["sunset_services"],
    basePrice: 2000,
    duration: 90,
    description: "Dignified transportation from home to cremation facility",
    isPackage: false
  },
  {
    serviceName: "24/7 Emergency Sunset Transport",
    categoryId: "cat_sunset_services",
    categoryName: "Pet Sunset Services",
    subCategoryId: "sub_sunset_transport",
    subCategoryName: "Transport Services",
    serviceStyle: "at_home",
    applicableRoles: ["sunset_services"],
    basePrice: 3500,
    duration: 60,
    description: "Immediate pickup service available 24/7",
    isPackage: false
  },
  {
    serviceName: "Pet Loss Grief Counseling - Single Session",
    categoryId: "cat_sunset_services",
    categoryName: "Pet Sunset Services",
    subCategoryId: "sub_sunset_grief",
    subCategoryName: "Grief Support",
    serviceStyle: "tele",
    applicableRoles: ["sunset_services"],
    basePrice: 1500,
    duration: 60,
    description: "Professional grief counseling for pet loss (video/phone)",
    isPackage: false
  },
  {
    serviceName: "Pet Loss Support Group - Monthly",
    categoryId: "cat_sunset_services",
    categoryName: "Pet Sunset Services",
    subCategoryId: "sub_sunset_grief",
    subCategoryName: "Grief Support",
    serviceStyle: "tele",
    applicableRoles: ["sunset_services"],
    basePrice: 500,
    duration: 90,
    description: "Monthly online support group for pet loss (free for service customers)",
    isPackage: false
  },
  {
    serviceName: "Rainbow Bridge Memorial Package",
    categoryId: "cat_sunset_services",
    categoryName: "Pet Sunset Services",
    subCategoryId: "sub_sunset_memorial",
    subCategoryName: "Memorial Services",
    serviceStyle: "at_center",
    applicableRoles: ["sunset_services"],
    basePrice: 20000,
    duration: 360,
    description: "Complete package: cremation, memorial service, urn, portrait, grief counseling",
    isPackage: true
  },
  {
    serviceName: "Compassionate Care Complete Package",
    categoryId: "cat_sunset_services",
    categoryName: "Pet Sunset Services",
    subCategoryId: "sub_sunset_cremation",
    subCategoryName: "Cremation Services",
    serviceStyle: "at_center",
    applicableRoles: ["sunset_services"],
    basePrice: 35000,
    duration: 480,
    description: "All-inclusive: transport, viewing, cremation, cemetery plot, memorial, keepsakes",
    isPackage: true
  }
];