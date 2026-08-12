/**
 * Lifetime cap tests for loyalty-points-service (separate from ignored loyalty-points-service.test.ts).
 */

import { loyaltyPointsService } from '../services/loyalty&reward/loyalty-points-service';
import { query, withTransaction } from '../../database/rds-connection';

jest.mock('../../database/rds-connection', () => ({
  query: jest.fn(),
  select: jest.fn(),
  insert: jest.fn(),
  withTransaction: jest.fn(),
}));

describe('loyalty lifetime_limit cap', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (loyaltyPointsService as any).walletPolicyCache = undefined;
  });

  it('blocks 4th complete_pet_profile award when count >= 3 since cap_effective_from', async () => {
    const capFrom = '2026-08-11T00:00:00.000Z';
    const mockRule = {
      id: 'rule-pet',
      action_name: 'complete_pet_profile',
      action_category: 'loyalty',
      user_type: 'customer',
      points_type: 'fixed',
      points_value: 100,
      frequency_type: 'lifetime_limit',
      frequency_limit: 3,
      conditions: { cap_effective_from: capFrom },
      is_active: true,
      priority: 100,
    };

    (query as jest.Mock)
      .mockResolvedValueOnce({ rows: [mockRule] })
      .mockResolvedValueOnce({ rows: [{ count: '3' }] });

    const result = await loyaltyPointsService.awardPoints({
      customerId: 'customer-1',
      actionName: 'complete_pet_profile',
      referenceType: 'pet',
      referenceId: 'pet-9',
    });

    expect(result.points).toBe(0);
    expect(query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('created_at >='),
      expect.arrayContaining(['customer-1', '% complete_pet_profile', capFrom])
    );
  });

  it('allows award when lifetime count is below cap', async () => {
    const mockRule = {
      id: 'rule-pet-2',
      action_name: 'update_health_record',
      action_category: 'loyalty',
      user_type: 'customer',
      points_type: 'fixed',
      points_value: 50,
      frequency_type: 'lifetime_limit',
      frequency_limit: 3,
      conditions: { cap_effective_from: '2026-08-11T00:00:00.000Z' },
      is_active: true,
      priority: 100,
    };

    (query as jest.Mock)
      .mockResolvedValueOnce({ rows: [mockRule] })
      .mockResolvedValueOnce({ rows: [{ count: '1' }] })
      .mockResolvedValueOnce({
        rows: [{ rule_name: 'basic', auto_convert_to_wallet: false, redemption_rate: '1' }],
      });

    (withTransaction as jest.Mock).mockImplementation(async (callback) => {
      const mockClient = {
        query: jest.fn().mockResolvedValue({ rows: [{ total_points: 50 }] }),
      };
      return callback(mockClient);
    });

    const result = await loyaltyPointsService.awardPoints({
      customerId: 'customer-1',
      actionName: 'update_health_record',
      referenceType: 'pet',
      referenceId: 'pet-10',
    });

    expect(result.points).toBe(50);
  });
});
