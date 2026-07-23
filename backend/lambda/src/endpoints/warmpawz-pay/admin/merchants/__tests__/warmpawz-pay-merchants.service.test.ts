import { WarmpawzPayMerchantsService } from '../services/warmpawz-pay-merchants.service';
import type { IMerchantAdminRepository } from '../../../repositories/interfaces/IMerchantAdminRepository';
import { PUBLISHED } from '../../../constants/publish-status';

describe('WarmpawzPayMerchantsService', () => {
  const sampleRow = {
    id: 'cat-1',
    vendorId: 'vendor-1',
    publishStatus: PUBLISHED,
    publishedAt: new Date('2026-07-23T12:00:00.000Z'),
    createdAt: new Date('2026-07-23T10:00:00.000Z'),
    updatedAt: new Date('2026-07-23T12:00:00.000Z'),
    businessName: 'Happy Paws',
    ownerName: 'Anjali Sharma',
    city: 'Bengaluru',
    phone: '+919876543210',
    vendorStatus: 'approved',
    payBillEnabled: true,
    bankVerified: true,
    isDeleted: false,
    isActive: true,
    isOnline: true,
    vendorType: 'solo',
    isSoloProvider: true,
    legacyCategory: null,
    roleName: 'groomer_solo',
    roleCategory: 'grooming',
    customerService: 'grooming',
    roleConfig: null,
  } as const;

  it('maps repository rows to enriched merchant list items', async () => {
    const repository: IMerchantAdminRepository = {
      listMerchants: jest.fn().mockResolvedValue([sampleRow]),
      countMerchants: jest.fn().mockResolvedValue(1),
    };

    const service = new WarmpawzPayMerchantsService(repository);
    const result = await service.listMerchants({
      page: 1,
      pageSize: 20,
      sortBy: 'updatedAt',
      sortOrder: 'desc',
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      catalogueId: 'cat-1',
      vendorName: 'Anjali Sharma',
      businessName: 'Happy Paws',
      category: 'Grooming',
      businessType: 'Solo',
      platformStatus: 'Approved',
      warmpawzPayStatus: 'Published',
      customerVisible: true,
    });
    expect(result.items[0].readiness.blockersTotal).toBeGreaterThan(0);
    expect(result.pagination.total).toBe(1);
  });
});
