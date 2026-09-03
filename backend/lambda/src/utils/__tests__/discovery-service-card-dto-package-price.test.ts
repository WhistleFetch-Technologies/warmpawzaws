import { toServiceCardDTO } from '../discovery-service-card-dto';

describe('toServiceCardDTO Pay omitPricing', () => {
  it('keeps package prices when omitPricing is true', () => {
    const dto = toServiceCardDTO(
      {
        id: 'svc-1',
        name: 'Walk pack',
        price: 10000,
        isPackage: true,
        packageDetails: { totalSessions: 10, price: 10000 },
      },
      { omitPricing: true },
    );
    expect(dto.isPackage).toBe(true);
    expect(dto.price).toBe(10000);
  });

  it('strips one-off service prices when omitPricing is true', () => {
    const dto = toServiceCardDTO(
      { id: 'svc-2', name: 'Walk', price: 400, isPackage: false },
      { omitPricing: true },
    );
    expect(dto.price).toBeNull();
  });
});
