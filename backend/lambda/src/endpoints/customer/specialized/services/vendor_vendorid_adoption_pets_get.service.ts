import type { Context } from 'hono';
import * as vendor_vendorid_adoption_pets_getRepo from '../repos/vendor_vendorid_adoption_pets_get.repo';
import { Hono } from 'hono';
import { isValidUUID } from '../../../../types/entities';

export async function executevendorVendoridAdoptionPetsGet(c: Context) {
    try {
      const { vendorId } = c.req.param();
      const status = c.req.query('status');

      let petsQuery = `
        SELECT al.*
        FROM adoption_listings al
        WHERE al.vendor_id = $1
      `;

      const params: any[] = [vendorId];
      let paramIndex = 2;

      if (status) {
        petsQuery += ` AND al.status = $${paramIndex}`;
        params.push(status);
        paramIndex++;
      }

      petsQuery += ` ORDER BY al.created_at DESC`;

      const pets = await vendor_vendorid_adoption_pets_getRepo.dbVendorVendoridAdoptionPetsGet0(petsQuery, params).catch(() => ({ rows: [] }));

      return c.json({
        success: true,
        pets: pets.rows,
        total: pets.rows.length,
      });
    } catch (error: any) {
      console.error('Error fetching adoption pets:', error);
      return c.json({ success: true, pets: [], total: 0 });
    }
}