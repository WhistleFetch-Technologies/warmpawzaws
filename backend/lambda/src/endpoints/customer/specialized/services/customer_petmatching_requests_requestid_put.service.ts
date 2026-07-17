import type { Context } from 'hono';
import * as customer_petmatching_requests_requestid_putRepo from '../repos/customer_petmatching_requests_requestid_put.repo';
import { Hono } from 'hono';
import { isValidUUID } from '../../../../types/entities';

export async function executecustomerPetmatchingRequestsRequestidPut(c: Context) {
    try {
      const { requestId } = c.req.param();
      const body = await c.req.json();
      const { action } = body; // 'accept' or 'decline'

      if (!['accept', 'decline'].includes(action)) {
        return c.json({ error: 'Action must be accept or decline' }, 400);
      }

      const updateData: any = {
        status: action === 'accept' ? 'accepted' : 'declined',
        updated_at: new Date().toISOString(),
      };

      if (action === 'accept') {
        updateData.accepted_at = new Date().toISOString();
      } else {
        updateData.declined_at = new Date().toISOString();
      }

      const updated = await customer_petmatching_requests_requestid_putRepo.dbCustomerPetmatchingRequestsRequestidPut0(requestId, updateData)

      return c.json({
        success: true,
        request: updated[0],
        message: action === 'accept' ? 'Match request accepted!' : 'Match request declined',
      });
    } catch (error: any) {
      console.error('Error updating match request:', error);
      return c.json({ error: error.message }, 500);
    }
}