import { fetchWarmpawzPayDashboard } from '../warmpawz-pay-dashboard-admin';
import { apiClient } from '../api-client';

jest.mock('../api-client', () => ({
  apiClient: {
    get: jest.fn(),
  },
}));

const mockedGet = apiClient.get as jest.MockedFunction<typeof apiClient.get>;

describe('warmpawz-pay-dashboard-admin', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetchWarmpawzPayDashboard unwraps success envelope', async () => {
    mockedGet.mockResolvedValue({
      success: true,
      data: {
        metrics: {
          publishedMerchants: { value: 4 },
          averageDiscountPercent: { value: 8 },
        },
        generatedAt: '2026-07-23T12:00:00.000Z',
      },
    });

    const data = await fetchWarmpawzPayDashboard();

    expect(mockedGet).toHaveBeenCalledWith('/admin/warmpawz-pay/dashboard');
    expect(data.metrics.publishedMerchants.value).toBe(4);
  });

  it('fetchWarmpawzPayDashboard throws on error envelope', async () => {
    mockedGet.mockResolvedValue({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Access denied' },
    });

    await expect(fetchWarmpawzPayDashboard()).rejects.toThrow('Access denied');
  });
});
