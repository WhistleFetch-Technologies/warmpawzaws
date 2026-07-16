/**
 * Published policy bundle loader — reads from DB with in-process cache, falls back to defaults.
 */
import { query } from '../../database/rds-connection';
import {
  buildDefaultPolicyBundle,
  syncBusinessRulesToEngine,
  ensureBusinessRules,
  type DiscountPolicyBundle,
} from '../config/business-rules-mapper';
import type {
  FundingConfiguration,
  LimitConfiguration,
  PriorityConfiguration,
  StackPolicyConfiguration,
} from '../config/types';

interface PublishedPolicyRow {
  publish_id: string;
  bundle: DiscountPolicyBundle;
  fingerprint: string;
  published_at: string;
  published_by: string | null;
}

let cachedPublished: PublishedPolicyRow | null = null;
let cachedDraft: DiscountPolicyBundle | null = null;
let cacheLoadedAt = 0;
let lastLoadFailedAt = 0;
const CACHE_TTL_MS = 30_000;
// After a failed DB load, don't retry on every request — a struggling DB
// (e.g. the Jul 14 2026 prod slowness event) shouldn't be hammered by policy reloads.
const FAILURE_RETRY_BACKOFF_MS = 60_000;

// A successful load with no published row is also a cacheable answer — otherwise
// every discount lookup re-queries the DB while no policy is published.
function isCacheFresh(): boolean {
  return cacheLoadedAt > 0 && Date.now() - cacheLoadedAt < CACHE_TTL_MS;
}

function isInFailureBackoff(): boolean {
  return lastLoadFailedAt > 0 && Date.now() - lastLoadFailedAt < FAILURE_RETRY_BACKOFF_MS;
}

export function invalidatePolicyCache(): void {
  cachedPublished = null;
  cachedDraft = null;
  cacheLoadedAt = 0;
  lastLoadFailedAt = 0;
}

export async function loadPublishedPolicyFromDb(): Promise<PublishedPolicyRow | null> {
  if (isCacheFresh()) return cachedPublished;
  if (isInFailureBackoff()) return cachedPublished;

  try {
    const res = await query(
      `SELECT publish_id, bundle, fingerprint, published_at, published_by
       FROM discount_policy_versions
       WHERE status = 'active'
       ORDER BY published_at DESC
       LIMIT 1`
    );
    const row = res.rows?.[0] as Record<string, unknown> | undefined;
    if (!row?.bundle) {
      cachedPublished = null;
      cacheLoadedAt = Date.now();
      return null;
    }

    const bundle =
      typeof row.bundle === 'string'
        ? (JSON.parse(row.bundle) as DiscountPolicyBundle)
        : (row.bundle as DiscountPolicyBundle);

    const synced = syncBusinessRulesToEngine(bundle, ensureBusinessRules(bundle));

    cachedPublished = {
      publish_id: String(row.publish_id),
      bundle: synced,
      fingerprint: String(row.fingerprint),
      published_at: String(row.published_at),
      published_by: row.published_by ? String(row.published_by) : null,
    };
    cacheLoadedAt = Date.now();
    lastLoadFailedAt = 0;
    return cachedPublished;
  } catch (err) {
    lastLoadFailedAt = Date.now();
    // Stable token for a CloudWatch metric filter / alarm — a published policy
    // exists but could not be loaded, so the engine is running on stale or
    // default policy. Must be alerted on before live campaigns depend on it.
    console.error('[discount-policy] ALERT policy_db_load_failed', {
      error: err instanceof Error ? err.message : String(err),
      servingStaleCache: cachedPublished != null,
      staleCacheAgeMs: cachedPublished ? Date.now() - cacheLoadedAt : null,
      retryBackoffMs: FAILURE_RETRY_BACKOFF_MS,
    });
    // Serve the last good published bundle (stale beats defaults) when we have one.
    return cachedPublished;
  }
}

export async function loadDraftPolicyFromDb(): Promise<DiscountPolicyBundle | null> {
  try {
    const res = await query(
      `SELECT bundle FROM discount_policy_draft WHERE id = 'singleton' LIMIT 1`
    );
    const row = res.rows?.[0] as Record<string, unknown> | undefined;
    if (!row?.bundle) return null;
    const bundle =
      typeof row.bundle === 'string'
        ? (JSON.parse(row.bundle) as DiscountPolicyBundle)
        : (row.bundle as DiscountPolicyBundle);
    cachedDraft = syncBusinessRulesToEngine(bundle, ensureBusinessRules(bundle));
    return cachedDraft;
  } catch {
    return null;
  }
}

export function getActivePolicyBundleSync(): DiscountPolicyBundle {
  if (cachedPublished?.bundle) return cachedPublished.bundle;
  return buildDefaultPolicyBundle();
}

export async function getActivePolicyBundle(): Promise<{
  bundle: DiscountPolicyBundle;
  publishId?: string;
  fingerprint?: string;
  publishedAt?: string;
  publishedBy?: string | null;
}> {
  const published = await loadPublishedPolicyFromDb();
  if (published) {
    return {
      bundle: published.bundle,
      publishId: published.publish_id,
      fingerprint: published.fingerprint,
      publishedAt: published.published_at,
      publishedBy: published.published_by,
    };
  }
  const defaults = buildDefaultPolicyBundle();
  return { bundle: defaults };
}

export function loadPriorityFromBundle(bundle: DiscountPolicyBundle): PriorityConfiguration {
  return structuredClone(bundle.priority);
}

export function loadStackFromBundle(bundle: DiscountPolicyBundle): StackPolicyConfiguration {
  return structuredClone(bundle.stack);
}

export function loadFundingFromBundle(bundle: DiscountPolicyBundle): FundingConfiguration {
  return structuredClone(bundle.funding);
}

export function loadLimitsFromBundle(bundle: DiscountPolicyBundle): LimitConfiguration {
  return structuredClone(bundle.limits);
}
