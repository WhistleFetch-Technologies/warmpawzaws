/**
 * PROBLEM-BASED SPECIALIZATION SYSTEM
 * Staff and Centers select specializations using the EXACT same labels customers see
 * This ensures perfect matching between what customers search for and what vendors offer
 */

import { 
  vetHealthProblems, 
  groomingNeeds, 
  trainingGoals, 
  walkingNeeds, 
  behavioralIssues, 
  boardingNeeds 
} from './problem-grid-catalog';

/**
 * Get problem-based specializations for a vendor role
 * Returns the EXACT problem labels that customers see
 */
export function getProblemSpecializations(roleId: string) {
  const cleanRoleId = roleId.replace('role_', '').toLowerCase();
  
  // Map roles to their problem grids
  const roleToProblems: Record<string, any[]> = {
    // Veterinary
    'veterinarian': vetHealthProblems,
    'vet_clinic': vetHealthProblems,
    'pet_clinic': vetHealthProblems,
    
    // Grooming
    'groomer': groomingNeeds,
    'pet_groomer': groomingNeeds,
    'grooming_center': groomingNeeds,
    
    // Training
    'trainer': trainingGoals,
    'pet_trainer': trainingGoals,
    'training_center': trainingGoals,
    
    // Walking
    'walker': walkingNeeds,
    'dog_walker': walkingNeeds,
    'pet_walker': walkingNeeds,
    
    // Behavioral
    'behaviourist': behavioralIssues,
    'behaviorist': behavioralIssues,
    'pet_behaviorist': behavioralIssues,
    
    // Boarding
    'boarding': boardingNeeds,
    'pet_boarding': boardingNeeds,
    'boarding_center': boardingNeeds
  };
  
  const problems = roleToProblems[cleanRoleId] || [];
  
  // Transform problems into specialization format
  return problems.map(problem => ({
    id: problem.id,
    name: problem.displayName, // This is what customers see!
    shortName: problem.name,
    icon: problem.icon,
    color: problem.color,
    gradient: problem.gradient,
    description: problem.description,
    keywords: problem.keywords,
    order: problem.order,
    // Keep reference to mapped subcategories for backward compatibility
    mappedSubCategories: problem.mappedSubCategories || []
  }));
}

/**
 * Check if a staff member's specializations match a customer's problem
 */
export function staffMatchesProblem(
  staffSpecializations: string[], // Array of problem IDs
  problemId: string
): boolean {
  return staffSpecializations.includes(problemId);
}

/**
 * Get specialization display name from ID
 */
export function getSpecializationName(problemId: string, roleId: string): string {
  const specializations = getProblemSpecializations(roleId);
  const spec = specializations.find(s => s.id === problemId);
  return spec?.name || problemId;
}

/**
 * Get all specialization names from IDs
 */
export function getSpecializationNames(problemIds: string[], roleId: string): string[] {
  return problemIds
    .map(id => getSpecializationName(id, roleId))
    .filter(Boolean);
}

/**
 * Validate specialization IDs for a role
 */
export function validateSpecializations(
  specializations: string[],
  roleId: string
): { valid: boolean; invalidIds: string[] } {
  const availableSpecs = getProblemSpecializations(roleId);
  const validIds = availableSpecs.map(s => s.id);
  const invalidIds = specializations.filter(id => !validIds.includes(id));
  
  return {
    valid: invalidIds.length === 0,
    invalidIds
  };
}

/**
 * Get problem details by ID across all problem types
 */
export function getProblemById(problemId: string): any | null {
  const allProblems = [
    ...vetHealthProblems,
    ...groomingNeeds,
    ...trainingGoals,
    ...walkingNeeds,
    ...behavioralIssues,
    ...boardingNeeds
  ];
  
  return allProblems.find(p => p.id === problemId) || null;
}

/**
 * Map old subcategory-based specializations to new problem-based specializations
 * For migration purposes
 */
export function migrateSubcategoryToProblems(
  subcategoryIds: string[],
  roleId: string
): string[] {
  const problems = getProblemSpecializations(roleId);
  const matchedProblemIds: string[] = [];
  
  for (const subCatId of subcategoryIds) {
    // Find problems that map to this subcategory
    const matchingProblems = problems.filter(p => 
      p.mappedSubCategories?.includes(subCatId)
    );
    
    matchingProblems.forEach(p => {
      if (!matchedProblemIds.includes(p.id)) {
        matchedProblemIds.push(p.id);
      }
    });
  }
  
  return matchedProblemIds;
}

/**
 * Group specializations by category for better organization
 * Useful for large lists like veterinary services
 */
export function groupSpecializations(roleId: string) {
  const specializations = getProblemSpecializations(roleId);
  
  // For veterinary, group by medical specialty
  if (roleId.includes('vet') || roleId.includes('clinic')) {
    return {
      'Medical Specialties': specializations.filter(s => 
        ['surgery', 'cardiology', 'dermatology', 'dentistry', 'ophthalmology', 'neurology', 'physiotherapy'].includes(s.id)
      ),
      'General Care': specializations.filter(s => 
        ['medicine', 'emergency'].includes(s.id)
      )
    };
  }
  
  // For other roles, return all in one group
  return {
    'All Specializations': specializations
  };
}
