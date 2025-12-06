/**
 * SERVICE MICRO-CATEGORIES MASTER DATA
 * 
 * AI-generated sub-categories for different service categories and vendor roles.
 * Only applicable for at_center and at_clinic service styles.
 * 
 * ROLE IDs USED IN SYSTEM:
 * - groomer (Pet Groomer)
 * - veterinary_clinic (Veterinary Clinic)
 * - veterinarian (Veterinarian)
 * - trainer (Pet Trainer)
 * - pet_hotel (Pet Hotel)
 * - boarding (Pet Boarding)
 * - walker (Dog Walker)
 * - sitter (Pet Sitter)
 */

export interface MicroCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  commonDuration: number; // minutes
  priceRange: { min: number; max: number }; // INR
  applicableRoles: string[]; // Which vendor types can offer this
}

export interface CategoryWithMicroCategories {
  category: string;
  categoryLabel: string;
  microCategories: MicroCategory[];
}

/**
 * AI-GENERATED MICRO-CATEGORIES FOR AT_CENTER / AT_CLINIC SERVICES
 */
export const SERVICE_MICRO_CATEGORIES: CategoryWithMicroCategories[] = [
  
  // ============================================
  // GROOMING - 30 Micro-Categories
  // ============================================
  {
    category: 'grooming',
    categoryLabel: 'Grooming',
    microCategories: [
      // Basic Grooming
      {
        id: 'grooming_basic_bath',
        name: 'Basic Bath & Dry',
        description: 'Shampoo, conditioner, blow dry',
        icon: '🛁',
        commonDuration: 60,
        priceRange: { min: 500, max: 1500 },
        applicableRoles: ['groomer', 'pet_cafe', 'pet_boarder']
      },
      {
        id: 'grooming_premium_bath',
        name: 'Premium Spa Bath',
        description: 'Medicated shampoo, conditioner, massage, blow dry',
        icon: '✨',
        commonDuration: 90,
        priceRange: { min: 1000, max: 2500 },
        applicableRoles: ['groomer', 'pet_cafe']
      },
      {
        id: 'grooming_full_service',
        name: 'Full Grooming Package',
        description: 'Bath, haircut, nail trim, ear cleaning, anal gland expression',
        icon: '💇',
        commonDuration: 120,
        priceRange: { min: 1500, max: 3500 },
        applicableRoles: ['groomer']
      },
      
      // Haircuts & Styling
      {
        id: 'grooming_breed_cut',
        name: 'Breed-Specific Cut',
        description: 'Professional breed standard haircut',
        icon: '✂️',
        commonDuration: 90,
        priceRange: { min: 1200, max: 3000 },
        applicableRoles: ['groomer']
      },
      {
        id: 'grooming_puppy_cut',
        name: 'Puppy Cut',
        description: 'Short, even cut all over body',
        icon: '🐶',
        commonDuration: 60,
        priceRange: { min: 800, max: 2000 },
        applicableRoles: ['groomer']
      },
      {
        id: 'grooming_creative_styling',
        name: 'Creative Styling',
        description: 'Custom designs, colors, patterns',
        icon: '🎨',
        commonDuration: 120,
        priceRange: { min: 2000, max: 5000 },
        applicableRoles: ['groomer']
      },
      {
        id: 'grooming_deshedding',
        name: 'De-shedding Treatment',
        description: 'Special treatment to remove excess fur',
        icon: '🌟',
        commonDuration: 90,
        priceRange: { min: 1000, max: 2500 },
        applicableRoles: ['groomer']
      },
      
      // Specialized Grooming
      {
        id: 'grooming_medicated_bath',
        name: 'Medicated Bath',
        description: 'Therapeutic bath for skin conditions',
        icon: '💊',
        commonDuration: 75,
        priceRange: { min: 1200, max: 2800 },
        applicableRoles: ['groomer', 'veterinary_clinic']
      },
      {
        id: 'grooming_flea_tick',
        name: 'Flea & Tick Treatment',
        description: 'Specialized bath and treatment',
        icon: '🦟',
        commonDuration: 90,
        priceRange: { min: 1500, max: 3000 },
        applicableRoles: ['groomer', 'veterinary_clinic']
      },
      {
        id: 'grooming_skin_treatment',
        name: 'Skin Treatment Package',
        description: 'Oatmeal bath, moisturizing, hot oil treatment',
        icon: '🧴',
        commonDuration: 120,
        priceRange: { min: 1800, max: 3500 },
        applicableRoles: ['groomer', 'veterinary_clinic']
      },
      
      // Nail Care
      {
        id: 'grooming_nail_trim',
        name: 'Nail Trimming',
        description: 'Basic nail clipping and filing',
        icon: '💅',
        commonDuration: 20,
        priceRange: { min: 200, max: 500 },
        applicableRoles: ['groomer', 'veterinary_clinic', 'pet_cafe']
      },
      {
        id: 'grooming_nail_grinding',
        name: 'Nail Grinding & Polish',
        description: 'Dremel grinding, polish, paw balm',
        icon: '✨',
        commonDuration: 30,
        priceRange: { min: 400, max: 800 },
        applicableRoles: ['groomer']
      },
      
      // Ear & Eye Care
      {
        id: 'grooming_ear_cleaning',
        name: 'Ear Cleaning',
        description: 'Professional ear cleaning and inspection',
        icon: '👂',
        commonDuration: 15,
        priceRange: { min: 200, max: 500 },
        applicableRoles: ['groomer', 'veterinary_clinic']
      },
      {
        id: 'grooming_eye_cleaning',
        name: 'Eye Cleaning & Tear Stain Removal',
        description: 'Gentle eye area cleaning',
        icon: '👁️',
        commonDuration: 15,
        priceRange: { min: 200, max: 500 },
        applicableRoles: ['groomer', 'veterinary_clinic']
      },
      
      // Dental Care
      {
        id: 'grooming_teeth_brushing',
        name: 'Teeth Brushing',
        description: 'Basic dental hygiene',
        icon: '🦷',
        commonDuration: 20,
        priceRange: { min: 300, max: 700 },
        applicableRoles: ['groomer', 'veterinary_clinic']
      },
      {
        id: 'grooming_dental_scaling',
        name: 'Dental Scaling (Non-Anesthetic)',
        description: 'Professional teeth scaling without anesthesia',
        icon: '🦷',
        commonDuration: 45,
        priceRange: { min: 1500, max: 3500 },
        applicableRoles: ['veterinary_clinic']
      },
      
      // Cat-Specific Grooming
      {
        id: 'grooming_cat_bath',
        name: 'Cat Bath & Dry',
        description: 'Specialized cat grooming',
        icon: '🐱',
        commonDuration: 60,
        priceRange: { min: 800, max: 2000 },
        applicableRoles: ['groomer', 'pet_cafe']
      },
      {
        id: 'grooming_cat_lion_cut',
        name: 'Cat Lion Cut',
        description: 'Full body shave with mane',
        icon: '🦁',
        commonDuration: 90,
        priceRange: { min: 1500, max: 3000 },
        applicableRoles: ['groomer']
      },
      
      // Specialized Treatments
      {
        id: 'grooming_aromatherapy',
        name: 'Aromatherapy Spa',
        description: 'Calming aromatherapy session',
        icon: '🌸',
        commonDuration: 60,
        priceRange: { min: 1200, max: 2500 },
        applicableRoles: ['groomer', 'pet_cafe']
      },
      {
        id: 'grooming_paw_treatment',
        name: 'Paw Pad Treatment',
        description: 'Moisturizing paw treatment',
        icon: '🐾',
        commonDuration: 30,
        priceRange: { min: 400, max: 800 },
        applicableRoles: ['groomer']
      },
      {
        id: 'grooming_anal_gland',
        name: 'Anal Gland Expression',
        description: 'Manual anal gland expression',
        icon: '💉',
        commonDuration: 15,
        priceRange: { min: 300, max: 600 },
        applicableRoles: ['groomer', 'veterinary_clinic', 'veterinarian']
      }
    ]
  },

  // ============================================
  // VETERINARY - 40 Micro-Categories
  // ============================================
  {
    category: 'veterinary',
    categoryLabel: 'Veterinary',
    microCategories: [
      // General Consultations
      {
        id: 'vet_general_consultation',
        name: 'General Health Consultation',
        description: 'Routine check-up and health assessment',
        icon: '🩺',
        commonDuration: 30,
        priceRange: { min: 500, max: 1500 },
        applicableRoles: ['veterinarian', 'veterinary_clinic']
      },
      {
        id: 'vet_wellness_exam',
        name: 'Annual Wellness Exam',
        description: 'Comprehensive yearly health check',
        icon: '📋',
        commonDuration: 45,
        priceRange: { min: 1000, max: 2500 },
        applicableRoles: ['veterinarian', 'veterinary_clinic']
      },
      {
        id: 'vet_puppy_checkup',
        name: 'Puppy/Kitten First Visit',
        description: 'Initial health screening for young pets',
        icon: '🐶',
        commonDuration: 45,
        priceRange: { min: 800, max: 2000 },
        applicableRoles: ['veterinarian', 'veterinary_clinic']
      },
      {
        id: 'vet_senior_checkup',
        name: 'Senior Pet Health Check',
        description: 'Geriatric health assessment',
        icon: '👴',
        commonDuration: 60,
        priceRange: { min: 1500, max: 3000 },
        applicableRoles: ['veterinarian', 'veterinary_clinic']
      },
      
      // Vaccinations
      {
        id: 'vet_vaccination_rabies',
        name: 'Rabies Vaccination',
        description: 'Rabies vaccine administration',
        icon: '💉',
        commonDuration: 15,
        priceRange: { min: 300, max: 800 },
        applicableRoles: ['veterinarian', 'veterinary_clinic']
      },
      {
        id: 'vet_vaccination_dhpp',
        name: 'DHPP Vaccination (Dogs)',
        description: 'Distemper, hepatitis, parvo, parainfluenza',
        icon: '💉',
        commonDuration: 15,
        priceRange: { min: 500, max: 1200 },
        applicableRoles: ['veterinarian', 'veterinary_clinic']
      },
      {
        id: 'vet_vaccination_fvrcp',
        name: 'FVRCP Vaccination (Cats)',
        description: 'Feline viral rhinotracheitis, calicivirus, panleukopenia',
        icon: '💉',
        commonDuration: 15,
        priceRange: { min: 500, max: 1200 },
        applicableRoles: ['veterinarian', 'veterinary_clinic']
      },
      {
        id: 'vet_vaccination_bordetella',
        name: 'Bordetella (Kennel Cough)',
        description: 'Kennel cough prevention',
        icon: '💉',
        commonDuration: 15,
        priceRange: { min: 400, max: 1000 },
        applicableRoles: ['veterinarian', 'veterinary_clinic']
      },
      {
        id: 'vet_vaccination_leptospirosis',
        name: 'Leptospirosis Vaccination',
        description: 'Protection against leptospirosis',
        icon: '💉',
        commonDuration: 15,
        priceRange: { min: 500, max: 1200 },
        applicableRoles: ['veterinarian', 'veterinary_clinic']
      },
      
      // Preventive Care
      {
        id: 'vet_deworming',
        name: 'Deworming Treatment',
        description: 'Intestinal parasite treatment',
        icon: '💊',
        commonDuration: 20,
        priceRange: { min: 300, max: 800 },
        applicableRoles: ['veterinarian', 'veterinary_clinic']
      },
      {
        id: 'vet_tick_flea_prevention',
        name: 'Tick & Flea Prevention',
        description: 'Topical/oral preventive treatment',
        icon: '🦟',
        commonDuration: 15,
        priceRange: { min: 500, max: 1500 },
        applicableRoles: ['veterinarian', 'veterinary_clinic']
      },
      {
        id: 'vet_heartworm_test',
        name: 'Heartworm Testing',
        description: 'Blood test for heartworm detection',
        icon: '❤️',
        commonDuration: 20,
        priceRange: { min: 800, max: 2000 },
        applicableRoles: ['veterinarian', 'veterinary_clinic']
      },
      
      // Diagnostics
      {
        id: 'vet_blood_test_basic',
        name: 'Basic Blood Test (CBC)',
        description: 'Complete blood count analysis',
        icon: '🔬',
        commonDuration: 30,
        priceRange: { min: 1000, max: 2500 },
        applicableRoles: ['veterinarian', 'veterinary_clinic']
      },
      {
        id: 'vet_blood_test_comprehensive',
        name: 'Comprehensive Blood Panel',
        description: 'CBC + biochemistry + electrolytes',
        icon: '🔬',
        commonDuration: 45,
        priceRange: { min: 2500, max: 5000 },
        applicableRoles: ['veterinarian', 'veterinary_clinic']
      },
      {
        id: 'vet_urine_analysis',
        name: 'Urinalysis',
        description: 'Urine sample testing',
        icon: '🧪',
        commonDuration: 30,
        priceRange: { min: 800, max: 1500 },
        applicableRoles: ['veterinarian', 'veterinary_clinic']
      },
      {
        id: 'vet_fecal_exam',
        name: 'Fecal Examination',
        description: 'Stool sample analysis',
        icon: '🔬',
        commonDuration: 30,
        priceRange: { min: 500, max: 1200 },
        applicableRoles: ['veterinarian', 'veterinary_clinic']
      },
      {
        id: 'vet_xray',
        name: 'X-Ray Imaging',
        description: 'Radiographic examination',
        icon: '📸',
        commonDuration: 45,
        priceRange: { min: 1500, max: 4000 },
        applicableRoles: ['veterinary_clinic']
      },
      {
        id: 'vet_ultrasound',
        name: 'Ultrasound Scan',
        description: 'Abdominal/cardiac ultrasound',
        icon: '🔊',
        commonDuration: 60,
        priceRange: { min: 2500, max: 6000 },
        applicableRoles: ['veterinary_clinic']
      },
      
      // Dental Services
      {
        id: 'vet_dental_exam',
        name: 'Dental Examination',
        description: 'Oral health assessment',
        icon: '🦷',
        commonDuration: 30,
        priceRange: { min: 500, max: 1200 },
        applicableRoles: ['veterinarian', 'veterinary_clinic']
      },
      {
        id: 'vet_dental_cleaning',
        name: 'Professional Dental Cleaning',
        description: 'Anesthetic dental scaling and polishing',
        icon: '🦷',
        commonDuration: 120,
        priceRange: { min: 3500, max: 8000 },
        applicableRoles: ['veterinary_clinic']
      },
      {
        id: 'vet_tooth_extraction',
        name: 'Tooth Extraction',
        description: 'Surgical tooth removal',
        icon: '🦷',
        commonDuration: 90,
        priceRange: { min: 2000, max: 5000 },
        applicableRoles: ['veterinary_clinic']
      },
      
      // Minor Procedures
      {
        id: 'vet_wound_treatment',
        name: 'Wound Care & Dressing',
        description: 'Wound cleaning and bandaging',
        icon: '🩹',
        commonDuration: 30,
        priceRange: { min: 500, max: 1500 },
        applicableRoles: ['veterinarian', 'veterinary_clinic']
      },
      {
        id: 'vet_suture_removal',
        name: 'Suture Removal',
        description: 'Post-surgical stitch removal',
        icon: '✂️',
        commonDuration: 15,
        priceRange: { min: 300, max: 800 },
        applicableRoles: ['veterinarian', 'veterinary_clinic']
      },
      {
        id: 'vet_abscess_treatment',
        name: 'Abscess Drainage',
        description: 'Lancing and draining abscess',
        icon: '💉',
        commonDuration: 45,
        priceRange: { min: 1500, max: 3500 },
        applicableRoles: ['veterinarian', 'veterinary_clinic']
      },
      
      // Surgical Services
      {
        id: 'vet_spay_dog',
        name: 'Spay Surgery (Female Dog)',
        description: 'Ovariohysterectomy',
        icon: '🔪',
        commonDuration: 120,
        priceRange: { min: 5000, max: 12000 },
        applicableRoles: ['veterinary_clinic']
      },
      {
        id: 'vet_neuter_dog',
        name: 'Neuter Surgery (Male Dog)',
        description: 'Castration',
        icon: '🔪',
        commonDuration: 90,
        priceRange: { min: 3500, max: 8000 },
        applicableRoles: ['veterinary_clinic']
      },
      {
        id: 'vet_spay_cat',
        name: 'Spay Surgery (Female Cat)',
        description: 'Feline ovariohysterectomy',
        icon: '🔪',
        commonDuration: 90,
        priceRange: { min: 3000, max: 7000 },
        applicableRoles: ['veterinary_clinic']
      },
      {
        id: 'vet_neuter_cat',
        name: 'Neuter Surgery (Male Cat)',
        description: 'Feline castration',
        icon: '🔪',
        commonDuration: 60,
        priceRange: { min: 2500, max: 5000 },
        applicableRoles: ['veterinary_clinic']
      },
      
      // Emergency Care
      {
        id: 'vet_emergency_consultation',
        name: 'Emergency Consultation',
        description: 'Urgent care consultation',
        icon: '🚨',
        commonDuration: 60,
        priceRange: { min: 2000, max: 5000 },
        applicableRoles: ['veterinarian', 'veterinary_clinic', 'ambulance_service']
      },
      {
        id: 'vet_iv_fluids',
        name: 'IV Fluid Therapy',
        description: 'Intravenous fluid administration',
        icon: '💧',
        commonDuration: 120,
        priceRange: { min: 1500, max: 4000 },
        applicableRoles: ['veterinary_clinic']
      },
      
      // Specialized Services
      {
        id: 'vet_skin_allergy_test',
        name: 'Allergy Testing',
        description: 'Skin or blood allergy panel',
        icon: '🔬',
        commonDuration: 60,
        priceRange: { min: 3000, max: 8000 },
        applicableRoles: ['veterinary_clinic']
      },
      {
        id: 'vet_microchipping',
        name: 'Microchip Implantation',
        description: 'Permanent pet identification',
        icon: '📱',
        commonDuration: 15,
        priceRange: { min: 800, max: 2000 },
        applicableRoles: ['veterinarian', 'veterinary_clinic']
      }
    ]
  },

  // ============================================
  // TRAINING - 25 Micro-Categories
  // ============================================
  {
    category: 'training',
    categoryLabel: 'Training',
    microCategories: [
      // Puppy Training
      {
        id: 'training_puppy_basic',
        name: 'Puppy Kindergarten',
        description: 'Socialization and basic commands',
        icon: '🐕',
        commonDuration: 60,
        priceRange: { min: 1500, max: 3000 },
        applicableRoles: ['trainer']
      },
      {
        id: 'training_puppy_potty',
        name: 'Potty Training',
        description: 'House training program',
        icon: '🚽',
        commonDuration: 45,
        priceRange: { min: 1000, max: 2500 },
        applicableRoles: ['trainer']
      },
      {
        id: 'training_puppy_socialization',
        name: 'Puppy Socialization Class',
        description: 'Group socialization sessions',
        icon: '👥',
        commonDuration: 90,
        priceRange: { min: 1200, max: 2500 },
        applicableRoles: ['trainer']
      },
      
      // Basic Obedience
      {
        id: 'training_basic_obedience',
        name: 'Basic Obedience Training',
        description: 'Sit, stay, come, down, heel',
        icon: '📚',
        commonDuration: 60,
        priceRange: { min: 1500, max: 3500 },
        applicableRoles: ['trainer']
      },
      {
        id: 'training_advanced_obedience',
        name: 'Advanced Obedience',
        description: 'Off-leash control, distance commands',
        icon: '🎓',
        commonDuration: 75,
        priceRange: { min: 2000, max: 4000 },
        applicableRoles: ['trainer']
      },
      
      // Behavioral Training
      {
        id: 'training_leash_pulling',
        name: 'Leash Manners Training',
        description: 'Stop pulling, loose leash walking',
        icon: '🦮',
        commonDuration: 60,
        priceRange: { min: 1500, max: 3000 },
        applicableRoles: ['trainer']
      },
      {
        id: 'training_separation_anxiety',
        name: 'Separation Anxiety Program',
        description: 'Reduce stress when alone',
        icon: '😰',
        commonDuration: 90,
        priceRange: { min: 2500, max: 5000 },
        applicableRoles: ['trainer']
      },
      {
        id: 'training_aggression',
        name: 'Aggression Modification',
        description: 'Manage aggressive behaviors',
        icon: '⚠️',
        commonDuration: 90,
        priceRange: { min: 3000, max: 6000 },
        applicableRoles: ['trainer']
      },
      {
        id: 'training_fear_anxiety',
        name: 'Fear & Anxiety Management',
        description: 'Build confidence, reduce fear',
        icon: '😟',
        commonDuration: 75,
        priceRange: { min: 2000, max: 4500 },
        applicableRoles: ['trainer']
      },
      {
        id: 'training_barking',
        name: 'Excessive Barking Control',
        description: 'Reduce unwanted barking',
        icon: '🔊',
        commonDuration: 60,
        priceRange: { min: 1500, max: 3000 },
        applicableRoles: ['trainer']
      },
      {
        id: 'training_jumping',
        name: 'No Jumping Training',
        description: 'Stop jumping on people',
        icon: '🦘',
        commonDuration: 45,
        priceRange: { min: 1200, max: 2500 },
        applicableRoles: ['trainer']
      },
      
      // Specialized Training
      {
        id: 'training_therapy_dog',
        name: 'Therapy Dog Certification',
        description: 'Therapy dog preparation',
        icon: '❤️',
        commonDuration: 120,
        priceRange: { min: 5000, max: 10000 },
        applicableRoles: ['trainer']
      },
      {
        id: 'training_service_dog',
        name: 'Service Dog Training',
        description: 'Task-specific service work',
        icon: '🦮',
        commonDuration: 120,
        priceRange: { min: 8000, max: 15000 },
        applicableRoles: ['trainer']
      },
      {
        id: 'training_agility',
        name: 'Agility Training',
        description: 'Obstacle course navigation',
        icon: '🏃',
        commonDuration: 90,
        priceRange: { min: 2000, max: 4000 },
        applicableRoles: ['trainer']
      },
      {
        id: 'training_scent_work',
        name: 'Scent Detection Training',
        description: 'Nose work and tracking',
        icon: '👃',
        commonDuration: 75,
        priceRange: { min: 2500, max: 5000 },
        applicableRoles: ['trainer']
      },
      {
        id: 'training_protection',
        name: 'Protection Training',
        description: 'Guard and protection work',
        icon: '🛡️',
        commonDuration: 90,
        priceRange: { min: 4000, max: 8000 },
        applicableRoles: ['trainer']
      },
      
      // Cat Training
      {
        id: 'training_cat_litter',
        name: 'Cat Litter Box Training',
        description: 'Proper litter box habits',
        icon: '🐱',
        commonDuration: 45,
        priceRange: { min: 1000, max: 2000 },
        applicableRoles: ['trainer']
      },
      {
        id: 'training_cat_scratching',
        name: 'Cat Scratching Redirection',
        description: 'Appropriate scratching behavior',
        icon: '🪵',
        commonDuration: 60,
        priceRange: { min: 1200, max: 2500 },
        applicableRoles: ['trainer']
      },
      
      // Group Classes
      {
        id: 'training_group_basic',
        name: 'Group Basic Training Class',
        description: 'Group obedience sessions',
        icon: '👥',
        commonDuration: 90,
        priceRange: { min: 1000, max: 2000 },
        applicableRoles: ['trainer']
      },
      {
        id: 'training_trick_class',
        name: 'Trick Training Workshop',
        description: 'Fun tricks and commands',
        icon: '🎪',
        commonDuration: 60,
        priceRange: { min: 1200, max: 2500 },
        applicableRoles: ['trainer']
      }
    ]
  },

  // ============================================
  // BOARDING - 15 Micro-Categories
  // ============================================
  {
    category: 'boarding',
    categoryLabel: 'Boarding & Daycare',
    microCategories: [
      {
        id: 'boarding_standard_day',
        name: 'Standard Daycare (Full Day)',
        description: 'Supervised daycare with playtime',
        icon: '🏠',
        commonDuration: 480, // 8 hours
        priceRange: { min: 500, max: 1500 },
        applicableRoles: ['boarding', 'pet_cafe', 'pet_hotel']
      },
      {
        id: 'boarding_premium_day',
        name: 'Premium Daycare',
        description: 'Enhanced care with activities',
        icon: '⭐',
        commonDuration: 480,
        priceRange: { min: 1000, max: 2500 },
        applicableRoles: ['boarding', 'pet_cafe', 'pet_hotel']
      },
      {
        id: 'boarding_overnight',
        name: 'Overnight Boarding',
        description: 'Overnight stay with meals',
        icon: '🌙',
        commonDuration: 1440, // 24 hours
        priceRange: { min: 1000, max: 3000 },
        applicableRoles: ['boarding', 'pet_hotel']
      },
      {
        id: 'boarding_luxury_suite',
        name: 'Luxury Suite Boarding',
        description: 'Private suite with premium amenities',
        icon: '👑',
        commonDuration: 1440,
        priceRange: { min: 2500, max: 6000 },
        applicableRoles: ['pet_hotel']
      },
      {
        id: 'boarding_group_play',
        name: 'Group Playcare',
        description: 'Socialization with other pets',
        icon: '🎾',
        commonDuration: 240,
        priceRange: { min: 600, max: 1500 },
        applicableRoles: ['boarding', 'pet_cafe']
      },
      {
        id: 'boarding_puppy_daycare',
        name: 'Puppy Daycare',
        description: 'Special care for puppies',
        icon: '🐶',
        commonDuration: 480,
        priceRange: { min: 800, max: 2000 },
        applicableRoles: ['boarding', 'pet_cafe']
      },
      {
        id: 'boarding_senior_care',
        name: 'Senior Pet Care',
        description: 'Specialized care for older pets',
        icon: '👴',
        commonDuration: 480,
        priceRange: { min: 1200, max: 2800 },
        applicableRoles: ['boarding', 'pet_hotel']
      },
      {
        id: 'boarding_medical_care',
        name: 'Medical Boarding',
        description: 'Boarding with medication administration',
        icon: '💊',
        commonDuration: 1440,
        priceRange: { min: 1500, max: 4000 },
        applicableRoles: ['veterinary_clinic', 'boarding']
      }
    ]
  },

  // ============================================
  // WELLNESS - 20 Micro-Categories
  // ============================================
  {
    category: 'wellness',
    categoryLabel: 'Wellness & Spa',
    microCategories: [
      {
        id: 'wellness_massage',
        name: 'Pet Massage Therapy',
        description: 'Therapeutic massage session',
        icon: '💆',
        commonDuration: 60,
        priceRange: { min: 1200, max: 2500 },
        applicableRoles: ['groomer', 'pet_cafe', 'veterinary_clinic']
      },
      {
        id: 'wellness_hydrotherapy',
        name: 'Hydrotherapy Session',
        description: 'Water-based rehabilitation',
        icon: '🏊',
        commonDuration: 45,
        priceRange: { min: 1500, max: 3500 },
        applicableRoles: ['veterinary_clinic', 'groomer']
      },
      {
        id: 'wellness_acupuncture',
        name: 'Pet Acupuncture',
        description: 'Traditional Chinese veterinary medicine',
        icon: '🎯',
        commonDuration: 60,
        priceRange: { min: 2000, max: 4000 },
        applicableRoles: ['veterinary_clinic']
      },
      {
        id: 'wellness_physiotherapy',
        name: 'Physiotherapy Session',
        description: 'Physical rehabilitation therapy',
        icon: '🏋️',
        commonDuration: 60,
        priceRange: { min: 1500, max: 3500 },
        applicableRoles: ['veterinary_clinic']
      },
      {
        id: 'wellness_aromatherapy',
        name: 'Aromatherapy Treatment',
        description: 'Calming aromatherapy session',
        icon: '🌸',
        commonDuration: 45,
        priceRange: { min: 1000, max: 2000 },
        applicableRoles: ['groomer', 'pet_cafe']
      },
      {
        id: 'wellness_nutrition_consult',
        name: 'Nutrition Consultation',
        description: 'Diet and nutrition planning',
        icon: '🥗',
        commonDuration: 45,
        priceRange: { min: 1000, max: 2500 },
        applicableRoles: ['veterinarian', 'veterinary_clinic']
      }
    ]
  }
];

