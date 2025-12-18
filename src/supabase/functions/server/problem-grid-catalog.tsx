/**
 * PROBLEM GRID CATALOG
 * Maps customer problems/needs to service subcategories
 * Used for intelligent vendor discovery
 */

/**
 * VETERINARY HEALTH PROBLEMS
 * Maps to Healthcare subcategories
 */
export const vetHealthProblems = [
  {
    id: 'surgery',
    name: 'Surgery',
    displayName: 'Surgery & Procedures',
    icon: '🔪',
    color: '#EF4444',
    gradient: 'from-red-500 to-red-600',
    description: 'Surgical procedures and operations',
    keywords: ['operation', 'surgery', 'procedure', 'spay', 'neuter', 'tumor'],
    mappedSubCategories: ['sub_surgical_services', 'sub_surgery'],
    order: 1
  },
  {
    id: 'dermatology',
    name: 'Dermatology',
    displayName: 'Skin & Coat Care',
    icon: '🐾',
    color: '#F59E0B',
    gradient: 'from-amber-500 to-amber-600',
    description: 'Skin conditions, allergies, coat problems',
    keywords: ['skin', 'rash', 'itch', 'allergy', 'fur', 'coat', 'mange'],
    mappedSubCategories: ['sub_dermatology', 'sub_specialty_services', 'sub_medical_treatment'],
    order: 2
  },
  {
    id: 'dentistry',
    name: 'Dentistry',
    displayName: 'Dental Care',
    icon: '🦷',
    color: '#06B6D4',
    gradient: 'from-cyan-500 to-cyan-600',
    description: 'Dental health, teeth cleaning, oral care',
    keywords: ['teeth', 'dental', 'gum', 'mouth', 'oral', 'cleaning'],
    mappedSubCategories: ['sub_dentistry', 'sub_dental', 'sub_specialty_services'],
    order: 3
  },
  {
    id: 'ophthalmology',
    name: 'Ophthalmology',
    displayName: 'Eye Care',
    icon: '👁️',
    color: '#8B5CF6',
    gradient: 'from-purple-500 to-purple-600',
    description: 'Eye problems, vision care, optical issues',
    keywords: ['eye', 'vision', 'sight', 'cataract', 'conjunctivitis'],
    mappedSubCategories: ['sub_ophthalmology', 'sub_specialty_services'],
    order: 4
  },
  {
    id: 'cardiology',
    name: 'Cardiology',
    displayName: 'Heart & Cardiovascular',
    icon: '❤️',
    color: '#EC4899',
    gradient: 'from-pink-500 to-pink-600',
    description: 'Heart conditions, cardiac care, circulation',
    keywords: ['heart', 'cardiac', 'circulation', 'ecg', 'murmur'],
    mappedSubCategories: ['sub_cardiology', 'sub_specialty_services', 'sub_diagnostics'],
    order: 5
  },
  {
    id: 'neurology',
    name: 'Neurology',
    displayName: 'Neurological Care',
    icon: '🧠',
    color: '#6366F1',
    gradient: 'from-indigo-500 to-indigo-600',
    description: 'Nervous system, seizures, neurological issues',
    keywords: ['brain', 'nerve', 'seizure', 'paralysis', 'neurological'],
    mappedSubCategories: ['sub_neurology', 'sub_specialty_services'],
    order: 6
  },
  {
    id: 'medicine',
    name: 'General Medicine',
    displayName: 'General Health',
    icon: '💊',
    color: '#10B981',
    gradient: 'from-green-500 to-green-600',
    description: 'General health issues, consultation, diagnosis',
    keywords: ['general', 'medicine', 'checkup', 'consultation', 'diagnosis'],
    mappedSubCategories: ['sub_general_medicine', 'sub_preventive_wellness', 'sub_medical_treatment', 'sub_diagnostics'],
    order: 7
  },
  {
    id: 'emergency',
    name: 'Emergency & Critical Care',
    displayName: 'Emergency Care',
    icon: '🚨',
    color: '#DC2626',
    gradient: 'from-red-600 to-red-700',
    description: 'Urgent care, accidents, critical conditions',
    keywords: ['emergency', 'urgent', 'accident', 'critical', 'trauma'],
    mappedSubCategories: ['sub_emergency_critical', 'sub_emergency'],
    order: 8
  },
  {
    id: 'orthopedic',
    name: 'Orthopedic',
    displayName: 'Bone & Joint Care',
    icon: '🦿',
    color: '#7C3AED',
    gradient: 'from-violet-600 to-violet-700',
    description: 'Bone fractures, joint problems, arthritis',
    keywords: ['bone', 'joint', 'fracture', 'arthritis', 'ligament', 'hip', 'knee', 'orthopedic', 'orthopaedic'],
    mappedSubCategories: ['sub_orthopedic', 'sub_specialty_services', 'sub_surgical_services'],
    order: 9
  },
  {
    id: 'physiotherapy',
    name: 'Physiotherapy',
    displayName: 'Physical Therapy',
    icon: '🏃',
    color: '#14B8A6',
    gradient: 'from-teal-500 to-teal-600',
    description: 'Physical rehabilitation, mobility support',
    keywords: ['physio', 'therapy', 'rehabilitation', 'mobility', 'exercise'],
    mappedSubCategories: ['sub_physiotherapy', 'sub_specialty_services'],
    order: 10
  }
];

