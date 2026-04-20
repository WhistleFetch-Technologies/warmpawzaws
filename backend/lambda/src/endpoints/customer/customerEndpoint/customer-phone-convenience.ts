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
 * - GET /customer/notifications/:phone - Inbox + notification channel settings (preferences.notificationSettings)
 * - PUT /customer/notifications/:phone - Save notification channel settings
 * - POST /customer/payments/:phone - Create payment by phone
 * 
 * Date: 2026-01-12
 * ============================================================================
 */

import { Hono } from 'hono';
import { select, query, insert } from '../../../database/rds-connection';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../../../utils/entity-extractor';
import { isValidUUID } from '../../../types/entities';
import { reconcileBookingPayments } from '../../../utils/payments/payment-reconciliation';
import {
  DEFAULT_CUSTOMER_NOTIFICATION_SETTINGS,
  fetchCustomerNotificationSettings,
  normalizeCustomerNotificationSettings,
  persistCustomerNotificationSettings,
} from '../../../utils/customer-notification-settings';
import { presignProductImagesJsonb } from '../../../utils/s3-media-presign';

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
 * Tries multiple stored shapes: 10-digit, +91XXXXXXXXXX, 91XXXXXXXXXX in DB, etc.
 */
async function resolveCustomerIdFromPhone(phone: string): Promise<string | null> {
  const trimmed = String(phone || '').trim();
  const digits = trimmed.replace(/\D/g, '');
  if (!digits || digits.length < 10) {
    return null;
  }

  const candidates: string[] = [];
  const add = (v: string) => {
    if (v && !candidates.includes(v)) candidates.push(v);
  };

  add(trimmed);
  add(digits);
  if (digits.length === 10) {
    add(`+91${digits}`);
  }
  // IN mobile with country code in UI/storage: 919XXXXXXXXX (12 digits)
  if (digits.length >= 10) {
    const last10 = digits.slice(-10);
    add(last10);
    add(`+91${last10}`);
    if (digits.startsWith('91') && digits.length >= 12) {
      add(digits);
    }
  }
  if (digits.length === 11 && digits.startsWith('0')) {
    const rest = digits.slice(1);
    add(rest);
    add(`+91${rest}`);
  }

  for (const candidate of candidates) {
    const rows = await select('customers', { phone: candidate });
    if (rows.length > 0) return rows[0].id;
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

/** Include row in list unless explicitly deactivated (soft-delete). NULL/missing is_active = show (legacy rows). */
function isPaymentMethodRowVisible(row: Record<string, unknown>): boolean {
  const v = row.is_active;
  if (v === null || v === undefined) return true;
  if (v === false || v === 'f' || v === 'false' || v === 0 || v === '0') return false;
  return true;
}

/** Decode `:phone` path or query param (handles encodeURIComponent from client). */
function decodePhoneParam(phone: string): string {
  try {
    return decodeURIComponent(phone);
  } catch {
    return phone;
  }
}

/** Normalize DB `payment_type` + row fields → customer-web union. */
function clientPaymentTypeFromRow(m: Record<string, unknown>): 'card' | 'upi' | 'netbanking' {
  const upiVal = m.upi_id != null ? String(m.upi_id).trim() : '';
  const bankVal = m.bank_name != null ? String(m.bank_name).trim() : '';
  const last4Val = m.card_last4 != null ? String(m.card_last4).replace(/\D/g, '') : '';
  if (upiVal.length > 0) return 'upi';
  if (bankVal.length > 0 && last4Val.length < 4) return 'netbanking';
  if (last4Val.length >= 4) return 'card';

  const raw = String(m.payment_type ?? m.type ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
  const c = raw.replace(/_/g, '');
  if (raw === 'upi' || c === 'upi' || raw.includes('upi')) return 'upi';
  if (
    c === 'netbanking' ||
    raw === 'net_banking' ||
    c === 'banktransfer' ||
    raw === 'bank_transfer' ||
    c === 'nb' ||
    raw === 'nb'
  ) {
    return 'netbanking';
  }
  if (
    c === 'card' ||
    c === 'debitcard' ||
    c === 'creditcard' ||
    raw === 'debit_card' ||
    raw === 'credit_card'
  ) {
    return 'card';
  }

  return 'card';
}

/** Body → stored payment_type (must match what we can read back). */
function normalizeIncomingPaymentType(body: Record<string, any>): 'card' | 'upi' | 'netbanking' {
  const req = String(body.type ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
  const collapsed = req.replace(/_/g, '');
  if (req === 'upi' || collapsed === 'upi') return 'upi';
  if (
    collapsed === 'netbanking' ||
    req === 'net_banking' ||
    collapsed === 'banktransfer' ||
    req === 'bank_transfer'
  ) {
    return 'netbanking';
  }
  if (req === 'card' || collapsed === 'debitcard' || collapsed === 'creditcard') return 'card';

  const hasCardDigits =
    typeof (body.cardNumber ?? body.card_number) === 'string' &&
    (body.cardNumber ?? body.card_number).replace(/\D/g, '').length >= 4;
  const upi = body.upiId ?? body.upi_id;
  const bank = body.bankName ?? body.bank_name;
  if (upi != null && String(upi).trim() !== '' && !hasCardDigits) return 'upi';
  if (bank != null && String(bank).trim() !== '' && !hasCardDigits && !(upi && String(upi).trim())) {
    return 'netbanking';
  }
  return 'card';
}

/** Map `customer_payment_methods` row → shape expected by customer-web Payment Settings (UserAccountSidebar). */
function mapPaymentMethodRowForCustomerWeb(m: Record<string, unknown>) {
  const last4 = m.card_last4 != null ? String(m.card_last4) : '';
  const resolvedType = clientPaymentTypeFromRow(m);
  return {
    id: String(m.id),
    type: resolvedType,
    payment_type: resolvedType,
    cardNumber: last4,
    cardHolderName:
      m.card_holder_name != null ? String(m.card_holder_name) : undefined,
    expiryMonth:
      m.card_expiry_month != null ? String(m.card_expiry_month) : undefined,
    expiryYear:
      m.card_expiry_year != null ? String(m.card_expiry_year) : undefined,
    cardType: (m.card_brand as string) || undefined,
    upiId: m.upi_id != null ? String(m.upi_id) : undefined,
    bankName: m.bank_name != null ? String(m.bank_name) : undefined,
    isDefault: Boolean(m.is_default),
    createdAt: m.created_at != null ? String(m.created_at) : '',
    updatedAt: m.updated_at != null ? String(m.updated_at) : '',
  };
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

      bookingQuery += ` ORDER BY b.created_at DESC, b.booking_date DESC, b.booking_time DESC LIMIT 50`;

      const bookings = await query(bookingQuery, params);

      // ✅ PAYMENT RECONCILIATION (2 tiers):
      //   Tier 1 – DB: pending booking with completed payment → mark paid
      //   Tier 2 – Razorpay API: pending payment with razorpay_order_id → check Razorpay if actually paid
      await reconcileBookingPayments(bookings.rows);

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
   * Inbox + unread count + notification channel settings (stored under customers.preferences.notificationSettings)
   */
  app.get("/customer/notifications/:phone", async (c) => {
    const { phone } = c.req.param();
    const limit = parseInt(c.req.query('limit') || '50', 10);

    const customerId = await resolveCustomerIdFromPhone(phone);
    if (!customerId) {
      return c.json({
        success: true,
        notifications: [],
        unreadCount: 0,
        settings: { ...DEFAULT_CUSTOMER_NOTIFICATION_SETTINGS },
      });
    }

    const settings = await fetchCustomerNotificationSettings(customerId);

    try {
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
        settings,
      });
    } catch (error: any) {
      console.error('[notifications] Error fetching notifications by phone:', error);
      console.error('[notifications] Error stack:', error?.stack);

      const errorMessage = error?.message || 'Unknown error';

      if (errorMessage.includes('relation') && errorMessage.includes('does not exist')) {
        console.log('[notifications] Table does not exist, returning empty notifications');
        return c.json({
          success: true,
          notifications: [],
          unreadCount: 0,
          settings,
        });
      }

      if (errorMessage.includes('connection pool') || errorMessage.includes('too many clients')) {
        return c.json({
          success: true,
          notifications: [],
          unreadCount: 0,
          settings,
        });
      }

      return c.json({
        success: true,
        notifications: [],
        unreadCount: 0,
        settings,
        _error: 'Unable to fetch notifications',
      });
    }
  });

  /**
   * PUT /customer/notifications/:phone
   * Persist channel toggles to customers.preferences.notificationSettings (JSONB)
   */
  app.put("/customer/notifications/:phone", async (c) => {
    try {
      const { phone } = c.req.param();
      const body = await c.req.json().catch(() => ({}));
      const customerId = await resolveCustomerIdFromPhone(phone);

      if (!customerId) {
        const merged = normalizeCustomerNotificationSettings({
          ...DEFAULT_CUSTOMER_NOTIFICATION_SETTINGS,
          ...(typeof body === 'object' && body ? body : {}),
        });
        return c.json({ success: true, settings: merged, persisted: false });
      }

      try {
        const merged = await persistCustomerNotificationSettings(customerId, body);
        return c.json({ success: true, settings: merged, persisted: true });
      } catch (err: any) {
        const msg = err?.message || '';
        if (msg.includes('column "preferences"')) {
          const merged = normalizeCustomerNotificationSettings({
            ...DEFAULT_CUSTOMER_NOTIFICATION_SETTINGS,
            ...(typeof body === 'object' && body ? body : {}),
          });
          return c.json({ success: true, settings: merged, persisted: false });
        }
        throw err;
      }
    } catch (error: any) {
      console.error('[notifications] Error saving notification settings:', error);
      return c.json({ error: error?.message || 'Failed to save notification settings' }, 500);
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

      const customerId = await resolveCustomerIdFromPhone(decodePhoneParam(phone));
      if (!customerId) {
        // Return empty payment methods for unregistered customers
        return c.json({ success: true, paymentMethods: [] });
      }

      let rows: any[] = [];
      try {
        const r = await query(
          `SELECT * FROM customer_payment_methods
           WHERE customer_id = $1
           ORDER BY is_default DESC NULLS LAST, created_at DESC NULLS LAST`,
          [customerId]
        );
        rows = (r.rows || []).filter((row: Record<string, unknown>) =>
          isPaymentMethodRowVisible(row)
        );
      } catch (dbError: any) {
        console.warn(
          '[PAYMENT-METHODS] Database query failed, returning empty array:',
          dbError?.message
        );
      }

      return c.json({
        success: true,
        paymentMethods: rows.map((row) =>
          mapPaymentMethodRowForCustomerWeb(row as Record<string, unknown>)
        ),
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

      const customerId = await resolveCustomerIdFromPhone(decodePhoneParam(phone));
      if (!customerId) {
        return c.json({ paymentMethods: [], success: true });
      }

      let rows: any[] = [];
      try {
        const r = await query(
          `SELECT * FROM customer_payment_methods
           WHERE customer_id = $1
           ORDER BY is_default DESC NULLS LAST, created_at DESC NULLS LAST`,
          [customerId]
        );
        rows = (r.rows || []).filter((row: Record<string, unknown>) =>
          isPaymentMethodRowVisible(row)
        );
      } catch (dbError: any) {
        console.warn(
          '[PAYMENTS/:phone] Database query failed, returning empty array:',
          dbError?.message
        );
      }

      return c.json({
        success: true,
        paymentMethods: rows.map((row) =>
          mapPaymentMethodRowForCustomerWeb(row as Record<string, unknown>)
        ),
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
      const body = (await c.req.json().catch(() => ({}))) as Record<string, any>;

      const customerId = await resolveCustomerIdFromPhone(decodePhoneParam(phone));
      if (!customerId) {
        return c.json({ error: 'Customer not found' }, 404);
      }

      const type = normalizeIncomingPaymentType(body);
      const digitsOnly = (s: string) => s.replace(/\D/g, '');

      let cardLast4: string | undefined;
      if (type === 'card') {
        const raw = body.cardNumber ?? body.card_number;
        const d = typeof raw === 'string' ? digitsOnly(raw) : '';
        cardLast4 = d.length >= 4 ? d.slice(-4) : undefined;
        if (!cardLast4) {
          return c.json({ error: 'Valid card number is required' }, 400);
        }
      }

      if (type === 'upi') {
        const upi = body.upiId ?? body.upi_id;
        if (!upi || String(upi).trim() === '') {
          return c.json({ error: 'UPI ID is required' }, 400);
        }
      }

      if (type === 'netbanking') {
        const bank = body.bankName ?? body.bank_name;
        if (!bank || String(bank).trim() === '') {
          return c.json({ error: 'Bank name is required' }, 400);
        }
      }

      const isDefault = Boolean(body.isDefault ?? body.is_default);

      if (isDefault) {
        await query(
          `UPDATE customer_payment_methods SET is_default = false WHERE customer_id = $1`,
          [customerId]
        ).catch((e) =>
          console.warn('[POST /customer/payments] clear defaults:', e?.message)
        );
      }

      // Per-type row: never send card_brand (e.g. default "visa") or card_last4 for UPI/netbanking.
      const insertRow: Record<string, unknown> = {
        customer_id: customerId,
        payment_type: type,
        is_default: isDefault || false,
        is_active: true,
      };
      const rt = body.razorpayToken ?? body.razorpay_token;
      if (rt != null && String(rt).trim() !== '') {
        insertRow.razorpay_token = rt;
      }

      if (type === 'card') {
        insertRow.card_last4 = cardLast4 ?? body.last4 ?? body.last_four;
        insertRow.card_brand = body.cardType ?? body.card_brand ?? body.brand ?? null;
        const holder = body.cardHolderName ?? body.card_holder_name;
        if (holder != null && String(holder).trim() !== '') {
          insertRow.card_holder_name = String(holder).trim().slice(0, 200);
        }
        const em = body.expiryMonth ?? body.expiry_month;
        const ey = body.expiryYear ?? body.expiry_year;
        if (em != null && String(em).trim() !== '') {
          const mn = parseInt(String(em).replace(/\D/g, ''), 10);
          if (!Number.isNaN(mn) && mn >= 1 && mn <= 12) {
            insertRow.card_expiry_month = String(mn).padStart(2, '0');
          }
        }
        if (ey != null && String(ey).trim() !== '') {
          let y = String(ey).replace(/\D/g, '');
          if (y.length === 2) y = `20${y}`;
          if (y.length === 4) insertRow.card_expiry_year = y;
        }
      } else if (type === 'upi') {
        insertRow.upi_id = String(body.upiId ?? body.upi_id ?? '').trim();
      } else if (type === 'netbanking') {
        insertRow.bank_name = String(body.bankName ?? body.bank_name ?? '').trim();
      }

      let inserted: any[];
      try {
        inserted = await insert('customer_payment_methods', insertRow);
      } catch (insertErr: any) {
        const errMsg = String(insertErr?.message || insertErr);
        const optionalCols = /card_holder_name|card_expiry_month|card_expiry_year/i.test(
          errMsg
        );
        if (optionalCols && /column/i.test(errMsg)) {
          delete insertRow.card_holder_name;
          delete insertRow.card_expiry_month;
          delete insertRow.card_expiry_year;
          try {
            inserted = await insert('customer_payment_methods', insertRow);
          } catch (retryErr: any) {
            console.error(
              '[POST /customer/payments] insert retry failed:',
              retryErr?.message || retryErr
            );
            const msg = retryErr?.message || 'Failed to save payment method';
            const isClient =
              /not null|violates|invalid input|check constraint/i.test(String(msg));
            return c.json({ error: msg }, isClient ? 400 : 500);
          }
        } else {
          console.error(
            '[POST /customer/payments] insert customer_payment_methods failed:',
            errMsg
          );
          const msg = insertErr?.message || 'Failed to save payment method';
          const isClient =
            /not null|violates|invalid input|check constraint/i.test(String(msg));
          return c.json({ error: msg }, isClient ? 400 : 500);
        }
      }

      const row = inserted[0] as Record<string, unknown> | undefined;
      if (!row) {
        return c.json({ error: 'Payment method was not created' }, 500);
      }

      return c.json({
        success: true,
        message: 'Payment method added successfully',
        paymentMethod: mapPaymentMethodRowForCustomerWeb(row),
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

      const customerId = await resolveCustomerIdFromPhone(decodePhoneParam(phone));
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

      /**
       * Walk "live" card + Track must use booking_id for:
       * - GET /tracking/booking/:bookingId (vendor HomeServiceTrackingManager + gps_tracking_sessions)
       * - GET /customer/:bookingId/track-walk (walker_live_sessions / walker-gps)
       * Previously we exposed walker_live_sessions.id as `id`, which broke tracking APIs.
       */
      const byBooking = new Map<
        string,
        {
          bookingId: string;
          walkerName: string;
          petName: string;
          startTime: string | null;
          status: string;
          distanceCovered: number;
          currentLocation: unknown | null;
        }
      >();

      const upsert = (bookingId: string | null | undefined, row: {
        walkerName: string;
        petName: string;
        startTime: string | null;
        status: string;
        distanceCovered: number;
        currentLocation: unknown | null;
      }) => {
        if (!bookingId) return;
        const bid = String(bookingId);
        if (!byBooking.has(bid)) {
          byBooking.set(bid, {
            bookingId: bid,
            walkerName: row.walkerName,
            petName: row.petName,
            startTime: row.startTime,
            status: row.status,
            distanceCovered: row.distanceCovered,
            currentLocation: row.currentLocation,
          });
        }
      };

      // 1) Legacy walker_live_sessions + walk_routes (walker-gps.ts)
      try {
        const walkerLive = await query(
          `
          SELECT 
            wls.booking_id,
            wls.started_at,
            p.name AS pet_name,
            v.business_name AS walker_name,
            (COALESCE(wr.total_distance_meters, 0)::numeric / 1000.0) AS distance_km,
            wr.waypoints
          FROM walker_live_sessions wls
          LEFT JOIN bookings b ON wls.booking_id = b.id
          LEFT JOIN pets p ON b.pet_id = p.id
          LEFT JOIN vendors v ON wls.walker_id = v.id
          LEFT JOIN walk_routes wr ON wls.booking_id = wr.booking_id
          WHERE wls.customer_id = $1
          AND wls.is_active = true
        `,
          [customerId]
        );

        for (const walk of (walkerLive as any).rows || []) {
          const waypoints = walk.waypoints;
          const lastWp =
            Array.isArray(waypoints) && waypoints.length > 0
              ? waypoints[waypoints.length - 1]
              : null;
          upsert(walk.booking_id, {
            walkerName: walk.walker_name || 'Walker',
            petName: walk.pet_name || 'Pet',
            startTime: walk.started_at || null,
            status: 'in_progress',
            distanceCovered: walk.distance_km != null ? Number(walk.distance_km) : 0,
            currentLocation: lastWp,
          });
        }
      } catch (wlsErr: any) {
        console.warn('[active-walks] walker_live_sessions query skipped:', wlsErr?.message || wlsErr);
      }

      // 2) Package sessions in progress (schema varies by migration — failure must not drop other sources)
      try {
        const pkgWalks = await query(
          `
          SELECT 
            ps.booking_id,
            ps.scheduled_start_time AS scheduled_start_time,
            ps.actual_start_time,
            ps.status,
            ps.location,
            p.name AS pet_name,
            s.name AS walker_name
          FROM package_sessions ps
          LEFT JOIN bookings b ON ps.booking_id = b.id
          LEFT JOIN pets p ON ps.pet_id = p.id
          LEFT JOIN staff s ON ps.staff_id = s.id
          WHERE ps.package_purchase_id IN (
            SELECT id FROM package_purchases WHERE customer_id = $1
          )
          AND ps.status = 'in_progress'
        `,
          [customerId]
        );

        for (const walk of (pkgWalks as any).rows || []) {
          upsert(walk.booking_id, {
            walkerName: walk.walker_name || 'Walker',
            petName: walk.pet_name || 'Pet',
            startTime: walk.actual_start_time || walk.scheduled_start_time || null,
            status: walk.status || 'in_progress',
            distanceCovered: 0,
            currentLocation: walk.location || null,
          });
        }
      } catch (pkgErr: any) {
        console.warn('[active-walks] package_sessions query skipped:', pkgErr?.message || pkgErr);
      }

      // 3) Vendor web walk flow: gps_tracking_sessions + HomeServiceTrackingManager (no walker_live row)
      try {
        const gpsWalks = await query(
          `
          SELECT 
            b.id AS booking_id,
            COALESCE(g.started_at, b.created_at) AS started_at,
            p.name AS pet_name,
            v.business_name AS walker_name,
            COALESCE(g.distance_km, g.distance_remaining_km, 0)::numeric AS distance_km,
            g.current_latitude,
            g.current_longitude
          FROM bookings b
          INNER JOIN gps_tracking_sessions g ON g.booking_id = b.id
          LEFT JOIN pets p ON b.pet_id = p.id
          LEFT JOIN vendors v ON b.vendor_id = v.id
          WHERE b.customer_id = $1
          AND b.status = 'in_progress'
          AND g.status IS NOT NULL
          AND LOWER(g.status::text) NOT IN ('completed', 'cancelled')
          AND (
            LOWER(COALESCE(b.service_name, '')) LIKE '%walk%'
            OR LOWER(COALESCE(b.service_type, '')) LIKE '%walk%'
            OR LOWER(COALESCE(b.service_name, '')) LIKE '%stroll%'
          )
        `,
          [customerId]
        );

        for (const walk of (gpsWalks as any).rows || []) {
          upsert(walk.booking_id, {
            walkerName: walk.walker_name || 'Walker',
            petName: walk.pet_name || 'Pet',
            startTime: walk.started_at || null,
            status: 'in_progress',
            distanceCovered: walk.distance_km != null ? Number(walk.distance_km) : 0,
            currentLocation:
              walk.current_latitude != null && walk.current_longitude != null
                ? {
                    latitude: parseFloat(String(walk.current_latitude)),
                    longitude: parseFloat(String(walk.current_longitude)),
                  }
                : null,
          });
        }
      } catch (gpsErr: any) {
        console.warn('[active-walks] gps_tracking_sessions walk query skipped:', gpsErr?.message || gpsErr);
      }

      const walks = Array.from(byBooking.values()).map((w) => ({
        id: w.bookingId,
        bookingId: w.bookingId,
        walkerName: w.walkerName,
        petName: w.petName,
        startTime: w.startTime,
        status: w.status,
        distanceCovered: w.distanceCovered,
        currentLocation: w.currentLocation,
      }));

      return c.json({
        success: true,
        walks,
        count: walks.length,
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
