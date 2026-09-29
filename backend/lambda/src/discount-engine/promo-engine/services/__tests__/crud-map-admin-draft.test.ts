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

  it('maps Same vendor redeem onto the publish vendor id', () => {
    const payload = mapAdminDraftToPayload({
      basics: { name: 'Same vendor cashback' },
      vcf: {
        visitSource: { letter: 'V', vendorId: 'visit-vendor', width: 'general' },
        visitLoop: { kind: 'every' },
        benefitMode: 'cashback',
        publish: { letter: 'V', vendorId: 'publish-vendor' },
        redeem: { letter: 'V', channels: ['paybill'] },
      },
    });
    expect(payload.metadata?.vcf).toMatchObject({
      redeem: { letter: 'V', vendorId: 'publish-vendor', channels: ['paybill'] },
    });
  });

  it('rejects an end date that is not after the start date', () => {
    expect(() =>
      mapAdminDraftToPayload({
        basics: { name: 'Same minute', startAt: '2026-09-29T14:52', endAt: '2026-09-29T14:52' },
      }),
    ).toThrow('End date must be after start date');
  });

  it('rejects decimal / negative usage limits before anything is written', () => {
    expect(() =>
      mapAdminDraftToPayload({ basics: { name: 'Bad limits' }, limits: { per_user: 1.5 } }),
    ).toThrow(/per_user must be a whole number/);
    expect(() =>
      mapAdminDraftToPayload({ basics: { name: 'Bad limits' }, limits: { daily_limit: -2 } }),
    ).toThrow(/daily_limit/);
  });

  it('keeps promotion budget and limits budget in sync, and null clears both', () => {
    const set = mapAdminDraftToPayload({
      basics: { name: 'Budget' },
      limits: { per_user: 1, budget_limit: 500 },
    });
    expect(set.budget_limit).toBe(500);
    expect(set.limits).toEqual({
      per_user: 1,
      per_transaction: null,
      daily_limit: null,
      campaign_limit: null,
      budget_limit: 500,
    });

    const cleared = mapAdminDraftToPayload({
      basics: { name: 'Budget' },
      budget_limit: 500,
      limits: { per_user: null, budget_limit: null },
    });
    expect(cleared.budget_limit).toBeNull();
    expect(cleared.limits?.budget_limit).toBeNull();
    expect(cleared.limits?.per_user).toBeNull();
  });

  it('stores validated customer copy on metadata and rejects unknown placeholders', () => {
    const payload = mapAdminDraftToPayload({
      basics: { name: 'Copy' },
      metadata: { customerCopy: { earnLine: 'Get ₹{amount} back', termsLine: '' } },
    });
    expect(payload.metadata?.customerCopy).toEqual({ earnLine: 'Get ₹{amount} back' });

    expect(() =>
      mapAdminDraftToPayload({
        basics: { name: 'Copy' },
        metadata: { customerCopy: { earnLine: 'Hi {customerName}' } },
      }),
    ).toThrow(/unknown placeholder/);
  });
});
