import { query, insert, update } from '../../../../database/rds-connection';

export async function dbBreederInquiryPost0(puppyId: string) {
  // Prefer adoption_listings (vendor-owned); fall back to pets without vendor_id.
  const listing = await query(
    `SELECT id, vendor_id, pet_name as name, adoption_fee as price FROM adoption_listings WHERE id = $1`,
    [puppyId]
  );
  if (listing.rows?.length) return listing;
  return await query(`SELECT id, name, NULL::uuid as vendor_id, NULL::numeric as price FROM pets WHERE id = $1`, [
    puppyId,
  ]);
}

export async function dbBreederInquiryPost1(
  customerId: string | undefined,
  customerPhone: string | undefined,
  customerName: string | undefined,
  puppy: { vendor_id?: string; name?: string; price?: number },
  puppyId: string,
  visitDate: string | undefined,
  message: string | undefined,
  vendorId?: string
) {
  const resolvedVendorId = puppy.vendor_id || vendorId;
  if (!resolvedVendorId) {
    throw new Error('vendorId is required when puppy has no vendor');
  }
  return await insert('bookings', {
    customer_id: customerId || null,
    customer_phone: customerPhone || null,
    vendor_id: resolvedVendorId,
    pet_id: puppyId,
    service_type: 'breeder_inquiry',
    booking_date: visitDate || new Date().toISOString().split('T')[0],
    status: 'inquiry',
    notes: message || `Purchase inquiry for ${puppy.name || 'puppy'}`,
    total_amount: puppy.price || 0,
  });
}
