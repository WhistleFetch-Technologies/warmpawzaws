/** Page size for vendor product list API (matches backend default). */
export const VENDOR_PRODUCT_PAGE_SIZE = 50;

export type VendorProductServerStatus = 'active' | 'inactive';

export interface VendorProductListQueryParams {
  limit?: number;
  offset: number;
  search?: string;
  category?: string;
  serverStatus?: VendorProductServerStatus;
}

/**
 * Build query string for GET /vendor/:vendorId/products.
 */
export function buildVendorProductListQuery(params: VendorProductListQueryParams): string {
  const sp = new URLSearchParams();
  const limit = params.limit ?? VENDOR_PRODUCT_PAGE_SIZE;
  sp.set('limit', String(limit));
  sp.set('offset', String(Math.max(0, params.offset)));

  const search = params.search?.trim();
  if (search) {
    sp.set('search', search);
  }

  const category = params.category?.trim();
  if (category && category !== 'all') {
    sp.set('category', category);
  }

  if (params.serverStatus === 'active' || params.serverStatus === 'inactive') {
    sp.set('status', params.serverStatus);
  }

  return sp.toString();
}

export function vendorProductListPath(
  sellerId: string,
  params: VendorProductListQueryParams,
): string {
  const qs = buildVendorProductListQuery(params);
  return `/vendor/${sellerId}/products?${qs}`;
}
