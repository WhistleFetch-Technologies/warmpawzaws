/**
 * Policy loader resilience — after the Jul 14 2026 prod incident where
 * discount_policy_versions lookups timed out and the engine silently dropped to
 * default policy: failures must serve the last good bundle, back off from a
 * struggling DB, and emit an alertable log token.
 */
import { describe, expect, test, jest, beforeEach, afterEach } from '@jest/globals';

jest.mock('../../../database/rds-connection', () => ({
  query: jest.fn(),
}));

jest.mock('../../config/business-rules-mapper', () => ({
  buildDefaultPolicyBundle: jest.fn(() => ({ default: true })),
  ensureBusinessRules: jest.fn(() => ({})),
  syncBusinessRulesToEngine: jest.fn((bundle: unknown) => bundle),
}));

import { query } from '../../../database/rds-connection';
import {
  loadPublishedPolicyFromDb,
  invalidatePolicyCache,
  getActivePolicyBundleSync,
} from '../policy-persistence';

const mockedQuery = query as jest.MockedFunction<any>;

const publishedRow = {
  publish_id: 'pub-1',
  bundle: { priority: {}, stack: {}, funding: {}, limits: {} },
  fingerprint: 'fp-1',
  published_at: '2026-07-01T00:00:00Z',
  published_by: 'admin',
};

describe('loadPublishedPolicyFromDb', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    invalidatePolicyCache();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('loads and caches the active published bundle', async () => {
    mockedQuery.mockResolvedValue({ rows: [publishedRow] });

    const first = await loadPublishedPolicyFromDb();
    const second = await loadPublishedPolicyFromDb();

    expect(first?.publish_id).toBe('pub-1');
    expect(second?.publish_id).toBe('pub-1');
    expect(mockedQuery).toHaveBeenCalledTimes(1); // second call served from cache
  });

  test('caches a "no published policy" answer instead of re-querying every call', async () => {
    mockedQuery.mockResolvedValue({ rows: [] });

    expect(await loadPublishedPolicyFromDb()).toBeNull();
    expect(await loadPublishedPolicyFromDb()).toBeNull();

    expect(mockedQuery).toHaveBeenCalledTimes(1);
    expect(getActivePolicyBundleSync()).toEqual({ default: true });
  });

  test('serves the stale cached bundle when the DB load fails, with an alertable error log', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockedQuery.mockResolvedValueOnce({ rows: [publishedRow] });
    const first = await loadPublishedPolicyFromDb();
    expect(first?.publish_id).toBe('pub-1');

    invalidateTtlOnly();
    mockedQuery.mockRejectedValueOnce(new Error('Query timeout: exceeded 25000ms'));
    const afterFailure = await loadPublishedPolicyFromDb();

    expect(afterFailure?.publish_id).toBe('pub-1'); // stale beats defaults
    expect(errorSpy).toHaveBeenCalledWith(
      '[discount-policy] ALERT policy_db_load_failed',
      expect.objectContaining({ servingStaleCache: true })
    );
    errorSpy.mockRestore();
  });

  test('backs off after a failure instead of hammering the DB on every request', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockedQuery.mockRejectedValue(new Error('connection refused'));

    expect(await loadPublishedPolicyFromDb()).toBeNull();
    expect(await loadPublishedPolicyFromDb()).toBeNull();
    expect(await loadPublishedPolicyFromDb()).toBeNull();

    expect(mockedQuery).toHaveBeenCalledTimes(1); // subsequent calls inside backoff window
    expect(getActivePolicyBundleSync()).toEqual({ default: true });
    errorSpy.mockRestore();
  });
});

/**
 * Expire the freshness TTL without wiping the cached bundle (invalidatePolicyCache
 * clears everything). Freezes Date.now past the TTL window; restored by afterEach.
 */
function invalidateTtlOnly() {
  const jump = Date.now() + 31_000;
  jest.spyOn(Date, 'now').mockReturnValue(jump);
}