/**
 * GROOMING NEEDS
 * Maps to Grooming & Day-care subcategories
 */
export const groomingNeeds = [
  {
    id: 'full_grooming',
    name: 'Full Grooming',
    displayName: 'Complete Grooming',
    icon: '✂️',
    color: '#FF8C42',
    gradient: 'from-orange-500 to-orange-600',
    description: 'Bath, haircut, nail trim, ear cleaning',
    keywords: ['grooming', 'bath', 'haircut', 'full', 'complete'],
    mappedSubCategories: ['sub_grooming_basic', 'sub_grooming_specialty'],
    order: 1
  },
  {
    id: 'bath_only',
    name: 'Bath & Brush',
    displayName: 'Bath Service',
    icon: '🛁',
    color: '#3B82F6',
    gradient: 'from-blue-500 to-blue-600',
    description: 'Basic bathing and brushing service',
    keywords: ['bath', 'shower', 'wash', 'brush'],
    mappedSubCategories: ['sub_grooming_basic'],
    order: 2
  },
  {
    id: 'haircut_styling',
    name: 'Haircut & Styling',
    displayName: 'Hair Styling',
    icon: '💇',
    color: '#EC4899',
    gradient: 'from-pink-500 to-pink-600',
    description: 'Professional haircuts and styling',
    keywords: ['haircut', 'styling', 'trim', 'cut'],
    mappedSubCategories: ['sub_grooming_basic'],
    order: 3
  },
  {
    id: 'nail_care',
    name: 'Nail Care',
    displayName: 'Nail Trimming',
    icon: '💅',
    color: '#F59E0B',
    gradient: 'from-amber-500 to-amber-600',
    description: 'Nail trimming and paw care',
    keywords: ['nail', 'trim', 'paw', 'claw'],
    mappedSubCategories: ['sub_grooming_basic'],
    order: 4
  },
  {
    id: 'deshedding',
    name: 'De-shedding',
    displayName: 'Shedding Control',
    icon: '🐕',
    color: '#8B5CF6',
    gradient: 'from-purple-500 to-purple-600',
    description: 'Reduce shedding and loose fur',
    keywords: ['deshed', 'shedding', 'fur', 'loose hair'],
    mappedSubCategories: ['sub_grooming_basic'],
    order: 5
  },
  {
    id: 'spa_treatment',
    name: 'Spa & Wellness',
    displayName: 'Spa Treatment',
    icon: '💆',
    color: '#14B8A6',
    gradient: 'from-teal-500 to-teal-600',
    description: 'Premium spa and wellness treatments',
    keywords: ['spa', 'massage', 'wellness', 'premium'],
    mappedSubCategories: ['sub_grooming_specialty'],
    order: 6
  }
];

/**
 * TRAINING GOALS
 * Maps to Training subcategories
 */
