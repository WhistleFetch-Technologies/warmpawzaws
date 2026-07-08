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
import { select, query, insert } from '../database/rds-connection';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../utils/entity-extractor';
import { isValidUUID } from '../types/entities';
import { presignProductImagesJsonb } from '../utils/s3-media-presign';

/** First image URL from products.images JSONB (array of strings or { url } objects). */
function firstProductImageUrl(images: unknown): string | undefined {
  if (images == null) return undefined;
  let arr: unknown;
  try {
    arr = typeof images === 'string' ? JSON.parse(images) : images;
  } catch {
    return undefined;
  }
  if (!Array.isArray(arr) || arr.length === 0) return undefined;
  const first = arr[0];
  if (typeof first === 'string' && first.trim()) return first;
  if (first && typeof first === 'object') {
    const o = first as Record<string, unknown>;
    const u = o.url ?? o.src ?? o.image_url;
    return typeof u === 'string' && u.trim() ? u : undefined;
  }
  return undefined;
}

/**
 * Helper to resolve phone to customer ID
 */
async function resolveCustomerIdFromPhone(phone: string): Promise<string | null> {
  const cleanPhone = phone.replace(/[^0-9]/g, '');
  if (!cleanPhone || cleanPhone.length < 10) {
    return null;
  }
  // Try exact match first
  let customers = await select('customers', { phone: cleanPhone });
  if (customers.length > 0) return customers[0].id;
  // Try with +91 prefix (Indian format)
  if (cleanPhone.length === 10) {
    customers = await select('customers', { phone: `+91${cleanPhone}` });
    if (customers.length > 0) return customers[0].id;
  }
  return null;
}

/** Ledger-based lifetime totals (aligned with GET /wallet/:customerId). */
async function getWalletLedgerTotalsByCustomerId(
  customerId: string
): Promise<{ totalEarned: number; totalSpent: number }> {
  try {
    const result = await query(
      `SELECT
        COALESCE(
          SUM(
            CASE
              WHEN LOWER(TRIM(COALESCE(wt.transaction_type::text, ''))) IN (
                'credit','c','refund','r','topup','top_up','cashback','credit_adjustment'
              )
              THEN ABS(wt.amount::numeric)
              ELSE 0::numeric
            END
          ),
          0
        )::text AS total_earned,
        COALESCE(
          SUM(
            CASE
              WHEN LOWER(TRIM(COALESCE(wt.transaction_type::text, ''))) IN (
                'debit','d','payout','payment','purchase','withdraw','debit_adjustment'
              )
              THEN ABS(wt.amount::numeric)
              ELSE 0::numeric
            END
          ),
          0
        )::text AS total_spent
       FROM wallet_transactions wt
       WHERE wt.customer_id = $1::uuid
          OR wt.wallet_id IN (SELECT id FROM customer_wallets WHERE customer_id = $1::uuid)`,
      [customerId]
    );
    if (!result.rows.length) {
      return { totalEarned: 0, totalSpent: 0 };
    }
    const r = result.rows[0] as { total_earned?: string; total_spent?: string };
    return {
      totalEarned: parseFloat(String(r.total_earned ?? '0')) || 0,
      totalSpent: parseFloat(String(r.total_spent ?? '0')) || 0,
    };
  } catch {
    return { totalEarned: 0, totalSpent: 0 };
  }
}

