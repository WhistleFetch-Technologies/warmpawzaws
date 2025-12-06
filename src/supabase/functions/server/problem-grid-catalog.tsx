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
    description: 'Day-time care while you work',
    keywords: ['daycare', 'daily', 'day', 'work'],
    mappedSubCategories: ['sub_daycare'],
    order: 3
  },
  {
    id: 'luxury_boarding',
    name: 'Luxury Boarding',
    displayName: 'Premium Stay',
    icon: '⭐',
    color: '#8B5CF6',
    gradient: 'from-purple-500 to-purple-600',
    description: 'Premium facilities and amenities',
    keywords: ['luxury', 'premium', 'vip', 'deluxe'],
    mappedSubCategories: ['sub_daycare'],
    order: 4
  },
  {
    id: 'medical_boarding',
    name: 'Medical Boarding',
    displayName: 'Special Care',
    icon: '💊',
    color: '#EF4444',
    gradient: 'from-red-500 to-red-600',
    description: 'For pets needing medication or special care',
    keywords: ['medical', 'medication', 'special', 'care'],
    mappedSubCategories: ['sub_daycare'],
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
    boarding: boardingNeeds
  };
}

/**
 * Find problem by ID across all grids
 */
export function findProblemById(problemId: string): any | null {
  const allGrids = Object.values(getAllProblemGrids()).flat();
  return allGrids.find(problem => problem.id === problemId) || null;
}