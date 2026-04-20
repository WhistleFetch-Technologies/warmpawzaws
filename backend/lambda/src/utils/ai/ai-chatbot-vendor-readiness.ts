/**
 * Vendor "customer visibility" snapshot for AI prompts — mirrors key checks used in
 * customer service discovery (approved/active/online, map pin, published services, VA2).
 * Read-only; vendor_id always comes from the authenticated session (caller).
 */

import { query } from '../../database/rds-connection';
import {
  getVendorIdsForAvailabilityLookup,
  resolveVendorById,
} from '../../endpoints/vendor/endpoints/vendorProfile.vendor';
import { logErrorSafe } from '../redact-for-log';
import { computeVendorReadinessMessages, formatVendorReadinessSection } from './ai-chatbot-vendor-readiness-core';

export {
  buildVendorAvailabilityV2OpenPredicateSql,
  computeVendorReadinessMessages,
  formatVendorReadinessSection,
  type VendorReadinessInputs,
} from './ai-chatbot-vendor-readiness-core';

async function countVendorAvailabilityV2Rows(availabilityIds: string[]): Promise<{ total_rows: number; open_rows: number }> {
  const ids = availabilityIds.length > 0 ? availabilityIds : [];
  if (ids.length === 0) return { total_rows: 0, open_rows: 0 };

  /** Same COALESCE as GET /vendor/:id/schedule (vendor-schedule.ts) so counts match the app. */
  const primary = await query(
    `SELECT
        COUNT(*)::int AS total_rows,
        COUNT(*) FILTER (WHERE COALESCE(va.is_enabled, va.is_available, true) = true)::int AS open_rows
      FROM vendor_availability_v2 va
      WHERE va.vendor_id::text = ANY($1::text[])`,
    [ids]
  ).catch((e: unknown) => {
    logErrorSafe('ai-chatbot-vendor-readiness-va2-primary', e);
    return null;
  });
  if (primary?.rows?.[0]) {
    const tr = parseInt(String(primary.rows[0].total_rows ?? '0'), 10) || 0;
    const op = parseInt(String(primary.rows[0].open_rows ?? '0'), 10) || 0;
    return { total_rows: tr, open_rows: op };
  }

  const legacy = await query(
    `SELECT
        COUNT(*)::int AS total_rows,
        COUNT(*) FILTER (WHERE COALESCE(va.is_available, true) = true)::int AS open_rows
      FROM vendor_availability_v2 va
      WHERE va.vendor_id::text = ANY($1::text[])`,
    [ids]
  ).catch((e2: unknown) => {
    logErrorSafe('ai-chatbot-vendor-readiness-va2-legacy', e2);
    return { rows: [{ total_rows: 0, open_rows: 0 }] };
  });
  const row = legacy.rows?.[0];
  return {
    total_rows: parseInt(String(row?.total_rows ?? '0'), 10) || 0,
    open_rows: parseInt(String(row?.open_rows ?? '0'), 10) || 0,
  };
}

export type VendorReadinessMetrics = {
  canonicalVendorId: string;
  availabilityIds: string[];
  publishedForDiscovery: number;
  availabilityTotalRows: number;
  availabilityOpenRows: number;
};

export async function fetchVendorReadinessLines(
  vendorId: string,
  vendorRow: Record<string, unknown>
): Promise<{ lines: string[]; metrics: VendorReadinessMetrics }> {
  const resolved = await resolveVendorById(vendorId).catch(() => null);
  const canonicalVendorId = resolved?.id ? String(resolved.id) : vendorId;
  const availabilityIds = await getVendorIdsForAvailabilityLookup(canonicalVendorId).catch(() => [canonicalVendorId]);

  const [svcRes, vaCounts] = (await Promise.all([
    query(
      `SELECT COUNT(*) FILTER (
          WHERE is_enabled = true
          AND (
            publish_status IS NULL
            OR LOWER(TRIM(COALESCE(publish_status::text, ''))) IN ('published', 'auto_published')
          )
        )::int AS published_for_discovery
       FROM vendor_services WHERE vendor_id = $1`,
      [canonicalVendorId]
    ).catch(() => ({ rows: [{ published_for_discovery: 0 }] })),
    countVendorAvailabilityV2Rows(availabilityIds),
  ])) as [{ rows?: Record<string, unknown>[] }, { total_rows: number; open_rows: number }];

  const vaRes = { rows: [{ total_rows: vaCounts.total_rows, open_rows: vaCounts.open_rows }] };

  const pub = parseInt(String(svcRes.rows?.[0]?.published_for_discovery ?? '0'), 10) || 0;
  const vaTotal = parseInt(String(vaRes.rows?.[0]?.total_rows ?? '0'), 10) || 0;
  const vaOpen = parseInt(String(vaRes.rows?.[0]?.open_rows ?? '0'), 10) || 0;

  const lines = computeVendorReadinessMessages({
    status: vendorRow.status,
    isActive: vendorRow.is_active,
    isOnline: vendorRow.is_online,
    latitude: vendorRow.latitude,
    longitude: vendorRow.longitude,
    businessName: vendorRow.business_name,
    publishedForDiscoveryServices: pub,
    availabilityTotalRows: vaTotal,
    availabilityOpenRows: vaOpen,
  });
  /** Bedrock sometimes echoed "no rows" despite checks passing — force explicit counts into the prompt. */
  if (vaTotal > 0) {
    lines.splice(
      1,
      0,
      `- Saved weekly schedule in the system: ${vaTotal} time-window row(s); ${vaOpen} turned on for customers to book. If the user asks whether they have availability, confirm these counts in plain language (Scheduling tab) — do not say they have none.`
    );
  }
  return {
    lines,
    metrics: {
      canonicalVendorId,
      availabilityIds,
      publishedForDiscovery: pub,
      availabilityTotalRows: vaTotal,
      availabilityOpenRows: vaOpen,
    },
  };
}
