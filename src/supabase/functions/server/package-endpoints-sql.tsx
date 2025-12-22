/**
 * PACKAGE ENDPOINTS - SQL VERSION
 * NO KV STORE - All data from SQL
 */

import { Hono } from 'npm:hono';
import { getDbClient, withTransaction } from '../../../supabase/lib/db.ts';
import { getSchedulingService } from '../../../supabase/lib/services/scheduling-service.ts';

export function packageEndpointsSQL(app: Hono) {
  
  /**
   * Redeem/Use package session (SQL)
   * POST /make-server-3dd53475/customer/:customerId/packages/:purchaseId/redeem
   */
  app.post('/make-server-3dd53475/customer/:customerId/packages/:purchaseId/redeem', async (c) => {
    try {
      const { customerId, purchaseId } = c.req.param();
      const { serviceId, bookingId, notes, date, time } = await c.req.json();
      
      console.log('🎟️ [PACKAGE] Redeeming package session:', purchaseId, '(SQL)');
      
      const client = getDbClient();
      const schedulingService = getSchedulingService();
      
      // Get package purchase
      const { data: purchase, error: purchaseError } = await client
        .from('package_purchases')
        .select('*')
        .eq('id', purchaseId)
        .single();
      
      if (purchaseError || !purchase) {
        return c.json({ error: 'Package not found' }, 404);
      }
      
      if (purchase.customer_id !== customerId) {
        return c.json({ error: 'Unauthorized' }, 403);
      }
      
      if (purchase.status !== 'active') {
        return c.json({ error: `Package is ${purchase.status}` }, 400);
      }
      
      // Check expiry
      if (purchase.expires_at && new Date(purchase.expires_at) < new Date()) {
        await client
          .from('package_purchases')
          .update({ status: 'expired' })
          .eq('id', purchaseId);
        
        return c.json({ error: 'Package expired' }, 400);
      }
      
      // Check remaining sessions
      if (!purchase.unlimited_usage) {
        const { data: sessions } = await client
          .from('package_sessions')
          .select('id')
          .eq('package_purchase_id', purchaseId)
          .in('status', ['pending', 'reserved', 'booked', 'completed']);
        
        const usedSessions = sessions?.length || 0;
        
        if (usedSessions >= purchase.total_sessions) {
          await client
            .from('package_purchases')
            .update({ status: 'used_up' })
            .eq('id', purchaseId);
          
          return c.json({ error: 'No sessions remaining' }, 400);
        }
      }
      
      // Redeem package session with slot validation (atomic)
      const result = await schedulingService.redeemPackageSession(
        purchaseId,
        customerId,
        purchase.vendor_id,
        serviceId,
        date,
        time
      );
      
      if (!result.success) {
        return c.json({ error: result.error }, 400);
      }
      
      // Get updated session
      const { data: session } = await client
        .from('package_sessions')
        .select('*')
        .eq('id', result.sessionId)
        .single();
      
      // Get remaining sessions count
      const { data: allSessions } = await client
        .from('package_sessions')
        .select('id')
        .eq('package_purchase_id', purchaseId)
        .in('status', ['pending', 'reserved', 'booked', 'completed']);
      
      const remainingSessions = purchase.unlimited_usage 
        ? -1 
        : purchase.total_sessions - (allSessions?.length || 0);
      
      console.log('✅ [PACKAGE] Session redeemed. Remaining:', remainingSessions, '(SQL)');
      
      return c.json({
        success: true,
        remainingSessions,
        unlimitedUsage: purchase.unlimited_usage,
        session
      });
    } catch (error) {
      console.error('❌ [PACKAGE] Error redeeming session:', error);
      return c.json({ error: String(error) }, 500);
    }
  });
}

// Export as default for compatibility
export default packageEndpointsSQL;

