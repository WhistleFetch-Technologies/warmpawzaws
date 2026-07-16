import type { Context } from 'hono';
import * as customer_petmatching_request_postRepo from '../repos/customer_petmatching_request_post.repo';
import { Hono } from 'hono';
import { isValidUUID } from '../../../../types/entities';

export async function executecustomerPetmatchingRequestPost(c: Context) {
    try {
      const body = await c.req.json();
      const { fromPetId, toPetId, fromCustomerId, message } = body;

      if (!fromPetId || !toPetId) {
        return c.json({ error: 'Both pet IDs are required' }, 400);
      }

      if (!fromCustomerId || !isValidUUID(fromCustomerId)) {
        return c.json({ error: 'fromCustomerId (valid UUID) is required' }, 400);
      }

      const ownerCheck = await customer_petmatching_request_postRepo.dbCustomerPetmatchingRequestPost0(fromPetId, fromCustomerId)
      if (ownerCheck.rows.length === 0) {
        return c.json({ error: 'fromPetId must be one of your pets' }, 403);
      }

      // Get target pet owner
      const targetPet = await customer_petmatching_request_postRepo.dbCustomerPetmatchingRequestPost1(toPetId)
      if (targetPet.rows.length === 0) {
        return c.json({ error: 'Target pet not found' }, 404);
      }

      const toCustomerId = targetPet.rows[0].customer_id;
      if (toCustomerId && String(toCustomerId) === String(fromCustomerId)) {
        return c.json({ error: 'Cannot send a match request to your own pet' }, 400);
      }

      // Create match request
      const matchRequest = await customer_petmatching_request_postRepo.dbCustomerPetmatchingRequestPost2(fromPetId, toPetId, fromCustomerId, toCustomerId, message).catch(async () => {
        // Create table if not exists
        await customer_petmatching_request_postRepo.dbCustomerPetmatchingRequestPost3()
        return customer_petmatching_request_postRepo.dbCustomerPetmatchingRequestPost2(fromPetId, toPetId, fromCustomerId, toCustomerId, message);
      });

      return c.json({
        success: true,
        request: matchRequest[0],
        message: 'Match request sent successfully!',
      });
    } catch (error: any) {
      console.error('Error creating match request:', error);
      return c.json({ error: error.message }, 500);
    }
}