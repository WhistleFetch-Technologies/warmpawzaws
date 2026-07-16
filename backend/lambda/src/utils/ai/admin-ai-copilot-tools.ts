/**
 * Execute allowlisted admin copilot tools (parameterized SQL only).
 *
 * Phase 3: add new tools here + in admin-ai-copilot-tools-core allowlist; map each to
 * `hasAdminPermission` in toolRequestAllowedForPermissions. Consider CloudWatch metrics
 * per tool and regex-based PII stripping on row payloads before returning to the model.
 */
import { query } from '../../database/rds-connection';
import type { AdminCopilotToolRequest } from './admin-ai-copilot-tools-core';

export type AdminQueryFn = (sql: string, params?: unknown[]) => Promise<{ rows?: Record<string, unknown>[] }>;

const SAFE_PLATFORM_SETTING_KEYS = new Set(['admin:settings:ai_copilot', 'admin:settings:aws']);

function redactAwsSettingsForCopilot(parsed: Record<string, unknown>): Record<string, unknown> {
  const bedrock = parsed.bedrock;
  const out: Record<string, unknown> = {
    bedrock:
      bedrock && typeof bedrock === 'object'
        ? {
            enabled: (bedrock as Record<string, unknown>).enabled,
            modelId: (bedrock as Record<string, unknown>).modelId,
            region: (bedrock as Record<string, unknown>).region,
          }
        : {},
  };
  return out;
}

async function runPendingVendorApplicationsSummary(runQuery: AdminQueryFn): Promise<Record<string, unknown>> {
  const res = await runQuery(
    `SELECT COUNT(*)::int AS c
     FROM vendor_onboarding_applications voa
     LEFT JOIN vendor_identity vi ON vi.id = voa.vendor_identity_id
     WHERE voa.status IN ('SUBMITTED', 'PENDING', 'UNDER_REVIEW')
       AND (vi.is_deleted IS NULL OR vi.is_deleted = false OR vi.is_deleted = 'f')`
  ).catch(() => ({ rows: [] as Record<string, unknown>[] }));
  const count = parseInt(String(res.rows?.[0]?.c ?? '0'), 10) || 0;

  const recent = await runQuery(
    `SELECT voa.id, vi.business_name, voa.status, COALESCE(voa.submitted_at, voa.created_at) AS at
     FROM vendor_onboarding_applications voa
     LEFT JOIN vendor_identity vi ON vi.id = voa.vendor_identity_id
     WHERE voa.status IN ('SUBMITTED', 'PENDING', 'UNDER_REVIEW')
       AND (vi.is_deleted IS NULL OR vi.is_deleted = false OR vi.is_deleted = 'f')
     ORDER BY COALESCE(voa.submitted_at, voa.created_at) DESC NULLS LAST
     LIMIT 5`
  ).catch(() => ({ rows: [] as Record<string, unknown>[] }));

  return {
    pendingApplicationCount: count,
    recentApplications: (recent.rows || []).map((r) => ({
      id: r.id,
      businessName: r.business_name || null,
      status: r.status,
      at: r.at,
    })),
    source: 'vendor_onboarding_applications',
  };
}

async function runPlatformSettingJsonSafe(
  runQuery: AdminQueryFn,
  key: string
): Promise<Record<string, unknown>> {
  const k = String(key || '').trim();
  if (!SAFE_PLATFORM_SETTING_KEYS.has(k)) {
    return { error: 'unsupported_key', allowedKeys: [...SAFE_PLATFORM_SETTING_KEYS] };
  }
  const res = await runQuery(
    `SELECT setting_key, setting_value FROM platform_settings WHERE setting_key = $1 LIMIT 1`,
    [k]
  ).catch(() => ({ rows: [] as Record<string, unknown>[] }));
  const row = res.rows?.[0] as Record<string, unknown> | undefined;
  if (!row) return { key: k, found: false };

  let raw = row.setting_value as unknown;
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return { key: k, found: true, valuePreview: (raw as string).slice(0, 200) };
    }
  }
  if (k === 'admin:settings:aws' && raw && typeof raw === 'object') {
    return { key: k, found: true, value: redactAwsSettingsForCopilot(raw as Record<string, unknown>) };
  }
  return { key: k, found: true, value: raw };
}

const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function runVendorPublicSnapshot(runQuery: AdminQueryFn, vendorId: string): Promise<Record<string, unknown>> {
  const id = String(vendorId || '').trim();
  if (!uuidRe.test(id)) return { error: 'invalid_vendor_id' };
  const res = await runQuery(
    `SELECT id, business_name, status, city, state, is_active, created_at
     FROM vendors
     WHERE id = $1::uuid
       AND (is_deleted IS NULL OR is_deleted = false OR is_deleted = 'f')
     LIMIT 1`,
    [id]
  ).catch(() => ({ rows: [] as Record<string, unknown>[] }));
  const row = res.rows?.[0];
  if (!row) return { found: false, vendorId: id };
  return {
    found: true,
    vendor: {
      id: row.id,
      businessName: row.business_name,
      status: row.status,
      city: row.city,
      state: row.state,
      isActive: row.is_active,
      createdAt: row.created_at,
    },
    source: 'vendors',
  };
}

export async function executeAdminCopilotToolRequests(
  requests: AdminCopilotToolRequest[],
  runQuery: AdminQueryFn = query
): Promise<Record<string, unknown>> {
  const results: Record<string, unknown> = {};
  for (const req of requests) {
    if (req.name === 'get_pending_vendor_applications_summary') {
      results.get_pending_vendor_applications_summary = await runPendingVendorApplicationsSummary(runQuery);
    } else if (req.name === 'get_platform_setting_json_safe') {
      const key = typeof req.args?.key === 'string' ? req.args.key : '';
      results.get_platform_setting_json_safe = await runPlatformSettingJsonSafe(runQuery, key);
    } else if (req.name === 'get_vendor_public_snapshot') {
      const vendorId = typeof req.args?.vendorId === 'string' ? req.args.vendorId : '';
      results.get_vendor_public_snapshot = await runVendorPublicSnapshot(runQuery, vendorId);
    }
  }
  return results;
}
