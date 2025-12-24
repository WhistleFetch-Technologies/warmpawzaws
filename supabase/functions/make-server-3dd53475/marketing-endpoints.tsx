// ✅ MIGRATED TO SQL: All KV operations removed
import { Hono } from "npm:hono";
import { getPromotionsRepository } from '../../lib/repositories/promotions.ts';
import { getUIConfigRepository } from '../../lib/repositories/ui-config.ts';

const app = new Hono();

// Base path for all routes
const BASE_PATH = "/make-server-3dd53475";

// ==========================================
// 1. PROMOTIONS & MARKETING API
// ==========================================

// ✅ SQL: GET All Promotions (Admin)
app.get(`${BASE_PATH}/marketing/promotions`, async (c) => {
  try {
    const promotionsRepo = getPromotionsRepository();
    const promotions = await promotionsRepo.findAll();
    return c.json({ success: true, promotions });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// ✅ SQL: CREATE Promotion (Admin)
app.post(`${BASE_PATH}/marketing/promotions`, async (c) => {
  try {
    const body = await c.req.json();
    const promotionsRepo = getPromotionsRepository();
    
    const newPromotion = await promotionsRepo.create({
      name: body.name || body.title || 'Promotion',
      description: body.description || body.subtitle,
      promotion_type: body.promotionType || 'discount',
      discount_type: body.discountType || 'percentage',
      discount_value: body.discountValue || 0,
      min_order_amount: body.minOrderAmount,
      max_discount_amount: body.maxDiscountAmount,
      start_date: body.validFrom || body.startDate || new Date().toISOString().split('T')[0],
      end_date: body.validUntil || body.endDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      is_active: body.isActive !== false,
    });
    
    return c.json({ success: true, promotion: newPromotion });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// ✅ SQL: UPDATE Promotion (Admin)
app.put(`${BASE_PATH}/marketing/promotions/:id`, async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const promotionsRepo = getPromotionsRepository();
    
    const updateData: any = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.promotionType !== undefined) updateData.promotion_type = body.promotionType;
    if (body.discountType !== undefined) updateData.discount_type = body.discountType;
    if (body.discountValue !== undefined) updateData.discount_value = body.discountValue;
    if (body.minOrderAmount !== undefined) updateData.min_order_amount = body.minOrderAmount;
    if (body.maxDiscountAmount !== undefined) updateData.max_discount_amount = body.maxDiscountAmount;
    if (body.startDate !== undefined || body.validFrom !== undefined) updateData.start_date = body.startDate || body.validFrom;
    if (body.endDate !== undefined || body.validUntil !== undefined) updateData.end_date = body.endDate || body.validUntil;
    if (body.isActive !== undefined) updateData.is_active = body.isActive;
    
    const updated = await promotionsRepo.update(id, updateData);
    
    return c.json({ success: true, promotion: updated });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// ✅ SQL: DELETE Promotion (Admin) - Soft delete
app.delete(`${BASE_PATH}/marketing/promotions/:id`, async (c) => {
  try {
    const id = c.req.param("id");
    const promotionsRepo = getPromotionsRepository();
    
    await promotionsRepo.delete(id);
    
    return c.json({ success: true, message: "Deleted successfully" });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// ✅ SQL: GET Targeted Promotions (Customer)
// Query params: roleId, lat, lon, city, region
app.get("/make-server-3dd53475/customer/marketing/promotions", async (c) => {
  try {
    const roleId = c.req.query("roleId");
    const serviceStyle = c.req.query("serviceStyle");
    const lat = c.req.query("lat");
    const lon = c.req.query("lon");
    
    const promotionsRepo = getPromotionsRepository();
    const allPromotions = await promotionsRepo.findActive({ 
      roleId: roleId || undefined,
      serviceStyle: serviceStyle || undefined 
    });
    
    // Transform to frontend-expected format
    const transformedPromotions = allPromotions.map((promo: any) => ({
      id: promo.id,
      title: promo.name, // Backend uses 'name', frontend expects 'title'
      name: promo.name,
      description: promo.description,
      discountPercentage: promo.discount_type === 'percentage' ? promo.discount_value : undefined,
      discountAmount: promo.discount_type === 'fixed' ? promo.discount_value : undefined,
      discountType: promo.discount_type,
      discountValue: promo.discount_value,
      maxDiscountAmount: promo.max_discount_amount,
      minOrderAmount: promo.min_order_amount || 0,
      startDate: promo.start_date,
      endDate: promo.end_date,
      validFrom: promo.start_date,
      validUntil: promo.end_date,
      applicableServices: promo.applicable_services || [],
      applicableRoles: promo.applicable_roles || [],
      priority: promo.priority || 0,
      isActive: promo.is_active
    }));
    
    return c.json({ success: true, promotions: transformedPromotions });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});


// ==========================================
// 2. UI CONFIGURATION API (Dashboard Buttons)
// ==========================================

// Default Config if nothing saved
const DEFAULT_UI_CONFIG = {
  'veterinarian': [
    { id: 'tele_consultation', label: 'Tele Consultation', icon: 'Video', enabled: true, serviceStyle: 'tele' },
    { id: 'clinic_visit', label: 'Clinic Visit', icon: 'Building2', enabled: true, serviceStyle: 'at_center' },
    { id: 'home_visit', label: 'Home Visit', icon: 'Home', enabled: true, serviceStyle: 'at_home' },
    { id: 'lab_collection', label: 'Lab Tests', icon: 'FlaskConical', enabled: true, serviceStyle: 'lab' },
    { id: 'medicine_delivery', label: 'Pharmacy', icon: 'Pill', enabled: true, serviceStyle: 'pharmacy' }
  ],
  'groomer': [
    { id: 'grooming_center', label: 'Visit Center', icon: 'Scissors', enabled: true, serviceStyle: 'at_center' },
    { id: 'grooming_home', label: 'Home Grooming', icon: 'Home', enabled: true, serviceStyle: 'at_home' }
  ]
};

// ✅ SQL: GET UI Config (Customer/Admin)
app.get("/make-server-3dd53475/config/ui/dashboard", async (c) => {
  try {
    const roleId = c.req.query("roleId");
    const uiConfigRepo = getUIConfigRepository();
    
    if (roleId) {
      const config = await uiConfigRepo.findByRole(roleId, 'dashboard');
      const configValue = config?.config_value || DEFAULT_UI_CONFIG[roleId] || [];
      return c.json({ success: true, config: configValue });
    }
    
    // Get all configs
    const allConfigs = await uiConfigRepo.findAll();
    const result: any = {};
    for (const config of allConfigs) {
      if (!result[config.role_id]) {
        result[config.role_id] = [];
      }
      if (config.config_key === 'dashboard') {
        result[config.role_id] = config.config_value;
      }
    }
    
    // Fill in defaults for missing roles
    Object.keys(DEFAULT_UI_CONFIG).forEach(role => {
      if (!result[role]) {
        result[role] = DEFAULT_UI_CONFIG[role];
      }
    });
    
    return c.json({ success: true, config: result });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// ✅ SQL: UPDATE UI Config (Admin)
app.put("/make-server-3dd53475/config/ui/dashboard", async (c) => {
  try {
    const body = await c.req.json(); // Expects { roleId, config: [] }
    const { roleId, config } = body;
    
    if (!roleId || !Array.isArray(config)) {
      return c.json({ success: false, error: "Invalid input" }, 400);
    }
    
    const uiConfigRepo = getUIConfigRepository();
    const updated = await uiConfigRepo.upsert({
      role_id: roleId,
      config_key: 'dashboard',
      config_value: config,
      is_active: true,
    });
    
    // Get all configs for response
    const allConfigs = await uiConfigRepo.findAll();
    const result: any = {};
    for (const cfg of allConfigs) {
      if (cfg.config_key === 'dashboard') {
        result[cfg.role_id] = cfg.config_value;
      }
    }
    
    // Fill in defaults for missing roles
    Object.keys(DEFAULT_UI_CONFIG).forEach(role => {
      if (!result[role]) {
        result[role] = DEFAULT_UI_CONFIG[role];
      }
    });
    
    return c.json({ success: true, config: result });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

export const marketingEndpoints = app;

// Also export as a registration function for direct registration
export function registerMarketingEndpoints(app: Hono) {
  // Register all routes from this module
  app.route('/', marketingEndpoints);
}
