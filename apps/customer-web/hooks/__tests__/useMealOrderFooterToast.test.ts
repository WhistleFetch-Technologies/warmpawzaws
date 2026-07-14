import { fetchMealFooterActiveOnly } from '../../hooks/useMealOrderFooterToast';

jest.mock('@/lib/api-client', () => ({
  apiClient: {
    get: jest.fn(),
  },
}));

jest.mock('@/lib/customer-meal-plans-flag', () => ({
  isCustomerMealPlansEnabled: () => true,
}));

import { apiClient } from '@/lib/api-client';

describe('fetchMealFooterActiveOnly', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls only meals/active (no meal-plan-orders or meal/orders/customer)', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue({
      orders: [
        {
          id: 'ord-1',
          status: 'preparing',
          vendorName: 'Kitchen',
          orderNumber: 'M-1',
        },
      ],
    });

    const rows = await fetchMealFooterActiveOnly('8780459376');
    expect(apiClient.get).toHaveBeenCalledTimes(1);
    expect(apiClient.get).toHaveBeenCalledWith('/customer/8780459376/orders/meals/active');
    const urls = (apiClient.get as jest.Mock).mock.calls.map((c) => String(c[0]));
    expect(urls.some((u) => u.includes('meal-plan-orders'))).toBe(false);
    expect(urls.some((u) => u.includes('/meal/orders/customer/'))).toBe(false);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.orderId).toBe('ord-1');
  });
});
