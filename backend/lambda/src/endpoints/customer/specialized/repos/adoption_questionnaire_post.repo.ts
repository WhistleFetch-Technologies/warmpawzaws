import { query, insert } from '../../../../database/rds-connection';

export async function dbAdoptionQuestionnairePost0(customerPhone: string) {
  return await query(`SELECT id FROM customers WHERE phone = $1`, [customerPhone]);
}

export async function dbAdoptionQuestionnairePost1(petId: string) {
  return await query(`SELECT vendor_id FROM pets WHERE id = $1`, [petId]);
}

export async function dbAdoptionQuestionnairePost2(
  resolvedCustomerId: string,
  customerPhone: string,
  petId: string,
  resolvedVendorId: string,
  experience: string,
  livingSituation: string,
  otherPets: string,
  timeCommitment: string,
  reason: string,
  additionalInfo: string
) {
  return await insert('adoption_applications', {
    customer_id: resolvedCustomerId,
    customer_phone: customerPhone,
    pet_id: petId,
    vendor_id: resolvedVendorId,
    experience,
    living_situation: livingSituation,
    other_pets: otherPets,
    time_commitment: timeCommitment,
    reason,
    additional_info: additionalInfo,
    status: 'pending',
    submitted_at: new Date().toISOString(),
  });
}

export async function dbAdoptionQuestionnairePost3() {
  return await query(`
    CREATE TABLE IF NOT EXISTS adoption_applications (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      customer_id UUID,
      customer_phone VARCHAR(20),
      pet_id UUID,
      vendor_id UUID,
      experience VARCHAR(50),
      living_situation VARCHAR(50),
      other_pets VARCHAR(50),
      time_commitment VARCHAR(50),
      reason TEXT,
      additional_info TEXT,
      status VARCHAR(50) DEFAULT 'pending',
      submitted_at TIMESTAMP DEFAULT NOW(),
      reviewed_at TIMESTAMP,
      reviewer_notes TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);
}

export async function dbAdoptionQuestionnairePost4(
  resolvedCustomerId: string,
  customerPhone: string,
  petId: string,
  resolvedVendorId: string,
  experience: string,
  livingSituation: string,
  otherPets: string,
  timeCommitment: string,
  reason: string,
  additionalInfo: string
) {
  return await insert('adoption_applications', {
    customer_id: resolvedCustomerId,
    customer_phone: customerPhone,
    pet_id: petId,
    vendor_id: resolvedVendorId,
    experience,
    living_situation: livingSituation,
    other_pets: otherPets,
    time_commitment: timeCommitment,
    reason,
    additional_info: additionalInfo,
    status: 'pending',
  });
}
