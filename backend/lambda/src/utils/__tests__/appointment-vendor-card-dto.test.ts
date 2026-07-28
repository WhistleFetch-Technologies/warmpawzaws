/**
 * @jest-environment node
 */
import { toAppointmentVendorCardDTO } from '../appointment-vendor-card-dto';

describe('toAppointmentVendorCardDTO', () => {
  it('omits priceMin and time fields from appointment cards', () => {
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
    expect((dto as { availabilityText?: string }).availabilityText).toBeUndefined();
    expect((dto as { nextAvailableSlot?: string }).nextAvailableSlot).toBeUndefined();
  });
});