export const trainingGoals = [
  {
    id: 'basic_obedience',
    name: 'Basic Obedience',
    displayName: 'Basic Commands',
    icon: '🎓',
    color: '#10B981',
    gradient: 'from-green-500 to-green-600',
    description: 'Sit, stay, come, basic commands',
    keywords: ['obedience', 'basic', 'commands', 'sit', 'stay'],
    mappedSubCategories: ['sub_training_basic'],
    order: 1
  },
  {
    id: 'potty_training',
    name: 'Potty Training',
    displayName: 'House Training',
    icon: '🏠',
    color: '#3B82F6',
    gradient: 'from-blue-500 to-blue-600',
    description: 'House training and toilet habits',
    keywords: ['potty', 'toilet', 'house', 'training'],
    mappedSubCategories: ['sub_training_basic'],
    order: 2
  },
  {
    id: 'socialization',
    name: 'Socialization',
    displayName: 'Social Skills',
    icon: '🐾',
    color: '#F59E0B',
    gradient: 'from-amber-500 to-amber-600',
    description: 'Interaction with people and other pets',
    keywords: ['social', 'interaction', 'people', 'pets'],
    mappedSubCategories: ['sub_training_basic'],
    order: 3
  },
  {
    id: 'aggression',
    name: 'Aggression Issues',
    displayName: 'Behavioral Problems',
    icon: '⚠️',
    color: '#EF4444',
    gradient: 'from-red-500 to-red-600',
    description: 'Aggressive behavior correction',
    keywords: ['aggression', 'biting', 'fighting', 'behavior'],
    mappedSubCategories: ['sub_behavior'],
    order: 4
  },
  {
    id: 'advanced_training',
    name: 'Advanced Training',
    displayName: 'Advanced Skills',
    icon: '🏆',
    color: '#8B5CF6',
    gradient: 'from-purple-500 to-purple-600',
    description: 'Advanced commands and tricks',
    keywords: ['advanced', 'tricks', 'skills', 'professional'],
    mappedSubCategories: ['sub_training_advanced'],
    order: 5
  },
  {
    id: 'leash_training',
    name: 'Leash Training',
    displayName: 'Walking Skills',
    icon: '🦮',
    color: '#06B6D4',
    gradient: 'from-cyan-500 to-cyan-600',
    description: 'Proper leash walking and control',
    keywords: ['leash', 'walk', 'pulling', 'control'],
    mappedSubCategories: ['sub_training_basic'],
    order: 6
  }
];

/**
 * WALKING NEEDS
 * Maps to Dog Walking subcategories
 */
export const walkingNeeds = [
  {
    id: 'daily_walk',
    name: 'Daily Walk',
    displayName: 'Regular Walking',
    icon: '🚶',
    color: '#10B981',
    gradient: 'from-green-500 to-green-600',
    description: 'Regular daily walks for exercise',
    keywords: ['daily', 'regular', 'walk', 'exercise'],
    mappedSubCategories: ['sub_walking'],
    order: 1
  },
  {
    id: 'puppy_walk',
    name: 'Puppy Walking',
    displayName: 'Gentle Puppy Walks',
    icon: '🐶',
    color: '#3B82F6',
    gradient: 'from-blue-500 to-blue-600',
    description: 'Gentle walks for young puppies',
    keywords: ['puppy', 'young', 'gentle', 'careful'],
    mappedSubCategories: ['sub_walking'],
    order: 2
  },
  {
    id: 'senior_walk',
    name: 'Senior Pet Walk',
    displayName: 'Senior Care Walks',
    icon: '🦴',
    color: '#F59E0B',
    gradient: 'from-amber-500 to-amber-600',
    description: 'Slow-paced walks for older pets',
    keywords: ['senior', 'old', 'slow', 'gentle'],
    mappedSubCategories: ['sub_walking'],
    order: 3
  },
  {
    id: 'multiple_dogs',
    name: 'Multiple Dogs',
    displayName: 'Group Walking',
    icon: '🐕‍🦺',
    color: '#8B5CF6',
    gradient: 'from-purple-500 to-purple-600',
    description: 'Walking multiple dogs together',
    keywords: ['multiple', 'group', 'pack', 'several'],
    mappedSubCategories: ['sub_walking'],
    order: 4
  },
  {
    id: 'long_walk',
    name: 'Long/Adventure Walk',
    displayName: 'Extended Walks',
    icon: '⛰️',
    color: '#14B8A6',
    gradient: 'from-teal-500 to-teal-600',
    description: 'Extended walks and outdoor adventures',
    keywords: ['long', 'adventure', 'hiking', 'extended'],
    mappedSubCategories: ['sub_walking'],
    order: 5
  }
];

/**
 * BEHAVIORAL ISSUES
 * Maps to Behaviorist subcategories
 */
