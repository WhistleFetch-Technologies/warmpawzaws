/**
 * ============================================================================
 * SERVICE CATEGORY MAPPING
 * ============================================================================
 *
 * Centralized mapping for vendor types to service categories
 *
 * Date: 2025-01-28
 * Migration: Supabase → Lambda
 * ============================================================================
 */
export declare const VENDOR_TYPE_TO_CATEGORY: Record<string, string>;
export declare const CATEGORY_IDS: Record<string, string>;
/**
 * Get service category from vendor types array
 */
export declare function getServiceCategoryFromVendorTypes(vendorTypes: string[] | string | undefined): string;
/**
 * Get category ID from service category name
 */
export declare function getCategoryId(categoryName: string): string;
/**
 * Determine service category from role configuration
 * Priority: role.vendorTypes -> role.serviceCategory -> role.category -> fallback
 */
export declare function determineServiceCategory(role: any): string;
//# sourceMappingURL=service-category-mapping.d.ts.map