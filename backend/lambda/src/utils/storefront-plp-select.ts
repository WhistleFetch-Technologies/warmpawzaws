/**
 * SELECT column lists for GET /ecommerce/products (PLP vs full row).
 */

/** Lean card DTO — omits description and vendor join; used with view=card. */
export const STOREFRONT_PLP_CARD_SELECT = `
  p.id, p.name, p.price, p.category_id, p.images,
  p.stock,
  p.vendor_id, p.rating, p.review_count, p.is_active,
  p.compare_at_price, p.specifications, p.metadata, p.weight,
  p.subcategory, p.created_at, p.is_featured,
  p.listing_ownership
`;

/** Full row + vendor fields for legacy clients (default). */
export const STOREFRONT_PLP_FULL_SELECT = `
  p.*, v.business_name as vendor_name,
  v.state as vendor_state,
  v.pincode as vendor_pincode,
  v.shipping_origin_pincode as vendor_shipping_origin_pincode
`;

export function isStorefrontCardView(queryView: string | undefined): boolean {
  const v = String(queryView ?? '').trim().toLowerCase();
  return v === 'card' || v === 'plp';
}