export const behavioralIssues = [
  {
    id: 'separation_anxiety',
    name: 'Separation Anxiety',
    displayName: 'Anxiety & Stress',
    icon: '😰',
    color: '#EF4444',
    gradient: 'from-red-500 to-red-600',
    description: 'Anxiety when left alone',
    keywords: ['anxiety', 'separation', 'stress', 'alone'],
    mappedSubCategories: ['sub_behavior'],
    order: 1
  },
  {
    id: 'barking',
    name: 'Excessive Barking',
    displayName: 'Barking Issues',
    icon: '📢',
    color: '#F59E0B',
    gradient: 'from-amber-500 to-amber-600',
    description: 'Unwanted or excessive barking',
    keywords: ['barking', 'noise', 'loud', 'excessive'],
    mappedSubCategories: ['sub_behavior'],
    order: 2
  },
  {
    id: 'destructive',
    name: 'Destructive Behavior',
    displayName: 'Destructive Habits',
    icon: '💥',
    color: '#DC2626',
    gradient: 'from-red-600 to-red-700',
    description: 'Chewing, digging, destroying property',
    keywords: ['destructive', 'chewing', 'digging', 'damage'],
    mappedSubCategories: ['sub_behavior'],
    order: 3
  },
  {
    id: 'fear_phobia',
    name: 'Fear & Phobias',
    displayName: 'Fear Issues',
    icon: '😨',
    color: '#8B5CF6',
    gradient: 'from-purple-500 to-purple-600',
    description: 'Fear of loud noises, people, situations',
    keywords: ['fear', 'phobia', 'scared', 'anxiety'],
    mappedSubCategories: ['sub_behavior'],
    order: 4
  },
  {
    id: 'resource_guarding',
    name: 'Resource Guarding',
    displayName: 'Possessive Behavior',
    icon: '🛡️',
    color: '#06B6D4',
    gradient: 'from-cyan-500 to-cyan-600',
    description: 'Guarding food, toys, or territory',
    keywords: ['guarding', 'possessive', 'aggressive', 'protective'],
    mappedSubCategories: ['sub_behavior'],
    order: 5
  }
];

/**
 * BOARDING NEEDS
 * Maps to Pet Boarding subcategories
 */
export const boardingNeeds = [
  {
    id: 'short_stay',
    name: 'Short Stay (1-3 days)',
    displayName: 'Weekend Boarding',
    icon: '🏨',
    color: '#3B82F6',
    gradient: 'from-blue-500 to-blue-600',
    description: 'Short-term boarding for weekends',
    keywords: ['short', 'weekend', 'few days'],
    mappedSubCategories: ['sub_daycare'],
    order: 1
  },
  {
    id: 'long_stay',
    name: 'Long Stay (4+ days)',
    displayName: 'Extended Boarding',
    icon: '🏡',
    color: '#10B981',
    gradient: 'from-green-500 to-green-600',
    description: 'Extended stays and vacations',
    keywords: ['long', 'extended', 'vacation', 'weeks'],
    mappedSubCategories: ['sub_daycare'],
    order: 2
  },
  {
    id: 'daycare',
    name: 'Daycare',
    displayName: 'Daily Daycare',
    icon: '☀️',
    color: '#F59E0B',
    gradient: 'from-amber-500 to-amber-600',
    description: 'Daily daycare services',
    keywords: ['daycare', 'daily', 'care'],
    mappedSubCategories: ['sub_daycare'],
    order: 3
  },
  {
    id: 'luxury_boarding',
    name: 'Luxury Boarding',
    displayName: 'Premium Care',
    icon: '⭐',
    color: '#8B5CF6',
    gradient: 'from-purple-500 to-purple-600',
    description: 'Premium luxury boarding with special amenities',
    keywords: ['luxury', 'premium', 'spa', 'vip'],
    mappedSubCategories: ['sub_daycare'],
    order: 4
  },
  {
    id: 'medical_boarding',
    name: 'Medical Boarding',
    displayName: 'Special Needs',
    icon: '🏥',
    color: '#EF4444',
    gradient: 'from-red-500 to-red-600',
    description: 'Boarding for pets with medical conditions',
    keywords: ['medical', 'special needs', 'elderly', 'medication'],
    mappedSubCategories: ['sub_daycare'],
    order: 5
  }
];

/**
 * NUTRITION & DIET NEEDS
 * Maps to Nutritionist subcategories
 */
