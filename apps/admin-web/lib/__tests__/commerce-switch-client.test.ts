jest.mock('@/lib/api-client', () => ({
  apiClient: { get: jest.fn() },
}));

import { apiClient } from '@/lib/api-client';
import {
  clearCommerceSwitchCache,
  fetchCommerceSwitchConfiguration,
  COMMERCE_SWITCH_CACHE_TTL_MS,
} from '../commerce-switch-client';

const mockedGet = apiClient.get as jest.Mock;

describe('admin commerce-switch-client', () => {
  beforeEach(() => {
    clearCommerceSwitchCache();
    mockedGet.mockReset();
  });

  it('preserves last-known Pay when fetch fails after TTL', async () => {
    const now = 1_700_000_000_000;
    const dateNow = jest.spyOn(Date, 'now').mockReturnValue(now);
    mockedGet.mockResolvedValueOnce({
      activeModelId: 'warmpawz_pay',
      version: 4,
      schemaVersion: '1.0',
      availableModels: ['marketplace', 'warmpawz_pay'],
      updatedAt: '2026-01-03T00:00:00.000Z',
    });

    const first = await fetchCommerceSwitchConfiguration();
    expect(first.activeModelId).toBe('warmpawz_pay');

    dateNow.mockReturnValue(now + COMMERCE_SWITCH_CACHE_TTL_MS + 1);
    mockedGet.mockRejectedValueOnce(new Error('network error'));

    const second = await fetchCommerceSwitchConfiguration();
    expect(second.activeModelId).toBe('warmpawz_pay');
    expect(second.version).toBe(4);
    dateNow.mockRestore();
  });

  it('returns marketplace degraded only when there is no last-known config', async () => {
    mockedGet.mockRejectedValueOnce(new Error('network error'));

    const config = await fetchCommerceSwitchConfiguration();
    expect(config.activeModelId).toBe('marketplace');
    expect(config.degraded).toBe(true);
  });
});