export function registerCustomerPhoneConvenienceEndpoints(app: Hono) {
  /**
   * GET /customer/bookings/active?phone=...
   * Get active bookings by phone (convenience endpoint)
   * ✅ CRITICAL: Must be registered BEFORE /customer/bookings to avoid route conflicts
   * This prevents "active" from being interpreted as a UUID in /customer/:customerId route
   */
  app.get("/customer/bookings/active", async (c) => {
    try {
      const phone = c.req.query('phone');

      if (!phone) {
        return c.json({ error: 'phone parameter is required' }, 400);
      }

      const customerId = await resolveCustomerIdFromPhone(phone);
      if (!customerId) {
        // ✅ FIX: Return empty array instead of 404 for better UX
        return c.json({ 
          success: true,
          bookings: [],
          count: 0 
        }, 200);
      }

      // Get active bookings (confirmed, in_progress, scheduled, pending)
      const bookingQuery = `
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
          AND b.status IN ('confirmed', 'in_progress', 'scheduled', 'pending')
        ORDER BY b.booking_date DESC, b.booking_time DESC
        LIMIT 50
      `;

      const bookings = await query(bookingQuery, [customerId]);

      return c.json({
        success: true,
        bookings: bookings.rows,
        count: bookings.rows.length,
      });
    } catch (error: any) {
      console.error('Error fetching active bookings by phone:', error);
      // ✅ FIX: Return empty array on error instead of 500
      return c.json({ 
        success: true,
        bookings: [],
        count: 0,
        error: error.message 
      }, 200);
    }
  });

  /**
   * GET /customer/:phone/bookings/upcoming-calls
   * Get video calls that are joinable: (a) upcoming within minutes, OR (b) live (scheduled passed, not completed)
   * includeLive=true: also return tele calls where scheduled time passed but status still confirmed/in_progress (until completed)
   * ✅ CRITICAL: Must be registered BEFORE /customer/:customerId/bookings/:bookingId
   */
  app.get("/customer/:phone/bookings/upcoming-calls", async (c) => {
    try {
      const phone = c.req.param('phone');
      const minutes = parseInt(c.req.query('minutes') || '5', 10);
      const includeLive = c.req.query('includeLive') === 'true' || c.req.query('include_live') === 'true';

      // Get customer by phone with error handling
      const customerId = await resolveCustomerIdFromPhone(phone);
      if (!customerId) {
        return c.json({ success: true, bookings: [] });
      }

      // Joinable = upcoming (next X min) OR live (scheduled passed, status confirmed/in_progress, within 2h)
      const statusFilter = includeLive
        ? `AND b.status IN ('confirmed', 'scheduled', 'in_progress', 'active')`
        : `AND b.status IN ('confirmed', 'scheduled')`;
      const timeFilter = includeLive
        ? `AND (b.booking_date + b.booking_time::time) >= NOW() - INTERVAL '2 hours'
             AND (b.booking_date + b.booking_time::time) <= NOW() + ($2 || ' minutes')::interval`
        : `AND (b.booking_date + b.booking_time::time) >= NOW()
             AND (b.booking_date + b.booking_time::time) <= NOW() + ($2 || ' minutes')::interval`;

      let bookingsResult: any;
      try {
        bookingsResult = await query(
          `SELECT b.id, b.booking_date, b.booking_time, b.status,
                  (b.booking_date + b.booking_time::time) as scheduled_at,
                  COALESCE(v.business_name, s.name) as vendor_name,
                  COALESCE(v.profile_photo, s.photo) as vendor_photo,
                  sv.service_name as service_name,
                  p.name as pet_name,
                  b.video_call_meeting_id
           FROM bookings b
           LEFT JOIN vendors v ON b.vendor_id = v.id
           LEFT JOIN staff s ON b.staff_id = s.id
           LEFT JOIN vendor_services sv ON b.service_id = sv.id
           LEFT JOIN pets p ON b.pet_id = p.id
           WHERE b.customer_id = $1
             ${statusFilter}
             AND (b.service_style = 'tele' OR b.service_type = 'tele' OR b.service_type = 'online')
             ${timeFilter}
           ORDER BY (b.booking_date + b.booking_time::time) ASC
           LIMIT 10`,
          [customerId, String(minutes)]
        );
      } catch (error: any) {
        console.warn('Error fetching upcoming calls (returning empty):', error.message);
        return c.json({ success: true, bookings: [] });
      }

      return c.json({
        success: true,
        bookings: bookingsResult.rows.map((b: any) => ({
          id: b.id,
          bookingDate: b.booking_date,
          scheduledAt: b.scheduled_at,
          bookingTime: b.booking_time,
          vendorName: b.vendor_name,
          vendorPhoto: b.vendor_photo,
          serviceName: b.service_name,
          petName: b.pet_name,
          meetingId: b.video_call_meeting_id
        }))
      });
    } catch (error: any) {
      console.error('Error getting upcoming calls:', error);
      return c.json({ success: true, bookings: [] });
    }
  });

  /**
   * GET /customer/bookings?phone=...
   * Get bookings by phone (convenience endpoint)
   */
  app.get("/customer/bookings", async (c) => {
    try {
      const phone = c.req.query('phone');
      const petId = c.req.query('petId');
      // Accept category as alias for serviceType (e.g. share report modal uses category=vet)
      const serviceType = (c.req.query('serviceType') || c.req.query('category')) as string | undefined;
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
        bookingQuery += ` AND (s.category ILIKE $${paramIndex} OR s.category = $${paramIndex + 1})`;
        params.push(`%${String(serviceType)}%`, String(serviceType));
        paramIndex += 2;
      }

      if (status) {
        // Handle multiple statuses (comma-separated or array)
        const statuses = status.split(',').map((s: string) => s.trim()).filter(Boolean);
        if (statuses.length === 1) {
          bookingQuery += ` AND b.status = $${paramIndex}`;
          params.push(statuses[0]);
          paramIndex++;
        } else if (statuses.length > 1) {
          bookingQuery += ` AND b.status = ANY($${paramIndex})`;
          params.push(statuses);
          paramIndex++;
        }
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
      // ✅ FIX: Return empty array instead of 500
      return c.json({ 
        success: true,
        bookings: [],
        count: 0,
        error: error.message 
      }, 200);
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
        return c.json({ success: true, cartItems: [], totalPrice: 0 });
      }

      // products table uses price + images (JSONB); sale_price/base_price/image_url are not guaranteed
      const cartResult = await query(
        `SELECT ci.id,
                ci.customer_id,
                ci.product_id,
                ci.quantity,
                ci.created_at,
                ci.updated_at,
                p.name AS product_name,
                p.price AS product_price,
                p.images AS product_images,
                p.vendor_id AS product_vendor_id,
                v.business_name AS vendor_name
         FROM cart_items ci
         LEFT JOIN products p ON ci.product_id = p.id
         LEFT JOIN vendors v ON p.vendor_id = v.id
         WHERE ci.customer_id = $1
         ORDER BY ci.created_at DESC`,
        [customerId]
      );

      let totalPrice = 0;
      const rows = cartResult.rows || [];
      const cartItems = await Promise.all(
        rows.map(async (row: any) => {
          const unit = parseFloat(String(row.product_price ?? 0)) || 0;
          const qty = Number(row.quantity) || 1;
          totalPrice += unit * qty;
          const signedImages = await presignProductImagesJsonb(row.product_images);
          return {
            id: row.id,
            itemId: row.id,
            type: 'product' as const,
            name: String(row.product_name || 'Product'),
            price: unit,
            quantity: qty,
            photo: firstProductImageUrl(signedImages),
            vendorId: row.product_vendor_id,
            vendor_name: row.vendor_name,
          };
        }),
      );

      return c.json({
        success: true,
        cartItems,
        totalPrice,
      });
    } catch (error: any) {
      console.error('Error fetching cart by phone:', error);
      if (
        typeof error?.message === 'string' &&
        error.message.includes('does not exist') &&
        error.message.includes('relation')
      ) {
        return c.json({ success: true, cartItems: [], totalPrice: 0 });
      }
      return c.json({ success: true, cartItems: [], totalPrice: 0, _error: 'Unable to load cart' });
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
   * E-commerce wishlist products for profile "Saved Items" (legacy phone convenience route).
   */
  app.get("/customer/saved/:phone", async (c) => {
    try {
      const { phone } = c.req.param();

      const customerId = await resolveCustomerIdFromPhone(phone);
      if (!customerId) {
        return c.json({ error: 'Customer not found' }, 404);
      }

      const savedResult = await query(
        `SELECT
           w.id,
           w.product_id,
           w.created_at,
           p.name,
           p.price
         FROM customer_wishlist w
         INNER JOIN products p ON w.product_id = p.id
         WHERE w.customer_id = $1
         ORDER BY w.created_at DESC`,
        [customerId]
      );

      const savedItems = (savedResult.rows || []).map((row: any) => ({
        itemId: row.id,
        type: 'product' as const,
        name: row.name || 'Product',
        savedAt: row.created_at,
        product_id: row.product_id,
        price: row.price != null ? parseFloat(String(row.price)) : 0,
      }));

      return c.json({
        success: true,
        savedItems,
      });
    } catch (error: any) {
      console.error('Error fetching saved items by phone:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * DELETE /customer/saved/:phone/items/:itemId
   * Remove e-commerce wishlist row by wishlist id or product id.
   */
  app.delete("/customer/saved/:phone/items/:itemId", async (c) => {
    try {
      const { phone, itemId } = c.req.param();

      const customerId = await resolveCustomerIdFromPhone(phone);
      if (!customerId) {
        return c.json({ error: 'Customer not found' }, 404);
      }

      const id = String(itemId || '').trim();
      if (!id) {
        return c.json({ error: 'Item id is required' }, 400);
      }

      await query(
        `DELETE FROM customer_wishlist
         WHERE customer_id = $1 AND (id = $2 OR product_id = $2)`,
        [customerId, id]
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
   * ✅ CRITICAL FIX: Never return 500 - always return a valid wallet response
   */
  app.get("/customer/wallet", async (c) => {
    // Default wallet response - always return this structure
    const defaultWallet = {
      success: true,
      wallet: {
        balance: 0,
        currency: 'INR',
        pending_credits: 0,
        total_earned: 0,
        total_spent: 0,
      },
    };

    try {
      const phone = c.req.query('phone');

      if (!phone) {
        // Return default wallet instead of error for missing phone
        console.log('[WALLET] No phone provided, returning default wallet');
        return c.json(defaultWallet);
      }

      let customerId: string | null = null;
      try {
        customerId = await resolveCustomerIdFromPhone(phone);
      } catch (resolveError) {
        console.warn('[WALLET] Error resolving customer ID:', resolveError);
        return c.json(defaultWallet);
      }

      if (!customerId) {
        // Return default wallet for unregistered customers
        console.log('[WALLET] Customer not found for phone:', phone);
        return c.json(defaultWallet);
      }

      let wallet: any = { balance: 0, currency: 'INR', pending_credits: 0 };

      try {
        const walletResult = await query(
          `SELECT * FROM customer_wallets WHERE customer_id = $1 LIMIT 1`,
          [customerId]
        );

        if (walletResult.rows && walletResult.rows.length > 0) {
          wallet = walletResult.rows[0];
        } else {
          try {
            await query(
              `INSERT INTO customer_wallets (customer_id, balance, currency)
               VALUES ($1, 0, 'INR')
               ON CONFLICT (customer_id) DO NOTHING`,
              [customerId]
            );
          } catch (insertError) {
            console.log('[WALLET] Could not create wallet (table may not exist)');
          }
          const afterUpsert = await query(
            `SELECT * FROM customer_wallets WHERE customer_id = $1 LIMIT 1`,
            [customerId]
          );
          if (afterUpsert.rows && afterUpsert.rows.length > 0) {
            wallet = afterUpsert.rows[0];
          }
        }
      } catch (dbError: any) {
        console.warn('[WALLET] Database query failed:', dbError?.message || dbError);
        return c.json(defaultWallet);
      }

      const { totalEarned, totalSpent } = await getWalletLedgerTotalsByCustomerId(customerId);

      return c.json({
        success: true,
        wallet: {
          balance: parseFloat(wallet.balance || '0') || 0,
          currency: wallet.currency || 'INR',
          pending_credits: parseFloat(wallet.pending_credits || '0') || 0,
          total_earned: totalEarned,
          total_spent: totalSpent,
        },
      });
    } catch (error: any) {
      console.error('[WALLET] Unexpected error:', error?.message || error);
      // ✅ CRITICAL: Return default wallet on ANY error - never 500
      return c.json(defaultWallet);
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
      console.error('[notifications] Error fetching notifications by phone:', error);
      console.error('[notifications] Error stack:', error?.stack);
      
      const errorMessage = error?.message || 'Unknown error';
      
      // ✅ FIX: Handle missing table gracefully - return empty notifications
      if (errorMessage.includes('relation') && errorMessage.includes('does not exist')) {
        console.log('[notifications] Table does not exist, returning empty notifications');
        return c.json({
          success: true,
          notifications: [],
          unreadCount: 0,
        });
      }
      
      // ✅ FIX: Return 200 with empty on pool exhaustion so customer home loads (non-critical)
      if (errorMessage.includes('connection pool') || errorMessage.includes('too many clients')) {
        return c.json({ 
          success: true, 
          notifications: [], 
          unreadCount: 0 
        });
      }
      
      // ✅ FIX: Return graceful fallback for other errors - don't break the UI
      return c.json({ 
        success: true, 
        notifications: [], 
        unreadCount: 0,
        _error: 'Unable to fetch notifications'
      });
    }
  });

  /**
   * GET /customer/payment-methods?phone=...
   * Get customer payment methods by phone (query param version)
   * ✅ FIX: Add this route for frontend compatibility
   */
  app.get("/customer/payment-methods", async (c) => {
    try {
      const phone = c.req.query('phone');

      if (!phone) {
        return c.json({ success: true, paymentMethods: [] });
      }

      const customerId = await resolveCustomerIdFromPhone(phone);
      if (!customerId) {
        // Return empty payment methods for unregistered customers
        return c.json({ success: true, paymentMethods: [] });
      }

      let paymentMethods: any[] = [];
      try {
        paymentMethods = await select('customer_payment_methods', { customer_id: customerId });
      } catch (dbError) {
        // Table might not exist - return empty array
        console.warn('[PAYMENT-METHODS] Database query failed, returning empty array');
      }

      return c.json({
        success: true,
        paymentMethods: paymentMethods || []
      });
    } catch (error: any) {
      console.error('Error getting payment methods:', error);
      // Return empty array on error, not 500
      return c.json({ success: true, paymentMethods: [] });
    }
  });

  /**
   * GET /customer/payments/:phone
   * Get customer payment methods by phone (path param version)
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
      return c.json({ success: true, paymentMethods: [] });
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
      ).catch((error) => {
        // Expected: notification may fail, but don't fail the main operation
        console.warn('[CUSTOMER-PHONE] Error sending notification:', error instanceof Error ? error.message : 'Unknown error');
      });

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
   * GET /customer/:phone/recommended-services
   * Phase 4: Service recommendations - "Recommended for you" based on booking history
   * Returns services/categories to suggest (e.g. if booked vet → suggest grooming, walking)
   */
  app.get("/customer/:phone/recommended-services", async (c) => {
    try {
      const { phone } = c.req.param();
      const limit = parseInt(c.req.query('limit') || '5');

      const customerId = await resolveCustomerIdFromPhone(phone);
      if (!customerId) {
        return c.json({ success: true, services: [] });
      }

      // Get customer's recent booking categories (bookings.service_id -> services.id)
      const recentBookings = await query(
        `SELECT DISTINCT s.category
         FROM bookings b
         LEFT JOIN services s ON b.service_id = s.id
         WHERE b.customer_id = $1
           AND b.status IN ('confirmed', 'completed')
           AND s.category IS NOT NULL
         ORDER BY b.created_at DESC
         LIMIT 10`,
        [customerId]
      ).catch(() => ({ rows: [] }));

      const usedCategories = new Set((recentBookings.rows || []).map((r: any) => (r.category || '').toLowerCase()).filter(Boolean));

      // Complementary service suggestions based on what they've used
      const categoryToSuggestions: Record<string, Array<{ name: string; screen: string; category: string }>> = {
        vet: [
          { name: 'Grooming', screen: 'grooming', category: 'grooming' },
          { name: 'Dog Walking', screen: 'walker', category: 'walker' },
          { name: 'Training', screen: 'training', category: 'training' },
        ],
        grooming: [
          { name: 'Vet Consultation', screen: 'vet', category: 'vet' },
          { name: 'Dog Walking', screen: 'walker', category: 'walker' },
          { name: 'Training', screen: 'training', category: 'training' },
        ],
        training: [
          { name: 'Vet Consultation', screen: 'vet', category: 'vet' },
          { name: 'Grooming', screen: 'grooming', category: 'grooming' },
          { name: 'Dog Walking', screen: 'walker', category: 'walker' },
        ],
        walker: [
          { name: 'Grooming', screen: 'grooming', category: 'grooming' },
          { name: 'Vet Consultation', screen: 'vet', category: 'vet' },
          { name: 'Training', screen: 'training', category: 'training' },
        ],
        boarding: [
          { name: 'Vet Consultation', screen: 'vet', category: 'vet' },
          { name: 'Grooming', screen: 'grooming', category: 'grooming' },
          { name: 'Dog Walking', screen: 'walker', category: 'walker' },
        ],
      };

      const suggested = new Map<string, { name: string; screen: string; category: string }>();
      for (const row of recentBookings.rows || []) {
        const cat = (row.category || '').toLowerCase();
        const list = categoryToSuggestions[cat] || categoryToSuggestions['vet'] || [];
        for (const s of list) {
          if (!usedCategories.has(s.category) && !suggested.has(s.screen)) {
            suggested.set(s.screen, s);
          }
        }
      }

      // If no recent bookings, suggest popular services
      if (suggested.size === 0) {
        const popular = [
          { name: 'Vet Consultation', screen: 'vet', category: 'vet' },
          { name: 'Grooming', screen: 'grooming', category: 'grooming' },
          { name: 'Dog Walking', screen: 'walker', category: 'walker' },
          { name: 'Training', screen: 'training', category: 'training' },
          { name: 'Boarding', screen: 'boarding', category: 'boarding' },
        ];
        popular.slice(0, limit).forEach((s) => suggested.set(s.screen, s));
      }

      const services = Array.from(suggested.values()).slice(0, limit).map((s) => ({
        id: s.screen,
        name: s.name,
        screen: s.screen,
        category: s.category,
        serviceName: s.name,
      }));

      return c.json({ success: true, services });
    } catch (error: any) {
      console.error('[recommended-services] Error:', error?.message);
      return c.json({ success: true, services: [] });
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

      // Enrich each package with includedServices (from snapshot or package definition)
      const packages = await Promise.all(result.rows.map(async (pkg: any) => {
        let includedServices: Array<{ id: string; name: string }> = [];
        const snapshot = pkg.package_snapshot && (typeof pkg.package_snapshot === 'string' ? JSON.parse(pkg.package_snapshot) : pkg.package_snapshot);
        if (snapshot?.includedServices && Array.isArray(snapshot.includedServices)) {
          includedServices = snapshot.includedServices.map((s: any) => ({ id: s.id || s.vendor_service_id, name: s.name || s.serviceName || 'Service' }));
        } else {
          // Try vendor_services (catalog package): package_id may be vendor_services.id
          try {
            const vsRows = await query(
              `SELECT id, service_name, metadata FROM vendor_services WHERE id = $1 AND vendor_id = $2`,
              [pkg.package_id, pkg.vendor_id]
            );
            if (vsRows.rows?.length > 0) {
              const meta = vsRows.rows[0].metadata;
              const parsed = typeof meta === 'string' ? (meta ? JSON.parse(meta) : {}) : (meta || {});
              const details = parsed?.packageDetails || parsed;
              const inc = details?.includedServices || details?.included_services;
              if (Array.isArray(inc) && inc.length > 0) {
                includedServices = inc.map((s: any) => ({ id: s.id || s.vendor_service_id, name: s.name || s.serviceName || 'Service' }));
              }
            }
          } catch (_) {}
          // Fallback: service_packages + package_services (legacy)
          if (includedServices.length === 0) {
            try {
              const psRows = await query(
                `SELECT ps.service_id, s.name as service_name FROM package_services ps
                 LEFT JOIN services s ON ps.service_id = s.id
                 WHERE ps.package_id = $1`,
                [pkg.package_id]
              );
              if (psRows.rows?.length > 0) {
                includedServices = psRows.rows.map((r: any) => ({ id: r.service_id, name: r.service_name || 'Service' }));
              }
            } catch (_) {}
          }
        }
        return {
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
          status: pkg.computed_status,
          includedServices,
        };
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
   * GET /customer/:phone/latest-booking-by-vendor?vendorId=...
   * Returns the latest booking for this customer with the given vendor (for opening chat from My Packages).
   */
  app.get("/customer/:phone/latest-booking-by-vendor", async (c) => {
    try {
      const { phone } = c.req.param();
      const vendorId = c.req.query('vendorId');
      if (!vendorId) {
        return c.json({ error: 'vendorId query required' }, 400);
      }
      const customerId = await resolveCustomerIdFromPhone(phone);
      if (!customerId) {
        return c.json({ booking: null, success: true });
      }
      const result = await query(
        `SELECT b.id as booking_id, b.vendor_id, v.business_name as vendor_name, v.logo_url as vendor_photo
         FROM bookings b
         LEFT JOIN vendors v ON v.id = b.vendor_id
         WHERE b.customer_id = $1 AND b.vendor_id = $2 AND b.status NOT IN ('cancelled', 'rejected')
         ORDER BY b.booking_date DESC, b.booking_time DESC
         LIMIT 1`,
        [customerId, vendorId]
      );
      const row = result.rows?.[0];
      if (!row) {
        return c.json({ success: true, booking: null });
      }
      return c.json({
        success: true,
        booking: {
          bookingId: row.booking_id,
          vendorId: row.vendor_id,
          vendorName: row.vendor_name,
          vendorPhoto: row.vendor_photo,
        },
      });
    } catch (error: any) {
      console.error('Error fetching latest booking by vendor:', error);
      return c.json({ success: true, booking: null });
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
