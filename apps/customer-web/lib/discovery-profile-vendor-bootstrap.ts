/**
 * When by-style feed is paginated, a deep-linked vendorId may not appear on page 1.
 * Bootstrap a single provider row from GET /customer/vendor/:id.
 */
import { apiClient } from './api-client';

export async function fetchDiscoveryProfileVendorRow(
  vendorId: string
): Promise<Record<string, unknown> | null> {
  try {
    const res = (await apiClient.get(`/customer/vendor/${encodeURIComponent(vendorId)}`)) as {
      success?: boolean;
      vendor?: Record<string, unknown>;
    } & Record<string, unknown>;
    const vendor = (res?.vendor ?? res) as Record<string, unknown>;
    if (!vendor || typeof vendor !== 'object') return null;

    const id = String(vendor.id ?? vendor.vendorId ?? vendorId).trim();
    if (!id) return null;

    return {
      id,
      vendorId: id,
      providerId: id,
      name:
        vendor.business_name ??
        vendor.businessName ??
        vendor.name ??
        vendor.owner_name ??
        'Provider',
      businessName: vendor.business_name ?? vendor.businessName,
      vendorName: vendor.business_name ?? vendor.businessName,
      photoUrl: vendor.profile_photo_url ?? vendor.photoUrl ?? vendor.logo_url,
      profile_photo_url: vendor.profile_photo_url,
      logo_url: vendor.logo_url,
      address: vendor.address,
      city: vendor.city,
      phone: vendor.phone,
      rating: vendor.rating ?? vendor.avg_rating ?? 0,
      reviewCount: vendor.review_count ?? vendor.reviewCount ?? 0,
      roleDisplayName: vendor.role_display_name ?? vendor.roleDisplayName ?? vendor.role_name,
      roleName: vendor.role_name ?? vendor.roleName,
      role: vendor.role,
      services: [],
      serviceCount: 1,
    };
  } catch {
    return null;
  }
}
