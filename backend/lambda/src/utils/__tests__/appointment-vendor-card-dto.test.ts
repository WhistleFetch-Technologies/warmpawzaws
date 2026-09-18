/**
 * @jest-environment node
 */
import { toAppointmentVendorCardDTO } from '../appointment-vendor-card-dto';

describe('toAppointmentVendorCardDTO', () => {
  it('includes availability without price fields on appointment cards', () => {
    const dto = toAppointmentVendorCardDTO({
      vendorId: 'v1',
      name: 'Test Clinic',
      rating: 4,
      reviewCount: 2,
      priceMin: 499,
      nextAvailable: { display: 'Tomorrow 10am' },
    });
    expect(dto.vendorId).toBe('v1');
    expect((dto as { priceMin?: number }).priceMin).toBeUndefined();
    expect(dto.availabilityText).toBe('Tomorrow 10am');
    expect(dto.nextAvailableSlot).toBe('Tomorrow 10am');
  });

  it('maps DistanceResolver km and text onto the public card DTO', () => {
    const dto = toAppointmentVendorCardDTO({
      vendorId: 'v-dist',
      name: 'Amigo Pet Hospital',
      distanceKm: 3.4,
      distanceText: '3 km away',
    });
    expect(dto.distanceKm).toBe(3.4);
    expect(dto.distanceText).toBe('3 km away');
  });
});
