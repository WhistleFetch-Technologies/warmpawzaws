jest.mock('@/lib/api-client', () => ({
  apiClient: { get: jest.fn() },
}));

import { apiClient } from '@/lib/api-client';
import {
  clearCommerceSwitchCache,
  getCommerceSwitchConfigurationVersion,
  prefetchCommerceSwitchConfiguration,
  syncCommerceSwitchConfiguration,
} from '../commerce-switch-client';
import {
  handleCommerceSwitchPushData,
  parseCommerceSwitchSyncData,
  requestCommerceSwitchSync,
} from '../commerce-switch-sync';

const mockedGet = apiClient.get as jest.Mock;

describe('commerce-switch-sync', () => {
  beforeEach(() => {
    clearCommerceSwitchCache();
    mockedGet.mockReset();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('parses commerce switch FCM data payloads', () => {
    expect(
      parseCommerceSwitchSyncData({
        type: 'commerce_switch_updated',
        configurationVersion: '7',
        activeModelId: 'warmpawz_pay',
        updatedAt: '2026-07-24T00:00:00.000Z',
      })
    ).toEqual({
      type: 'commerce_switch_updated',
      configurationVersion: 7,
      activeModelId: 'warmpawz_pay',
      updatedAt: '2026-07-24T00:00:00.000Z',
    });
  });

  it('ignores non-commerce push payloads', () => {
    expect(parseCommerceSwitchSyncData({ type: 'booking_created' })).toBeNull();
  });

  it('dedupes rapid duplicate sync triggers', async () => {
    mockedGet.mockResolvedValue({
      activeModelId: 'warmpawz_pay',
      version: 5,
      schemaVersion: '1.0',
      availableModels: ['marketplace', 'warmpawz_pay'],
      updatedAt: '2026-07-24T00:00:00.000Z',
    });

    requestCommerceSwitchSync({ configurationVersion: 5 }, 'fcm');
    requestCommerceSwitchSync({ configurationVersion: 5 }, 'fcm');
    jest.runAllTimers();
    await Promise.resolve();
    await Promise.resolve();

    expect(mockedGet).toHaveBeenCalledTimes(1);
  });

  it('skips sync when local version is already current', async () => {
    mockedGet.mockResolvedValueOnce({
      activeModelId: 'marketplace',
      version: 3,
      schemaVersion: '1.0',
      availableModels: ['marketplace'],
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    await prefetchCommerceSwitchConfiguration();
    expect(getCommerceSwitchConfigurationVersion()).toBe(3);

    handleCommerceSwitchPushData({
      type: 'commerce_switch_updated',
      configurationVersion: '3',
      activeModelId: 'marketplace',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    jest.runAllTimers();
    await Promise.resolve();

    expect(mockedGet).toHaveBeenCalledTimes(1);
  });
});

describe('syncCommerceSwitchConfiguration', () => {
  beforeEach(() => {
    clearCommerceSwitchCache();
    mockedGet.mockReset();
  });

  it('dedupes concurrent sync calls', async () => {
    mockedGet.mockResolvedValue({
      activeModelId: 'warmpawz_pay',
      version: 2,
      schemaVersion: '1.0',
      availableModels: ['marketplace', 'warmpawz_pay'],
      updatedAt: '2026-01-02T00:00:00.000Z',
    });

    const [a, b] = await Promise.all([
      syncCommerceSwitchConfiguration({ expectedMinVersion: 2 }),
      syncCommerceSwitchConfiguration({ expectedMinVersion: 2 }),
    ]);

    expect(mockedGet).toHaveBeenCalledTimes(1);
    expect(a).toEqual(b);
    expect(a.version).toBe(2);
  });
});
