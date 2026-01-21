/**
 * SERVICE ORDERING CONFIGURATION
 * 
 * This file defines the priority ordering for pet services in the "What's Your Pet's Need?" section.
 * Services are arranged from most frequently needed (daily use) to least needed (specialty/rare).
 * 
 * ORDERING PHILOSOPHY:
 * 1. Daily-use services first (grooming, walking, nutrition)
 * 2. Exciting/engaging services next (training, boarding, cafes)
 * 3. General health services (checkups, vaccinations)
 * 4. Specialty services last (surgery, emergency - rarely needed)
 * 
 * HOW TO ADD NEW SERVICES:
 * 1. Add the service category to CATEGORY_DISPLAY_ORDER with appropriate priority
 * 2. Add individual items to SERVICE_ITEM_PRIORITY within their category
 * 3. Lower numbers = higher priority (shown first)
 */

// ============================================
// CATEGORY DISPLAY ORDER (for "All" tab)
// ============================================
// Categories ordered by daily usage frequency
// Lower number = shown earlier in the "All" view

export const CATEGORY_DISPLAY_ORDER: Record<string, number> = {
  // DAILY USE (Priority 1-20)
  'grooming': 1,       // Regular grooming is essential for pet hygiene
  'walker': 2,         // Daily walks are crucial for dog health
  'nutrition': 3,      // Daily feeding and diet planning
  
  // REGULAR CARE (Priority 21-40)
  'training': 21,      // Training sessions - regular but not daily
  'boarding': 22,      // Occasional need when traveling
  'behavioral': 23,    // Behavioral support when needed
  
  // HEALTH SERVICES (Priority 41-60)
  'vet': 41,           // Vet visits - periodic checkups and illness
  
  // SPECIALTY (Priority 61+)
  // Add future specialty categories here
};

// ============================================
// SERVICE ITEM PRIORITY (within each category)
// ============================================
// Items within each category ordered by frequency of need
// Lower number = shown earlier in category list