export const nutritionNeeds = [
  {
    id: 'weight_management',
    name: 'Weight Management',
    displayName: 'Weight Loss/Gain',
    icon: '⚖️',
    color: '#10B981',
    gradient: 'from-green-500 to-green-600',
    description: 'Customized diet plans for healthy weight',
    keywords: ['weight', 'obesity', 'diet', 'overweight', 'underweight'],
    mappedSubCategories: ['sub_nutrition_consultation', 'sub_diet_planning'],
    serviceTypes: ['nutrition_consultation', 'diet_planning', 'weight_management'],
    order: 1
  },
  {
    id: 'allergies_sensitivities',
    name: 'Food Allergies',
    displayName: 'Allergies & Sensitivities',
    icon: '🚫',
    color: '#EF4444',
    gradient: 'from-red-500 to-red-600',
    description: 'Managing food allergies and sensitivities',
    keywords: ['allergy', 'sensitive', 'intolerance', 'reaction'],
    mappedSubCategories: ['sub_nutrition_consultation', 'sub_special_diets'],
    serviceTypes: ['nutrition_consultation', 'allergy_diet', 'elimination_diet'],
    order: 2
  },
  {
    id: 'digestive_issues',
    name: 'Digestive Problems',
    displayName: 'Digestive Health',
    icon: '🥗',
    color: '#F59E0B',
    gradient: 'from-amber-500 to-amber-600',
    description: 'Diet plans for digestive issues',
    keywords: ['digestion', 'stomach', 'diarrhea', 'constipation', 'ibd'],
    mappedSubCategories: ['sub_nutrition_consultation', 'sub_special_diets'],
    serviceTypes: ['nutrition_consultation', 'digestive_diet', 'gut_health'],
    order: 3
  },
  {
    id: 'puppy_kitten_nutrition',
    name: 'Puppy/Kitten Nutrition',
    displayName: 'Growth & Development',
    icon: '🍼',
    color: '#3B82F6',
    gradient: 'from-blue-500 to-blue-600',
    description: 'Nutrition for growing pets',
    keywords: ['puppy', 'kitten', 'growth', 'development', 'young'],
    mappedSubCategories: ['sub_nutrition_consultation', 'sub_diet_planning'],
    serviceTypes: ['nutrition_consultation', 'growth_diet', 'puppy_nutrition'],
    order: 4
  },
  {
    id: 'senior_nutrition',
    name: 'Senior Pet Nutrition',
    displayName: 'Senior Care Diet',
    icon: '👴',
    color: '#8B5CF6',
    gradient: 'from-purple-500 to-purple-600',
    description: 'Special diets for senior pets',
    keywords: ['senior', 'elderly', 'aging', 'old'],
    mappedSubCategories: ['sub_nutrition_consultation', 'sub_diet_planning'],
    serviceTypes: ['nutrition_consultation', 'senior_diet', 'aging_pet_nutrition'],
    order: 5
  },
  {
    id: 'medical_conditions',
    name: 'Medical Condition Diets',
    displayName: 'Therapeutic Nutrition',
    icon: '💊',
    color: '#06B6D4',
    gradient: 'from-cyan-500 to-cyan-600',
    description: 'Specialized diets for medical conditions',
    keywords: ['medical', 'disease', 'kidney', 'diabetes', 'liver', 'therapeutic'],
    mappedSubCategories: ['sub_nutrition_consultation', 'sub_special_diets'],
    serviceTypes: ['nutrition_consultation', 'therapeutic_diet', 'medical_nutrition'],
    order: 6
  },
  {
    id: 'raw_fresh_food',
    name: 'Raw/Fresh Food Diet',
    displayName: 'Natural Feeding',
    icon: '🥩',
    color: '#DC2626',
    gradient: 'from-red-600 to-red-700',
    description: 'Raw and fresh food diet planning',
    keywords: ['raw', 'fresh', 'natural', 'barf', 'homemade'],
    mappedSubCategories: ['sub_nutrition_consultation', 'sub_diet_planning'],
    serviceTypes: ['nutrition_consultation', 'raw_diet', 'fresh_food_plan'],
    order: 7
  },
  {
    id: 'performance_nutrition',
    name: 'Performance Nutrition',
    displayName: 'Active Pet Diets',
    icon: '🏃',
    color: '#14B8A6',
    gradient: 'from-teal-500 to-teal-600',
    description: 'Nutrition for working and athletic pets',
    keywords: ['performance', 'athletic', 'working', 'active', 'energy'],
    mappedSubCategories: ['sub_nutrition_consultation', 'sub_diet_planning'],
    serviceTypes: ['nutrition_consultation', 'performance_diet', 'athletic_nutrition'],
    order: 8
  }
];

/**
 * PHARMACY & MEDICATION NEEDS
 * Maps to Pet Pharmacy subcategories
 */
