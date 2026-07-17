import { query, insert, update } from '../../../../database/rds-connection';

export async function dbBreederReservePost0(puppyId: string) {
  return await query(`SELECT id, vendor_id, name, price, status FROM pets WHERE id = $1`, [puppyId]);
}

export async function dbBreederReservePost1(puppyId: string, customerId: string) {
  return await update('pets', { id: puppyId }, { status: 'reserved', reserved_by: customerId });
}

export async function dbBreederReservePost2(
  customerId: string,
  puppy: { vendor_id: string; name?: string; price?: number },
  puppyId: string,
  depositAmount: number | undefined
) {
  return await insert('bookings', {
    customer_id: customerId,
    vendor_id: puppy.vendor_id,
    pet_id: puppyId,
    service_type: 'puppy_reservation',
    booking_date: new Date().toISOString().split('T')[0],
    status: 'reserved',
    total_amount: puppy.price,
    deposit_amount: depositAmount || (puppy.price || 0) * 0.2,
    payment_status: 'deposit_pending',
  });
}
