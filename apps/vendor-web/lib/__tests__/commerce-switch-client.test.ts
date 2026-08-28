jest.mock('../api-client', () => ({
  apiClient: { get: jest.fn() },
}));

import { apiClient } from '../api-client';
import {
  clearCommerceSwitchCache,
  getActiveCommerceModel,
  getAvailableModels,
  getCommerceSwitchConfiguration,
  hasCommerceSwitchConfiguration,
  isCommerceSwitchDegraded,
  isMarketplace,
  isWarmpawzPay,
  prefetchCommerceSwitchConfiguration,
  prefetchCommerceSwitchConfigurationOnStartup,
  COMMERCE_SWITCH_CACHE_TTL_MS,
  isCommerceSwitchCacheStale,
} from '../commerce-switch-client';

const mockedGet = apiClient.get as jest.Mock;

describe('commerce-switch-client (read-only)', () => {
  beforeEach(() => {
    clearCommerceSwitchCache();
    mockedGet.mockReset();
  });

  it('defaults to marketplace before prefetch', () => {
    expect(getActiveCommerceModel()).toBe('marketplace');
    expect(isMarketplace()).toBe(true);
    expect(isWarmpawzPay()).toBe(false);
    expect(getAvailableModels()).toEqual(['marketplace']);
    expect(hasCommerceSwitchConfiguration()).toBe(false);
  });

  it('dedupes concurrent prefetch to a single API request', async () => {
    mockedGet.mockResolvedValue({
      activeModelId: 'marketplace',
      version: 3,
      schemaVersion: '1.0',
      availableModels: ['marketplace', 'warmpawz_pay'],
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    const [a, b, c] = await Promise.all([
      prefetchCommerceSwitchConfiguration(),
      prefetchCommerceSwitchConfiguration(),
      getCommerceSwitchConfiguration(),
    ]);

    expect(mockedGet).toHaveBeenCalledTimes(1);
    expect(mockedGet).toHaveBeenCalledWith('/config/commerce-switch');
    expect(a.version).toBe(3);
    expect(b).toEqual(a);
    expect(c).toEqual(a);
    expect(getActiveCommerceModel()).toBe('marketplace');
    expect(getAvailableModels()).toEqual(['marketplace', 'warmpawz_pay']);
    expect(hasCommerceSwitchConfiguration()).toBe(true);
  });

  it('startup prefetch runs only once', async () => {
    mockedGet.mockResolvedValue({
      activeModelId: 'warmpawz_pay',
      version: 2,
      schemaVersion: '1.0',
      availableModels: ['marketplace', 'warmpawz_pay'],
      updatedAt: '2026-01-02T00:00:00.000Z',
    });

    prefetchCommerceSwitchConfigurationOnStartup();
    prefetchCommerceSwitchConfigurationOnStartup();
    await prefetchCommerceSwitchConfiguration();

    expect(mockedGet).toHaveBeenCalledTimes(1);
    expect(isWarmpawzPay()).toBe(true);
    expect(isMarketplace()).toBe(false);
  });

  it('falls back to marketplace when API fails', async () => {
    mockedGet.mockRejectedValue(new Error('network error'));

    const config = await prefetchCommerceSwitchConfiguration();

    expect(config.activeModelId).toBe('marketplace');
    expect(config.degraded).toBe(true);
    expect(isCommerceSwitchDegraded()).toBe(true);
    expect(isMarketplace()).toBe(true);
  });

  it('serves cached config without additional requests until cleared', async () => {
    mockedGet.mockResolvedValue({
      activeModelId: 'marketplace',
      version: 1,
      schemaVersion: '1.0',
      availableModels: ['marketplace'],
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    await prefetchCommerceSwitchConfiguration();
    await prefetchCommerceSwitchConfiguration();

    expect(mockedGet).toHaveBeenCalledTimes(1);
  });

  it('keeps last-known Pay after cache TTL elapses', async () => {
    const now = 1_700_000_000_000;
    const dateNow = jest.spyOn(Date, 'now').mockReturnValue(now);
    mockedGet.mockResolvedValue({
      activeModelId: 'warmpawz_pay',
      version: 4,
      schemaVersion: '1.0',
      availableModels: ['marketplace', 'warmpawz_pay'],
      updatedAt: '2026-01-03T00:00:00.000Z',
    });

    await prefetchCommerceSwitchConfiguration();
    dateNow.mockReturnValue(now + COMMERCE_SWITCH_CACHE_TTL_MS + 1);

    expect(isWarmpawzPay()).toBe(true);
    expect(getActiveCommerceModel()).toBe('warmpawz_pay');
    expect(isCommerceSwitchCacheStale()).toBe(true);
    dateNow.mockRestore();
  });

  it('preserves last-known Pay when refresh fails after TTL', async () => {
    const now = 1_700_000_000_000;
    const dateNow = jest.spyOn(Date, 'now').mockReturnValue(now);
    mockedGet.mockResolvedValueOnce({
      activeModelId: 'warmpawz_pay',
      version: 4,
      schemaVersion: '1.0',
      availableModels: ['marketplace', 'warmpawz_pay'],
      updatedAt: '2026-01-03T00:00:00.000Z',
    });

    await prefetchCommerceSwitchConfiguration();
    dateNow.mockReturnValue(now + COMMERCE_SWITCH_CACHE_TTL_MS + 1);
    mockedGet.mockRejectedValueOnce(new Error('network error'));

    const result = await prefetchCommerceSwitchConfiguration();

    expect(result.activeModelId).toBe('warmpawz_pay');
    expect(isWarmpawzPay()).toBe(true);
    dateNow.mockRestore();
  });
});
