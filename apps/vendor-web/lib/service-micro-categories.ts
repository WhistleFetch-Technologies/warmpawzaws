export interface MicroCategory {
  id: string;
  name: string;
  description?: string;
  parentCategory?: string;
  commonDuration?: number;
  priceRange?: {
    min: number;
    max: number;
  };
  icon?: string;
}

export function getMicroCategoriesForRole(roleId?: string): MicroCategory[] {
  // Placeholder implementation - to be implemented with actual micro categories
  return [
    { id: 'basic-care', name: 'Basic Care', description: 'Basic pet care services' },
    { id: 'grooming', name: 'Grooming', description: 'Pet grooming services' },
    { id: 'training', name: 'Training', description: 'Pet training services' },
    { id: 'walking', name: 'Walking', description: 'Pet walking services' },
    { id: 'boarding', name: 'Boarding', description: 'Pet boarding services' },
  ];
}

export function getAllMicroCategoriesForRole(roleId?: string): MicroCategory[] {
  // Alias for getMicroCategoriesForRole
  return getMicroCategoriesForRole(roleId);
}

