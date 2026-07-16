/**
 * V2 authoritative "clean empty" ownership — resolveWithProductionMode must treat a
 * successful zero-savings pipeline run as a v2 decision when the call site opts in
 * (acceptEmptyResult), instead of logging a fallback and re-running legacy.
 * Context: prod logged ~1.9k resolver_result_unusable fallbacks per 48h with zero
 * active promotions, because empty results were classified unusable.
 */
import { describe, expect, test, jest, beforeEach, afterEach } from '@jest/globals';

jest.mock('../unified-discount-resolver', () => ({
  getUnifiedDiscountResolver: jest.fn(),
}));

import { getUnifiedDiscountResolver } from '../unified-discount-resolver';
import { resolveWithProductionMode } from '../production-bridge';
import {
  isResolverResultCleanEmpty,
  isResolverResultAuthoritativeUsable,
} from '../resolver-result-mappers';
import type { ResolverResult } from '../types';

const mockedGetResolver = getUnifiedDiscountResolver as jest.MockedFunction<
  typeof getUnifiedDiscountResolver
>;

function makeResult(overrides: Partial<ResolverResult> = {}): ResolverResult {
  return {
    originalAmount: 1000,
    totalSavings: 0,
    finalAmount: 1000,
    applied: [],
    benefits: [],
    messages: [],
    warnings: [],
    metadata: {},
    eligibleCandidates: [],
    rejectedCandidates: [],
    appliedCandidates: [],
    benefitResults: [],
    ruleResults: [],
    executionTimeMs: 5,
    resolverVersion: 'test',
    ...overrides,
  };
}

function stubResolver(result: ResolverResult | Error) {
  mockedGetResolver.mockReturnValue({
    resolve: async () => {
      if (result instanceof Error) throw result;
      return result;
    },
  } as unknown as ReturnType<typeof getUnifiedDiscountResolver>);
}

const context = { domain: 'SERVICE', trigger: 'AUTO' } as never;
const envBackup = { ...process.env };

describe('resolveWithProductionMode — empty result ownership (AUTHORITATIVE)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.DISCOUNT_ENGINE_V2_RESOLVER_MODE = 'AUTHORITATIVE';
  });

  afterEach(() => {
    process.env = { ...envBackup };
  });

  test('clean empty result is v2-owned when acceptEmptyResult is set (legacy not called)', async () => {
    stubResolver(makeResult());
    const legacy = jest.fn(async () => 'legacy-value');

    const { value, source } = await resolveWithProductionMode({
      label: 'test-auto',
      context,
      legacy,
      mapResolverToLegacy: () => 'v2-empty',
      acceptEmptyResult: true,
    });

    expect(source).toBe('v2');
    expect(value).toBe('v2-empty');
    expect(legacy).not.toHaveBeenCalled();
  });

  test('clean empty result still falls back to legacy without acceptEmptyResult (code paths)', async () => {
    stubResolver(makeResult());
    const legacy = jest.fn(async () => 'legacy-value');

    const { value, source } = await resolveWithProductionMode({
      label: 'test-code',
      context,
      legacy,
      mapResolverToLegacy: () => 'v2-empty',
    });

    expect(source).toBe('legacy');
    expect(value).toBe('legacy-value');
    expect(legacy).toHaveBeenCalledTimes(1);
  });

  test('empty result with priority fallbackReason is NOT v2-owned even with acceptEmptyResult', async () => {
    stubResolver(
      makeResult({ metadata: { priority: { fallbackReason: 'PRIORITY_ENGINE_FAILED' } } })
    );
    const legacy = jest.fn(async () => 'legacy-value');

    const { source } = await resolveWithProductionMode({
      label: 'test-auto',
      context,
      legacy,
      mapResolverToLegacy: () => 'v2-empty',
      acceptEmptyResult: true,
    });

    expect(source).toBe('legacy');
    expect(legacy).toHaveBeenCalledTimes(1);
  });

  test('result with savings stays v2 regardless of acceptEmptyResult', async () => {
    stubResolver(makeResult({ totalSavings: 100, finalAmount: 900 }));
    const legacy = jest.fn(async () => 'legacy-value');

    const { source, value } = await resolveWithProductionMode({
      label: 'test-auto',
      context,
      legacy,
      mapResolverToLegacy: (r) => `v2-${r.totalSavings}`,
    });

    expect(source).toBe('v2');
    expect(value).toBe('v2-100');
    expect(legacy).not.toHaveBeenCalled();
  });

  test('pipeline error falls back to legacy even with acceptEmptyResult', async () => {
    stubResolver(new Error('boom'));
    const legacy = jest.fn(async () => 'legacy-value');

    const { source, value } = await resolveWithProductionMode({
      label: 'test-auto',
      context,
      legacy,
      mapResolverToLegacy: () => 'v2',
      acceptEmptyResult: true,
    });

    expect(source).toBe('legacy');
    expect(value).toBe('legacy-value');
  });
});

describe('isResolverResultCleanEmpty', () => {
  test('true for a successful zero-savings run', () => {
    expect(isResolverResultCleanEmpty(makeResult())).toBe(true);
  });

  test('false for null', () => {
    expect(isResolverResultCleanEmpty(null)).toBe(false);
  });

  test('false when priority fell back', () => {
    expect(
      isResolverResultCleanEmpty(
        makeResult({ metadata: { priority: { fallbackReason: 'POLICY_VALIDATION_FAILED' } } })
      )
    ).toBe(false);
  });

  test('false when result has savings (that is usable, not empty)', () => {
    const withSavings = makeResult({ totalSavings: 50 });
    expect(isResolverResultCleanEmpty(withSavings)).toBe(false);
    expect(isResolverResultAuthoritativeUsable(withSavings)).toBe(true);
  });

  test('false when a benefit carries savings even if totals are zero', () => {
    const result = makeResult({
      benefitResults: [{ candidate: {} as never, benefit: {} as never, discountAmount: 25 }],
    });
    expect(isResolverResultCleanEmpty(result)).toBe(false);
    expect(isResolverResultAuthoritativeUsable(result)).toBe(true);
  });
});
