/**
 * Lifetime frequency cap for update_health_record (pet vaccination profile saves).
 */

import { loyaltyPointsService } from '../loyalty&reward/loyalty-points-service';
import { query, withTransaction } from '../../../database/rds-connection';

jest.mock('../../../database/rds-connection', () => ({
  query: jest.fn(),
  select: jest.fn(),
  insert: jest.fn(),
  update: jest.fn(),
  withTransaction: jest.fn(),
}));

describe('LoyaltyPointsService update_health_record lifetime cap', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const healthRule = {
    id: 'rule-health',
    action_name: 'update_health_record',
    action_category: 'loyalty',
    user_type: 'customer',
    points_type: 'fixed' as const,
    points_value: 50,
    frequency_type: 'recurring',
    frequency_limit: 3,
    frequency_period: null as string | null,
    is_active: true,
    priority: 100,
  };

  it('allows award when lifetime earn count is under 3', async () => {
    (query as jest.Mock)
      .mockResolvedValueOnce({ rows: [healthRule] })
      .mockResolvedValueOnce({ rows: [{ count: '2' }] })
      .mockResolvedValueOnce({
        rows: [{ rule_name: 'basic', auto_convert_to_wallet: true, redemption_rate: 1 }],
      });

    (withTransaction as jest.Mock).mockImplementation(async (callback) => {
      const mockClient = {
        query: jest.fn().mockResolvedValue({ rows: [] }),
      };
      return callback(mockClient);
    });

    const result = await loyaltyPointsService.awardPoints({
      customerId: 'customer-1',
      actionName: 'update_health_record',
      referenceType: 'pet',
      referenceId: 'pet-3',
      description: 'Action update_health_record',
    });

    expect(result.points).toBe(50);
    expect(result.walletCredited).toBe(0);
  });

  it('blocks award after 3 lifetime earns', async () => {
    (query as jest.Mock)
      .mockResolvedValueOnce({ rows: [healthRule] })
      .mockResolvedValueOnce({ rows: [{ count: '3' }] });

    const result = await loyaltyPointsService.awardPoints({
      customerId: 'customer-1',
      actionName: 'update_health_record',
      referenceType: 'pet',
      referenceId: 'pet-4',
      description: 'Action update_health_record',
    });

    expect(result.points).toBe(0);
    expect(result.walletCredited).toBe(0);
    expect(withTransaction).not.toHaveBeenCalled();
  });
});
