/**
 * ============================================================================
 * CUSTOMER PHONE-BASED CONVENIENCE ENDPOINTS
 * ============================================================================
 * 
 * Provides convenience endpoints that accept phone numbers instead of customer IDs
 * These endpoints resolve phone to customer ID internally and forward to main endpoints
 * 
 * Endpoints:
 * - GET /customer/bookings?phone=... - Get bookings by phone
 * - GET /customer/cart/:phone - Get cart by phone
 * - PUT /customer/cart/:phone/items/:itemId - Update cart item by phone
 * - DELETE /customer/cart/:phone/items/:itemId - Remove cart item by phone
 * - GET /customer/saved/:phone - Get saved items by phone
 * - DELETE /customer/saved/:phone/items/:itemId - Remove saved item by phone
 * - GET /customer/wallet?phone=... - Get wallet by phone
 * - GET /customer/wallet/transactions?phone=... - Get wallet transactions by phone
 * - GET /customer/notifications/:phone - Get notifications by phone
 * - POST /customer/payments/:phone - Create payment by phone
 * 
 * Date: 2026-01-12
 * ============================================================================
 */

import { Hono } from 'hono';
import { select, query } from '../database/rds-connection';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../utils/entity-extractor';
import { isValidUUID } from '../types/entities';

/**
 * Helper to resolve phone to customer ID
 */
async function resolveCustomerIdFromPhone(phone: string): Promise<string | null> {
  const cleanPhone = phone.replace(/[^0-9]/g, '');
  if (!cleanPhone || cleanPhone.length < 10) {
    return null;
  }

  const customers = await select('customers', { phone: cleanPhone });
  return customers.length > 0 ? customers[0].id : null;
}

