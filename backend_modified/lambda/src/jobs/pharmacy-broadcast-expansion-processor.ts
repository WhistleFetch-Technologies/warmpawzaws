/**
 * ============================================================================
 * PHARMACY BROADCAST EXPANSION PROCESSOR
 * ============================================================================
 * 
 * Server-side scheduled job for automated pharmacy broadcast radius expansion.
 * Replaces client-side polling with server-side automation.
 * 
 * Expansion Schedule:
 * - 5km (initial) → 10km (after 2 min) → 20km (after 4 min) → expire (after 6 min)
 * 
 * Triggered by:
 * - AWS EventBridge Scheduler (every 1 minute)
 * - Direct API call to POST /pharmacy/broadcasts/process-expansion
 * 
 * Date: 2026-01-27
 * ============================================================================
 */

import { ScheduledEvent, Context, APIGatewayProxyResult } from 'aws-lambda';
import { query, update, insert, select } from '../database/rds-connection';
import { websocketService } from '../lib/services/websocket-service';
import { sendPharmacyBroadcast } from '../lib/services/push-notification-service';

// ============================================================================
// CONFIGURATION
// ============================================================================

const RADIUS_LEVELS = [5, 10, 20] as const;
const EXPANSION_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes between expansions
const MAX_BROADCAST_DURATION_MS = 6 * 60 * 1000; // 6 minutes total
const BATCH_SIZE = 50;

interface ExpansionResult {
  orderId: string;
  previousRadius: number;
  newRadius: number;
  newPharmaciesNotified: number;
  success: boolean;
  error?: string;
}

interface ProcessingResults {
  processedCount: number;
  expandedCount: number;
  expiredCount: number;
  failedCount: number;
  expansions: ExpansionResult[];
  timestamp: string;
}

// ============================================================================
// MAIN HANDLER - SCHEDULED EVENT
// ============================================================================

export async function handler(
  event: ScheduledEvent | { source: string },
  context: Context
): Promise<APIGatewayProxyResult> {
  console.log('📡 Pharmacy broadcast expansion processor triggered', {
    time: new Date().toISOString(),
    requestId: context?.awsRequestId,
    source: (event as any).source || 'api',
  });

  const results = await processAllPendingExpansions();

  console.log('✅ Pharmacy broadcast expansion processing complete', results);

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      success: true,
      ...results,
    }),
  };
}

// ============================================================================
// CORE PROCESSING LOGIC
// ============================================================================

/**
 * Process all pharmacy broadcasts that need radius expansion
 */
export async function processAllPendingExpansions(): Promise<ProcessingResults> {
  const results: ProcessingResults = {
    processedCount: 0,
    expandedCount: 0,
    expiredCount: 0,
    failedCount: 0,
    expansions: [],
    timestamp: new Date().toISOString(),
  };

  try {
    // Query orders that need expansion:
    // - status = 'broadcasting'
    // - current_radius < 20 (max radius)
    // - last_expanded_at + 2 minutes < NOW() (or broadcast_started_at + 2 min if never expanded)
    const pendingExpansions = await query(
      `SELECT 
        po.id,
        po.customer_id,
        po.customer_lat,
        po.customer_lng,
        po.current_broadcast_radius_km,
        po.broadcast_started_at,
        po.broadcast_expires_at,
        po.last_expanded_at,
        po.expansion_count,
        po.items,
        po.subtotal
      FROM pharmacy_orders po
      WHERE po.status = 'broadcasting'
        AND COALESCE(po.current_broadcast_radius_km, 5) < 20
        AND (
          -- If never expanded, check if 2 minutes passed since broadcast started
          (po.last_expanded_at IS NULL AND po.broadcast_started_at + INTERVAL '2 minutes' < NOW())
          OR
          -- If already expanded, check if 2 minutes passed since last expansion
          (po.last_expanded_at IS NOT NULL AND po.last_expanded_at + INTERVAL '2 minutes' < NOW())
        )
      ORDER BY po.broadcast_started_at ASC
      LIMIT $1`,
      [BATCH_SIZE]
    );

    const orders = (pendingExpansions as any).rows || [];
    console.log(`📋 Found ${orders.length} orders needing radius expansion`);

    for (const order of orders) {
      results.processedCount++;

      try {
        const expansionResult = await expandBroadcastRadius(order);
        
        if (expansionResult.success) {
          if (expansionResult.newRadius === -1) {
            // Order expired
            results.expiredCount++;
          } else {
            results.expandedCount++;
          }
        } else {
          results.failedCount++;
        }
        
        results.expansions.push(expansionResult);
        
      } catch (error: any) {
        console.error(`❌ Error expanding order ${order.id}:`, error);
        results.failedCount++;
        results.expansions.push({
          orderId: order.id,
          previousRadius: order.current_broadcast_radius_km || 5,
          newRadius: -1,
          newPharmaciesNotified: 0,
          success: false,
          error: error.message,
        });
      }
    }

    // Also check and expire broadcasts that have exceeded max duration
    const expiredResults = await expireStaleBroadcasts();
    results.expiredCount += expiredResults;

  } catch (error: any) {
    console.error('❌ Error in processAllPendingExpansions:', error);
  }

  return results;
}

