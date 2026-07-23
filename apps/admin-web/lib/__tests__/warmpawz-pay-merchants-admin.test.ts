import { formatReadinessScore } from '../warmpawz-pay-merchants-admin';
import { fetchMerchantList } from '../warmpawz-pay-merchants-admin';
import { apiClient } from '../api-client';

jest.mock('../api-client', () => ({
  apiClient: {
    get: jest.fn(),
  },
}));

const mockedGet = apiClient.get as jest.MockedFunction<typeof apiClient.get>;

describe('warmpawz-pay-merchants-admin', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('formats readiness score', () => {
    expect(
      formatReadinessScore({
        checks: [],
        blockersPassed: 3,
        blockersTotal: 4,
        readyForPayBill: false,
      }),
    ).toBe('3/4');
  });

  it('fetchMerchantList unwraps success envelope', async () => {
    mockedGet.mockResolvedValue({
      success: true,
      data: {
        items: [],
        pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
      },
    });

    const data = await fetchMerchantList({ page: 1, pageSize: 20 });

    expect(mockedGet).toHaveBeenCalledWith('/admin/warmpawz-pay/merchants?page=1&pageSize=20');
    expect(data.items).toEqual([]);
  });
});
