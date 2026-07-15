import type { Context } from 'hono';
import * as vendor_vendorid_matingrequests_getRepo from '../repos/vendor_vendorid_matingrequests_get.repo';
import { Hono } from 'hono';
import { isValidUUID } from '../../../../types/entities';

export async function executevendorVendoridMatingrequestsGet(c: Context) {
    try {
      const { vendorId } = c.req.param();

      // Get pets owned by this vendor (breeder)
      const vendorPets = await vendor_vendorid_matingrequests_getRepo.dbVendorVendoridMatingrequestsGet0().catch(() => ({ rows: [] }));

      if (vendorPets.rows.length === 0) {
        return c.json({ success: true, requests: [], total: 0 });
      }

      const petIds = vendorPets.rows.map((p: any) => p.id);

      const requests = await vendor_vendorid_matingrequests_getRepo.dbVendorVendoridMatingrequestsGet1(fp, tp, fc, mr).catch(() => ({ rows: [] }));

      return c.json({
        success: true,
        requests: requests.rows,
        total: requests.rows.length,
      });
    } catch (error: any) {
      console.error('Error fetching mating requests:', error);
      return c.json({ success: true, requests: [], total: 0 });
    }
}