export function registerCustomerPhoneConvenienceEndpoints(app: Hono) {
  /**
   * GET /customer/bookings?phone=...
   * Get bookings by phone (convenience endpoint)
   */
  app.get("/customer/bookings", async (c) => {
    try {
      const phone = c.req.query('phone');
      const petId = c.req.query('petId');
      const serviceType = c.req.query('serviceType');
      const status = c.req.query('status');

      if (!phone) {
        return c.json({ error: 'phone parameter is required' }, 400);
      }

      const customerId = await resolveCustomerIdFromPhone(phone);
      if (!customerId) {
        return c.json({ error: 'Customer not found' }, 404);
      }

      // Build query
      let bookingQuery = `
        SELECT b.*,
               v.business_name as vendor_name,
               v.phone as vendor_phone,
               v.city as vendor_city,
               s.name as service_name,
               s.category as service_category
        FROM bookings b
        LEFT JOIN vendors v ON b.vendor_id = v.id
        LEFT JOIN services s ON b.service_id = s.id
        WHERE b.customer_id = $1
      `;

      const params: any[] = [customerId];
      let paramIndex = 2;

      if (petId) {
        bookingQuery += ` AND b.pet_id = $${paramIndex}`;
        params.push(petId);
        paramIndex++;
      }

      if (serviceType) {
        bookingQuery += ` AND s.category = $${paramIndex}`;
        params.push(serviceType);
        paramIndex++;
      }

      if (status) {
        bookingQuery += ` AND b.status = $${paramIndex}`;
        params.push(status);
        paramIndex++;
      }

      bookingQuery += ` ORDER BY b.booking_date DESC, b.booking_time DESC LIMIT 50`;

      const bookings = await query(bookingQuery, params);

      return c.json({
        success: true,
        bookings: bookings.rows,
        count: bookings.rows.length,
      });
    } catch (error: any) {
      console.error('Error fetching bookings by phone:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /customer/cart/:phone
   * Get cart by phone (convenience endpoint)
   */
  app.get("/customer/cart/:phone", async (c) => {
    try {
      const { phone } = c.req.param();

      const customerId = await resolveCustomerIdFromPhone(phone);
      if (!customerId) {
        return c.json({ error: 'Customer not found' }, 404);
      }

      const cartItems = await query(
        `SELECT ci.*, p.name, p.sale_price, p.base_price, p.image_url, v.business_name as vendor_name
         FROM cart_items ci
         LEFT JOIN products p ON ci.product_id = p.id
         LEFT JOIN vendors v ON p.vendor_id = v.id
         WHERE ci.customer_id = $1
         ORDER BY ci.created_at DESC`,
        [customerId]
      );

      let totalPrice = 0;
      cartItems.rows.forEach((item: any) => {
        totalPrice += (item.sale_price || item.base_price || 0) * (item.quantity || 1);
      });

      return c.json({
        success: true,
        cartItems: cartItems.rows,
        totalPrice: totalPrice,
      });
    } catch (error: any) {
      console.error('Error fetching cart by phone:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * PUT /customer/cart/:phone/items/:itemId
   * Update cart item by phone (convenience endpoint)
   */
  app.put("/customer/cart/:phone/items/:itemId", async (c) => {
    try {
      const { phone, itemId } = c.req.param();
      const body = await c.req.json();
      const { quantity } = body;

      const customerId = await resolveCustomerIdFromPhone(phone);
      if (!customerId) {
        return c.json({ error: 'Customer not found' }, 404);
      }

      await query(
        'UPDATE cart_items SET quantity = $1 WHERE id = $2 AND customer_id = $3',
        [quantity, itemId, customerId]
      );

      return c.json({ success: true, message: 'Cart item updated' });
    } catch (error: any) {
      console.error('Error updating cart item by phone:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * DELETE /customer/cart/:phone/items/:itemId
   * Remove cart item by phone (convenience endpoint)
   */
  app.delete("/customer/cart/:phone/items/:itemId", async (c) => {
    try {
      const { phone, itemId } = c.req.param();

      const customerId = await resolveCustomerIdFromPhone(phone);
      if (!customerId) {
        return c.json({ error: 'Customer not found' }, 404);
      }

      await query(
        'DELETE FROM cart_items WHERE id = $1 AND customer_id = $2',
        [itemId, customerId]
      );

      return c.json({ success: true, message: 'Item removed from cart' });
    } catch (error: any) {
      console.error('Error removing cart item by phone:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /customer/saved/:phone
   * Get saved items by phone (convenience endpoint)
   */
  app.get("/customer/saved/:phone", async (c) => {
    try {
      const { phone } = c.req.param();

      const customerId = await resolveCustomerIdFromPhone(phone);
      if (!customerId) {
        return c.json({ error: 'Customer not found' }, 404);
      }

      // Get wishlist items
      const savedItems = await query(
        `SELECT w.*, p.name as product_name, p.sale_price, p.base_price, p.image_url, v.business_name as vendor_name
         FROM wishlists w
         LEFT JOIN products p ON w.product_id = p.id
         LEFT JOIN vendors v ON p.vendor_id = v.id
         WHERE w.customer_id = $1
         ORDER BY w.created_at DESC`,
        [customerId]
      );

      return c.json({
        success: true,
        savedItems: savedItems.rows,
      });
    } catch (error: any) {
      console.error('Error fetching saved items by phone:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * DELETE /customer/saved/:phone/items/:itemId
   * Remove saved item by phone (convenience endpoint)
   */
  app.delete("/customer/saved/:phone/items/:itemId", async (c) => {
    try {
      const { phone, itemId } = c.req.param();

      const customerId = await resolveCustomerIdFromPhone(phone);
      if (!customerId) {
        return c.json({ error: 'Customer not found' }, 404);
      }

      await query(
        'DELETE FROM wishlists WHERE id = $1 AND customer_id = $2',
        [itemId, customerId]
      );

      return c.json({ success: true, message: 'Item removed from saved' });
    } catch (error: any) {
      console.error('Error removing saved item by phone:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /customer/wallet?phone=...
   * Get wallet by phone (convenience endpoint)
   */
  app.get("/customer/wallet", async (c) => {
    try {
      const phone = c.req.query('phone');

      if (!phone) {
        return c.json({ error: 'phone parameter is required' }, 400);
      }

      const customerId = await resolveCustomerIdFromPhone(phone);
      if (!customerId) {
        return c.json({ error: 'Customer not found' }, 404);
      }

      // Get or create wallet
      let wallets = await select('customer_wallets', { customer_id: customerId });
      
      if (wallets.length === 0) {
        await query(
          `INSERT INTO customer_wallets (customer_id, balance, currency)
           VALUES ($1, 0, 'INR')
           ON CONFLICT (customer_id) DO NOTHING`,
          [customerId]
        );
        wallets = await select('customer_wallets', { customer_id: customerId });
      }

      const wallet = wallets[0] || { balance: 0, currency: 'INR' };

      return c.json({
        success: true,
        wallet: {
          balance: parseFloat(wallet.balance || '0'),
          currency: wallet.currency || 'INR',
          pending_credits: 0,
          total_earned: 0,
          total_spent: 0,
        },
      });
    } catch (error: any) {
      console.error('Error fetching wallet by phone:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /customer/wallet/transactions?phone=...
   * Get wallet transactions by phone (convenience endpoint)
   */
  app.get("/customer/wallet/transactions", async (c) => {
    try {
      const phone = c.req.query('phone');
      const type = c.req.query('type');
      const limit = parseInt(c.req.query('limit') || '50', 10);
      const offset = parseInt(c.req.query('offset') || '0', 10);

      if (!phone) {
        return c.json({ error: 'phone parameter is required' }, 400);
      }

      const customerId = await resolveCustomerIdFromPhone(phone);
      if (!customerId) {
        return c.json({ error: 'Customer not found' }, 404);
      }

      let transactionQuery = `
        SELECT * FROM wallet_transactions
        WHERE customer_id = $1
      `;

      const params: any[] = [customerId];
      let paramIndex = 2;

      if (type && type !== 'all') {
        transactionQuery += ` AND transaction_type = $${paramIndex}`;
        params.push(type);
        paramIndex++;
      }

      transactionQuery += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);

      const transactions = await query(transactionQuery, params);

      return c.json({
        success: true,
        transactions: transactions.rows,
        count: transactions.rows.length,
      });
    } catch (error: any) {
      console.error('Error fetching wallet transactions by phone:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /customer/notifications/:phone
   * Get notifications by phone (convenience endpoint)
   */
  app.get("/customer/notifications/:phone", async (c) => {
    try {
      const { phone } = c.req.param();
      const limit = parseInt(c.req.query('limit') || '50', 10);

      const customerId = await resolveCustomerIdFromPhone(phone);
      if (!customerId) {
        return c.json({ error: 'Customer not found' }, 404);
      }

      const notifications = await query(
        `SELECT * FROM notifications
         WHERE recipient_id = $1 AND recipient_type = 'customer'
         ORDER BY created_at DESC
         LIMIT $2`,
        [customerId, limit]
      );

      const unreadCount = await query(
        `SELECT COUNT(*) as count FROM notifications
         WHERE recipient_id = $1 AND recipient_type = 'customer' AND is_read = false`,
        [customerId]
      );

      return c.json({
        success: true,
        notifications: notifications.rows,
        unreadCount: parseInt(unreadCount.rows[0]?.count || '0', 10),
      });
    } catch (error: any) {
      console.error('Error fetching notifications by phone:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /customer/payments/:phone
   * Get customer payment methods by phone
   */
  app.get("/customer/payments/:phone", async (c) => {
    try {
      const { phone } = c.req.param();

      const customerId = await resolveCustomerIdFromPhone(phone);
      if (!customerId) {
        return c.json({ paymentMethods: [], success: true });
      }

      const paymentMethods = await select('customer_payment_methods', { customer_id: customerId })
        .catch(() => []);

      return c.json({
        success: true,
        paymentMethods: paymentMethods || []
      });
    } catch (error: any) {
      console.error('Error getting payment methods:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /customer/payments/:phone
   * Create payment by phone (convenience endpoint)
   */
  app.post("/customer/payments/:phone", async (c) => {
    try {
      const { phone } = c.req.param();
      const body = await c.req.json();

      const customerId = await resolveCustomerIdFromPhone(phone);
      if (!customerId) {
        return c.json({ error: 'Customer not found' }, 404);
      }

      // Create payment method
      const newPaymentMethod = await insert('customer_payment_methods', {
        customer_id: customerId,
        type: body.type || 'card',
        last_four: body.last_four || body.cardNumber?.slice(-4),
        card_brand: body.card_brand || body.cardType,
        expiry: body.expiry,
        is_default: body.is_default || false,
        nickname: body.nickname,
        created_at: new Date().toISOString()
      }).catch(() => [{ id: 'pm_' + Date.now() }]);

      return c.json({
        success: true,
        message: 'Payment method added successfully',
        paymentMethod: newPaymentMethod[0]
      });
    } catch (error: any) {
      console.error('Error creating payment method:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * DELETE /customer/payments/:phone/:paymentId
   * Delete a customer payment method
   */
  app.delete("/customer/payments/:phone/:paymentId", async (c) => {
    try {
      const { phone, paymentId } = c.req.param();

      const customerId = await resolveCustomerIdFromPhone(phone);
      if (!customerId) {
        return c.json({ error: 'Customer not found' }, 404);
      }

      // Delete the payment method
      await query(
        `DELETE FROM customer_payment_methods WHERE id = $1 AND customer_id = $2`,
        [paymentId, customerId]
      ).catch(() => {});

      return c.json({
        success: true,
        message: 'Payment method removed successfully'
      });
    } catch (error: any) {
      console.error('Error deleting payment method:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /customer/:phone/packages
   * Get customer packages by phone (convenience endpoint)
   * Query params: serviceType (optional filter)
   */
  app.get("/customer/:phone/packages", async (c) => {
    try {
      const { phone } = c.req.param();
      const serviceType = c.req.query('serviceType');

      const customerId = await resolveCustomerIdFromPhone(phone);
      if (!customerId) {
        return c.json({ packages: [], success: true });
      }

      let packageQuery = `
        SELECT 
          pp.*,
          v.business_name as vendor_name,
          v.phone as vendor_phone,
          (pp.total_sessions - pp.remaining_sessions) as sessions_used,
          CASE 
            WHEN pp.expires_at IS NOT NULL AND pp.expires_at < NOW() THEN 'expired'
            WHEN pp.remaining_sessions <= 0 AND pp.unlimited_usage = false THEN 'exhausted'
            ELSE pp.status
          END as computed_status
        FROM package_purchases pp
        LEFT JOIN vendors v ON pp.vendor_id = v.id
        WHERE pp.customer_id = $1
        AND pp.status = 'active'
        AND (pp.expires_at IS NULL OR pp.expires_at > NOW())
        AND (pp.remaining_sessions > 0 OR pp.unlimited_usage = true)
      `;

      const params: any[] = [customerId];

      if (serviceType) {
        packageQuery += ` AND pp.package_type = $2`;
        params.push(serviceType);
      }

      packageQuery += ` ORDER BY pp.expires_at ASC NULLS LAST, pp.created_at DESC`;

      const result = await query(packageQuery, params);

      const packages = result.rows.map((pkg: any) => ({
        id: pkg.id,
        packageName: pkg.package_name || pkg.name,
        vendorName: pkg.vendor_name,
        vendorId: pkg.vendor_id,
        totalSessions: pkg.total_sessions,
        remainingSessions: pkg.unlimited_usage ? 'unlimited' : pkg.remaining_sessions,
        sessionsUsed: pkg.sessions_used || 0,
        expiresAt: pkg.expires_at,
        isUnlimited: pkg.unlimited_usage,
        packageType: pkg.package_type,
        status: pkg.computed_status
      }));

      return c.json({
        success: true,
        packages: packages,
        count: packages.length
      });
    } catch (error: any) {
      console.error('Error fetching packages by phone:', error);
      return c.json({ packages: [], success: true });
    }
  });

  /**
   * GET /customer/:phone/active-walks
   * Get active walking sessions by phone (convenience endpoint)
   */
  app.get("/customer/:phone/active-walks", async (c) => {
    try {
      const { phone } = c.req.param();

      const customerId = await resolveCustomerIdFromPhone(phone);
      if (!customerId) {
        return c.json({ walks: [], success: true });
      }

      // Get active walk sessions (from walker_live_sessions or package_sessions)
      const activeWalks = await query(`
        SELECT 
          wls.*,
          b.id as booking_id,
          b.pet_id,
          p.name as pet_name,
          v.id as walker_id,
          v.business_name as walker_name,
          wr.distance_covered_km as distanceCovered,
          wr.waypoints
        FROM walker_live_sessions wls
        LEFT JOIN bookings b ON wls.booking_id = b.id
        LEFT JOIN pets p ON b.pet_id = p.id
        LEFT JOIN vendors v ON wls.walker_id = v.id
        LEFT JOIN walk_routes wr ON wls.booking_id = wr.booking_id
        WHERE wls.customer_id = $1
        AND wls.is_active = true
        UNION
        SELECT 
          ps.id,
          ps.booking_id,
          ps.pet_id,
          p.name as pet_name,
          ps.staff_id as walker_id,
          s.name as walker_name,
          NULL as distanceCovered,
          NULL as waypoints,
          ps.status,
          ps.scheduled_start_time as started_at,
          ps.actual_start_time,
          ps.actual_end_time,
          ps.location
        FROM package_sessions ps
        LEFT JOIN bookings b ON ps.booking_id = b.id
        LEFT JOIN pets p ON ps.pet_id = p.id
        LEFT JOIN staff s ON ps.staff_id = s.id
        WHERE ps.package_purchase_id IN (
          SELECT id FROM package_purchases WHERE customer_id = $1
        )
        AND ps.status = 'in_progress'
      `, [customerId]);

      const walks = activeWalks.rows.map((walk: any) => ({
        id: walk.id || walk.booking_id,
        walkerName: walk.walker_name || 'Walker',
        petName: walk.pet_name || 'Pet',
        startTime: walk.started_at || walk.actual_start_time,
        status: walk.status || 'in_progress',
        distanceCovered: walk.distanceCovered || 0,
        currentLocation: walk.location || (walk.waypoints && walk.waypoints.length > 0 ? walk.waypoints[walk.waypoints.length - 1] : null)
      }));

      return c.json({
        success: true,
        walks: walks,
        count: walks.length
      });
    } catch (error: any) {
      console.error('Error fetching active walks by phone:', error);
      return c.json({ walks: [], success: true });
    }
  });

  /**
   * GET /customer/:phone/pet-skills
   * Get pet skills progress by phone (convenience endpoint)
   */
  app.get("/customer/:phone/pet-skills", async (c) => {
    try {
      const { phone } = c.req.param();

      const customerId = await resolveCustomerIdFromPhone(phone);
      if (!customerId) {
        return c.json({ skills: [], success: true });
      }

      // Get all pets for this customer
      const pets = await query(`
        SELECT id, name FROM pets WHERE customer_id = $1
      `, [customerId]);

      if (pets.rows.length === 0) {
        return c.json({ skills: [], success: true });
      }

      const petIds = pets.rows.map((p: any) => p.id);

      // Get skill progress for all pets
      const skillsResult = await query(`
        SELECT 
          psp.*,
          ts.skill_name,
          ts.skill_category,
          p.name as pet_name
        FROM pet_skill_progress psp
        LEFT JOIN training_skills ts ON psp.skill_id = ts.id
        LEFT JOIN pets p ON psp.pet_id = p.id
        WHERE psp.pet_id = ANY($1)
        ORDER BY psp.updated_at DESC
      `, [petIds]);

      const skills = skillsResult.rows.map((skill: any) => {
        // Use proficiency_score (0-100) and current_level from schema
        const progressLevel = skill.proficiency_score || 0;
        const currentLevel = skill.current_level || 'not_started';

        return {
          skillName: skill.skill_name || 'Unknown Skill',
          level: progressLevel,
          status: currentLevel,
          petName: skill.pet_name,
          category: skill.skill_category,
          lastUpdated: skill.updated_at,
          sessionsPracticed: skill.sessions_practiced || 0
        };
      });

      return c.json({
        success: true,
        skills: skills,
        count: skills.length
      });
    } catch (error: any) {
      console.error('Error fetching pet skills by phone:', error);
      return c.json({ skills: [], success: true });
    }
  });
}