/**
 * Expand broadcast radius for a single order
 */
async function expandBroadcastRadius(order: any): Promise<ExpansionResult> {
  const currentRadius = order.current_broadcast_radius_km || 5;
  const currentIndex = RADIUS_LEVELS.indexOf(currentRadius as 5 | 10 | 20);
  
  // Check if already at max radius
  if (currentIndex === -1 || currentIndex >= RADIUS_LEVELS.length - 1) {
    // Max radius reached or invalid - expire the broadcast
    await expireOrder(order.id, 'No pharmacy accepted within maximum 20km radius');
    
    return {
      orderId: order.id,
      previousRadius: currentRadius,
      newRadius: -1,
      newPharmaciesNotified: 0,
      success: true,
      error: 'Max radius reached - order expired',
    };
  }

  const nextRadius = RADIUS_LEVELS[currentIndex + 1];
  const expansionCount = (order.expansion_count || 0) + 1;

  console.log(`🔄 Expanding order ${order.id}: ${currentRadius}km → ${nextRadius}km (expansion #${expansionCount})`);

  // Broadcast to new pharmacies in the expanded radius band
  const newPharmaciesNotified = await broadcastToNewPharmacies(
    order.id,
    { latitude: order.customer_lat, longitude: order.customer_lng },
    currentRadius,
    nextRadius
  );

  // Update order with new radius
  const newExpiresAt = nextRadius === 20 
    ? new Date(Date.now() + EXPANSION_INTERVAL_MS) // Give 2 more minutes at max radius
    : new Date(Date.now() + EXPANSION_INTERVAL_MS);

  await update('pharmacy_orders', { id: order.id }, {
    current_broadcast_radius_km: nextRadius,
    last_expanded_at: new Date(),
    expansion_count: expansionCount,
    broadcast_expires_at: newExpiresAt,
    updated_at: new Date(),
  });

  // Also update pharmacy_broadcasts table if it exists
  try {
    await query(
      `UPDATE pharmacy_broadcasts 
       SET current_radius = $1, 
           last_expanded_at = NOW(),
           expansion_count = $2,
           next_expansion_at = $3
       WHERE order_id = $4`,
      [nextRadius, expansionCount, nextRadius < 20 ? newExpiresAt : null, order.id]
    );
  } catch (error) {
    // Table might not exist or have these columns - continue anyway
    console.warn('Could not update pharmacy_broadcasts table:', error);
  }

  // Send WebSocket update to customer about radius expansion
  try {
    await websocketService.sendToUser(
      order.customer_id,
      'customer',
      {
        type: 'broadcast_radius_expanded',
        data: {
          orderId: order.id,
          previousRadius: currentRadius,
          newRadius: nextRadius,
          newPharmaciesNotified,
          isMaxRadius: nextRadius === 20,
        },
        timestamp: new Date().toISOString(),
      }
    );
  } catch (wsError) {
    console.warn('WebSocket notification failed:', wsError);
  }

  console.log(`✅ Order ${order.id} expanded to ${nextRadius}km, ${newPharmaciesNotified} new pharmacies notified`);

  return {
    orderId: order.id,
    previousRadius: currentRadius,
    newRadius: nextRadius,
    newPharmaciesNotified,
    success: true,
  };
}

