/**
 * 🏥 HEALTH PROBLEM MANAGEMENT ENDPOINTS
 * 
 * Manages pet health problem categories (Surgery, Cardiology, Dermatology, etc.)
 * These categories help customers find specialized doctors/clinics
 * 
 * Architecture:
 * - Dynamic master data (no hardcoding)
 * - Admin-controlled categories
 * - Links to staff specializations
 * - Links to service catalog tags
 */

import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';

const app = new Hono();

/**
 * 🏥 Get all health problems
 */
app.get('/make-server-3dd53475/health-problems', async (c) => {
  try {
    console.log('🏥 [HEALTH-PROBLEMS] Fetching all health problems');
    
    const healthProblems = await kv.getByPrefix('health_problem:');
    
    // Sort by displayOrder
    const sorted = healthProblems.sort((a: any, b: any) => 
      (a.displayOrder || 999) - (b.displayOrder || 999)
    );
    
    // Filter active only by default
    const status = c.req.query('status');
    const filtered = status === 'all' 
      ? sorted 
      : sorted.filter((hp: any) => hp.status === 'active');
    
    console.log(`✅ Found ${filtered.length} health problems (status: ${status || 'active'})`);
    
    return c.json({
      success: true,
      healthProblems: filtered,
      total: filtered.length
    });
  } catch (error) {
    console.error('❌ Error fetching health problems:', error);
    return c.json({ 
      success: false, 
      error: String(error) 
    }, 500);
  }
});

/**
 * 🏥 Get single health problem by ID
 */
app.get('/make-server-3dd53475/health-problems/:id', async (c) => {
  try {
    const id = c.req.param('id');
    console.log(`🏥 [HEALTH-PROBLEMS] Fetching health problem: ${id}`);
    
    const healthProblem = await kv.get(`health_problem:${id}`);
    
    if (!healthProblem) {
      return c.json({ 
        success: false, 
        error: 'Health problem not found' 
      }, 404);
    }
    
    return c.json({
      success: true,
      healthProblem
    });
  } catch (error) {
    console.error('❌ Error fetching health problem:', error);
    return c.json({ 
      success: false, 
      error: String(error) 
    }, 500);
  }
});

/**
 * 🏥 Create new health problem (Admin only)
 */
app.post('/make-server-3dd53475/admin/health-problems', async (c) => {
  try {
    const body = await c.req.json();
    console.log('🏥 [HEALTH-PROBLEMS] Creating new health problem:', body);
    
    const { name, displayName, icon, description, keywords, displayOrder } = body;
    
    // Generate ID from name
    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    
    // Check if already exists
    const existing = await kv.get(`health_problem:${id}`);
    if (existing) {
      return c.json({ 
        success: false, 
        error: 'Health problem with this name already exists' 
      }, 400);
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
    
    await kv.set(`health_problem:${id}`, healthProblem);
    
    console.log(`✅ Created health problem: ${id}`);
    
    return c.json({
      success: true,
      healthProblem
    });
  } catch (error) {
    console.error('❌ Error creating health problem:', error);
    return c.json({ 
      success: false, 
      error: String(error) 
    }, 500);
  }
});

/**
 * 🏥 Update health problem (Admin only)
 */
app.put('/make-server-3dd53475/admin/health-problems/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    console.log(`🏥 [HEALTH-PROBLEMS] Updating health problem: ${id}`, body);
    
    const existing = await kv.get(`health_problem:${id}`);
    if (!existing) {
      return c.json({ 
        success: false, 
        error: 'Health problem not found' 
      }, 404);
    }
    
    const updated = {
      ...existing,
      ...body,
      id, // Preserve ID
      updatedAt: new Date().toISOString()
    };
    
    await kv.set(`health_problem:${id}`, updated);
    
    console.log(`✅ Updated health problem: ${id}`);
    
    return c.json({
      success: true,
      healthProblem: updated
    });
  } catch (error) {
    console.error('❌ Error updating health problem:', error);
    return c.json({ 
      success: false, 
      error: String(error) 
    }, 500);
  }
});

/**
 * 🏥 Delete health problem (Admin only)
 */
app.delete('/make-server-3dd53475/admin/health-problems/:id', async (c) => {
  try {
    const id = c.req.param('id');
    console.log(`🏥 [HEALTH-PROBLEMS] Deleting health problem: ${id}`);
    
    const existing = await kv.get(`health_problem:${id}`);
    if (!existing) {
      return c.json({ 
        success: false, 
        error: 'Health problem not found' 
      }, 404);
    }
    
    // Soft delete by setting status to inactive
    const updated = {
      ...existing,
      status: 'inactive',
      updatedAt: new Date().toISOString()
    };
    
    await kv.set(`health_problem:${id}`, updated);
    
    console.log(`✅ Deleted (soft) health problem: ${id}`);
    
    return c.json({
      success: true,
      message: 'Health problem deleted'
    });
  } catch (error) {
    console.error('❌ Error deleting health problem:', error);
    return c.json({ 
      success: false, 
      error: String(error) 
    }, 500);
  }
});

/**
 * 🌱 Seed initial health problems
 */
