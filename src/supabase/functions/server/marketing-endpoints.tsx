// ✅ SQL MIGRATION: All KV operations replaced with SQL repositories
import { Hono } from "hono";
import { getDbClient } from '../../../supabase/lib/db';
import { getPromotionsRepository } from '../../../supabase/lib/repositories/index';

const app = new Hono();

// ==========================================
// 1. PROMOTIONS & MARKETING API
// ==========================================

// ✅ SQL: GET All Promotions (Admin)
app.get("/marketing/promotions", async (c) => {
  try {
    const promotionsRepo = getPromotionsRepository();
    const promotions = await promotionsRepo.findAll();
    return c.json({ success: true, promotions });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// ✅ SQL: CREATE Promotion (Admin)
app.post("/marketing/promotions", async (c) => {
  try {
    const body = await c.req.json();
    const promotionsRepo = getPromotionsRepository();
    
    const newPromotion = await promotionsRepo.create({
      ...body,
      is_active: true,
      created_at: new Date().toISOString()
    });
    
    return c.json({ success: true, promotion: newPromotion });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// ✅ SQL: UPDATE Promotion (Admin)
app.put("/marketing/promotions/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const promotionsRepo = getPromotionsRepository();
    
    const existing = await promotionsRepo.findById(id);
    if (!existing) {
      return c.json({ success: false, error: "Promotion not found" }, 404);
    }
    
    const updated = await promotionsRepo.update(id, {
      ...body,
      updated_at: new Date().toISOString()
    });
    
    return c.json({ success: true, promotion: updated });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// ✅ SQL: DELETE Promotion (Admin)
app.delete("/marketing/promotions/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const promotionsRepo = getPromotionsRepository();
    
    await promotionsRepo.delete(id);
    
    return c.json({ success: true, message: "Deleted successfully" });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// GET Targeted Promotions (Customer)
// Query params: roleId, lat, lon, city, region
app.get("/customer/marketing/promotions", async (c) => {
  try {
    const roleId = c.req.query("roleId");
    const serviceStyle = c.req.query("serviceStyle");
    const lat = c.req.query("lat");
    const lon = c.req.query("lon");
    
    // ✅ SQL: Get all active promotions
    const promotionsRepo = getPromotionsRepository();
    const allPromotions = await promotionsRepo.findAll();
    
    // Filter logic
    const filtered = allPromotions.filter((p: any) => {
      if (!p.is_active && !p.isActive) return false;
      
      // Role Filter
      if (p.serviceCategory && p.serviceCategory !== 'all' && p.serviceCategory !== roleId) return false;
      
      // Style Filter
      if (p.serviceStyle && p.serviceStyle !== 'all' && serviceStyle && p.serviceStyle !== serviceStyle) return false;
      
      // TODO: Add Geo filtering logic here when we have a robust geo service
      // For now, assume global or manually checked by city string match if provided
      
      return true;
    });
    
    return c.json({ success: true, promotions: filtered });
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
app.get("/config/ui/dashboard", async (c) => {
  try {
    const roleId = c.req.query("roleId");
    const db = getDbClient();
    
    // Get UI config from platform_settings
    const { data: settings } = await db
      .from('platform_settings')
      .select('*')
      .eq('key', 'ui_dashboard_config')
      .single();
    
    const storedConfig = settings?.value || DEFAULT_UI_CONFIG;
    
    if (roleId) {
      return c.json({ success: true, config: storedConfig[roleId] || [] });
    }
    
    return c.json({ success: true, config: storedConfig });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// ✅ SQL: UPDATE UI Config (Admin)
app.put("/config/ui/dashboard", async (c) => {
  try {
    const body = await c.req.json(); // Expects { roleId, config: [] }
    const { roleId, config } = body;
    
    if (!roleId || !Array.isArray(config)) {
      return c.json({ success: false, error: "Invalid input" }, 400);
    }
    
    const db = getDbClient();
    
    // Get current config
    const { data: existing } = await db
      .from('platform_settings')
      .select('*')
      .eq('key', 'ui_dashboard_config')
      .single();
    
    const currentConfig = existing?.value || DEFAULT_UI_CONFIG;
    currentConfig[roleId] = config;
    
    // Upsert UI config
    await db
      .from('platform_settings')
      .upsert({
        key: 'ui_dashboard_config',
        value: currentConfig,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'key'
      });
    
    return c.json({ success: true, config: currentConfig });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

export const marketingEndpoints = app;
