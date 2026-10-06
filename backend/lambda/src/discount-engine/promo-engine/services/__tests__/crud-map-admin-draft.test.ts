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

  it('stores applyToPackages on metadata.vcf and defaults missing to false', () => {
    const yes = mapAdminDraftToPayload({
      basics: { name: 'Package yes' },
      vcf: {
        visitSource: { letter: 'C', categoryId: 'grooming', width: 'general' },
        visitLoop: { kind: 'every' },
        benefitMode: 'discount',
        publish: { letter: 'C', categoryId: 'grooming' },
        applyToPackages: true,
      },
    });
    expect(yes.metadata?.vcf).toMatchObject({ applyToPackages: true });

    const no = mapAdminDraftToPayload({
      basics: { name: 'Package no' },
      vcf: {
        visitSource: { letter: 'F', width: 'general' },
        visitLoop: { kind: 'every' },
        benefitMode: 'discount',
        publish: { letter: 'F' },
      },
    });
    expect(no.metadata?.vcf).toMatchObject({ applyToPackages: false });
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

  it('normalizes visit/publish lists: singular is the first entry, other-letter ids cleared', () => {
    const payload = mapAdminDraftToPayload({
      basics: { name: 'Welcome to pet care' },
      vcf: {
        visitSource: {
          letter: 'C',
          categoryIds: ['vet', 'groom', 'vet', 'train'],
          categoryId: 'stale',
          vendorId: 'old-vendor',
          vendorName: 'Old',
          width: 'general',
        },
        visitLoop: { kind: 'visit_number', n: 1 },
        benefitMode: 'discount',
        publish: { letter: 'V', vendorIds: ['a', 'b'], categoryId: 'x', categoryName: 'X' },
      },
    });
    const vcf = payload.metadata?.vcf as Record<string, Record<string, unknown>>;
    expect(vcf.visitSource).toMatchObject({
      categoryIds: ['vet', 'groom', 'train', 'stale'],
      categoryId: 'vet',
      countMode: 'pooled',
    });
    expect(vcf.visitSource.vendorId).toBeUndefined();
    expect(vcf.visitSource.vendorName).toBeUndefined();
    expect(vcf.publish).toMatchObject({ vendorIds: ['a', 'b'], vendorId: 'a' });
    expect(vcf.publish.categoryId).toBeUndefined();
    expect(vcf.publish.categoryName).toBeUndefined();
  });

  it('copies the whole publish category list into Same category redeem', () => {
    const payload = mapAdminDraftToPayload({
      basics: { name: 'Group cashback' },
      vcf: {
        visitSource: { letter: 'F', width: 'general' },
        visitLoop: { kind: 'every' },
        benefitMode: 'cashback',
        publish: { letter: 'C', categoryIds: ['vet', 'groom'] },
        redeem: { letter: 'C', channels: ['paybill'] },
      },
    });
    expect(payload.metadata?.vcf).toMatchObject({
      redeem: { letter: 'C', categoryIds: ['vet', 'groom'], categoryId: 'vet' },
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
