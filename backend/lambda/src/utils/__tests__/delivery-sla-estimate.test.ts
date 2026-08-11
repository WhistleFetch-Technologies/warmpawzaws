import {
  computeDeliverySlaEstimate,
  INTRA_STATE_SLA,
  INTER_STATE_SLA,
  normalizeIndianPincode,
} from '@warmpawz/shared-types';

describe('delivery SLA estimate', () => {
  const fixedNow = new Date('2026-08-07T10:00:00+05:30');

  it('normalizeIndianPincode accepts 6 digits', () => {
    expect(normalizeIndianPincode('560034')).toBe('560034');
    expect(normalizeIndianPincode('560 034')).toBe('560034');
    expect(normalizeIndianPincode('12345')).toBeNull();
  });

  it('returns null without valid customer pincode', () => {
    expect(
      computeDeliverySlaEstimate(
        { state: 'Karnataka', pincode: '560001' },
        { pincode: '', state: 'Karnataka' },
        fixedNow,
      ),
    ).toBeNull();
  });

  it('intra-state Karnataka → 2–3 days', () => {
    const est = computeDeliverySlaEstimate(
      { state: 'Karnataka', pincode: '560001' },
      { pincode: '560034', state: 'Karnataka' },
      fixedNow,
    );
    expect(est).not.toBeNull();
    expect(est!.minDays).toBe(INTRA_STATE_SLA.minDays);
    expect(est!.maxDays).toBe(INTRA_STATE_SLA.maxDays);
    expect(est!.isInterState).toBe(false);
    expect(est!.confidence).toBe('high');
    expect(est!.label).toBe('Delivery in 2–3 days');
    expect(est!.deliverByLabel).toMatch(/^Deliver by /);
    expect(est!.deliverByDate).toBe('2026-08-10');
  });

  it('inter-state Karnataka vendor → Maharashtra customer → 4–5 days', () => {
    const est = computeDeliverySlaEstimate(
      { state: 'Karnataka', pincode: '560001' },
      { pincode: '400001', state: 'Maharashtra' },
      fixedNow,
    );
    expect(est).not.toBeNull();
    expect(est!.minDays).toBe(INTER_STATE_SLA.minDays);
    expect(est!.maxDays).toBe(INTER_STATE_SLA.maxDays);
    expect(est!.isInterState).toBe(true);
    expect(est!.deliverByDate).toBe('2026-08-12');
  });

  it('KA vs Karnataka resolves as intra-state', () => {
    const est = computeDeliverySlaEstimate(
      { state: 'KA', pincode: '560001' },
      { pincode: '560034', state: 'Karnataka' },
      fixedNow,
    );
    expect(est?.isInterState).toBe(false);
  });

  it('missing customer state uses inter-state fallback', () => {
    const est = computeDeliverySlaEstimate(
      { state: 'Karnataka', pincode: '560001' },
      { pincode: '560034' },
      fixedNow,
    );
    expect(est?.isInterState).toBe(true);
    expect(est?.confidence).toBe('fallback');
    expect(est?.maxDays).toBe(INTER_STATE_SLA.maxDays);
  });

  it('prefers vendor shipping origin pincode', () => {
    const est = computeDeliverySlaEstimate(
      {
        state: 'Maharashtra',
        pincode: '560002',
        shippingOriginPincode: '400001',
      },
      { pincode: '400002', state: 'Maharashtra' },
      fixedNow,
    );
    expect(est?.vendorPincode).toBe('400001');
    expect(est?.isInterState).toBe(false);
  });
});
