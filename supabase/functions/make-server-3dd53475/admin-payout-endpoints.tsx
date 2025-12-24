import { Hono } from "npm:hono";
import { getPayoutsRepository } from "../../lib/repositories/payouts.ts";
import { getVendorsRepository } from "../../lib/repositories/vendors.ts";
import { getNotificationsRepository } from "../../lib/repositories/notifications.ts";
import { getDbClient } from "../../lib/db.ts";
import { sendSuccess, sendError } from "./response-utils.ts";

/**
 * ADMIN PAYOUT MANAGEMENT ENDPOINTS (✅ SQL-ONLY)
 * 
 * Admin-side endpoints for managing vendor payouts:
 * - Review pending payout requests
 * - Approve/reject payouts
 * - Process settlements
 * - Track payout history
 * 
 * MIGRATED: All KV operations replaced with SQL repositories
 */

export function adminPayoutEndpoints(app: Hono) {
  const payoutsRepo = getPayoutsRepository();
  const vendorsRepo = getVendorsRepository();
  const notificationsRepo = getNotificationsRepository();
  const client = getDbClient();
  
  /**
   * Get all pending payouts for admin review (✅ SQL-only)
   * GET /make-server-3dd53475/admin/payouts/pending
   */
  app.get("/make-server-3dd53475/admin/payouts/pending", async (c) => {
    try {
      // ✅ SQL: Get all pending payouts
      const payouts = await payoutsRepo.findByStatus('pending', { limit: 100 });
      
      // Enrich with vendor details
      const enrichedPayouts = await Promise.all(
        payouts.map(async (payout) => {
          const vendor = await vendorsRepo.findById(payout.vendor_id);
          return {
            ...payout,
            vendorName: vendor?.business_name || vendor?.owner_name || 'Unknown',
            vendorPhone: vendor?.phone,
            vendorType: vendor?.role_id || 'unknown',
            createdAt: payout.created_at
          };
        })
      );
      
      // Sort by date (oldest first for processing)
      enrichedPayouts.sort((a, b) => 
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
      
      return sendSuccess(c, { payouts: enrichedPayouts, total: enrichedPayouts.length });
    } catch (error) {
      console.error('Error fetching pending payouts:', error);
      return sendError(c, error, 500);
    }
  });
  
  /**
   * Get all payouts (with filters) (✅ SQL-only)
   * GET /make-server-3dd53475/admin/payouts
   */
  app.get("/make-server-3dd53475/admin/payouts", async (c) => {
    try {
      const status = c.req.query('status'); // pending, processing, completed, failed
      const vendorId = c.req.query('vendorId');
      const limit = parseInt(c.req.query('limit') || '50');
      
      let payouts;
      
      if (status) {
        // ✅ SQL: Get payouts by status
        payouts = await payoutsRepo.findByStatus(status, { limit });
      } else if (vendorId) {
        // ✅ SQL: Get payouts by vendor
        payouts = await payoutsRepo.findByVendor(vendorId, { limit });
      } else {
        // ✅ SQL: Get all payouts (using direct query for multiple statuses)
        const { data, error } = await client
          .from('payouts')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(limit);
        
        if (error) throw error;
        payouts = data || [];
      }
      
      // Enrich with vendor details
      const enrichedPayouts = await Promise.all(
        payouts.map(async (payout: any) => {
          const vendor = await vendorsRepo.findById(payout.vendor_id);
          return {
            ...payout,
            vendorName: vendor?.business_name || vendor?.owner_name || 'Unknown',
            vendorPhone: vendor?.phone,
            vendorType: vendor?.role_id || 'unknown'
          };
        })
      );
      
      return sendSuccess(c, { payouts: enrichedPayouts, total: enrichedPayouts.length });
    } catch (error) {
      console.error('Error fetching payouts:', error);
      return sendError(c, error, 500);
    }
  });
  
  /**
   * Approve payout and move to processing (✅ SQL-only)
   * POST /make-server-3dd53475/admin/payouts/:payoutId/approve
   */
  app.post("/make-server-3dd53475/admin/payouts/:payoutId/approve", async (c) => {
    try {
      const { payoutId } = c.req.param();
      const { adminId, notes, transactionId } = await c.req.json();
      
      // ✅ SQL: Get payout
      const payout = await payoutsRepo.findById(payoutId);
      
      if (!payout) {
        return sendError(c, 'Payout not found', 404);
      }
      
      if (payout.payout_status !== 'pending') {
        return sendError(c, 'Payout is not in pending status', 400);
      }
      
      // ✅ SQL: Update payout status to processing
      const updatedPayout = await payoutsRepo.update(payoutId, {
        payout_status: 'processing',
        processed_at: new Date().toISOString()
      });
      
      // ✅ SQL: Update admin tracking fields
      await client
        .from('payouts')
        .update({
          approved_by: adminId,
          approved_at: new Date().toISOString(),
          admin_notes: notes || '',
          transaction_id: transactionId || null
        })
        .eq('id', payoutId);
      
      // ✅ SQL: Create notification for vendor
      await notificationsRepo.create({
        recipient_type: 'vendor',
        recipient_id: payout.vendor_id,
        notification_type: 'payout_approved',
        title: 'Payout Approved',
        message: `Your payout request of ₹${payout.amount} has been approved and is being processed.`,
        channels: { in_app: true, email: false, sms: false }
      });
      
      console.log(`✅ Payout ${payoutId} approved and moved to processing`);
      return sendSuccess(c, { payout: updatedPayout });
    } catch (error) {
      console.error('Error approving payout:', error);
      return sendError(c, error, 500);
    }
  });
  
  /**
   * Complete payout (mark as settled) (✅ SQL-only)
   * POST /make-server-3dd53475/admin/payouts/:payoutId/complete
   */
  app.post("/make-server-3dd53475/admin/payouts/:payoutId/complete", async (c) => {
    try {
      const { payoutId } = c.req.param();
      const { adminId, transactionId, notes } = await c.req.json();
      
      // ✅ SQL: Get payout
      const payout = await payoutsRepo.findById(payoutId);
      
      if (!payout) {
        return sendError(c, 'Payout not found', 404);
      }
      
      if (payout.payout_status !== 'processing') {
        return sendError(c, 'Payout is not in processing status', 400);
      }
      
      // ✅ SQL: Complete payout
      const completedPayout = await payoutsRepo.complete(payoutId);
      
      // ✅ SQL: Update admin tracking fields
      const existingNotes = (completedPayout as any).admin_notes || '';
      await client
        .from('payouts')
        .update({
          completed_by: adminId,
          transaction_id: transactionId || (completedPayout as any).transaction_id,
          admin_notes: existingNotes ? `${existingNotes}\n${notes || ''}` : (notes || '')
        })
        .eq('id', payoutId);
      
      // ✅ SQL: Update vendor stats (if needed, could be a trigger or separate service)
      // For now, we'll just log it - vendor stats can be calculated from payouts table
      
      // ✅ SQL: Create notification for vendor
      await notificationsRepo.create({
        recipient_type: 'vendor',
        recipient_id: payout.vendor_id,
        notification_type: 'payout_completed',
        title: 'Payout Completed',
        message: `Your payout of ₹${payout.amount} has been successfully transferred. Transaction ID: ${transactionId || 'N/A'}`,
        channels: { in_app: true, email: true, sms: false }
      });
      
      console.log(`✅ Payout ${payoutId} completed and settled`);
      return sendSuccess(c, { payout: completedPayout });
    } catch (error) {
      console.error('Error completing payout:', error);
      return sendError(c, error, 500);
    }
  });
  
  /**
   * Reject payout (✅ SQL-only)
   * POST /make-server-3dd53475/admin/payouts/:payoutId/reject
   */
  app.post("/make-server-3dd53475/admin/payouts/:payoutId/reject", async (c) => {
    try {
      const { payoutId } = c.req.param();
      const { adminId, reason } = await c.req.json();
      
      // ✅ SQL: Get payout
      const payout = await payoutsRepo.findById(payoutId);
      
      if (!payout) {
        return sendError(c, 'Payout not found', 404);
      }
      
      if (payout.payout_status === 'completed') {
        return sendError(c, 'Cannot reject completed payout', 400);
      }
      
      // ✅ SQL: Reject payout
      const rejectedPayout = await payoutsRepo.fail(payoutId, reason || 'Rejected by admin');
      
      // ✅ SQL: Update admin tracking fields
      await client
        .from('payouts')
        .update({
          rejected_by: adminId,
          failed_at: new Date().toISOString()
        })
        .eq('id', payoutId);
      
      // ✅ SQL: Create notification for vendor
      await notificationsRepo.create({
        recipient_type: 'vendor',
        recipient_id: payout.vendor_id,
        notification_type: 'payout_rejected',
        title: 'Payout Rejected',
        message: `Your payout request of ₹${payout.amount} has been rejected. Reason: ${reason || 'Rejected by admin'}`,
        channels: { in_app: true, email: true, sms: false }
      });
      
      console.log(`✅ Payout ${payoutId} rejected`);
      return sendSuccess(c, { payout: rejectedPayout });
    } catch (error) {
      console.error('Error rejecting payout:', error);
      return sendError(c, error, 500);
    }
  });
  
  /**
   * Get payout statistics for admin dashboard (✅ SQL-only)
   * GET /make-server-3dd53475/admin/payouts/stats
   */
  app.get("/make-server-3dd53475/admin/payouts/stats", async (c) => {
    try {
      // ✅ SQL: Get payout stats by status
      const [pending, processing, completed, failed] = await Promise.all([
        payoutsRepo.findByStatus('pending'),
        payoutsRepo.findByStatus('processing'),
        payoutsRepo.findByStatus('completed'),
        payoutsRepo.findByStatus('failed')
      ]);
      
      // Calculate totals
      const totalPending = pending.reduce((sum, p) => sum + Number(p.amount), 0);
      const totalProcessing = processing.reduce((sum, p) => sum + Number(p.amount), 0);
      const totalCompleted = completed.reduce((sum, p) => sum + Number(p.amount), 0);
      
      return sendSuccess(c, {
        stats: {
          pending: {
            count: pending.length,
            amount: totalPending
          },
          processing: {
            count: processing.length,
            amount: totalProcessing
          },
          completed: {
            count: completed.length,
            amount: totalCompleted
          },
          failed: {
            count: failed.length
          },
          total: {
            count: pending.length + processing.length + completed.length + failed.length,
            amount: totalPending + totalProcessing + totalCompleted
          }
        }
      });
    } catch (error) {
      console.error('Error fetching payout stats:', error);
      return sendError(c, error, 500);
    }
  });
  
  console.log('✅ Admin payout endpoints registered (SQL-only)');
}
