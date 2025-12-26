/**
 * ✅ MARKETING ROUTES V2 - SQL-ONLY VERSION
 * 
 * ✅ MIGRATED TO SQL: NO KV STORE - All data from SQL
 * KV Operations: 19 → 0
 * 
 * Features:
 * - Customer promotions list
 * - Coupon validation and application
 * - Admin promotion management
 * - Admin coupon management
 * - Bulk coupon generation
 */

import { Hono } from "npm:hono";
import { getPromotionsRepository } from '../../lib/repositories/promotions.ts';
import { getCouponsRepository } from '../../lib/repositories/coupons.ts';
import { getDbClient, withTransaction } from '../../lib/db.ts';
import { generateId } from './database-schema.tsx';

const app = new Hono();
const BASE_PATH = "/make-server-3dd53475";

// ==========================================
// COMPONENT 1: Customer Promotions List
// ==========================================
app.get(`${BASE_PATH}/promotions/active`, async (c) => {
  try {
    const category = c.req.query("category");
    const applicableTo = c.req.query("applicableTo");
    
    // ✅ SQL: Get all active promotions
    const promotionsRepo = getPromotionsRepository();
    const allPromotions = await promotionsRepo.findAll({ is_active: true });
    
    const now = new Date();
    
    const activePromotions = allPromotions.filter((p: any) => {
      if (!p.is_active) return false;
      if (p.start_date && new Date(p.start_date) > now) return false;
      if (p.end_date && new Date(p.end_date) < now) return false;
      
      if (category && p.applicable_services && p.applicable_services.length > 0 && !p.applicable_services.includes(category)) {
        return false;
      }
      
      if (applicableTo && applicableTo !== 'all' && p.applicable_roles && p.applicable_roles.length > 0 && !p.applicable_roles.includes(applicableTo)) {
        return false;
      }
      
      return true;
    });
    
    // Sort by priority
    activePromotions.sort((a: any, b: any) => (b.priority || 0) - (a.priority || 0));
    
    return c.json({
      success: true,
      promotions: activePromotions,
      total: activePromotions.length
    });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// ==========================================
// COMPONENT 2: Coupon Validation
// ==========================================
app.post(`${BASE_PATH}/coupons/validate`, async (c) => {
  try {
    const body = await c.req.json();
    const { code, orderAmount, customerId, targetIds } = body;
    
    if (!code) return c.json({ success: false, error: "Code is required" }, 400);
    
    // ✅ SQL: Get coupon by code (repository expects uppercase)
    const couponsRepo = getCouponsRepository();
    const coupon = await couponsRepo.findByCode(code.toUpperCase());
    
    if (!coupon) {
      return c.json({ success: true, valid: false, error: "Invalid coupon code" });
    }
    
    if (!coupon.is_active) {
      return c.json({ success: true, valid: false, error: "Coupon is not active" });
    }
    
    const now = new Date();
    if (coupon.starts_at && new Date(coupon.starts_at) > now) {
      return c.json({ success: true, valid: false, error: "Coupon is not yet active" });
    }
    if (coupon.expires_at && new Date(coupon.expires_at) < now) {
      return c.json({ success: true, valid: false, error: "Coupon has expired" });
    }
    
    if (coupon.max_uses && (coupon.uses_count || 0) >= coupon.max_uses) {
      return c.json({ success: true, valid: false, error: "Coupon usage limit reached" });
    }
    
    if (orderAmount !== undefined && coupon.minimum_amount && orderAmount < coupon.minimum_amount) {
      return c.json({ success: true, valid: false, error: `Minimum order amount of ${coupon.minimum_amount} required` });
    }
    
    // Validate User Limit
    if (customerId && coupon.max_uses_per_customer) {
      const userUsageCount = await couponsRepo.getUsageCount(coupon.id, customerId);
      if (userUsageCount >= coupon.max_uses_per_customer) {
        return c.json({ success: true, valid: false, error: "Coupon usage limit reached for this user" });
      }
    }
    
    // Calculate Discount
    let discountAmount = 0;
    if (coupon.discount_type === 'percentage') {
      discountAmount = (orderAmount * Number(coupon.discount_value)) / 100;
      if (coupon.max_discount) {
        discountAmount = Math.min(discountAmount, Number(coupon.max_discount));
      }
    } else if (coupon.discount_type === 'fixed') {
      discountAmount = Number(coupon.discount_value);
    }
    
    // Ensure discount doesn't exceed order amount
    discountAmount = Math.min(discountAmount, orderAmount);
    
    return c.json({
      success: true,
      valid: true,
      coupon: {
        ...coupon,
        discountAmount,
        finalAmount: orderAmount - discountAmount
      }
    });
    
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// ==========================================
// COMPONENT 3: Apply Coupon
// ==========================================
app.post(`${BASE_PATH}/coupons/apply`, async (c) => {
  try {
    const body = await c.req.json();
    const { code, orderAmount, customerId, orderId, bookingId } = body;
    
    // ✅ SQL: Get coupon by code (repository expects uppercase)
    const couponsRepo = getCouponsRepository();
    const coupon = await couponsRepo.findByCode(code.toUpperCase());
    
    if (!coupon || !coupon.is_active) {
      return c.json({ success: false, error: "Invalid or inactive coupon" }, 400);
    }
    
    // Calculate discount
    let discountAmount = 0;
    if (coupon.discount_type === 'percentage') {
      discountAmount = (orderAmount * Number(coupon.discount_value)) / 100;
      if (coupon.max_discount) {
        discountAmount = Math.min(discountAmount, Number(coupon.max_discount));
      }
    } else if (coupon.discount_type === 'fixed') {
      discountAmount = Number(coupon.discount_value);
    }
    discountAmount = Math.min(discountAmount, orderAmount);
    
    // ✅ SQL: Record usage with transaction
    await withTransaction(async () => {
      await couponsRepo.recordUsage(coupon.id, customerId, bookingId, orderId);
      
      // Update coupon usage count
      await couponsRepo.update(coupon.id, {
        uses_count: (coupon.uses_count || 0) + 1
      });
    });
    
    const usageRecord = {
      couponId: coupon.id,
      couponCode: coupon.code,
      userId: customerId,
      orderId,
      bookingId,
      orderAmount,
      discountAmount,
      usedAt: new Date().toISOString()
    };
    
    return c.json({
      success: true,
      usage: usageRecord,
      coupon
    });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// ==========================================
// COMPONENT 4: Admin Promotion Creation
// ==========================================
app.post(`${BASE_PATH}/admin/promotions/create`, async (c) => {
  try {
    const body = await c.req.json();
    
    if (!body.name || !body.type || body.value === undefined || !body.validFrom || !body.validUntil) {
      return c.json({ success: false, error: "Missing required fields" }, 400);
    }
    
    // ✅ SQL: Create promotion
    const promotionsRepo = getPromotionsRepository();
    const promotion = await promotionsRepo.create({
      name: body.name,
      description: body.description || '',
      promotion_type: body.type || 'discount',
      discount_type: body.discountType || 'percentage',
      discount_value: Number(body.value),
      max_discount_amount: body.maxDiscountAmount ? Number(body.maxDiscountAmount) : null,
      min_order_amount: body.minOrderAmount ? Number(body.minOrderAmount) : 0,
      start_date: body.validFrom,
      end_date: body.validUntil,
      applicable_services: body.targetIds || [],
      applicable_roles: body.applicableRoles || [],
      priority: body.priority || 0,
      is_active: body.isActive !== false
    });
    
    return c.json({ success: true, promotion });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// ==========================================
// COMPONENT 5: Admin Promotion Management
// ==========================================

app.put(`${BASE_PATH}/admin/promotions/:id`, async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    
    // ✅ SQL: Update promotion
    const promotionsRepo = getPromotionsRepository();
    const promotion = await promotionsRepo.update(id, {
      ...body,
      updated_at: new Date().toISOString()
    });
    
    if (!promotion) {
      return c.json({ success: false, error: "Promotion not found" }, 404);
    }
    
    return c.json({ success: true, promotion });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

app.delete(`${BASE_PATH}/admin/promotions/:id`, async (c) => {
  try {
    const id = c.req.param("id");
    
    // ✅ SQL: Delete promotion
    const promotionsRepo = getPromotionsRepository();
    await promotionsRepo.delete(id);
    
    return c.json({ success: true, message: "Deleted successfully" });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

app.get(`${BASE_PATH}/admin/promotions`, async (c) => {
  try {
    const status = c.req.query("status");
    const type = c.req.query("type");
    const search = c.req.query("search");
    const page = parseInt(c.req.query("page") || "1");
    const limit = parseInt(c.req.query("limit") || "50");
    
    // ✅ SQL: Get all promotions
    const promotionsRepo = getPromotionsRepository();
    let promotions = await promotionsRepo.findAll();
    
    // Filtering
    if (status && status !== 'all') {
      const now = new Date();
      promotions = promotions.filter((p: any) => {
        if (status === 'active') return p.is_active && (!p.end_date || new Date(p.end_date) > now);
        if (status === 'inactive') return !p.is_active;
        if (status === 'expired') return p.end_date && new Date(p.end_date) < now;
        return true;
      });
    }
    
    if (type && type !== 'all') {
      promotions = promotions.filter((p: any) => p.promotion_type === type);
    }
    
    if (search) {
      const lowerSearch = search.toLowerCase();
      promotions = promotions.filter((p: any) => 
        p.name.toLowerCase().includes(lowerSearch) || 
        (p.description && p.description.toLowerCase().includes(lowerSearch))
      );
    }
    
    // Pagination
    const total = promotions.length;
    const start = (page - 1) * limit;
    const paginated = promotions.slice(start, start + limit);
    
    return c.json({
      success: true,
      promotions: paginated,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// ==========================================
// COMPONENT 6: Admin Coupon Management
// ==========================================

app.get(`${BASE_PATH}/admin/coupons`, async (c) => {
  try {
    const status = c.req.query("status");
    const search = c.req.query("search");
    const page = parseInt(c.req.query("page") || "1");
    const limit = parseInt(c.req.query("limit") || "50");
    
    // ✅ SQL: Get all coupons
    const couponsRepo = getCouponsRepository();
    let coupons = await couponsRepo.findAll();
    
    if (search) {
      coupons = coupons.filter((c: any) => c.code.toLowerCase().includes(search.toLowerCase()));
    }
    
    // Pagination
    const total = coupons.length;
    const start = (page - 1) * limit;
    const paginated = coupons.slice(start, start + limit);
    
    return c.json({
      success: true,
      coupons: paginated,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

app.post(`${BASE_PATH}/admin/coupons/create`, async (c) => {
  try {
    const body = await c.req.json();
    
    if (!body.code || !body.type || body.value === undefined) {
      return c.json({ success: false, error: "Missing required fields" }, 400);
    }
    
    // ✅ SQL: Check uniqueness (repository expects uppercase)
    const couponsRepo = getCouponsRepository();
    const existing = await couponsRepo.findByCode(body.code.toUpperCase());
    if (existing) {
      return c.json({ success: false, error: "Coupon code already exists" }, 400);
    }
    
    // ✅ SQL: Create coupon (repository stores as uppercase)
    const coupon = await couponsRepo.create({
      code: body.code.toUpperCase(),
      name: body.name || body.code,
      description: body.description || '',
      discount_type: body.type,
      discount_value: Number(body.value),
      max_discount: body.maxDiscountAmount ? Number(body.maxDiscountAmount) : null,
      minimum_amount: body.minOrderAmount ? Number(body.minOrderAmount) : 0,
      max_uses: body.usageLimit || null,
      max_uses_per_customer: body.userUsageLimit || null,
      starts_at: body.validFrom || new Date().toISOString(),
      expires_at: body.validUntil || null,
      is_active: body.isActive !== false
    });
    
    return c.json({ success: true, coupon });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

app.post(`${BASE_PATH}/admin/coupons/bulk-generate`, async (c) => {
  try {
    const body = await c.req.json();
    const { prefix, quantity, format, length, ...couponData } = body;
    
    if (!quantity || quantity > 10000) {
      return c.json({ success: false, error: "Invalid quantity (max 10000)" }, 400);
    }
    
    // ✅ SQL: Get existing codes
    const couponsRepo = getCouponsRepository();
    const existingCoupons = await couponsRepo.findAll();
    const existingCodes = new Set(existingCoupons.map((c: any) => c.code.toLowerCase()));
    
    const generatedCoupons = [];
    const chars = format === 'numeric' ? '0123456789' : 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    
    await withTransaction(async () => {
      for (let i = 0; i < quantity; i++) {
        let code = prefix || '';
        const randomLength = length || 8;
        
        let randomPart = '';
        let attempts = 0;
        
        do {
          randomPart = '';
          for (let j = 0; j < randomLength; j++) {
            randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
          }
          attempts++;
        } while (existingCodes.has(code + randomPart) && attempts < 10);
        
        if (attempts >= 10) continue;
        
        code += randomPart;
        existingCodes.add(code);
        
        // ✅ SQL: Create coupon (repository stores as uppercase)
        const coupon = await couponsRepo.create({
          code: code.toUpperCase(),
          name: couponData.name || code,
          description: couponData.description || '',
          discount_type: couponData.type || 'percentage',
          discount_value: Number(couponData.value || 0),
          max_discount: couponData.maxDiscountAmount ? Number(couponData.maxDiscountAmount) : null,
          minimum_amount: couponData.minOrderAmount ? Number(couponData.minOrderAmount) : 0,
          max_uses: couponData.usageLimit || null,
          max_uses_per_customer: couponData.userUsageLimit || null,
          starts_at: couponData.validFrom || new Date().toISOString(),
          expires_at: couponData.validUntil || null,
          is_active: couponData.isActive !== false
        });
        
        generatedCoupons.push(coupon);
      }
    });
    
    return c.json({
      success: true,
      message: `Successfully generated ${generatedCoupons.length} coupons`,
      coupons: generatedCoupons,
      total: generatedCoupons.length
    });
    
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

export default app;

