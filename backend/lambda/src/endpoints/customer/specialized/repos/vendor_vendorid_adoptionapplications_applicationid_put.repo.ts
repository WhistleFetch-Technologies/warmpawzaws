import { update } from '../../../../database/rds-connection';

export async function dbVendorVendoridAdoptionapplicationsApplicationidPut0(applicationId, vendorId, reviewerNotes) {
  return await update(
    'adoption_applications',
    { id: applicationId, vendor_id: vendorId },
    {
      status,
      reviewer_notes: reviewerNotes,
      reviewed_at: new Date().toISOString(),
    }
  );
}

export async function dbVendorVendoridAdoptionapplicationsApplicationidPut1(petId) {
  return await update('pets', { id: petId }, { status: 'adoption_pending' });
}
