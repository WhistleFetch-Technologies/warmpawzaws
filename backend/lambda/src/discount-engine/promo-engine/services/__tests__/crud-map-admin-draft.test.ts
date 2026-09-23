import { toDatetimeLocalIst } from '../../dsl/category-aliases';
import { mapAdminDraftToPayload } from '../crud.service';

describe('mapAdminDraftToPayload', () => {
  it('persists datetime-local as Asia/Kolkata and normalizes service slugs', () => {
    const payload = mapAdminDraftToPayload({
      basics: {
        name: 'Vet first visit',
        startAt: '2026-09-17T17:29',
        endAt: '2026-09-30T23:59',
        serviceCategories: ['VET', 'shop'],
      },
    });
    expect(payload.start_at).toBe('2026-09-17T17:29:00+05:30');
    expect(payload.end_at).toBe('2026-09-30T23:59:00+05:30');
    expect(payload.service_categories).toEqual(['veterinary', 'ecommerce']);
    expect(toDatetimeLocalIst(new Date(payload.start_at as string).toISOString())).toBe(
      '2026-09-17T17:29'
    );
  });

  it('stores independent visit/publish/redeem on metadata.vcf', () => {
    const payload = mapAdminDraftToPayload({
      basics: { name: 'Vendor ladder' },
      vcf: {
        visitSource: { letter: 'V', vendorId: 'v1', width: 'specific', channels: ['paybill'] },
        visitLoop: { kind: 'every_nth', n: 2 },
        benefitMode: 'both',
        maxDiscount: 200,
        publish: { letter: 'F' },
        redeem: { letter: 'C', categoryId: 'c1', channels: ['ecommerce'] },
      },
    });
    expect(payload.metadata?.vcf).toMatchObject({
      visitSource: { letter: 'V', vendorId: 'v1' },
      publish: { letter: 'F' },
      redeem: { letter: 'C', channels: ['ecommerce'] },
    });
  });
});
