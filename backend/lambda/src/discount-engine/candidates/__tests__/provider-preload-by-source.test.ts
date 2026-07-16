/**
 * Batch quote path (calculate-booking-batch) preloads candidate rows once per
 * vendor and passes them per source — providers must not hit the DB when a
 * preloaded array (even empty) is present for their source.
 */
import { DiscountSource } from '../../enums/discount-source';
import {
  PlatformPromotionCandidateProvider,
  VendorServicePromotionCandidateProvider,
} from '../providers';

jest.mock('../../../database/rds-connection', () => ({
  query: jest.fn(),
  select: jest.fn(),
}));

import { query } from '../../../database/rds-connection';

const mockQuery = query as jest.Mock;

describe('candidate providers — preloadedRowsBySource', () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  it('vendor service promotion provider returns preloaded rows without querying', async () => {
    const rows = [{ id: 'vp-1' }, { id: 'vp-2' }];
    const provider = new VendorServicePromotionCandidateProvider();
    const result = await provider.load({
      vendorId: 'vendor-1',
      preloadedRowsBySource: { [DiscountSource.VENDOR_PROMOTION]: rows },
    });
    expect(result).toBe(rows);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('platform promotion provider returns preloaded rows without querying', async () => {
    const rows = [{ id: 'pp-1' }];
    const provider = new PlatformPromotionCandidateProvider();
    const result = await provider.load({
      preloadedRowsBySource: { [DiscountSource.PLATFORM_PROMOTION]: rows },
    });
    expect(result).toBe(rows);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('empty preloaded array still skips the DB load', async () => {
    const provider = new VendorServicePromotionCandidateProvider();
    const result = await provider.load({
      vendorId: 'vendor-1',
      preloadedRowsBySource: { [DiscountSource.VENDOR_PROMOTION]: [] },
    });
    expect(result).toEqual([]);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('preload for a different source does not short-circuit the provider', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'db-row' }] });
    const provider = new VendorServicePromotionCandidateProvider();
    const result = await provider.load({
      vendorId: 'vendor-1',
      preloadedRowsBySource: { [DiscountSource.PLATFORM_PROMOTION]: [{ id: 'pp-1' }] },
    });
    expect(result).toEqual([{ id: 'db-row' }]);
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });

  it('loads from DB when no preload is provided', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'db-row' }] });
    const provider = new VendorServicePromotionCandidateProvider();
    const result = await provider.load({ vendorId: 'vendor-1' });
    expect(result).toEqual([{ id: 'db-row' }]);
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });
});
