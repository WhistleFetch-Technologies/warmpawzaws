import { getServiceCatalogForRole, ServiceCatalogItem } from './service-catalogs';

/** Role key for catalog lookup - prefer role name when roleId is UUID */
export function getRoleKeyForCatalog(roleId?: string | null, roleName?: string | null): string | null {
  const isUUID = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
  if (roleName) {
    return String(roleName).toLowerCase().trim().replace(/\s+/g, '_').replace(/-/g, '_');
  }
  if (roleId && !isUUID(roleId)) {
    return String(roleId).toLowerCase().trim().replace(/\s+/g, '_').replace(/-/g, '_');
  }
  return roleId || null;
}

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
 * @param roleIdOrName - Role ID (UUID) or role name/code
 * @param roleName - Optional role display name (used when roleId is UUID)
 */
export function getMicroCategoriesForRole(
  roleIdOrName?: string | null,
  roleName?: string | null
): MicroCategory[] {
  if (!roleIdOrName && !roleName) return [];
  
  const services = getServiceCatalogForRole(roleIdOrName, roleName);
  
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

export function getAllMicroCategoriesForRole(
  roleIdOrName?: string | null,
  roleName?: string | null
): MicroCategory[] {
  return getMicroCategoriesForRole(roleIdOrName, roleName);
}

/**
 * Get services for a role (convenience function)
 */
export function getServicesForRole(roleId?: string): ServiceCatalogItem[] {
  return getServiceCatalogForRole(roleId);
}
