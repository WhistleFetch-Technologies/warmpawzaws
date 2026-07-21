import type { Context } from 'hono';
import { getDiscoveryRules } from '../../../../../lib/rule-engine';
import { resolveVendorListSqlPage } from '../../../../../utils/discovery-list-pagination';
import {
  acceptableStylesForService,
  discoveryCustomerRadiusKm,
  getCustomerCoordinates,
  normalizeServiceStyle,
} from '../../repos/legacy-helpers.repo';
import type { ServicesByStyleParsed } from './types';

export type ParseServicesByStyleResult =
  | { ok: false; response: Response }
  | { ok: true; parsed: ServicesByStyleParsed };

export async function parseServicesByStyleRequest(c: Context): Promise<ParseServicesByStyleResult> {
  const serviceStyle = c.req.query('style');
  if (!serviceStyle) {
    return {
      ok: false,
      response: c.json(
        {
          error: 'Service style is required (tele, at_home, at_center)',
          success: false,
        },
        400
      ),
    };
  }

  const serviceStyleNormByStyle = normalizeServiceStyle(serviceStyle) || serviceStyle;

  const category = c.req.query('category');
  const roleId = c.req.query('roleId');
  const problemTitle = c.req.query('problemTitle');
  const specializationFilterByStyle = (
    c.req.query('specialization') ||
    c.req.query('specializationId') ||
    ''
  ).trim();
  /** Cards-only by default (same as discover-services). Legacy hydrate via fullEnrich/full only. */
  const fullEnrichByStyle =
    c.req.query('fullEnrich') === 'true' || c.req.query('full') === 'true';
  let latitude = c.req.query('latitude') || c.req.query('lat');
  let longitude =
    c.req.query('longitude') || c.req.query('lng') || c.req.query('lon');
  let customerApproximateByStyle = false;
  const customerPhoneForByStyle = c.req.query('customerPhone') || c.req.query('phone') || null;

  if (!latitude || !longitude) {
    const coords = await getCustomerCoordinates(customerPhoneForByStyle || undefined);
    if (coords) {
      latitude = String(coords.latitude);
      longitude = String(coords.longitude);
      customerApproximateByStyle = !!coords.approximate;
      console.log(`[by-style] Using coordinates from customer address: ${latitude}, ${longitude}, approx=${customerApproximateByStyle}`);
    } else if (customerPhoneForByStyle) {
      console.warn(
        '[by-style] No customer coordinates for distance: query omitted lat/lng and getCustomerCoordinates returned null. ' +
          'Ensure default address has coordinates or a 6-digit pincode (and Geocoding API key on Lambda), or pass latitude/longitude from the app.'
      );
    }
  }

  const rules = await getDiscoveryRules(
    roleId || category || 'all', 'discover', serviceStyle, category || undefined
  );

  const listPageByStyle = resolveVendorListSqlPage(c.req.query('limit'), c.req.query('cursor'));
  const {
    sqlOffset: sqlOffsetByStyle,
    resultOffset: resultOffsetByStyle,
    sqlLimit: sqlLimitByStyle,
    pageSize: pageSizeByStyle,
  } = listPageByStyle;
  const maxResults = sqlLimitByStyle;
  const radius = discoveryCustomerRadiusKm({
    rules,
    serviceStyleNorm: serviceStyleNormByStyle,
    radiusFromQuery: c.req.query('radius') || undefined,
  });
  const maxDistanceKm = c.req.query('maxDistance') ? parseFloat(c.req.query('maxDistance')!) : null;
  const minRatingVal = c.req.query('minRating') ? parseFloat(c.req.query('minRating')!) : null;
  const sortBy = c.req.query('sortBy') || (rules.discovery_sort_default as string) || 'relevance';

  const acceptableStyles = acceptableStylesForService(serviceStyle);
  const customerLat = latitude ? parseFloat(latitude) : null;
  const customerLng = longitude ? parseFloat(longitude) : null;
  if (
    (customerLat == null ||
      customerLng == null ||
      !Number.isFinite(customerLat) ||
      !Number.isFinite(customerLng)) &&
    (latitude || longitude)
  ) {
    console.warn('[by-style] Invalid latitude/longitude query values; distance will be omitted', {
      latitude,
      longitude,
    });
  }
  const isAtCenter = serviceStyle === 'at_center';

  return {
    ok: true,
    parsed: {
      serviceStyle,
      serviceStyleNormByStyle,
      category,
      roleId,
      problemTitle,
      specializationFilterByStyle,
      fullEnrichByStyle,
      customerLat,
      customerLng,
      customerApproximateByStyle,
      rules,
      sqlOffsetByStyle,
      resultOffsetByStyle,
      sqlLimitByStyle,
      pageSizeByStyle,
      maxResults,
      radius,
      maxDistanceKm,
      minRatingVal,
      sortBy,
      acceptableStyles,
      isAtCenter,
    },
  };
}