app.post('/make-server-3dd53475/admin/health-problems/seed', async (c) => {
  try {
    console.log('🌱 [HEALTH-PROBLEMS] Seeding initial health problems...');
    
    const initialHealthProblems = [
      {
        id: 'surgery',
        name: 'Surgery',
        displayName: 'Surgery & Surgical Care',
        icon: '🔪',
        description: 'Surgical procedures, post-op care, and surgical consultations',
        displayOrder: 1,
        keywords: ['surgery', 'operation', 'surgical', 'post-op', 'pre-op', 'procedure'],
        relatedServiceCategories: ['cat_healthcare'],
        relatedServiceSubCategories: ['sub_surgery']
      },
      {
        id: 'dermatology',
        name: 'Dermatology',
        displayName: 'Skin & Coat Care',
        icon: '🐾',
        description: 'Skin conditions, allergies, coat problems, dermatological issues',
        displayOrder: 2,
        keywords: ['skin', 'dermatology', 'allergy', 'coat', 'rash', 'itch', 'dermatologist'],
        relatedServiceCategories: ['cat_healthcare'],
        relatedServiceSubCategories: ['sub_dermatology']
      },
      {
        id: 'dentistry',
        name: 'Dentistry',
        displayName: 'Dental & Oral Care',
        icon: '🦷',
        description: 'Dental cleaning, tooth problems, oral health, gum disease',
        displayOrder: 3,
        keywords: ['dental', 'dentistry', 'tooth', 'teeth', 'oral', 'gum', 'mouth', 'dentist'],
        relatedServiceCategories: ['cat_healthcare'],
        relatedServiceSubCategories: ['sub_dentistry']
      },
      {
        id: 'ophthalmology',
        name: 'Ophthalmology',
        displayName: 'Eye Care',
        icon: '👁️',
        description: 'Eye problems, vision issues, eye infections, ophthalmological care',
        displayOrder: 4,
        keywords: ['eye', 'ophthalmology', 'vision', 'sight', 'ophthalmologist', 'cataract'],
        relatedServiceCategories: ['cat_healthcare'],
        relatedServiceSubCategories: ['sub_ophthalmology']
      },
      {
        id: 'cardiology',
        name: 'Cardiology',
        displayName: 'Heart & Cardiovascular Care',
        icon: '❤️',
        description: 'Heart conditions, cardiac care, circulation issues, ECG',
        displayOrder: 5,
        keywords: ['heart', 'cardiac', 'cardiology', 'circulation', 'ecg', 'cardiovascular', 'cardiologist'],
        relatedServiceCategories: ['cat_healthcare'],
        relatedServiceSubCategories: ['sub_cardiology']
      },
      {
        id: 'neurology',
        name: 'Neurology',
        displayName: 'Neurological Care',
        icon: '🧠',
        description: 'Neurological conditions, seizures, brain and nervous system issues',
        displayOrder: 6,
        keywords: ['neurology', 'neurological', 'brain', 'seizure', 'nervous', 'neurologist'],
        relatedServiceCategories: ['cat_healthcare'],
        relatedServiceSubCategories: ['sub_neurology']
      },
      {
        id: 'medicine',
        name: 'Medicine',
        displayName: 'General Medicine',
        icon: '💊',
        description: 'General health check-ups, wellness exams, routine care',
        displayOrder: 7,
        keywords: ['medicine', 'general', 'checkup', 'wellness', 'routine', 'health', 'physician'],
        relatedServiceCategories: ['cat_healthcare'],
        relatedServiceSubCategories: ['sub_preventive_wellness', 'sub_general_medicine']
      },
      {
        id: 'emergency',
        name: 'Emergency & Critical Care',
        displayName: 'Emergency & Critical Care',
        icon: '🚨',
        description: 'Emergency services, critical care, urgent medical attention',
        displayOrder: 8,
        keywords: ['emergency', 'critical', 'urgent', 'icu', 'trauma', 'accident'],
        relatedServiceCategories: ['cat_healthcare'],
        relatedServiceSubCategories: ['sub_emergency_care']
      },
      {
        id: 'physiotherapy',
        name: 'Physiotherapy',
        displayName: 'Physiotherapy & Rehabilitation',
        icon: '🏃',
        description: 'Physical therapy, rehabilitation, mobility issues, post-injury care',
        displayOrder: 9,
        keywords: ['physiotherapy', 'physio', 'rehabilitation', 'therapy', 'mobility', 'recovery'],
        relatedServiceCategories: ['cat_healthcare'],
        relatedServiceSubCategories: ['sub_physiotherapy']
      }
    ];
    
    let created = 0;
    let skipped = 0;
    
    for (const hp of initialHealthProblems) {
      const existing = await kv.get(`health_problem:${hp.id}`);
      if (existing) {
        console.log(`⏭️ Skipped existing: ${hp.id}`);
        skipped++;
        continue;
      }
      
      const healthProblem = {
        ...hp,
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      await kv.set(`health_problem:${hp.id}`, healthProblem);
      console.log(`✅ Created: ${hp.id}`);
      created++;
    }
    
    console.log(`🌱 Seeding complete: ${created} created, ${skipped} skipped`);
    
    return c.json({
      success: true,
      message: 'Health problems seeded successfully',
      created,
      skipped,
      total: initialHealthProblems.length
    });
  } catch (error) {
    console.error('❌ Error seeding health problems:', error);
    return c.json({ 
      success: false, 
      error: String(error) 
    }, 500);
  }
});

export default app;
