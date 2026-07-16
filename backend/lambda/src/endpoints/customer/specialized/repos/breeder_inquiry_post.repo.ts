import { query, insert } from '../../../../database/rds-connection';

async function resolveServiceId(vendorId: string) {
  const svc = await query(
    `SELECT id::text AS id FROM vendor_services WHERE vendor_id = $1::uuid AND COALESCE(is_enabled, true) = true LIMIT 1`,
    [vendorId]
  );
  if (svc.rows?.[0]?.id) return String(svc.rows[0].id);
  const anySvc = await query(
    `SELECT id::text AS id FROM vendor_services WHERE COALESCE(is_enabled, true) = true LIMIT 1`
  );
  return anySvc.rows?.[0]?.id ? String(anySvc.rows[0].id) : null;
}

export async function dbBreederInquiryPost0(puppyId: string) {
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
  const serviceId = await resolveServiceId(resolvedVendorId);
  if (!serviceId) {
    throw new Error('No vendor service available for breeder inquiry booking');
  }
  return await insert('bookings', {
    customer_id: customerId || null,
    customer_phone: customerPhone || null,
    vendor_id: resolvedVendorId,
    service_id: serviceId,
    pet_id: puppyId,
    service_type: 'breeder_inquiry',
    booking_date: visitDate || new Date().toISOString().split('T')[0],
    booking_time: '10:00',
    status: 'inquiry',
    notes: message || `Purchase inquiry for ${puppy.name || 'puppy'}`,
    total_amount: puppy.price || 0,
    base_price: puppy.price || 0,
  });
}
