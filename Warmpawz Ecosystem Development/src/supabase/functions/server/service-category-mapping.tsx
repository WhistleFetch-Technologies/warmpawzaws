/**
 * Service Category Mapping
 * Centralized mapping for vendor types to service categories
 * 
 * STRUCTURE:
 * - Service Category (Broad): Healthcare Providers, Service Providers, Product Sellers
 * - Vendor Type (Specific from role.vendorTypes): healthcare_provider, service_provider, seller
 * - Role Name (Specific): Veterinarian, Groomer, Dog Walker, etc.
 */

export const VENDOR_TYPE_TO_CATEGORY: Record<string, string> = {
  'healthcare_provider': 'Healthcare Providers',
  'service_provider': 'Service Providers',
  'seller': 'Product Sellers',
  'product_seller': 'Product Sellers'
};

export const CATEGORY_IDS: Record<string, string> = {
  'Healthcare Providers': 'healthcare',
  'Service Providers': 'services',
  'Product Sellers': 'products'
};

/**
 * Get service category from vendor types array
 * @param vendorTypes - Array of vendor types from role config (e.g., ['healthcare_provider'])
 * @returns Human-readable service category (e.g., "Healthcare Providers")
 */
export function getServiceCategoryFromVendorTypes(vendorTypes: string[] | string | undefined): string {
  if (!vendorTypes) return 'N/A';
  
  // Handle string or array
  const types = Array.isArray(vendorTypes) ? vendorTypes : [vendorTypes];
  
  // Get the first vendor type and map it
  const firstType = types[0];
  return VENDOR_TYPE_TO_CATEGORY[firstType] || 'Service Providers';
}

/**
 * Get category ID from service category name
 * @param categoryName - Service category name (e.g., "Healthcare Providers")
 * @returns Category ID (e.g., "healthcare")
 */
export function getCategoryId(categoryName: string): string {
  return CATEGORY_IDS[categoryName] || 'services';
}

/**
 * Determine service category from role configuration
 * Priority: role.vendorTypes -> role.serviceCategory -> role.category -> fallback
 */
export function determineServiceCategory(role: any): string {
  if (!role) return 'N/A';
  
  // First priority: Extract from vendorTypes array
  if (role.vendorTypes && role.vendorTypes.length > 0) {
    return getServiceCategoryFromVendorTypes(role.vendorTypes);
  }
  
  // Second priority: Direct serviceCategory field
  if (role.serviceCategory) {
    return role.serviceCategory;
  }
  
  // Third priority: Category field
  if (role.category) {
    return role.category;
  }
  
  // Fallback
  return 'Service Providers';
}
