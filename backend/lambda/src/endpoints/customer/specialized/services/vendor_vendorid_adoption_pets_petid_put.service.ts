import type { Context } from 'hono';
import * as vendor_vendorid_adoption_pets_petid_putRepo from '../repos/vendor_vendorid_adoption_pets_petid_put.repo';

export async function executevendorVendoridAdoptionPetsPetidPut(c: Context) {
  try {
    const { petId } = c.req.param();
    const petData = await c.req.json();

    const updated = await vendor_vendorid_adoption_pets_petid_putRepo.dbVendorVendoridAdoptionPetsPetidPut0(petId, petData);

    return c.json({
      success: true,
      pet: updated[0],
      message: 'Pet updated',
    });
  } catch (error: any) {
    console.error('Error updating adoption pet:', error);
    return c.json({ success: false, error: error.message }, 500);
  }
}
