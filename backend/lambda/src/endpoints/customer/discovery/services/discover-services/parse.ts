import type { Context } from 'hono';
import { getDiscoveryRules } from '../../../../../lib/rule-engine';
import { resolveVendorListSqlPage } from '../../../../../utils/discovery-list-pagination';
import {
  acceptableStylesForService,
  discoveryCustomerRadiusKm,
  getCustomerCoordinates,
  normalizeServiceStyle,
} from '../../repos/legacy-helpers.repo';
import type { DiscoverServicesParsed } from './types';

export type ParseDiscoverServicesResult =
  | { ok: false; response: Response }
  | { ok: true; parsed: DiscoverServicesParsed };

export async function parseDiscoverServicesRequest(c: Context): Promise<ParseDiscoverServicesResult> {
  const serviceStyle = c.req.query('serviceStyle') || c.req.query('style');
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

  const serviceStyleNormDiscover = normalizeServiceStyle(serviceStyle) || serviceStyle;

  const category = c.req.query('category');
  const roleId = c.req.query('roleId');
  const problemTitle = c.req.query('problemTitle');
  const specializationFilterDiscover = (
    c.req.query('specialization') ||
    c.req.query('specializationId') ||
    ''
  ).trim();
  /** Opt-in: attach slim services[] on cards. Default = cards only (priceMin/Max/serviceCount). */
  const fullEnrichDiscover =
    c.req.query('fullEnrich') === 'true' || c.req.query('full') === 'true';
  // Accept lat/lon and latitude/longitude aliases (different parts of the
  // app use different spellings — keep them all working).
  let latitude = c.req.query('latitude') || c.req.query('lat');
  let longitude =
    c.req.query('longitude') || c.req.query('lng') || c.req.query('lon');

  // If coordinates not provided, fetch from customer address (with pincode fallback)
  let customerApproximateDiscover = false;
  if (!latitude || !longitude) {
    const customerPhone = c.req.query('customerPhone') || c.req.query('phone') || null;
    const coords = await getCustomerCoordinates(customerPhone || undefined);
    if (coords) {
      latitude = String(coords.latitude);
      longitude = String(coords.longitude);
      customerApproximateDiscover = !!coords.approximate;
      console.log(`[discover-services] Using coordinates from customer address: ${latitude}, ${longitude}, approx=${customerApproximateDiscover}`);
    }
  }

  // Rules and sorting defaults
  const rules = await getDiscoveryRules(
    roleId || category || 'all', 'discover', serviceStyle as string, category || undefined
  );
  const listPage = resolveVendorListSqlPage(c.req.query('limit'), c.req.query('cursor'));
  const { sqlOffset, resultOffset, sqlLimit, pageSize } = listPage;
  const maxResults = sqlLimit;
  const radius = discoveryCustomerRadiusKm({
    rules,
    serviceStyleNorm: serviceStyleNormDiscover,
    radiusFromQuery: c.req.query('radius') || undefined,
  });
  const maxDistanceKm = c.req.query('maxDistance') ? parseFloat(c.req.query('maxDistance')!) : null;
  const minRatingVal = c.req.query('minRating') ? parseFloat(c.req.query('minRating')!) : null;
  const sortBy = c.req.query('sortBy') || (rules.discovery_sort_default as string) || 'relevance';

  const acceptableStyles = acceptableStylesForService(serviceStyle);
  const customerLat = latitude ? parseFloat(latitude) : null;
  const customerLng = longitude ? parseFloat(longitude) : null;
  const isAtCenter = serviceStyle === 'at_center';

  return {
    ok: true,
    parsed: {
      serviceStyle,
      serviceStyleNormDiscover,
      category,
      roleId,
      problemTitle,
      specializationFilterDiscover,
      fullEnrichDiscover,
      customerLat,
      customerLng,
      customerApproximateDiscover,
      rules,
      sqlOffset,
      resultOffset,
      sqlLimit,
      pageSize,
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
