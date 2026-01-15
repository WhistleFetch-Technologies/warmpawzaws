import { getServiceCatalogForRole, ServiceCatalogItem } from './service-catalogs';

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

/**
 * Get micro categories for a role based on service catalog
 * Extracts unique categories from service catalog
 */
export function getMicroCategoriesForRole(roleId?: string): MicroCategory[] {
  if (!roleId) return [];
  
  const services = getServiceCatalogForRole(roleId);
  
  // Extract unique categories
  const categoryMap = new Map<string, MicroCategory>();
  
  services.forEach(service => {
    // ✅ FIX: Handle undefined category
    if (!service.category) {
      console.warn('⚠️ Service missing category:', service);
      return;
    }
    
    const categoryId = service.category.toLowerCase().replace(/\s+/g, '_');
    
    if (!categoryMap.has(categoryId)) {
      categoryMap.set(categoryId, {
        id: categoryId,
        name: service.category,
        description: `Services in ${service.category} category`,
        commonDuration: service.duration,
        priceRange: service.priceRange,
        icon: service.icon,
      });
    } else {
      // Update price range to include all services in category
      const existing = categoryMap.get(categoryId)!;
      if (existing.priceRange && service.priceRange) {
        existing.priceRange.min = Math.min(existing.priceRange.min, service.priceRange.min);
        existing.priceRange.max = Math.max(existing.priceRange.max, service.priceRange.max);
      }
    }
  });
  
  return Array.from(categoryMap.values());
}

export function getAllMicroCategoriesForRole(roleId?: string): MicroCategory[] {
  return getMicroCategoriesForRole(roleId);
}

/**
 * Get services for a role (convenience function)
 */
export function getServicesForRole(roleId?: string): ServiceCatalogItem[] {
  return getServiceCatalogForRole(roleId);
}
