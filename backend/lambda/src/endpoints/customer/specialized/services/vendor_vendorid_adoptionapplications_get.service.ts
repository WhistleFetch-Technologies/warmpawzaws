import type { Context } from 'hono';
import * as vendor_vendorid_adoptionapplications_getRepo from '../repos/vendor_vendorid_adoptionapplications_get.repo';
import { Hono } from 'hono';
import { isValidUUID } from '../../../../types/entities';

export async function executevendorVendoridAdoptionapplicationsGet(c: Context) {
    try {
      const { vendorId } = c.req.param();
      const status = c.req.query('status');

      let applicationsQuery = `
        SELECT 
          aa.*,
          p.name as pet_name,
          p.breed as pet_breed,
          p.photos as pet_photos,
          c.full_name as customer_name,
          c.phone as customer_phone,
          c.email as customer_email
        FROM adoption_applications aa
        LEFT JOIN pets p ON aa.pet_id = p.id
        LEFT JOIN customers c ON aa.customer_id = c.id
        WHERE aa.vendor_id = $1
      `;

      const params: any[] = [vendorId];
      let paramIndex = 2;

      if (status) {
        applicationsQuery += ` AND aa.status = ${paramIndex}`;
        params.push(status);
        paramIndex++;
      }

      applicationsQuery += ` ORDER BY aa.submitted_at DESC`;

      const applications = await vendor_vendorid_adoptionapplications_getRepo.dbVendorVendoridAdoptionapplicationsGet0(applicationsQuery, params).catch(() => ({ rows: [] }));

      return c.json({
        success: true,
        applications: applications.rows,
        total: applications.rows.length,
      });
    } catch (error: any) {
      console.error('Error fetching adoption applications:', error);
      return c.json({ success: true, applications: [], total: 0 });
    }
}