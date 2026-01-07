/**
 * Loyalty Points Service Tests
 * 
 * Tests for loyalty points earning, auto-conversion to wallet, and action-based rules
 */

import { loyaltyPointsService } from '../loyalty-points-service';
import { query, select, insert, withTransaction } from '../../../database/rds-connection';

// Mock database functions
jest.mock('../../../database/rds-connection', () => ({
  query: jest.fn(),
  select: jest.fn(),
  insert: jest.fn(),
  withTransaction: jest.fn(),
}));

describe('LoyaltyPointsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('awardPoints', () => {
    it('should award fixed points and auto-convert to wallet', async () => {
      const mockRule = {
        id: 'rule-1',
        action_name: 'signup',
        action_category: 'loyalty',
        user_type: 'customer',
        points_type: 'fixed',
        points_value: 100,
        frequency_type: 'one_time',
        is_active: true,
        priority: 100,
      };

      const mockProfile = {
        id: 'profile-1',
        customer_id: 'customer-1',
        total_points: 0,
        lifetime_points_earned: 0,
      };

      const mockWallet = {
        id: 'wallet-1',
        customer_id: 'customer-1',
        balance: 0,
      };

      (select as jest.Mock)
        .mockResolvedValueOnce([mockRule]) // getApplicableRule
        .mockResolvedValueOnce([]) // checkFrequencyLimit - no existing transactions
        .mockResolvedValueOnce([mockProfile]) // getOrCreateWallet - profile exists
        .mockResolvedValueOnce([mockWallet]); // getOrCreateWallet - wallet exists

      (withTransaction as jest.Mock).mockImplementation(async (callback) => {
        const mockClient = {
          query: jest.fn().mockResolvedValue({ rows: [{ ...mockProfile, total_points: 100 }] }),
        };
        return callback(mockClient);
      });

      (insert as jest.Mock)
        .mockResolvedValueOnce([{ id: 'txn-1' }]) // loyalty transaction
        .mockResolvedValueOnce([{ id: 'wallet-txn-1' }]); // wallet transaction

      const result = await loyaltyPointsService.awardPoints({
        customerId: 'customer-1',
        actionName: 'signup',
        referenceType: 'signup',
        referenceId: 'customer-1',
        description: 'Welcome bonus',
      });

      expect(result.points).toBe(100);
      expect(result.walletCredited).toBe(100);
    });

    it('should calculate per_amount points correctly', async () => {
      const mockRule = {
        id: 'rule-2',
        action_name: 'buy_product',
        action_category: 'loyalty',
        user_type: 'customer',
        points_type: 'per_amount',
        points_value: 10,
        base_amount: 1000,
        frequency_type: 'unlimited',
        is_active: true,
        priority: 100,
      };

      (select as jest.Mock)
        .mockResolvedValueOnce([mockRule])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ customer_id: 'customer-1', total_points: 0 }])
        .mockResolvedValueOnce([{ id: 'wallet-1', customer_id: 'customer-1', balance: 0 }]);

      (withTransaction as jest.Mock).mockImplementation(async (callback) => {
        const mockClient = {
          query: jest.fn().mockResolvedValue({ rows: [{ total_points: 50 }] }),
        };
        return callback(mockClient);
      });

      (insert as jest.Mock)
        .mockResolvedValueOnce([{ id: 'txn-1' }])
        .mockResolvedValueOnce([{ id: 'wallet-txn-1' }]);

      // ₹5000 purchase = 5 × ₹1000 = 50 points
      const result = await loyaltyPointsService.awardPoints({
        customerId: 'customer-1',
        actionName: 'buy_product',
        amount: 5000,
        referenceType: 'order',
        referenceId: 'order-1',
      });

      expect(result.points).toBe(50);
      expect(result.walletCredited).toBe(50);
    });

    it('should respect frequency limits', async () => {
      const mockRule = {
        id: 'rule-3',
        action_name: 'post_review',
        action_category: 'loyalty',
        user_type: 'customer',
        points_type: 'fixed',
        points_value: 500,
        frequency_type: 'monthly_limit',
        frequency_limit: 3,
        is_active: true,
        priority: 100,
      };

      (select as jest.Mock)
        .mockResolvedValueOnce([mockRule])
        .mockResolvedValueOnce([{ count: '3' }]); // Already 3 reviews this month

      const result = await loyaltyPointsService.awardPoints({
        customerId: 'customer-1',
        actionName: 'post_review',
        referenceType: 'review',
        referenceId: 'review-1',
      });

      expect(result.points).toBe(0);
      expect(result.walletCredited).toBe(0);
    });

    it('should apply birthday month multiplier', async () => {
      const mockRule = {
        id: 'rule-4',
        action_name: 'birthday_month_booking',
        action_category: 'loyalty',
        user_type: 'customer',
        points_type: 'fixed',
        points_value: 100,
        multiplier_conditions: { birthday_month: 2 },
        frequency_type: 'yearly_limit',
        is_active: true,
        priority: 100,
      };

      (select as jest.Mock)
        .mockResolvedValueOnce([mockRule])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ customer_id: 'customer-1', total_points: 0 }])
        .mockResolvedValueOnce([{ id: 'wallet-1', customer_id: 'customer-1', balance: 0 }]);

      (withTransaction as jest.Mock).mockImplementation(async (callback) => {
        const mockClient = {
          query: jest.fn().mockResolvedValue({ rows: [{ total_points: 200 }] }),
        };
        return callback(mockClient);
      });

      (insert as jest.Mock)
        .mockResolvedValueOnce([{ id: 'txn-1' }])
        .mockResolvedValueOnce([{ id: 'wallet-txn-1' }]);

      const result = await loyaltyPointsService.awardPoints({
        customerId: 'customer-1',
        actionName: 'birthday_month_booking',
        amount: 1000,
        metadata: { is_birthday_month: true },
        referenceType: 'booking',
        referenceId: 'booking-1',
      });

      // 100 points × 2 (birthday multiplier) = 200 points
      expect(result.points).toBe(200);
      expect(result.walletCredited).toBe(200);
    });
  });

  describe('getLoyaltyBalance', () => {
    it('should return points and wallet balance', async () => {
      (select as jest.Mock)
        .mockResolvedValueOnce([{ customer_id: 'customer-1', total_points: 500 }])
        .mockResolvedValueOnce([{ customer_id: 'customer-1', balance: 1000 }]);

      const result = await loyaltyPointsService.getLoyaltyBalance('customer-1');

      expect(result.points).toBe(500);
      expect(result.walletBalance).toBe(1000);
      expect(result.total).toBe(1500);
    });
  });
});

