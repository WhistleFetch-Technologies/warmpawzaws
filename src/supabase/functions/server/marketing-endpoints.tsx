import { Hono } from "npm:hono";
import * as kv from "./kv_store.tsx";

const app = new Hono();

// ==========================================
// 1. PROMOTIONS & MARKETING API
// ==========================================

// GET All Promotions (Admin)
app.get("/marketing/promotions", async (c) => {
  try {
    const promotions = await kv.get("marketing:promotions") || [];
    return c.json({ success: true, promotions });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// CREATE Promotion (Admin)
app.post("/marketing/promotions", async (c) => {
  try {
    const body = await c.req.json();
    const promotions = await kv.get("marketing:promotions") || [];
    
    const newPromotion = {
      id: `promo_${Date.now()}`,
      createdAt: new Date().toISOString(),
      isActive: true,
      ...body
    };
    
    promotions.unshift(newPromotion);
    await kv.set("marketing:promotions", promotions);
    
    return c.json({ success: true, promotion: newPromotion });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// UPDATE Promotion (Admin)
app.put("/marketing/promotions/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const promotions = await kv.get("marketing:promotions") || [];
    
    const index = promotions.findIndex((p: any) => p.id === id);
    if (index === -1) {
      return c.json({ success: false, error: "Promotion not found" }, 404);
    }
    
    promotions[index] = { ...promotions[index], ...body, updatedAt: new Date().toISOString() };
    await kv.set("marketing:promotions", promotions);
    
    return c.json({ success: true, promotion: promotions[index] });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// DELETE Promotion (Admin)
app.delete("/marketing/promotions/:id", async (c) => {
  try {
    const id = c.req.param("id");
    let promotions = await kv.get("marketing:promotions") || [];
    
    promotions = promotions.filter((p: any) => p.id !== id);
    await kv.set("marketing:promotions", promotions);
    
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
    
    const allPromotions = await kv.get("marketing:promotions") || [];
    
    // Filter logic
    const filtered = allPromotions.filter((p: any) => {
      if (!p.isActive) return false;
      
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

// GET UI Config (Customer/Admin)
app.get("/config/ui/dashboard", async (c) => {
  try {
    const roleId = c.req.query("roleId");
    const storedConfig = await kv.get("config:ui:dashboard") || DEFAULT_UI_CONFIG;
    
    if (roleId) {
      return c.json({ success: true, config: storedConfig[roleId] || [] });
    }
    
    return c.json({ success: true, config: storedConfig });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// UPDATE UI Config (Admin)
app.put("/config/ui/dashboard", async (c) => {
  try {
    const body = await c.req.json(); // Expects { roleId, config: [] }
    const { roleId, config } = body;
    
    if (!roleId || !Array.isArray(config)) {
      return c.json({ success: false, error: "Invalid input" }, 400);
    }
    
    const currentConfig = await kv.get("config:ui:dashboard") || DEFAULT_UI_CONFIG;
    currentConfig[roleId] = config;
    
    await kv.set("config:ui:dashboard", currentConfig);
    
    return c.json({ success: true, config: currentConfig });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

export const marketingEndpoints = app;