/**
 * Broadcast to pharmacies in the new radius band (between previous and new radius)
 */
async function broadcastToNewPharmacies(
  orderId: string,
  location: { latitude: number; longitude: number },
  previousRadius: number,
  newRadius: number
): Promise<number> {
  try {
    // Find pharmacies in the new radius band using Haversine formula
    const { rows: pharmacies } = await query(
      `SELECT 
        v.id,
        v.business_name,
        v.phone,
        v.user_id,
        v.latitude,
        v.longitude,
        v.fcm_token,
        (
          6371 * acos(
            cos(radians($1)) * cos(radians(v.latitude)) *
            cos(radians(v.longitude) - radians($2)) +
            sin(radians($1)) * sin(radians(v.latitude))
          )
        ) AS distance_km
      FROM vendors v
      WHERE v.role_id IN (
        SELECT id FROM roles WHERE name IN ('pharmacy', 'pet_pharmacy', 'medical_store')
      )
      AND v.is_active = true
      AND v.is_verified = true
      AND v.latitude IS NOT NULL
      AND v.longitude IS NOT NULL
      AND (
        6371 * acos(
          cos(radians($1)) * cos(radians(v.latitude)) *
          cos(radians(v.longitude) - radians($2)) +
          sin(radians($1)) * sin(radians(v.latitude))
        )
      ) > $3
      AND (
        6371 * acos(
          cos(radians($1)) * cos(radians(v.latitude)) *
          cos(radians(v.longitude) - radians($2)) +
          sin(radians($1)) * sin(radians(v.latitude))
        )
      ) <= $4
      ORDER BY distance_km ASC
      LIMIT 50`,
      [location.latitude, location.longitude, previousRadius, newRadius]
    ) as { rows: any[] };

    if (pharmacies.length === 0) {
      console.log(`No new pharmacies found in ${previousRadius}km-${newRadius}km band`);
      return 0;
    }

    console.log(`📍 Found ${pharmacies.length} new pharmacies in ${previousRadius}km-${newRadius}km band`);

    // Create notifications for new pharmacies
    for (const pharmacy of pharmacies) {
      // Check if already notified
      const { rows: existing } = await query(
        `SELECT id FROM pharmacy_order_notifications 
         WHERE order_id = $1 AND pharmacy_id = $2`,
        [orderId, pharmacy.id]
      ) as { rows: any[] };

      if (existing.length > 0) continue;

      // Create notification record
      await insert('pharmacy_order_notifications', {
        order_id: orderId,
        pharmacy_id: pharmacy.id,
        distance_km: pharmacy.distance_km,
        radius_level: newRadius,
        status: 'pending',
        notified_at: new Date(),
      });

      // Create in-app notification
      await insert('notifications', {
        user_id: pharmacy.user_id || pharmacy.id,
        user_type: 'vendor',
        type: 'pharmacy_order',
        title: '🔔 Medicine Order Available!',
        message: `Prescription order ${pharmacy.distance_km.toFixed(1)}km away. Tap to view.`,
        data: JSON.stringify({
          order_id: orderId,
          type: 'pharmacy_order',
          distance: pharmacy.distance_km,
          radius: newRadius,
          priority: 'high',
        }),
        is_read: false,
        requires_action: true,
        action_url: `/orders/${orderId}`,
        created_at: new Date(),
      });

      // Send push notification
      try {
        await sendPharmacyBroadcast(
          [pharmacy.id],
          orderId,
          'Customer',
          pharmacies.length
        );
      } catch (pushError) {
        console.warn(`Push notification failed for pharmacy ${pharmacy.id}:`, pushError);
      }

      // Send WebSocket notification
      try {
        await websocketService.sendToUser(
          pharmacy.id,
          'vendor',
          {
            type: 'pharmacy_broadcast',
            data: {
              orderId,
              distance: pharmacy.distance_km,
              radius: newRadius,
            },
            timestamp: new Date().toISOString(),
          }
        );
      } catch (wsError) {
        console.warn(`WebSocket notification failed for pharmacy ${pharmacy.id}:`, wsError);
      }
    }

    // Also create records in pharmacy_broadcasts table
    for (const pharmacy of pharmacies) {
      try {
        await insert('pharmacy_broadcasts', {
          order_id: orderId,
          pharmacy_id: pharmacy.id,
          radius_km: newRadius,
          distance_from_customer: Math.round(pharmacy.distance_km * 100) / 100,
          status: 'pending',
          expires_at: new Date(Date.now() + EXPANSION_INTERVAL_MS),
        });
      } catch (error) {
        // Might already exist or table structure different
        console.warn(`Could not insert pharmacy_broadcasts for ${pharmacy.id}:`, error);
      }
    }

    return pharmacies.length;
  } catch (error) {
    console.error('Error broadcasting to new pharmacies:', error);
    return 0;
  }
}

