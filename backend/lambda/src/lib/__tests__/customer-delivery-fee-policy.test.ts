import {
  calculateCustomerDeliveryFee,
  DEFAULT_CUSTOMER_DELIVERY_FEE_POLICY,
  migrateV1PolicyToV2,
  resolveDeliveryFeeZone,
  validateCustomerDeliveryFeePolicy,
  type CustomerDeliveryFeePolicyV1,
} from '../../utils/customer-delivery-fee-policy';

describe('customer-delivery-fee-policy v2', () => {
  const v1Raw = {
    version: 1,
    maxServiceRadiusKm: 10,
    zoneABoundaryKm: 5,
    zones: {
      zoneA: [{ minOrderInr: 0, maxOrderInr: null, deliveryFeeInr: 99 }],
      zoneB: [{ minOrderInr: 0, maxOrderInr: null, deliveryFeeInr: 149 }],
    },
    surges: DEFAULT_CUSTOMER_DELIVERY_FEE_POLICY.surges,
    content: {
      coverageSummary: 'test',
      rulesFreeDelivery: ['a'],
      rulesBeyond5Km: ['b'],
      rulesBeyond8Km: ['c'],
      importantNotes: ['d'],
    },
  };

  it('validates and migrates v1 policy to v2 zones array', () => {
    const parsed = validateCustomerDeliveryFeePolicy(v1Raw);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.policy.version).toBe(2);
    expect(parsed.policy.zones).toHaveLength(2);
    expect(parsed.policy.zones[0].minDistanceKm).toBe(0);
    expect(parsed.policy.zones[0].maxDistanceKm).toBe(5);
    expect(parsed.policy.zones[1].minDistanceKm).toBe(5);
    expect(parsed.policy.zones[1].maxDistanceKm).toBe(10);
  });

  it('resolves boundary distance to lower zone (legacy Zone A behavior)', () => {
    const v2 = migrateV1PolicyToV2(v1Raw as CustomerDeliveryFeePolicyV1);
    expect(resolveDeliveryFeeZone(v2, 5)?.id).toBe('zone_near');
    expect(resolveDeliveryFeeZone(v2, 5.1)?.id).toBe('zone_mid');
    expect(resolveDeliveryFeeZone(v2, 10)?.id).toBe('zone_mid');
    expect(resolveDeliveryFeeZone(v2, 10.1)).toBeNull();
  });

  it('calculates fee using matched zone slabs', () => {
    const parsed = validateCustomerDeliveryFeePolicy(v1Raw);
    if (!parsed.ok) throw new Error('expected valid');
    const near = calculateCustomerDeliveryFee({
      policy: parsed.policy,
      orderSubtotalInr: 500,
      distanceKm: 4,
    });
    expect(near.success).toBe(true);
    expect(near.zone).toBe('zone_a');
    expect(near.zoneId).toBe('zone_near');
    expect(near.totalDeliveryFeeInr).toBe(99);

    const far = calculateCustomerDeliveryFee({
      policy: parsed.policy,
      orderSubtotalInr: 500,
      distanceKm: 8,
    });
    expect(far.success).toBe(true);
    expect(far.zone).toBe('zone_b');
    expect(far.totalDeliveryFeeInr).toBe(149);
  });

  it('validates contiguous dynamic zones', () => {
    const bad = validateCustomerDeliveryFeePolicy({
      version: 2,
      maxServiceRadiusKm: 10,
      zones: [
        {
          id: 'a',
          name: 'A',
          sortOrder: 0,
          minDistanceKm: 0,
          maxDistanceKm: 4,
          slabs: [{ minOrderInr: 0, maxOrderInr: null, deliveryFeeInr: 10 }],
          surgeConfig: { weekend: true, festival: true, rain: true },
        },
        {
          id: 'b',
          name: 'B',
          sortOrder: 1,
          minDistanceKm: 5,
          maxDistanceKm: 10,
          slabs: [{ minOrderInr: 0, maxOrderInr: null, deliveryFeeInr: 20 }],
          surgeConfig: { weekend: true, festival: true, rain: true },
        },
      ],
      surges: DEFAULT_CUSTOMER_DELIVERY_FEE_POLICY.surges,
      content: DEFAULT_CUSTOMER_DELIVERY_FEE_POLICY.content,
    });
    expect(bad.ok).toBe(false);
    if (bad.ok) return;
    expect(bad.error).toMatch(/must equal next zone minDistanceKm/);
  });
});
