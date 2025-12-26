/**
 * ============================================================================
 * HEALTH PROBLEM MANAGEMENT ENDPOINTS - SQL-ONLY VERSION
 * ============================================================================
 * 
 * ✅ SQL-ONLY: Removed all KV usage, using SQL repositories only
 * 
 * Manages pet health problem categories (Surgery, Cardiology, Dermatology, etc.)
 * These categories help customers find specialized doctors/clinics
 * 
 * CHANGES:
 * - Removed `kv` imports
 * - Replaced all `kv.get()`, `kv.set()`, `kv.getByPrefix()` with SQL queries
 * - Uses `platform_settings` table (JSONB) for health problem storage
 * 
 * Date: 2025-01-28
 * Migration: Batch 16 - KV to SQL (10 KV operations removed)
 * ============================================================================
 */

import { Hono } from 'npm:hono';
import { getDbClient } from '../../lib/db.ts';

const app = new Hono();
const db = getDbClient();

// Helper to get all health problems from platform_settings
async function getAllHealthProblems(): Promise<any[]> {
  const { data, error } = await db
    .from('platform_settings')
    .select('setting_value')
    .eq('setting_key', 'health_problems_master')
    .single();
  
  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching health problems:', error);
    return [];
  }
  
  return data?.setting_value?.problems || [];
}

// Helper to save all health problems to platform_settings
async function saveHealthProblems(problems: any[]): Promise<void> {
  await db
    .from('platform_settings')
    .upsert({
      setting_key: 'health_problems_master',
      setting_value: { problems },
      setting_type: 'object'
    }, {
      onConflict: 'setting_key'
    });
}

/**
 * 🏥 Get all health problems
 */
app.get('/make-server-3dd53475/health-problems', async (c) => {
  try {
    const status = c.req.query('status');
    
    let healthProblems = await getAllHealthProblems();
    
    // Sort by displayOrder
    healthProblems.sort((a: any, b: any) => 
      (a.displayOrder || 999) - (b.displayOrder || 999)
    );
    
    // Filter active only by default
    const filtered = status === 'all' 
      ? healthProblems 
      : healthProblems.filter((hp: any) => hp.status === 'active');
    
    return c.json({
      success: true,
      healthProblems: filtered,
      total: filtered.length
    });
  } catch (error) {
    console.error('❌ Error fetching health problems:', error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

/**
 * 🏥 Get single health problem by ID
 */
app.get('/make-server-3dd53475/health-problems/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const healthProblems = await getAllHealthProblems();
    const healthProblem = healthProblems.find((hp: any) => hp.id === id);
    
    if (!healthProblem) {
      return c.json({ success: false, error: 'Health problem not found' }, 404);
    }
    
    return c.json({ success: true, healthProblem });
  } catch (error) {
    console.error('❌ Error fetching health problem:', error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

/**
 * 🏥 Create new health problem (Admin only)
 */
app.post('/make-server-3dd53475/admin/health-problems', async (c) => {
  try {
    const body = await c.req.json();
    const { name, displayName, icon, description, keywords, displayOrder } = body;
    
    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    
    let healthProblems = await getAllHealthProblems();
    const existing = healthProblems.find((hp: any) => hp.id === id);
    
    if (existing) {
      return c.json({ success: false, error: 'Health problem with this name already exists' }, 400);
    }
    
    const healthProblem = {
      id,
      name,
      displayName: displayName || name,
      icon: icon || '🏥',
      description: description || '',
      displayOrder: displayOrder || 999,
      status: 'active',
      keywords: keywords || [],
      relatedServiceCategories: [],
      relatedServiceSubCategories: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    healthProblems.push(healthProblem);
    await saveHealthProblems(healthProblems);
    
    return c.json({ success: true, healthProblem });
  } catch (error) {
    console.error('❌ Error creating health problem:', error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

/**
 * 🏥 Update health problem (Admin only)
 */
app.put('/make-server-3dd53475/admin/health-problems/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    
    let healthProblems = await getAllHealthProblems();
    const index = healthProblems.findIndex((hp: any) => hp.id === id);
    
    if (index === -1) {
      return c.json({ success: false, error: 'Health problem not found' }, 404);
    }
    
    healthProblems[index] = {
      ...healthProblems[index],
      ...body,
      id,
      updatedAt: new Date().toISOString()
    };
    
    await saveHealthProblems(healthProblems);
    
    return c.json({ success: true, healthProblem: healthProblems[index] });
  } catch (error) {
    console.error('❌ Error updating health problem:', error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

/**
 * 🏥 Delete health problem (Admin only)
 */
app.delete('/make-server-3dd53475/admin/health-problems/:id', async (c) => {
  try {
    const id = c.req.param('id');
    
    let healthProblems = await getAllHealthProblems();
    const filtered = healthProblems.filter((hp: any) => hp.id !== id);
    
    if (filtered.length === healthProblems.length) {
      return c.json({ success: false, error: 'Health problem not found' }, 404);
    }
    
    await saveHealthProblems(filtered);
    
    return c.json({ success: true, message: 'Health problem deleted' });
  } catch (error) {
    console.error('❌ Error deleting health problem:', error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

console.log('✅ Health Problem Endpoints (SQL-only) registered');

export default app;

