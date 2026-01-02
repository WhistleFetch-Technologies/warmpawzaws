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

// ✅ SQL MIGRATION: All KV operations replaced with SQL repositories
import { Hono } from 'hono';
import { getDbClient } from '../../../supabase/lib/db';

const app = new Hono();

/**
 * 🏥 Get all health problems
 */
app.get('/make-server-3dd53475/health-problems', async (c) => {
  try {
    console.log('🏥 [HEALTH-PROBLEMS] Fetching all health problems');
    
    // ✅ SQL: Get health problems from health_problems table
    const db = getDbClient();
    const status = c.req.query('status');
    
    const query = db
      .from('health_problems')
      .select('*')
      .order('display_order', { ascending: true });
    
    if (status !== 'all') {
      query.eq('status', 'active');
    }
    
    const { data: filtered } = await query;
    
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
    
    // ✅ SQL: Get health problem from health_problems table
    const db = getDbClient();
    const { data: healthProblem } = await db
      .from('health_problems')
      .select('*')
      .eq('id', id)
      .single();
    
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
    
    // ✅ SQL: Check if already exists in health_problems table
    const db = getDbClient();
    const { data: existing } = await db
      .from('health_problems')
      .select('id')
      .eq('id', id)
      .single();
    
    if (existing) {
      return c.json({ 
        success: false, 
        error: 'Health problem with this name already exists' 
      }, 400);
    }
    
    // ✅ SQL: Create health problem in health_problems table
    const { data: healthProblem } = await db
      .from('health_problems')
      .insert({
        id,
        name,
        display_name: displayName || name,
        icon: icon || '🏥',
        description: description || '',
        display_order: displayOrder || 999,
        status: 'active',
        keywords: keywords || [],
        related_service_categories: [],
        related_service_sub_categories: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();
    
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
    
    // ✅ SQL: Get and update health problem in health_problems table
    const db = getDbClient();
    const { data: existing } = await db
      .from('health_problems')
      .select('*')
      .eq('id', id)
      .single();
    
    if (!existing) {
      return c.json({ 
        success: false, 
        error: 'Health problem not found' 
      }, 404);
    }
    
    const updateData: any = {
      updated_at: new Date().toISOString()
    };
    
    if (body.name) updateData.name = body.name;
    if (body.displayName) updateData.display_name = body.displayName;
    if (body.icon) updateData.icon = body.icon;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.displayOrder !== undefined) updateData.display_order = body.displayOrder;
    if (body.status) updateData.status = body.status;
    if (body.keywords) updateData.keywords = body.keywords;
    if (body.relatedServiceCategories) updateData.related_service_categories = body.relatedServiceCategories;
    if (body.relatedServiceSubCategories) updateData.related_service_sub_categories = body.relatedServiceSubCategories;
    
    const { data: updated } = await db
      .from('health_problems')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
    
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
    
    // ✅ SQL: Soft delete health problem (set status to inactive) in health_problems table
    const db = getDbClient();
    const { data: existing } = await db
      .from('health_problems')
      .select('id')
      .eq('id', id)
      .single();
    
    if (!existing) {
      return c.json({ 
        success: false, 
        error: 'Health problem not found' 
      }, 404);
    }
    
    await db
      .from('health_problems')
      .update({ status: 'inactive', updated_at: new Date().toISOString() })
      .eq('id', id);
    
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
    
    // ✅ SQL: Seed health problems in health_problems table
    const db = getDbClient();
    
    for (const hp of initialHealthProblems) {
      const { data: existing } = await db
        .from('health_problems')
        .select('id')
        .eq('id', hp.id)
        .single();
      
      if (existing) {
        console.log(`⏭️ Skipped existing: ${hp.id}`);
        skipped++;
        continue;
      }
      
      await db
        .from('health_problems')
        .insert({
          id: hp.id,
          name: hp.name,
          display_name: hp.displayName,
          icon: hp.icon,
          description: hp.description,
          display_order: hp.displayOrder,
          status: 'active',
          keywords: hp.keywords,
          related_service_categories: hp.relatedServiceCategories,
          related_service_sub_categories: hp.relatedServiceSubCategories,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      
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
