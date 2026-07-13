import {
  buildBoardingBookPlanPayload,
  buildFacilityPayload,
} from '@/lib/boarding-vendor-booking-utils';
import type { BoardingListVendor, BoardingPlanRow } from '@/lib/boarding-vendor-discovery-map';

function makeVendor(): BoardingListVendor {
  return {
    id: 'vendor-1',
    name: 'Happy Paws',
    address: '12 Main St, Mumbai 400001',
    rating: 4.5,
    review_count: 10,
    distanceKm: null,
    timing: '9am–6pm',
    price_label: '₹600',
    photo: undefined,
    services: ['Daycare'],
    planRows: [],
    needsServiceFetch: false,
    raw: {},
  };
}

function makePlan(): BoardingPlanRow {
  return {
    rowId: 'vs-row-uuid-1',
    serviceId: 'svc-1',
    vendorServiceId: 'vs-row-uuid-1',
    name: 'Full Day Daycare',
    price: 600,
    duration: 480,
    serviceStyle: 'at_center',
    isPackage: false,
    categoryLabel: 'Daycare',
    description: 'Full day care',
    metadata: {},
  };
}

describe('boarding-vendor-booking-utils', () => {
  it('buildBoardingBookPlanPayload includes serviceId for preselected wizard skip', () => {
    const vendor = makeVendor();
    const plan = makePlan();
    const payload = buildBoardingBookPlanPayload(vendor, plan);

    expect(payload.vendorId).toBe('vendor-1');
    expect(payload.serviceId).toBe('vs-row-uuid-1');
    expect(payload.serviceName).toBe('Full Day Daycare');
    expect(payload.price).toBe(600);
    expect(payload.duration).toBe(480);
    expect(payload.serviceStyle).toBe('at_center');
    expect(payload.facility).toEqual(buildFacilityPayload(vendor));
  });
});
