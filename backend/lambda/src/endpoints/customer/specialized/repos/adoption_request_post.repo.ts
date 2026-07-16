import { query, insert } from '../../../../database/rds-connection';

export async function dbAdoptionRequestPost0(petId: string) {
  return await query(
    `SELECT id, vendor_id, pet_name as name FROM adoption_listings WHERE id = $1`,
    [petId]
  );
}

export async function dbAdoptionRequestPost1(
  customerId: string | undefined,
  customerPhone: string | undefined,
  pet: { vendor_id: string; name?: string },
  petId: string,
  visitDate: string | undefined,
  visitTime: string | undefined,
  message: string | undefined
) {
  return await insert('bookings', {
    customer_id: customerId || null,
    customer_phone: customerPhone || null,
    vendor_id: pet.vendor_id,
    pet_id: petId,
    service_type: 'adoption_visit',
    booking_date: visitDate || new Date().toISOString().split('T')[0],
    booking_time: visitTime || '10:00',
    status: 'pending',
    notes: message || `Adoption inquiry for ${pet.name || 'pet'}`,
    total_amount: 0,
  });
}