/**
 * Get micro-categories for a specific service category and vendor role
 */
export function getMicroCategoriesForRole(
  serviceCategory: string,
  vendorRole: string
): MicroCategory[] {
  const categoryData = SERVICE_MICRO_CATEGORIES.find(
    cat => cat.category === serviceCategory
  );
  
  if (!categoryData) return [];
  
  // Filter micro-categories by applicable roles
  return categoryData.microCategories.filter(micro =>
    micro.applicableRoles.includes(vendorRole)
  );
}

/**
 * Get all micro-categories for a vendor role across all categories
 */
export function getAllMicroCategoriesForRole(vendorRole: string): {
  category: string;
  categoryLabel: string;
  microCategories: MicroCategory[];
}[] {
  console.log('🔍 [getAllMicroCategoriesForRole] Input vendorRole:', vendorRole);
  console.log('🔍 [getAllMicroCategoriesForRole] Total categories:', SERVICE_MICRO_CATEGORIES.length);
  
  const result = SERVICE_MICRO_CATEGORIES.map(cat => {
    const filteredMicros = cat.microCategories.filter(micro =>
      micro.applicableRoles.includes(vendorRole)
    );
    
    console.log(`   📂 Category: ${cat.categoryLabel}, Micros: ${cat.microCategories.length}, Filtered: ${filteredMicros.length}`);
    if (filteredMicros.length > 0 && cat.microCategories.length > 0) {
      console.log(`      Sample applicableRoles:`, cat.microCategories[0].applicableRoles);
    }
    
    return {
      category: cat.category,
      categoryLabel: cat.categoryLabel,
      microCategories: filteredMicros
    };
  }).filter(cat => cat.microCategories.length > 0);
  
  console.log('✅ [getAllMicroCategoriesForRole] Returning categories:', result.length);
  return result;
}

/**
 * Check if a vendor role can create custom at_center/at_clinic services
 */
export function canCreateCenterServices(vendorRole: string): boolean {
  const allowedRoles = [
    'groomer',
    'veterinarian', 
    'veterinary_clinic',
    'trainer',
    'boarding',
    'pet_hotel',
    'pet_cafe'
  ];
  return allowedRoles.includes(vendorRole);
}