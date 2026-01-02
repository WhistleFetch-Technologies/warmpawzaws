import { Hono } from "hono";

/**
 * ADMIN PAYOUT MANAGEMENT ENDPOINTS
 * 
 * Admin-side endpoints for managing vendor payouts:
 * - Review pending payout requests
 * - Approve/reject payouts
 * - Process settlements
 * - Track payout history
 */

export function adminPayoutEndpoints(app: Hono, kv: any) {
  
  /**
   * Get all pending payouts for admin review
   * GET /make-server-3dd53475/admin/payouts/pending
   */
  app.get("/make-server-3dd53475/admin/payouts/pending", async (c) => {
    try {
      const pendingPayoutIds = await kv.get(`admin:payouts:pending`) || [];
      
      const payouts = [];
      
      for (const payoutId of pendingPayoutIds) {
        const payout = await kv.get(`payout:${payoutId}`);
        if (payout && payout.status === 'pending') {
          // Get vendor details
          const vendor = await kv.get(`vendor:${payout.vendorId}`);
          
          payouts.push({
            ...payout,
            vendorName: vendor?.fullName || vendor?.businessName || 'Unknown',
            vendorPhone: vendor?.phone,
            vendorType: vendor?.vendorType
          });
        }
      }
      
      // Sort by date (oldest first for processing)
      payouts.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      
      return c.json({ success: true, payouts, total: payouts.length });
    } catch (error) {
      console.error('Error fetching pending payouts:', error);
      return c.json({ error: String(error) }, 500);
    }
  });
  
  /**
   * Get all payouts (with filters)
   * GET /make-server-3dd53475/admin/payouts
   */
  app.get("/make-server-3dd53475/admin/payouts", async (c) => {
    try {
      const status = c.req.query('status'); // pending, processing, completed, failed
      const vendorId = c.req.query('vendorId');
      const limit = parseInt(c.req.query('limit') || '50');
      
      // Get all payout IDs from different queues
      let allPayoutIds: string[] = [];
      
      if (status === 'pending') {
        allPayoutIds = await kv.get(`admin:payouts:pending`) || [];
      } else if (status === 'processing') {
        allPayoutIds = await kv.get(`admin:payouts:processing`) || [];
      } else if (status === 'completed') {
        allPayoutIds = await kv.get(`admin:payouts:completed`) || [];
      } else if (status === 'failed') {
        allPayoutIds = await kv.get(`admin:payouts:failed`) || [];
      } else {
        // Get all
        const pending = await kv.get(`admin:payouts:pending`) || [];
        const processing = await kv.get(`admin:payouts:processing`) || [];
        const completed = await kv.get(`admin:payouts:completed`) || [];
        const failed = await kv.get(`admin:payouts:failed`) || [];
        allPayoutIds = [...pending, ...processing, ...completed, ...failed];
      }
      
      const payouts = [];
      
      for (const payoutId of allPayoutIds.slice(0, limit)) {
        const payout = await kv.get(`payout:${payoutId}`);
        if (!payout) continue;
        
        // Filter by vendorId if provided
        if (vendorId && payout.vendorId !== vendorId) continue;
        
        // Get vendor details
        const vendor = await kv.get(`vendor:${payout.vendorId}`);
        
        payouts.push({
          ...payout,
          vendorName: vendor?.fullName || vendor?.businessName || 'Unknown',
          vendorPhone: vendor?.phone,
          vendorType: vendor?.vendorType
        });
      }
      
      return c.json({ success: true, payouts, total: payouts.length });
    } catch (error) {
      console.error('Error fetching payouts:', error);
      return c.json({ error: String(error) }, 500);
    }
  });
  
  /**
   * Approve payout and move to processing
   * POST /make-server-3dd53475/admin/payouts/:payoutId/approve
   */
  app.post("/make-server-3dd53475/admin/payouts/:payoutId/approve", async (c) => {
    try {
      const { payoutId } = c.req.param();
      const { adminId, notes, transactionId } = await c.req.json();
      
      const payout = await kv.get(`payout:${payoutId}`);
      
      if (!payout) {
        return c.json({ error: 'Payout not found' }, 404);
      }
      
      if (payout.status !== 'pending') {
        return c.json({ error: 'Payout is not in pending status' }, 400);
      }
      
      // Update payout status
      payout.status = 'processing';
      payout.approvedBy = adminId;
      payout.approvedAt = new Date().toISOString();
      payout.adminNotes = notes || '';
      payout.transactionId = transactionId || null;
      payout.updatedAt = new Date().toISOString();
      
      await kv.set(`payout:${payoutId}`, payout);
      
      // Remove from pending queue
      const pendingPayouts = await kv.get(`admin:payouts:pending`) || [];
      const updatedPending = pendingPayouts.filter((id: string) => id !== payoutId);
      await kv.set(`admin:payouts:pending`, updatedPending);
      
      // Add to processing queue
      const processingPayouts = await kv.get(`admin:payouts:processing`) || [];
      processingPayouts.unshift(payoutId);
      await kv.set(`admin:payouts:processing`, processingPayouts);
      
      // Create notification for vendor
      const notificationId = `notification_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const notification = {
        notificationId,
        vendorId: payout.vendorId,
        type: 'payout_approved',
        title: 'Payout Approved',
        message: `Your payout request of ₹${payout.amount} has been approved and is being processed.`,
        createdAt: new Date().toISOString(),
        isRead: false
      };
      
      await kv.set(`notification:${notificationId}`, notification);
      
      const vendorNotifications = await kv.get(`vendor:${payout.vendorId}:notifications`) || [];
      vendorNotifications.unshift(notificationId);
      await kv.set(`vendor:${payout.vendorId}:notifications`, vendorNotifications);
      
      console.log(`✅ Payout ${payoutId} approved and moved to processing`);
      return c.json({ success: true, payout });
    } catch (error) {
      console.error('Error approving payout:', error);
      return c.json({ error: String(error) }, 500);
    }
  });
  
  /**
   * Complete payout (mark as settled)
   * POST /make-server-3dd53475/admin/payouts/:payoutId/complete
   */
  app.post("/make-server-3dd53475/admin/payouts/:payoutId/complete", async (c) => {
    try {
      const { payoutId } = c.req.param();
      const { adminId, transactionId, notes } = await c.req.json();
      
      const payout = await kv.get(`payout:${payoutId}`);
      
      if (!payout) {
        return c.json({ error: 'Payout not found' }, 404);
      }
      
      if (payout.status !== 'processing') {
        return c.json({ error: 'Payout is not in processing status' }, 400);
      }
      
      // Update payout status
      payout.status = 'completed';
      payout.completedBy = adminId;
      payout.completedAt = new Date().toISOString();
      payout.transactionId = transactionId || payout.transactionId;
      payout.adminNotes = (payout.adminNotes || '') + '\n' + (notes || '');
      payout.updatedAt = new Date().toISOString();
      
      await kv.set(`payout:${payoutId}`, payout);
      
      // Remove from processing queue
      const processingPayouts = await kv.get(`admin:payouts:processing`) || [];
      const updatedProcessing = processingPayouts.filter((id: string) => id !== payoutId);
      await kv.set(`admin:payouts:processing`, updatedProcessing);
      
      // Add to completed queue
      const completedPayouts = await kv.get(`admin:payouts:completed`) || [];
      completedPayouts.unshift(payoutId);
      await kv.set(`admin:payouts:completed`, completedPayouts);
      
      // Update vendor stats
      const vendor = await kv.get(`vendor:${payout.vendorId}`);
      if (vendor) {
        vendor.totalPayoutsReceived = (vendor.totalPayoutsReceived || 0) + payout.amount;
        vendor.lastPayoutAt = payout.completedAt;
        await kv.set(`vendor:${payout.vendorId}`, vendor);
      }
      
      // Create notification for vendor
      const notificationId = `notification_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const notification = {
        notificationId,
        vendorId: payout.vendorId,
        type: 'payout_completed',
        title: 'Payout Completed',
        message: `Your payout of ₹${payout.amount} has been successfully transferred. Transaction ID: ${transactionId}`,
        createdAt: new Date().toISOString(),
        isRead: false
      };
      
      await kv.set(`notification:${notificationId}`, notification);
      
      const vendorNotifications = await kv.get(`vendor:${payout.vendorId}:notifications`) || [];
      vendorNotifications.unshift(notificationId);
      await kv.set(`vendor:${payout.vendorId}:notifications`, vendorNotifications);
      
      console.log(`✅ Payout ${payoutId} completed and settled`);
      return c.json({ success: true, payout });
    } catch (error) {
      console.error('Error completing payout:', error);
      return c.json({ error: String(error) }, 500);
    }
  });
  
  /**
   * Reject payout
   * POST /make-server-3dd53475/admin/payouts/:payoutId/reject
   */
  app.post("/make-server-3dd53475/admin/payouts/:payoutId/reject", async (c) => {
    try {
      const { payoutId } = c.req.param();
      const { adminId, reason } = await c.req.json();
      
      const payout = await kv.get(`payout:${payoutId}`);
      
      if (!payout) {
        return c.json({ error: 'Payout not found' }, 404);
      }
      
      if (payout.status === 'completed') {
        return c.json({ error: 'Cannot reject completed payout' }, 400);
      }
      
      // Update payout status
      payout.status = 'failed';
      payout.rejectedBy = adminId;
      payout.failedAt = new Date().toISOString();
      payout.failureReason = reason || 'Rejected by admin';
      payout.updatedAt = new Date().toISOString();
      
      await kv.set(`payout:${payoutId}`, payout);
      
      // Remove from pending or processing queue
      if (payout.status === 'pending') {
        const pendingPayouts = await kv.get(`admin:payouts:pending`) || [];
        const updatedPending = pendingPayouts.filter((id: string) => id !== payoutId);
        await kv.set(`admin:payouts:pending`, updatedPending);
      } else {
        const processingPayouts = await kv.get(`admin:payouts:processing`) || [];
        const updatedProcessing = processingPayouts.filter((id: string) => id !== payoutId);
        await kv.set(`admin:payouts:processing`, updatedProcessing);
      }
      
      // Add to failed queue
      const failedPayouts = await kv.get(`admin:payouts:failed`) || [];
      failedPayouts.unshift(payoutId);
      await kv.set(`admin:payouts:failed`, failedPayouts);
      
      // Create notification for vendor
      const notificationId = `notification_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const notification = {
        notificationId,
        vendorId: payout.vendorId,
        type: 'payout_rejected',
        title: 'Payout Rejected',
        message: `Your payout request of ₹${payout.amount} has been rejected. Reason: ${reason}`,
        createdAt: new Date().toISOString(),
        isRead: false
      };
      
      await kv.set(`notification:${notificationId}`, notification);
      
      const vendorNotifications = await kv.get(`vendor:${payout.vendorId}:notifications`) || [];
      vendorNotifications.unshift(notificationId);
      await kv.set(`vendor:${payout.vendorId}:notifications`, vendorNotifications);
      
      console.log(`✅ Payout ${payoutId} rejected`);
      return c.json({ success: true, payout });
    } catch (error) {
      console.error('Error rejecting payout:', error);
      return c.json({ error: String(error) }, 500);
    }
  });
  
  /**
   * Get payout statistics for admin dashboard
   * GET /make-server-3dd53475/admin/payouts/stats
   */
  app.get("/make-server-3dd53475/admin/payouts/stats", async (c) => {
    try {
      const pending = await kv.get(`admin:payouts:pending`) || [];
      const processing = await kv.get(`admin:payouts:processing`) || [];
      const completed = await kv.get(`admin:payouts:completed`) || [];
      const failed = await kv.get(`admin:payouts:failed`) || [];
      
      let totalPending = 0;
      let totalProcessing = 0;
      let totalCompleted = 0;
      
      // Calculate amounts
      for (const payoutId of pending) {
        const payout = await kv.get(`payout:${payoutId}`);
        if (payout) totalPending += payout.amount;
      }
      
      for (const payoutId of processing) {
        const payout = await kv.get(`payout:${payoutId}`);
        if (payout) totalProcessing += payout.amount;
      }
      
      for (const payoutId of completed) {
        const payout = await kv.get(`payout:${payoutId}`);
        if (payout) totalCompleted += payout.amount;
      }
      
      return c.json({
        success: true,
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
      return c.json({ error: String(error) }, 500);
    }
  });
  
  console.log('✅ Admin payout endpoints registered');
}
