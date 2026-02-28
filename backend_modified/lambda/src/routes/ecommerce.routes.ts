/**
 * ============================================================================
 * ECOMMERCE ROUTES
 * ============================================================================
 * 
 * Route registration for e-commerce endpoints
 * 
 * Date: 2026-01-28
 * Phase 7: E-commerce domain restructuring
 * ============================================================================
 */

import { Hono } from 'hono';

// Import from original backend (to be extracted to controllers/ecommerce/)
import { registerEcommerceEndpoints } from '../endpoints/ecommerce';
import { registerOrderManagementEndpoints } from '../endpoints/order-management';
import { registerReturnsEndpoints } from '../endpoints/returns';
import { registerBulkProductUploadEndpoints } from '../endpoints/bulk-product-upload';
import { registerProductReviewEndpoints } from '../endpoints/product-reviews';
import { registerProductVariationsEndpoints } from '../endpoints/product-variations';
import { registerRecommendationEndpoints } from '../endpoints/recommendations';
import { registerWishlistEndpoints } from '../endpoints/wishlist';
import { registerTaxInvoicePdfEndpoints } from '../endpoints/tax-invoice-pdf';

/**
 * Register all e-commerce-related routes
 */
export function registerEcommerceRoutes(app: Hono) {
  registerEcommerceEndpoints(app);
  registerOrderManagementEndpoints(app);
  registerReturnsEndpoints(app);
  registerBulkProductUploadEndpoints(app);
  registerProductReviewEndpoints(app);
  registerProductVariationsEndpoints(app);
  registerRecommendationEndpoints(app);
  registerWishlistEndpoints(app);
  registerTaxInvoicePdfEndpoints(app);
}
