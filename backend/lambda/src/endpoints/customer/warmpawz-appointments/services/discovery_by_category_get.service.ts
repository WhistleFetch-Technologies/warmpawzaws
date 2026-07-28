import type { Context } from 'hono';
import { buildAppointmentVendorListResponse } from '../../../../utils/appointment-list-response';
import { dbListWapptDiscoveryByCategory } from '../repos/discovery_by_category_get.repo';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

function parseServiceStyle(raw: string | undefined): 'all' | 'at_center' | 'at_home' {
  const style = String(raw || 'all').toLowerCase().trim();
  if (style === 'at_center' || style === 'at_clinic' || style === 'at_vendor') return 'at_center';
  if (style === 'at_home' || style === 'home_visit') return 'at_home';
  return 'all';
}

export async function executeDiscoveryByCategoryGet(c: Context) {
  const category = String(c.req.query('category') || '').trim().toLowerCase();
  if (!category) {
    return c.json({ success: false, error: 'category is required' }, 400);
  }

  const serviceStyle = parseServiceStyle(c.req.query('serviceStyle'));
  const limit = Math.min(
    Math.max(parseInt(String(c.req.query('limit') || DEFAULT_LIMIT), 10) || DEFAULT_LIMIT, 1),
    MAX_LIMIT,
  );
  const page = Math.max(parseInt(String(c.req.query('page') || '1'), 10) || 1, 1);
  const offset = (page - 1) * limit;

  const { rows, total } = await dbListWapptDiscoveryByCategory({
    category,
    serviceStyle,
    limit,
    offset,
  });

  const enrichedCards = rows.map((row) => {
    const name =
      String(row.business_name || '').trim() ||
      String(row.owner_name || '').trim() ||
      'Provider';
    return {
      vendorId: row.vendor_id,
      id: row.vendor_id,
      name,
      photoUrl: row.profile_image,
      roleDisplayName: row.role_display_name || row.role_name || '',
      rating: Number(row.avg_rating) || 0,
      reviewCount: Number(row.review_count) || 0,
      isVerified: true,
      isOnline: row.is_online,
      city: row.city,
      address: row.address,
      serviceStyle: serviceStyle === 'all' ? undefined : serviceStyle,
    };
  });

  const hasMore = offset + rows.length < total;
  const nextCursor = hasMore ? String(page + 1) : null;

  return c.json(
    buildAppointmentVendorListResponse({
      style: serviceStyle,
      enrichedCards,
      nextCursor,
      appliedFilters: { category, serviceStyle, page, limit },
      serviceStyleNorm: serviceStyle === 'all' ? undefined : serviceStyle,
    }),
  );
}
