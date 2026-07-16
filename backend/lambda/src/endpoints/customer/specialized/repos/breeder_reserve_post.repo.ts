import { query, insert, update } from '../../../../database/rds-connection';

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

export async function dbBreederReservePost0(puppyId: string) {
  const listing = await query(
    `SELECT id, vendor_id, pet_name as name, adoption_fee as price, status FROM adoption_listings WHERE id = $1`,
    [puppyId]
  );
  if (listing.rows?.length) return listing;
  return await query(
    `SELECT id, name, NULL::uuid as vendor_id, NULL::numeric as price, 'available'::text as status FROM pets WHERE id = $1`,
    [puppyId]
  );
}

export async function dbBreederReservePost1(puppyId: string, _customerId: string) {
  try {
    return await update(
      'adoption_listings',
      { id: puppyId },
      { status: 'reserved', updated_at: new Date().toISOString() }
    );
  } catch {
    return [];
  }
}

export async function dbBreederReservePost2(
  customerId: string,
  puppy: { vendor_id?: string; name?: string; price?: number },
  puppyId: string,
  depositAmount: number | undefined,
  vendorId?: string
) {
  const resolvedVendorId = puppy.vendor_id || vendorId;
  if (!resolvedVendorId) {
    throw new Error('vendorId is required when puppy has no vendor');
  }
  const serviceId = await resolveServiceId(resolvedVendorId);
  if (!serviceId) {
    throw new Error('No vendor service available for puppy reservation booking');
  }
  const price = Number(puppy.price || 0);
  return await insert('bookings', {
    customer_id: customerId,
    vendor_id: resolvedVendorId,
    service_id: serviceId,
    pet_id: puppyId,
    service_type: 'puppy_reservation',
    booking_date: new Date().toISOString().split('T')[0],
    booking_time: '10:00',
    status: 'reserved',
    total_amount: price,
    base_price: price,
    payment_status: 'pending',
    notes: `Reservation deposit pending for ${puppy.name || 'puppy'}; amount=${depositAmount || price * 0.2}`,
  });
}
