import { query, select, insert, update } from '../../../../database/rds-connection';

export async function dbBreederInquiryPost0(puppyId) {
  return await query(`SELECT id, vendor_id, name, price FROM pets WHERE id = $1`, [puppyId]);
}

export async function dbBreederInquiryPost1(customerId, customerPhone, customerName, puppy, puppyId, visitDate, message) {
  return await insert('bookings', {
        customer_id: customerId,
        customer_phone: customerPhone,
        customer_name: customerName,
        vendor_id: puppy.vendor_id,
        pet_id: puppyId,
        service_type: 'breeder_inquiry',
        booking_date: visitDate || new Date().toISOString().split('T')[0],
        status: 'inquiry',
        notes: message || `Purchase inquiry for ${puppy.name}`,
        total_amount: puppy.price || 0,
      });
}

