/**
 * Stage 3 — pharmacy nearby debug diagnostic.
 * Admin-only. Returns aggregate counts only (no vendor rows or coordinates).
 */

import type { Context } from 'hono';
import { query } from '../database/rds-connection';
import { isAdminRole } from '../utils/security-ownership';
import { captureException } from '../utils/error-tracking';
import { SAFE_INTERNAL_ERROR_MESSAGE } from '../utils/safe-hono-error';

export async function executePharmacyNearbyPharmaciesDebug(c: Context) {
  try {
    if (!isAdminRole(c)) {
      return c.json({ success: false, error: 'Forbidden' }, 403);
    }

    const lat = parseFloat(c.req.query('lat') || '19.0954');
    const lng = parseFloat(c.req.query('lng') || '72.8331');
    const radiusKm = parseFloat(c.req.query('radius') || '5');

    const vendorsWithCoordinates = await query(
      `SELECT COUNT(*)::text AS c
       FROM vendors v
       WHERE v.latitude IS NOT NULL
         AND v.latitude::text != ''
         AND v.longitude IS NOT NULL
         AND v.longitude::text != ''`,
      [],
    );

    const pharmacyVendors = await query(
      `SELECT COUNT(*)::text AS c
       FROM vendors v
       WHERE v.role_id IN (SELECT id FROM roles WHERE LOWER(name) LIKE '%pharmacy%')
         AND v.is_active = true
         AND v.status = 'approved'
         AND v.latitude IS NOT NULL
         AND v.latitude::text != ''
         AND v.longitude IS NOT NULL
         AND v.longitude::text != ''`,
      [],
    );

    return c.json({
      success: true,
      debug: {
        searchLocation: { lat, lng },
        radiusKm,
        counts: {
          vendorsWithCoordinates: parseInt(vendorsWithCoordinates.rows[0]?.c || '0', 10) || 0,
          approvedPharmaciesWithCoordinates:
            parseInt(pharmacyVendors.rows[0]?.c || '0', 10) || 0,
        },
        message: 'Diagnostic summary only; vendor records and coordinates are not exposed',
      },
    });
  } catch (error: unknown) {
    captureException(error instanceof Error ? error : new Error(String(error)), {
      path: c.req.path,
      method: c.req.method,
    });
    return c.json({ error: SAFE_INTERNAL_ERROR_MESSAGE }, 500);
  }
}
