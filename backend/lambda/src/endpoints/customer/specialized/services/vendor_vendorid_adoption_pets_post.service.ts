import type { Context } from 'hono';
import * as vendor_vendorid_adoption_pets_postRepo from '../repos/vendor_vendorid_adoption_pets_post.repo';
import { Hono } from 'hono';
import { isValidUUID } from '../../../../types/entities';

export async function executevendorVendoridAdoptionPetsPost(c: Context) {
    try {
      const { vendorId } = c.req.param();
      const petData = await c.req.json();

      const pet = await vendor_vendorid_adoption_pets_postRepo.dbVendorVendoridAdoptionPetsPost0(vendorId, petData)

      return c.json({
        success: true,
        pet: pet[0],
        message: 'Pet added for adoption',
      });
    } catch (error: any) {
      console.error('Error adding adoption pet:', error);
      return c.json({ success: false, error: error.message }, 500);
    }
}