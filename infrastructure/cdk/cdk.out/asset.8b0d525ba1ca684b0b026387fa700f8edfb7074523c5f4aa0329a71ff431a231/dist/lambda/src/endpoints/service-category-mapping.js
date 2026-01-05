"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.CATEGORY_IDS = exports.VENDOR_TYPE_TO_CATEGORY = void 0;
exports.getServiceCategoryFromVendorTypes = getServiceCategoryFromVendorTypes;
exports.getCategoryId = getCategoryId;
exports.determineServiceCategory = determineServiceCategory;
exports.VENDOR_TYPE_TO_CATEGORY = {
    'healthcare_provider': 'Healthcare Providers',
    'service_provider': 'Service Providers',
    'seller': 'Product Sellers',
    'product_seller': 'Product Sellers'
};
exports.CATEGORY_IDS = {
    'Healthcare Providers': 'healthcare',
    'Service Providers': 'services',
    'Product Sellers': 'products'
};
/**
 * Get service category from vendor types array
 */
function getServiceCategoryFromVendorTypes(vendorTypes) {
    if (!vendorTypes)
        return 'N/A';
    // Handle string or array
    const types = Array.isArray(vendorTypes) ? vendorTypes : [vendorTypes];
    // Get the first vendor type and map it
    const firstType = types[0];
    return exports.VENDOR_TYPE_TO_CATEGORY[firstType] || 'Service Providers';
}
/**
 * Get category ID from service category name
 */
function getCategoryId(categoryName) {
    return exports.CATEGORY_IDS[categoryName] || 'services';
}
/**
 * Determine service category from role configuration
 * Priority: role.vendorTypes -> role.serviceCategory -> role.category -> fallback
 */
function determineServiceCategory(role) {
    if (!role)
        return 'N/A';
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
//# sourceMappingURL=service-category-mapping.js.map