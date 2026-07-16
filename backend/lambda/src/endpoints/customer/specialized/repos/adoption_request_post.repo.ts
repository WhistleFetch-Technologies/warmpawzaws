import { query, select, insert, update } from '../../../../database/rds-connection';

export async function dbAdoptionRequestPost0(petId) {
  return await query(`SELECT id, vendor_id, name FROM pets WHERE id = $1`, [petId]);
}

export async function dbAdoptionRequestPost1(customerId, customerPhone, pet, petId, visitDate, visitTime, message) {
  return await insert('bookings', {
        customer_id: customerId,
        customer_phone: customerPhone,
        vendor_id: pet.vendor_id,
        pet_id: petId,
        service_type: 'adoption_visit',
        booking_date: visitDate || new Date().toISOString().split('T')[0],
        booking_time: visitTime || '10:00',
        status: 'pending',
        notes: message || `Adoption inquiry for ${pet.name}`,
        total_amount: 0, // Adoption visits are typically free
      });
}