/**
 * Expire an order that has reached max radius without acceptance
 */
async function expireOrder(orderId: string, reason: string): Promise<void> {
  console.log(`⏰ Expiring order ${orderId}: ${reason}`);

  await update('pharmacy_orders', { id: orderId }, {
    status: 'expired',
    broadcast_status: 'expired',
    cancellation_reason: reason,
    cancelled_at: new Date(),
    updated_at: new Date(),
  });

  // Get customer to notify
  const orders = await select('pharmacy_orders', { id: orderId });
  if (orders.length > 0) {
    const order = orders[0];
    
    // Create notification for customer
    await insert('notifications', {
      user_id: order.customer_id,
      user_type: 'customer',
      type: 'order_expired',
      title: '⏰ Order Expired',
      message: 'Unfortunately, no pharmacy was available to accept your order. Please try again.',
      data: JSON.stringify({
        order_id: orderId,
        reason,
      }),
      is_read: false,
      created_at: new Date(),
    });

    // Send WebSocket notification
    try {
      await websocketService.sendToUser(
        order.customer_id,
        'customer',
        {
          type: 'order_expired',
          data: {
            orderId,
            reason,
          },
          timestamp: new Date().toISOString(),
        }
      );
    } catch (wsError) {
      console.warn('WebSocket notification failed:', wsError);
    }
  }

  // Mark all pending broadcasts as expired
  await query(
    `UPDATE pharmacy_broadcasts 
     SET status = 'expired' 
     WHERE order_id = $1 AND status = 'pending'`,
    [orderId]
  );

  await query(
    `UPDATE pharmacy_order_notifications 
     SET status = 'expired' 
     WHERE order_id = $1 AND status = 'pending'`,
    [orderId]
  );
}

/**
 * Expire broadcasts that have exceeded max duration
 */
async function expireStaleBroadcasts(): Promise<number> {
  try {
    const staleOrders = await query(
      `SELECT id FROM pharmacy_orders 
       WHERE status = 'broadcasting'
         AND broadcast_expires_at < NOW()
         AND current_broadcast_radius_km >= 20`,
      []
    );

    const orders = (staleOrders as any).rows || [];
    
    for (const order of orders) {
      await expireOrder(order.id, 'Broadcast duration exceeded without pharmacy acceptance');
    }

    return orders.length;
  } catch (error) {
    console.error('Error expiring stale broadcasts:', error);
    return 0;
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get expansion status for a specific order
 */
export async function getExpansionStatus(orderId: string): Promise<{
  orderId: string;
  status: string;
  currentRadius: number;
  expansionCount: number;
  lastExpandedAt: string | null;
  nextExpansionAt: string | null;
  isMaxRadius: boolean;
}> {
  const orders = await select('pharmacy_orders', { id: orderId });
  
  if (orders.length === 0) {
    throw new Error('Order not found');
  }

  const order = orders[0];
  const currentRadius = order.current_broadcast_radius_km || 5;
  const lastExpandedAt = order.last_expanded_at;
  
  let nextExpansionAt: string | null = null;
  if (order.status === 'broadcasting' && currentRadius < 20) {
    const baseTime = lastExpandedAt || order.broadcast_started_at;
    if (baseTime) {
      nextExpansionAt = new Date(new Date(baseTime).getTime() + EXPANSION_INTERVAL_MS).toISOString();
    }
  }

  return {
    orderId: order.id,
    status: order.status,
    currentRadius,
    expansionCount: order.expansion_count || 0,
    lastExpandedAt: lastExpandedAt ? new Date(lastExpandedAt).toISOString() : null,
    nextExpansionAt,
    isMaxRadius: currentRadius >= 20,
  };
}
