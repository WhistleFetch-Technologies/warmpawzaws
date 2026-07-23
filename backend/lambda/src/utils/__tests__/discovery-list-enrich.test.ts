/**
 * @jest-environment node
 */
import { enrichDiscoveryListVendor } from '../discovery-list-enrich';

describe('enrichDiscoveryListVendor availability', () => {
  const baseVendor = {
    vendor_id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    business_name: 'Test Clinic',
    phone: '9999999999',
    avg_rating: '4',
    review_count: '2',
    is_online: true,
  };

  it('calls getNextAvailableSlot when includeAvailability is true', async () => {
    const getNextAvailableSlot = jest.fn().mockResolvedValue({
      date: '2026-07-23',
      time: '15:00',
      display: 'Today 3:00 PM',
    });

    const card = await enrichDiscoveryListVendor({
      vendor: baseVendor,
      stats: { serviceCount: 2, priceMin: 100, priceMax: 200 },
      services: [],
      acceptableStyles: ['tele'],
      distResolver: { resolve: async () => ({ km: 1, distanceText: '1 km' }) } as any,
      getNextAvailableSlot,
      defaultAvailabilityDisplay: 'Tap to view availability',
      includeAvailability: true,
    });

    expect(getNextAvailableSlot).toHaveBeenCalled();
    expect(card?.nextAvailable).toMatchObject({ display: 'Today 3:00 PM' });
  });

  it('skips slot lookup when includeAvailability is false', async () => {
    const getNextAvailableSlot = jest.fn();

    const card = await enrichDiscoveryListVendor({
      vendor: baseVendor,
      stats: { serviceCount: 1, priceMin: 50, priceMax: 50 },
      services: [],
      acceptableStyles: ['at_home'],
      distResolver: { resolve: async () => ({ km: null, distanceText: null }) } as any,
      getNextAvailableSlot,
      defaultAvailabilityDisplay: 'Tap to view availability',
      includeAvailability: false,
    });

    expect(getNextAvailableSlot).not.toHaveBeenCalled();
    expect((card?.nextAvailable as { display?: string })?.display).toBe(
      'Tap to view availability'
    );
  });
});
