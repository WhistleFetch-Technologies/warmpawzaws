import { query, insert } from '../../../../database/rds-connection';

export async function dbBreederInquiryPost0(puppyId: string) {
  return await query(`SELECT id, vendor_id, name, price FROM pets WHERE id = $1`, [puppyId]);
}

export async function dbBreederInquiryPost1(
  customerId: string | undefined,
  customerPhone: string | undefined,
  customerName: string | undefined,
  puppy: { vendor_id?: string; name?: string; price?: number },
  puppyId: string,
  visitDate: string | undefined,
  message: string | undefined
) {
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