export const pharmacyNeeds = [
  {
    id: 'prescription_refill',
    name: 'Prescription Refill',
    displayName: 'Medication Refill',
    icon: '💊',
    color: '#2196F3',
    gradient: 'from-blue-600 to-blue-700',
    description: 'Refill existing prescriptions',
    keywords: ['refill', 'prescription', 'medication', 'medicine'],
    mappedSubCategories: ['sub_pharmacy_prescription'],
    serviceTypes: ['prescription_fulfillment', 'medication_refill'],
    order: 1
  },
  {
    id: 'flea_tick',
    name: 'Flea & Tick Prevention',
    displayName: 'Parasite Prevention',
    icon: '🦟',
    color: '#10B981',
    gradient: 'from-green-500 to-green-600',
    description: 'Flea, tick, and parasite prevention medications',
    keywords: ['flea', 'tick', 'parasite', 'prevention'],
    mappedSubCategories: ['sub_pharmacy_otc', 'sub_preventive_meds'],
    serviceTypes: ['otc_medications', 'preventive_care'],
    order: 2
  },
  {
    id: 'heartworm_prevention',
    name: 'Heartworm Prevention',
    displayName: 'Heartworm Meds',
    icon: '❤️',
    color: '#EF4444',
    gradient: 'from-red-500 to-red-600',
    description: 'Heartworm prevention medications',
    keywords: ['heartworm', 'prevention', 'cardiac'],
    mappedSubCategories: ['sub_pharmacy_prescription', 'sub_preventive_meds'],
    serviceTypes: ['prescription_fulfillment', 'preventive_care'],
    order: 3
  },
  {
    id: 'pain_management',
    name: 'Pain Relief',
    displayName: 'Pain Management',
    icon: '🩹',
    color: '#F59E0B',
    gradient: 'from-amber-500 to-amber-600',
    description: 'Pain relief and management medications',
    keywords: ['pain', 'relief', 'arthritis', 'inflammation'],
    mappedSubCategories: ['sub_pharmacy_prescription'],
    serviceTypes: ['prescription_fulfillment', 'pain_medications'],
    order: 4
  },
  {
    id: 'antibiotics',
    name: 'Antibiotics',
    displayName: 'Infection Treatment',
    icon: '💉',
    color: '#8B5CF6',
    gradient: 'from-purple-500 to-purple-600',
    description: 'Antibiotic medications for infections',
    keywords: ['antibiotic', 'infection', 'bacterial'],
    mappedSubCategories: ['sub_pharmacy_prescription'],
    serviceTypes: ['prescription_fulfillment'],
    order: 5
  },
  {
    id: 'skin_ear_meds',
    name: 'Skin & Ear Medications',
    displayName: 'Topical Treatments',
    icon: '🧴',
    color: '#06B6D4',
    gradient: 'from-cyan-500 to-cyan-600',
    description: 'Skin and ear treatment medications',
    keywords: ['skin', 'ear', 'topical', 'ointment', 'drops'],
    mappedSubCategories: ['sub_pharmacy_prescription', 'sub_pharmacy_otc'],
    serviceTypes: ['prescription_fulfillment', 'otc_medications'],
    order: 6
  },
  {
    id: 'vitamins_supplements',
    name: 'Vitamins & Supplements',
    displayName: 'Nutritional Support',
    icon: '🌿',
    color: '#14B8A6',
    gradient: 'from-teal-500 to-teal-600',
    description: 'Vitamins and dietary supplements',
    keywords: ['vitamin', 'supplement', 'nutritional', 'health'],
    mappedSubCategories: ['sub_pharmacy_otc'],
    serviceTypes: ['otc_medications', 'supplements'],
    order: 7
  }
];

/**
 * ADOPTION & RESCUE NEEDS
 * Maps to Adoption Center subcategories
 */
export const adoptionNeeds = [
  {
    id: 'adopt_puppy_kitten',
    name: 'Adopt Puppy/Kitten',
    displayName: 'Young Pets',
    icon: '🐶',
    color: '#EC4899',
    gradient: 'from-pink-500 to-pink-600',
    description: 'Adopt young puppies or kittens',
    keywords: ['puppy', 'kitten', 'young', 'baby'],
    mappedSubCategories: ['sub_adoption'],
    serviceTypes: ['pet_adoption'],
    order: 1
  },
  {
    id: 'adopt_adult',
    name: 'Adopt Adult Pet',
    displayName: 'Mature Pets',
    icon: '🐕',
    color: '#3B82F6',
    gradient: 'from-blue-500 to-blue-600',
    description: 'Adopt adult dogs or cats',
    keywords: ['adult', 'mature', 'trained'],
    mappedSubCategories: ['sub_adoption'],
    serviceTypes: ['pet_adoption'],
    order: 2
  },
  {
    id: 'adopt_senior',
    name: 'Adopt Senior Pet',
    displayName: 'Senior Companions',
    icon: '👴',
    color: '#8B5CF6',
    gradient: 'from-purple-500 to-purple-600',
    description: 'Adopt senior pets needing loving homes',
    keywords: ['senior', 'elderly', 'old', 'mature'],
    mappedSubCategories: ['sub_adoption'],
    serviceTypes: ['pet_adoption'],
    order: 3
  },
  {
    id: 'adopt_special_needs',
    name: 'Special Needs Pets',
    displayName: 'Special Care Required',
    icon: '❤️',
    color: '#EF4444',
    gradient: 'from-red-500 to-red-600',
    description: 'Pets with special medical or behavioral needs',
    keywords: ['special needs', 'disability', 'medical', 'care'],
    mappedSubCategories: ['sub_adoption'],
    serviceTypes: ['pet_adoption'],
    order: 4
  },
  {
    id: 'foster_to_adopt',
    name: 'Foster to Adopt',
    displayName: 'Trial Period',
    icon: '🏠',
    color: '#10B981',
    gradient: 'from-green-500 to-green-600',
    description: 'Foster a pet before committing to adoption',
    keywords: ['foster', 'trial', 'temporary'],
    mappedSubCategories: ['sub_adoption'],
    serviceTypes: ['pet_adoption', 'fostering'],
    order: 5
  }
];

