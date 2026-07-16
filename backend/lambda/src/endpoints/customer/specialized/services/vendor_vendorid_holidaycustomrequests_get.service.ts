import type { Context } from 'hono';
import * as vendor_vendorid_holidaycustomrequests_getRepo from '../repos/vendor_vendorid_holidaycustomrequests_get.repo';
import { Hono } from 'hono';
import { isValidUUID } from '../../../../types/entities';

export async function executevendorVendoridHolidaycustomrequestsGet(c: Context) {
    try {
      const { vendorId } = c.req.param();

      const requests = await vendor_vendorid_holidaycustomrequests_getRepo.dbVendorVendoridHolidaycustomrequestsGet0(vendorId).catch(() => ({ rows: [] }));

      return c.json({
        success: true,
        requests: requests.rows,
        total: requests.rows.length,
      });
    } catch (error: any) {
      console.error('Error fetching holiday custom requests:', error);
      return c.json({ success: true, requests: [], total: 0 });
    }
}