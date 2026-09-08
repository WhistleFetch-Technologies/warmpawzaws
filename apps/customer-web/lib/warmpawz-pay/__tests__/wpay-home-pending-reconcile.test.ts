import { apiClient } from '@/lib/api-client';
import { reconcileWpayPendingOnHome } from '../wpay-home-pending-reconcile';

jest.mock('@/lib/api-client', () => ({
  apiClient: { get: jest.fn() },
}));

describe('reconcileWpayPendingOnHome', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  it('does not call the API without a phone', async () => {
    await reconcileWpayPendingOnHome('');
    expect(apiClient.get).not.toHaveBeenCalled();
  });

  it('loads Pay Bill history so pending captures are reconciled', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue({ success: true, transactions: [] });
    await reconcileWpayPendingOnHome('9945039143');
    expect(apiClient.get).toHaveBeenCalledWith(
      '/customer/warmpawz-pay/transactions?limit=5&phone=9945039143',
    );
  });
});
