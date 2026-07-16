import { query, insert } from '../../../../database/rds-connection';

export async function dbAdoptionQuestionnairePost0(customerPhone: string) {
  return await query(`SELECT id from customers WHERE phone = $1`, [customerPhone]);
}

export async function dbAdoptionQuestionnairePost1(petId: string) {
  return await query(`SELECT vendor_id FROM adoption_listings WHERE id = $1`, [petId]);
}

/** Dev schema: adoption_applications has application_status + application_data (jsonb), not flat form columns. */
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
  additionalInfo: unknown
) {
  return await insert('adoption_applications', {
    customer_id: resolvedCustomerId,
    pet_id: petId || null,
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
  // Table already exists on dev; keep no-op DDL for older envs that may lack it.
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
  additionalInfo: unknown
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
    additionalInfo
  );
}