export const SERVICE_ITEM_PRIORITY: Record<string, Record<string, number>> = {
  // VET SERVICES - General first, Surgery/Emergency last
  'vet': {
    // Daily/Preventive Care (Priority 1-20)
    'medicine': 1,           // General medicine - most common
    'vaccination': 2,        // Routine vaccinations
    'checkup': 3,            // Regular health checkups
    
    // Common Health Issues (Priority 21-40)
    'dermatology': 21,       // Skin issues - fairly common
    'dentistry': 22,         // Dental care - regular need
    'ophthalmology': 23,     // Eye care
    
    // Specialty Care (Priority 41-60)
    'cardiology': 41,        // Heart care - less frequent
    'orthopedics': 42,       // Bone/joint issues
    'neurology': 43,         // Neurological issues
    
    // Rare/Emergency (Priority 61+)
    'surgery': 61,           // Surgery - rarely needed
    'emergency': 62,         // Emergency - hopefully rare
    'oncology': 63,          // Cancer treatment - specialty
  },
  
  // GROOMING SERVICES - Basic hygiene first, luxury last
  'grooming': {
    // Essential/Daily (Priority 1-20)
    'bath_only': 1,          // Basic bathing - most common
    'full_grooming': 2,      // Complete grooming package
    'nail_care': 3,          // Regular nail trimming
    
    // Regular Maintenance (Priority 21-40)
    'haircut_styling': 21,   // Haircuts as needed
    'deshedding': 22,        // Seasonal deshedding
    'ear_cleaning': 23,      // Ear hygiene
    
    // Specialty/Luxury (Priority 41+)
    'spa_treatment': 41,     // Spa services - luxury
    'creative_styling': 42,  // Creative/show styling
  },
  
  // TRAINING SERVICES - Basic obedience first, specialized last
  'training': {
    // Essential Training (Priority 1-20)
    'basic_obedience': 1,    // Sit, stay, come - most needed
    'potty_training': 2,     // Essential for puppies
    'leash_training': 3,     // Fundamental skill
    
    // Socialization (Priority 21-40)
    'socialization': 21,     // Important for all dogs
    'puppy_training': 22,    // Puppy-specific training
    
    // Advanced/Specialty (Priority 41+)
    'advanced_training': 41, // Advanced commands
    'agility': 42,           // Agility training
    'aggression': 43,        // Aggression management - specialty
  },
  
  // WALKING SERVICES - Daily walks first, specialty last
  'walker': {
    // Daily Essentials (Priority 1-20)
    'daily_walk': 1,         // Regular daily walking
    'puppy_walk': 2,         // Puppy-appropriate walks
    'morning_walk': 3,       // Morning routine
    'evening_walk': 4,       // Evening routine
    
    // Regular Needs (Priority 21-40)
    'multiple_dogs': 21,     // Multiple dog walking
    'senior_walk': 22,       // Gentle walks for seniors
    
    // Special Occasions (Priority 41+)
    'long_walk': 41,         // Extended adventure walks
    'hiking': 42,            // Trail hiking
  },
  
  // BOARDING SERVICES - Short stays first, specialty last
  'boarding': {
    // Common Needs (Priority 1-20)
    'daycare': 1,            // Daily daycare - most frequent
    'short_stay': 2,         // Weekend boarding
    
    // Extended Care (Priority 21-40)
    'long_stay': 21,         // Extended boarding
    'pet_sitting': 22,       // In-home pet sitting
    
    // Specialty (Priority 41+)
    'luxury_boarding': 41,   // Premium boarding
    'medical_boarding': 42,  // Medical/recovery boarding
  },
  
  // BEHAVIORAL SERVICES - Common issues first, complex last
  'behavioral': {
    // Common Issues (Priority 1-20)
    'separation_anxiety': 1, // Very common issue
    'barking': 2,            // Common complaint
    
    // Regular Issues (Priority 21-40)
    'fear_phobia': 21,       // Fear-related behaviors
    'leash_reactivity': 22,  // Leash behavior issues
    
    // Complex Issues (Priority 41+)
    'destructive': 41,       // Destructive habits
    'resource_guarding': 42, // Resource guarding
    'inter_dog_aggression': 43, // Dog-to-dog aggression
  },
  
  // NUTRITION SERVICES - Daily diet first, specialty last
  'nutrition': {
    // Daily Needs (Priority 1-20)
    'diet_plan': 1,          // Basic diet planning
    'puppy_nutrition': 2,    // Puppy diet - common need
    'senior_nutrition': 3,   // Senior diet adjustments
    
    // Health-Related (Priority 21-40)
    'weight_management': 21, // Weight control
    'allergies': 22,         // Food allergy management
    
    // Specialty (Priority 41+)
    'special_diet': 41,      // Medical diet needs
    'raw_diet': 42,          // Raw/homemade diet planning
  },
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get the display priority for a category
 * Lower number = shown first
 */
export function getCategoryPriority(categoryId: string): number {
  return CATEGORY_DISPLAY_ORDER[categoryId] ?? 100;
}

/**
 * Get the display priority for a service item within its category
 * Lower number = shown first
 */
export function getServiceItemPriority(categoryId: string, itemId: string): number {
  const categoryPriorities = SERVICE_ITEM_PRIORITY[categoryId];
  if (!categoryPriorities) return 50; // Default middle priority
  return categoryPriorities[itemId] ?? 50;
}

/**
 * Sort service items by priority
 * Items without explicit priority get middle priority (50)
 */
export function sortServicesByPriority<T extends { id: string; category?: string }>(
  items: T[],
  getCategoryFromItem?: (item: T) => string
): T[] {
  return [...items].sort((a, b) => {
    const categoryA = getCategoryFromItem?.(a) ?? (a as any).category ?? '';
    const categoryB = getCategoryFromItem?.(b) ?? (b as any).category ?? '';
    
    // First sort by category priority
    const catPriorityA = getCategoryPriority(categoryA);
    const catPriorityB = getCategoryPriority(categoryB);
    
    if (catPriorityA !== catPriorityB) {
      return catPriorityA - catPriorityB;
    }
    
    // Then sort by item priority within category
    const itemPriorityA = getServiceItemPriority(categoryA, a.id);
    const itemPriorityB = getServiceItemPriority(categoryB, b.id);
    
    return itemPriorityA - itemPriorityB;
  });
}

/**
 * Sort items within a single category by priority
 */
export function sortItemsWithinCategory<T extends { id: string }>(
  items: T[],
  categoryId: string
): T[] {
  return [...items].sort((a, b) => {
    const priorityA = getServiceItemPriority(categoryId, a.id);
    const priorityB = getServiceItemPriority(categoryId, b.id);
    return priorityA - priorityB;
  });
}

/**
 * Get a mixed display order for "All" view
 * This creates an interleaved display showing daily items from each category first,
 * then regular items, then specialty items - creating a nice variety
 */
export function getMixedDisplayOrder<T extends { id: string; category: string }>(
  items: T[]
): T[] {
  // Group items by priority tier across all categories
  const dailyUse: T[] = [];      // Priority 1-20
  const regularUse: T[] = [];    // Priority 21-40
  const specialty: T[] = [];     // Priority 41+
  
  items.forEach(item => {
    const itemPriority = getServiceItemPriority(item.category, item.id);
    if (itemPriority <= 20) {
      dailyUse.push(item);
    } else if (itemPriority <= 40) {
      regularUse.push(item);
    } else {
      specialty.push(item);
    }
  });
  
  // Sort each tier by category priority, then by item priority
  const sortTier = (tier: T[]) => {
    return tier.sort((a, b) => {
      const catPriorityA = getCategoryPriority(a.category);
      const catPriorityB = getCategoryPriority(b.category);
      if (catPriorityA !== catPriorityB) return catPriorityA - catPriorityB;
      
      const itemPriorityA = getServiceItemPriority(a.category, a.id);
      const itemPriorityB = getServiceItemPriority(b.category, b.id);
      return itemPriorityA - itemPriorityB;
    });
  };
  
  // Return items: daily use first, then regular, then specialty
  return [...sortTier(dailyUse), ...sortTier(regularUse), ...sortTier(specialty)];
}

// ============================================
// CATEGORY METADATA (for display)
// ============================================
export const CATEGORY_METADATA: Record<string, {
  name: string;
  description: string;
  usageFrequency: 'daily' | 'regular' | 'occasional' | 'rare';
}> = {
  'grooming': {
    name: 'Grooming',
    description: 'Keep your pet clean and well-groomed',
    usageFrequency: 'daily',
  },
  'walker': {
    name: 'Walking',
    description: 'Regular walks for exercise and health',
    usageFrequency: 'daily',
  },
  'nutrition': {
    name: 'Nutrition',
    description: 'Diet planning and food advice',
    usageFrequency: 'daily',
  },
  'training': {
    name: 'Training',
    description: 'Obedience and behavior training',
    usageFrequency: 'regular',
  },
  'boarding': {
    name: 'Boarding',
    description: 'Safe stays when you travel',
    usageFrequency: 'occasional',
  },
  'behavioral': {
    name: 'Behavioral',
    description: 'Address behavior issues',
    usageFrequency: 'occasional',
  },
  'vet': {
    name: 'Veterinary',
    description: 'Health checkups and medical care',
    usageFrequency: 'regular',
  },
};
