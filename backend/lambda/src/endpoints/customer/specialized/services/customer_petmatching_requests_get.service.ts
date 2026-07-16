import type { Context } from 'hono';
import * as customer_petmatching_requests_getRepo from '../repos/customer_petmatching_requests_get.repo';
import { Hono } from 'hono';
import { isValidUUID } from '../../../../types/entities';

export async function executecustomerPetmatchingRequestsGet(c: Context) {
    try {
      const customerId = c.req.query('customerId');
      const type = c.req.query('type') || 'received'; // 'received' or 'sent'

      if (!customerId || !isValidUUID(customerId)) {
        return c.json({ error: 'Valid customerId (UUID) is required' }, 400);
      }

      let requestsQuery;
      if (type === 'sent') {
        requestsQuery = `
          SELECT 
            mr.*,
            fp.name as from_pet_name,
            fp.breed as from_pet_breed,
            tp.name as to_pet_name,
            tp.breed as to_pet_breed,
            tc.full_name as to_owner_name
          FROM mating_requests mr
          LEFT JOIN pets fp ON mr.from_pet_id = fp.id
          LEFT JOIN pets tp ON mr.to_pet_id = tp.id
          LEFT JOIN customers tc ON mr.to_customer_id = tc.id
          WHERE mr.from_customer_id = $1
          ORDER BY mr.created_at DESC
        `;
      } else {
        requestsQuery = `
          SELECT 
            mr.*,
            fp.name as from_pet_name,
            fp.breed as from_pet_breed,
            tp.name as to_pet_name,
            tp.breed as to_pet_breed,
            fc.full_name as from_owner_name
          FROM mating_requests mr
          LEFT JOIN pets fp ON mr.from_pet_id = fp.id
          LEFT JOIN pets tp ON mr.to_pet_id = tp.id
          LEFT JOIN customers fc ON mr.from_customer_id = fc.id
          WHERE mr.to_customer_id = $1
          ORDER BY mr.created_at DESC
        `;
      }

      const requests = await customer_petmatching_requests_getRepo.dbCustomerPetmatchingRequestsGet0(customerId, requestsQuery).catch(() => ({ rows: [] }));

      return c.json({
        success: true,
        requests: requests.rows,
        total: requests.rows.length,
      });
    } catch (error: any) {
      console.error('Error fetching match requests:', error);
      return c.json({ success: true, requests: [], total: 0 });
    }
}