/**
 * Helper function to get problem grid by vendor role
 */
export function getProblemGridByRole(roleId: string): any[] {
  const roleMapping: Record<string, any[]> = {
    // ✅ VETERINARY - All variations
    'veterinarian': vetHealthProblems,
    'role_veterinarian': vetHealthProblems,
    'vet_clinic': vetHealthProblems,
    'role_vet_clinic': vetHealthProblems,
    'pet_clinic': vetHealthProblems,
    'role_pet_clinic': vetHealthProblems,
    
    // ✅ GROOMING - All variations
    'groomer': groomingNeeds,
    'role_groomer': groomingNeeds,
    'pet_groomer': groomingNeeds,
    'role_pet_groomer': groomingNeeds,
    'grooming_center': groomingNeeds,
    'role_grooming_center': groomingNeeds,
    
    // ✅ TRAINING - All variations
    'trainer': trainingGoals,
    'role_trainer': trainingGoals,
    'pet_trainer': trainingGoals,
    'role_pet_trainer': trainingGoals,
    'training_center': trainingGoals,
    'role_training_center': trainingGoals,
    
    // ✅ WALKING - All variations
    'dog_walker': walkingNeeds,
    'role_dog_walker': walkingNeeds,
    'pet_walker': walkingNeeds,
    'role_pet_walker': walkingNeeds,
    
    // ✅ BEHAVIORAL - All variations
    'behaviourist': behavioralIssues,
    'role_behaviourist': behavioralIssues,
    'pet_behaviorist': behavioralIssues,
    'role_pet_behaviorist': behavioralIssues,
    'behaviorist': behavioralIssues,
    'role_behaviorist': behavioralIssues,
    
    // ✅ BOARDING - All variations
    'boarding': boardingNeeds,
    'role_boarding': boardingNeeds,
    'pet_boarding': boardingNeeds,
    'role_pet_boarding': boardingNeeds,
    'boarding_center': boardingNeeds,
    'role_boarding_center': boardingNeeds,
    
    // ✅ NUTRITION - All variations
    'nutritionist': nutritionNeeds,
    'role_nutritionist': nutritionNeeds,
    'pet_nutritionist': nutritionNeeds,
    'role_pet_nutritionist': nutritionNeeds,
    'nutrition_center': nutritionNeeds,
    'role_nutrition_center': nutritionNeeds,
    
    // ✅ PHARMACY - All variations
    'pharmacist': pharmacyNeeds,
    'role_pharmacist': pharmacyNeeds,
    'pet_pharmacist': pharmacyNeeds,
    'role_pet_pharmacist': pharmacyNeeds,
    'pharmacy_center': pharmacyNeeds,
    'role_pharmacy_center': pharmacyNeeds,
    
    // ✅ ADOPTION - All variations
    'adoption_center': adoptionNeeds,
    'role_adoption_center': adoptionNeeds,
    'pet_adoption_center': adoptionNeeds,
    'role_pet_adoption_center': adoptionNeeds,
    'adoption_agency': adoptionNeeds,
    'role_adoption_agency': adoptionNeeds,
    'pet_shelter': adoptionNeeds,
    'role_pet_shelter': adoptionNeeds,
    
    // ✅ SITTING - Uses boarding needs (similar service type)
    'pet_sitter': boardingNeeds,
    'role_pet_sitter': boardingNeeds,
    'sitter': boardingNeeds,
    'role_sitter': boardingNeeds,
    
    // ✅ TRANSPORT - Uses basic transport needs
    'pet_taxi': walkingNeeds, // Similar to walking - pick up/drop off service
    'role_pet_taxi': walkingNeeds,
    'pet_transport': walkingNeeds,
    'role_pet_transport': walkingNeeds,
    'taxi': walkingNeeds,
    'role_taxi': walkingNeeds,
    
    // ✅ PHOTOGRAPHY - Uses basic photography needs (will add specific later if needed)
    'pet_photographer': groomingNeeds, // Similar to grooming - aesthetic service
    'role_pet_photographer': groomingNeeds,
    'photographer': groomingNeeds,
    'role_photographer': groomingNeeds,
    
    // ✅ CAFE - Uses basic reservation needs (handled separately in booking flow)
    'pet_cafe': boardingNeeds, // Placeholder - cafe has separate booking flow
    'role_pet_cafe': boardingNeeds,
    'cafe': boardingNeeds,
    'role_cafe': boardingNeeds,
    
    // ✅ RESORT - Uses boarding needs (similar to boarding)
    'pet_resort': boardingNeeds,
    'role_pet_resort': boardingNeeds,
    'resort': boardingNeeds,
    'role_resort': boardingNeeds,
    'boarding_center': boardingNeeds,
    'role_boarding_center': boardingNeeds,
    
    // ✅ INSURANCE - Uses basic consultation needs (handled separately)
    'pet_insurance': vetHealthProblems.slice(0, 3), // Use first few general health problems
    'role_pet_insurance': vetHealthProblems.slice(0, 3),
    'insurance': vetHealthProblems.slice(0, 3),
    'role_insurance': vetHealthProblems.slice(0, 3),
    
    // ✅ HOLIDAY PLANNER - Uses boarding needs (similar service)
    'pet_holiday': boardingNeeds,
    'role_pet_holiday': boardingNeeds,
    'pet_holiday_planner': boardingNeeds,
    'role_pet_holiday_planner': boardingNeeds,
    'holiday_planner': boardingNeeds,
    'role_holiday_planner': boardingNeeds,
    
    // ✅ SUNSET SERVICES - Uses basic end-of-life needs (handled separately)
    'pet_sunset': vetHealthProblems.slice(0, 2), // Use general health problems as placeholder
    'role_pet_sunset': vetHealthProblems.slice(0, 2),
    'pet_sunset_services': vetHealthProblems.slice(0, 2),
    'role_pet_sunset_services': vetHealthProblems.slice(0, 2),
    'sunset_services': vetHealthProblems.slice(0, 2),
    'role_sunset_services': vetHealthProblems.slice(0, 2),
    
    // ✅ BREEDER - Uses adoption needs (similar service)
    'pet_breeder': adoptionNeeds,
    'role_pet_breeder': adoptionNeeds,
    'breeder': adoptionNeeds,
    'role_breeder': adoptionNeeds,
    
    // ✅ AMBULANCE - Uses emergency needs
    'pet_ambulance': vetHealthProblems.filter((p: any) => p.id === 'emergency'),
    'role_pet_ambulance': vetHealthProblems.filter((p: any) => p.id === 'emergency'),
    'ambulance': vetHealthProblems.filter((p: any) => p.id === 'emergency'),
    'role_ambulance': vetHealthProblems.filter((p: any) => p.id === 'emergency'),
    
    // ✅ RELOCATION - Uses transport-like needs
    'pet_relocation': walkingNeeds.slice(0, 2), // Use basic transport needs
    'role_pet_relocation': walkingNeeds.slice(0, 2),
    'relocation': walkingNeeds.slice(0, 2),
    'role_relocation': walkingNeeds.slice(0, 2),
    
    // ✅ PRODUCT STORE - Uses pharmacy needs (similar retail model)
    'pet_products_store': pharmacyNeeds,
    'role_pet_products_store': pharmacyNeeds,
    'product_seller': pharmacyNeeds,
    'role_product_seller': pharmacyNeeds,
    'pet_product': pharmacyNeeds,
    'role_pet_product': pharmacyNeeds,
  };
  
  return roleMapping[roleId] || [];
}

/**
 * Get all problem grids (for admin seeding)
 */
export function getAllProblemGrids() {
  return {
    veterinary: vetHealthProblems,
    grooming: groomingNeeds,
    training: trainingGoals,
    walking: walkingNeeds,
    behavioral: behavioralIssues,
    boarding: boardingNeeds,
    nutrition: nutritionNeeds,
    pharmacy: pharmacyNeeds,
    adoption: adoptionNeeds
  };
}

/**
 * Find problem by ID across all grids
 */
export function findProblemById(problemId: string): any | null {
  const allGrids = Object.values(getAllProblemGrids()).flat();
  return allGrids.find(problem => problem.id === problemId) || null;
}