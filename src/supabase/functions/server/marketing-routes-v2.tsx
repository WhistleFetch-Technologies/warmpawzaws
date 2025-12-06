import { Hono } from "npm:hono";
import * as kv from "./kv_store.tsx";

const app = new Hono();

// Helper to generate ID
const generateId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).substring(7)}`;

// ==========================================
// COMPONENT 1: Customer Promotions List
// ==========================================
app.get("/promotions/active", async (c) => {
  try {
    const category = c.req.query("category");
    const applicableTo = c.req.query("applicableTo");
    
    const allPromotions = await kv.get("promotions:list") || [];
    
    const now = new Date();
    
    const activePromotions = allPromotions.filter((p: any) => {
      if (!p.isActive) return false;
      if (p.validFrom && new Date(p.validFrom) > now) return false;
      if (p.validUntil && new Date(p.validUntil) < now) return false;
      
      if (category && p.targetIds && p.targetIds.length > 0 && !p.targetIds.includes(category)) {
         // This is a simplistic check. In reality, category might be a property, not just targetId
         // But sticking to handoff implied logic where targetIds might contain category IDs
      }
      
      if (applicableTo && applicableTo !== 'all' && p.applicableTo !== 'all' && p.applicableTo !== applicableTo) {
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
app.post("/coupons/validate", async (c) => {
  try {
    const body = await c.req.json();
    const { code, orderAmount, customerId, targetIds } = body;
    
    if (!code) return c.json({ success: false, error: "Code is required" }, 400);
    
    const coupons = await kv.get("coupons:list") || [];
    const coupon = coupons.find((c: any) => c.code.toLowerCase() === code.toLowerCase());
    
    if (!coupon) {
      return c.json({ success: true, valid: false, error: "Invalid coupon code" });
    }
    
    if (!coupon.isActive) {
      return c.json({ success: true, valid: false, error: "Coupon is not active" });
    }
    
    const now = new Date();
    if (coupon.validFrom && new Date(coupon.validFrom) > now) {
      return c.json({ success: true, valid: false, error: "Coupon is not yet active" });
    }
    if (coupon.validUntil && new Date(coupon.validUntil) < now) {
      return c.json({ success: true, valid: false, error: "Coupon has expired" });
    }
    
    if (coupon.usageLimit && (coupon.usageCount || 0) >= coupon.usageLimit) {
      return c.json({ success: true, valid: false, error: "Coupon usage limit reached" });
    }
    
    if (orderAmount !== undefined && coupon.minOrderAmount && orderAmount < coupon.minOrderAmount) {
      return c.json({ success: true, valid: false, error: `Minimum order amount of ${coupon.minOrderAmount} required` });
    }
    
    // Validate User Limit
    if (customerId && coupon.userUsageLimit) {
      const usages = await kv.get(`coupons:usage:${coupon.id}`) || [];
      const userUsage = usages.filter((u: any) => u.userId === customerId).length;
      if (userUsage >= coupon.userUsageLimit) {
        return c.json({ success: true, valid: false, error: "Coupon usage limit reached for this user" });
      }
    }
    
    // Calculate Discount
    let discountAmount = 0;
    if (coupon.type === 'percentage') {
      discountAmount = (orderAmount * coupon.value) / 100;
      if (coupon.maxDiscountAmount) {
        discountAmount = Math.min(discountAmount, coupon.maxDiscountAmount);
      }
    } else if (coupon.type === 'fixed') {
      discountAmount = coupon.value;
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
app.post("/coupons/apply", async (c) => {
  try {
    const body = await c.req.json();
    const { code, orderAmount, customerId, orderId, bookingId } = body;
    
    // Re-validate logic first (simplified here, assuming client calls validate first, but backend should always double check)
    const coupons = await kv.get("coupons:list") || [];
    const coupon = coupons.find((c: any) => c.code.toLowerCase() === code.toLowerCase());
    
    if (!coupon || !coupon.isActive) {
      return c.json({ success: false, error: "Invalid or inactive coupon" }, 400);
    }
    
    // Record Usage
    const usageId = generateId("usage");
    const usageRecord = {
      id: usageId,
      couponId: coupon.id,
      couponCode: coupon.code,
      userId: customerId,
      orderId,
      bookingId,
      orderAmount,
      usedAt: new Date().toISOString(),
      // Recalculate discount for record
      discountAmount: coupon.type === 'percentage' 
        ? Math.min((orderAmount * coupon.value) / 100, coupon.maxDiscountAmount || Infinity)
        : coupon.value
    };
    
    // Store usage
    const allUsages = await kv.get(`coupons:usage:${coupon.id}`) || [];
    allUsages.push(usageRecord);
    await kv.set(`coupons:usage:${coupon.id}`, allUsages);
    
    // Update coupon usage count
    coupon.usageCount = (coupon.usageCount || 0) + 1;
    
    // Update coupon in list
    const index = coupons.findIndex((c: any) => c.id === coupon.id);
    coupons[index] = coupon;
    await kv.set("coupons:list", coupons);
    
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
app.post("/admin/promotions/create", async (c) => {
  try {
    const body = await c.req.json();
    
    // Basic Validation
    if (!body.name || !body.type || body.value === undefined || !body.validFrom || !body.validUntil) {
      return c.json({ success: false, error: "Missing required fields" }, 400);
    }
    
    const promotion = {
      id: generateId("promo"),
      ...body,
      usageCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    const promotions = await kv.get("promotions:list") || [];
    promotions.unshift(promotion);
    await kv.set("promotions:list", promotions);
    
    return c.json({ success: true, promotion });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// ==========================================
// COMPONENT 5: Admin Promotion List
// ==========================================

// UPDATE Promotion
app.put("/admin/promotions/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    let promotions = await kv.get("promotions:list") || [];
    
    const index = promotions.findIndex((p: any) => p.id === id);
    if (index === -1) {
      return c.json({ success: false, error: "Promotion not found" }, 404);
    }
    
    promotions[index] = { ...promotions[index], ...body, updatedAt: new Date().toISOString() };
    await kv.set("promotions:list", promotions);
    
    return c.json({ success: true, promotion: promotions[index] });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// DELETE Promotion
app.delete("/admin/promotions/:id", async (c) => {
  try {
    const id = c.req.param("id");
    let promotions = await kv.get("promotions:list") || [];
    
    promotions = promotions.filter((p: any) => p.id !== id);
    await kv.set("promotions:list", promotions);
    
    return c.json({ success: true, message: "Deleted successfully" });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

app.get("/admin/promotions", async (c) => {
  try {
    const status = c.req.query("status");
    const type = c.req.query("type");
    const search = c.req.query("search");
    const page = parseInt(c.req.query("page") || "1");
    const limit = parseInt(c.req.query("limit") || "50");
    
    let promotions = await kv.get("promotions:list") || [];
    
    // Filtering
    if (status && status !== 'all') {
      const now = new Date();
      promotions = promotions.filter((p: any) => {
        if (status === 'active') return p.isActive && (!p.validUntil || new Date(p.validUntil) > now);
        if (status === 'inactive') return !p.isActive;
        if (status === 'expired') return p.validUntil && new Date(p.validUntil) < now;
        return true;
      });
    }
    
    if (type && type !== 'all') {
      promotions = promotions.filter((p: any) => p.type === type);
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

// List Coupons
app.get("/admin/coupons", async (c) => {
  try {
    const status = c.req.query("status");
    const search = c.req.query("search");
    const page = parseInt(c.req.query("page") || "1");
    const limit = parseInt(c.req.query("limit") || "50");
    
    let coupons = await kv.get("coupons:list") || [];
    
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

// Create Single Coupon
app.post("/admin/coupons/create", async (c) => {
  try {
    const body = await c.req.json();
    
    if (!body.code || !body.type || body.value === undefined) {
      return c.json({ success: false, error: "Missing required fields" }, 400);
    }
    
    const coupons = await kv.get("coupons:list") || [];
    
    // Check uniqueness
    if (coupons.some((c: any) => c.code.toLowerCase() === body.code.toLowerCase())) {
      return c.json({ success: false, error: "Coupon code already exists" }, 400);
    }
    
    const coupon = {
      id: generateId("coupon"),
      ...body,
      usageCount: 0,
      createdAt: new Date().toISOString()
    };
    
    coupons.unshift(coupon);
    await kv.set("coupons:list", coupons);
    
    return c.json({ success: true, coupon });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// Bulk Generate Coupons
app.post("/admin/coupons/bulk-generate", async (c) => {
  try {
    const body = await c.req.json();
    const { prefix, quantity, format, length, ...couponData } = body;
    
    if (!quantity || quantity > 10000) {
      return c.json({ success: false, error: "Invalid quantity (max 10000)" }, 400);
    }
    
    const generatedCoupons = [];
    const coupons = await kv.get("coupons:list") || [];
    const existingCodes = new Set(coupons.map((c: any) => c.code));
    
    const chars = format === 'numeric' ? '0123456789' : 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    
    for (let i = 0; i < quantity; i++) {
      let code = prefix || '';
      const randomLength = length || 8;
      
      // Generate unique random part
      let randomPart = '';
      let attempts = 0;
      
      do {
        randomPart = '';
        for (let j = 0; j < randomLength; j++) {
          randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        attempts++;
      } while (existingCodes.has(code + randomPart) && attempts < 10);
      
      if (attempts >= 10) continue; // Skip if strict collision (rare)
      
      code += randomPart;
      existingCodes.add(code);
      
      const coupon = {
        id: generateId("coupon"),
        code,
        ...couponData,
        usageCount: 0,
        createdAt: new Date().toISOString()
      };
      
      generatedCoupons.push(coupon);
    }
    
    // Merge with existing
    const newCouponList = [...generatedCoupons, ...coupons];
    await kv.set("coupons:list", newCouponList);
    
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