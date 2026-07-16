import { query, insert } from '../../../../database/rds-connection';

export async function dbAdoptionQuestionnairePost0(customerPhone: string) {
  return await query(`SELECT id FROM customers WHERE phone = $1`, [customerPhone]);
}

export async function dbAdoptionQuestionnairePost1(petId: string) {
  return await query(`SELECT vendor_id FROM adoption_listings WHERE id = $1`, [petId]);
}

async function ensureBookingForAdoption(params: {
  customerId: string | null;
  vendorId: string | null | undefined;
  petId: string | undefined;
  serviceId: string | null | undefined;
}) {
  const { customerId, vendorId, petId, serviceId } = params;
  if (!customerId || !vendorId) return null;

  let resolvedServiceId = serviceId || null;
  if (!resolvedServiceId) {
    const svc = await query(
      `SELECT id::text AS id FROM vendor_services WHERE vendor_id = $1::uuid AND COALESCE(is_enabled, true) = true LIMIT 1`,
      [vendorId]
    );
    resolvedServiceId = svc.rows?.[0]?.id || null;
  }
  if (!resolvedServiceId) {
    const anySvc = await query(
      `SELECT id::text AS id FROM vendor_services WHERE COALESCE(is_enabled, true) = true LIMIT 1`
    );
    resolvedServiceId = anySvc.rows?.[0]?.id || null;
  }
  if (!resolvedServiceId) return null;

  const booking = await insert('bookings', {
    customer_id: customerId,
    vendor_id: vendorId,
    service_id: resolvedServiceId,
    pet_id: petId || null,
    service_type: 'adoption_visit',
    booking_date: new Date().toISOString().split('T')[0],
    booking_time: '10:00',
    status: 'pending',
    notes: 'Adoption application booking',
    total_amount: 0,
  });
  return booking[0]?.id || null;
}

/** Dev schema requires booking_id + customer_id + pet_id NOT NULL. */
export async function dbAdoptionQuestionnairePost2(
  resolvedCustomerId: string | null,
  customerPhone: string | undefined,
  petId: string | undefined,
  resolvedVendorId: string | undefined,
  experience: unknown,
  livingSituation: unknown,
  otherPets: unknown,
  timeCommitment: unknown,
  reason: unknown,
  additionalInfo: unknown,
  serviceId?: string | null
) {
  const bookingId = await ensureBookingForAdoption({
    customerId: resolvedCustomerId,
    vendorId: resolvedVendorId,
    petId,
    serviceId,
  });
  if (!bookingId) {
    throw new Error('Unable to create adoption booking (need customerId, vendorId, serviceId)');
  }
  if (!petId) {
    throw new Error('petId is required');
  }

  return await insert('adoption_applications', {
    booking_id: bookingId,
    customer_id: resolvedCustomerId,
    pet_id: petId,
    application_status: 'pending',
    application_data: {
      customer_phone: customerPhone || null,
      vendor_id: resolvedVendorId || null,
      experience: experience || null,
      living_situation: livingSituation || null,
      other_pets: otherPets || null,
      time_commitment: timeCommitment || null,
      reason: reason || null,
      additional_info: additionalInfo || null,
    },
    submitted_at: new Date().toISOString(),
  });
}

export async function dbAdoptionQuestionnairePost3() {
  return await query(`SELECT 1`);
}

export async function dbAdoptionQuestionnairePost4(
  resolvedCustomerId: string | null,
  customerPhone: string | undefined,
  petId: string | undefined,
  resolvedVendorId: string | undefined,
  experience: unknown,
  livingSituation: unknown,
  otherPets: unknown,
  timeCommitment: unknown,
  reason: unknown,
  additionalInfo: unknown,
  serviceId?: string | null
) {
  return dbAdoptionQuestionnairePost2(
    resolvedCustomerId,
    customerPhone,
    petId,
    resolvedVendorId,
    experience,
    livingSituation,
    otherPets,
    timeCommitment,
    reason,
    additionalInfo,
    serviceId
  );
}
