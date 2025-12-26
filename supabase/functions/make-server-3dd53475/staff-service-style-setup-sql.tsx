/**
 * ============================================================================
 * STAFF SERVICE STYLE SETUP SCRIPT - SQL-ONLY VERSION
 * ============================================================================
 * 
 * ✅ SQL-ONLY: Removed all KV usage, using SQL repositories only
 * 
 * This script:
 * 1. Creates staff members for all approved vendors (vendor owner becomes default staff)
 * 2. Sets up service style preferences (at_home, at_center, tele) based on vendor's serviceStyles
 * 3. Creates sample services for each staff with proper serviceStyle tags
 * 4. Configures home service settings (maxDistance, travel charges, etc.)
 * 5. Configures tele service settings (video enabled, session duration, etc.)
 * 
 * CHANGES:
 * - Removed `kv` imports
 * - Replaced all `kv.get()`, `kv.set()`, `kv.getByPrefix()` with SQL queries
 * - Uses `vendors`, `staff`, `staff_services` tables
 * - Uses `platform_settings` for style preferences
 * 
 * Date: 2025-01-28
 * Migration: Batch 15 - KV to SQL (11 KV operations removed)
 * ============================================================================
 */

import { Hono } from 'npm:hono@4';
import { getVendorsRepository } from '../../lib/repositories/vendors.ts';
import { getStaffRepository } from '../../lib/repositories/staff.ts';
import { getDbClient } from '../../lib/db.ts';

const db = getDbClient();
const vendorsRepo = getVendorsRepository();
const staffRepo = getStaffRepository();

interface StylePreferences {
  staffId: string;
  at_center: {
    enabled: boolean;
    available: boolean;
  };
  at_home: {
    enabled: boolean;
    available: boolean;
    maxDistance: number;
    acceptInstantBooking: boolean;
  };
  tele: {
    enabled: boolean;
    available: boolean;
    videoEnabled: boolean;
    chatEnabled: boolean;
    maxSessionDuration: number;
    acceptInstantBooking: boolean;
  };
  autoAcceptBookings: boolean;
  createdAt: string;
  updatedAt: string;
}

// Sample services by role type with service styles
const SAMPLE_SERVICES_BY_ROLE: Record<string, any[]> = {
  veterinarian: [
    {
      serviceName: 'General Checkup',
      categoryName: 'Veterinary',
      subCategoryName: 'Consultation',
      price: 500,
      duration: 30,
      description: 'Complete health checkup',
      serviceStyles: ['at_center', 'at_home', 'tele']
    },
    {
      serviceName: 'Vaccination',
      categoryName: 'Veterinary',
      subCategoryName: 'Preventive Care',
      price: 800,
      duration: 20,
      description: 'Pet vaccination service',
      serviceStyles: ['at_center', 'at_home']
    },
    {
      serviceName: 'Emergency Consultation',
      categoryName: 'Veterinary',
      subCategoryName: 'Emergency',
      price: 1200,
      duration: 45,
      description: '24/7 emergency vet care',
      serviceStyles: ['at_center', 'at_home']
    }
  ],
  pet_groomer: [
    {
      serviceName: 'Basic Grooming',
      categoryName: 'Grooming',
      subCategoryName: 'Basic Care',
      price: 600,
      duration: 60,
      description: 'Bath, brush, nail trim',
      serviceStyles: ['at_center', 'at_home']
    },
    {
      serviceName: 'Full Grooming Package',
      categoryName: 'Grooming',
      subCategoryName: 'Premium Care',
      price: 1200,
      duration: 90,
      description: 'Complete grooming with styling',
      serviceStyles: ['at_center', 'at_home']
    }
  ],
  pet_trainer: [
    {
      serviceName: 'Basic Obedience Training',
      categoryName: 'Training',
      subCategoryName: 'Obedience',
      price: 1500,
      duration: 60,
      description: 'Basic commands training',
      serviceStyles: ['at_center', 'at_home']
    },
    {
      serviceName: 'Behavioral Consultation',
      categoryName: 'Training',
      subCategoryName: 'Behavior',
      price: 2000,
      duration: 45,
      description: 'Address behavioral issues',
      serviceStyles: ['tele', 'at_center', 'at_home']
    }
  ],
  pet_walker: [
    {
      serviceName: 'Daily Walk (30 min)',
      categoryName: 'Walking',
      subCategoryName: 'Regular Walk',
      price: 300,
      duration: 30,
      description: 'Daily neighborhood walk',
      serviceStyles: ['at_home']
    },
    {
      serviceName: 'Extended Walk (60 min)',
      categoryName: 'Walking',
      subCategoryName: 'Extended Walk',
      price: 500,
      duration: 60,
      description: 'Longer walk with playtime',
      serviceStyles: ['at_home']
    }
  ],
  pet_boarder: [
    {
      serviceName: 'Day Boarding',
      categoryName: 'Boarding',
      subCategoryName: 'Day Care',
      price: 800,
      duration: 480,
      description: 'Full day pet care',
      serviceStyles: ['at_center']
    },
    {
      serviceName: 'Overnight Boarding',
      categoryName: 'Boarding',
      subCategoryName: 'Night Care',
      price: 1500,
      duration: 1440,
      description: 'Overnight pet boarding',
      serviceStyles: ['at_center']
    }
  ],
  pet_photographer: [
    {
      serviceName: 'Pet Portrait Session',
      categoryName: 'Photography',
      subCategoryName: 'Portrait',
      price: 3000,
      duration: 120,
      description: 'Professional pet photo session',
      serviceStyles: ['at_center', 'at_home']
    }
  ],
  pet_behaviourist: [
    {
      serviceName: 'Behavioral Assessment',
      categoryName: 'Behavior',
      subCategoryName: 'Assessment',
      price: 2500,
      duration: 60,
      description: 'Complete behavioral evaluation',
      serviceStyles: ['at_center', 'at_home', 'tele']
    }
  ]
};

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
}

/**
 * Create default style preferences based on vendor's service styles
 */
function createStylePreferences(
  staffId: string,
  vendorServiceStyles: string[]
): StylePreferences {
  const hasAtHome = vendorServiceStyles.includes('at_home') || vendorServiceStyles.includes('both');
  const hasAtCenter = vendorServiceStyles.includes('at_center') || vendorServiceStyles.includes('both');
  const hasTele = vendorServiceStyles.includes('tele') || vendorServiceStyles.includes('both');

  return {
    staffId,
    at_center: {
      enabled: hasAtCenter,
      available: hasAtCenter
    },
    at_home: {
      enabled: hasAtHome,
      available: hasAtHome,
      maxDistance: 10,
      acceptInstantBooking: true
    },
    tele: {
      enabled: hasTele,
      available: hasTele,
      videoEnabled: true,
      chatEnabled: true,
      maxSessionDuration: 45,
      acceptInstantBooking: false
    },
    autoAcceptBookings: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

/**
 * Create staff member from vendor profile
 */
async function createStaffFromVendor(vendor: any): Promise<string> {
  const staffId = generateId('staff');
  const now = new Date().toISOString();
  
  // ✅ SQL: Create staff member
  const { data: staff, error } = await db
    .from('staff')
    .insert({
      id: staffId,
      vendor_id: vendor.id,
      name: vendor.owner_name || vendor.business_name,
      phone: vendor.phone,
      email: vendor.email,
      role: vendor.role_id || 'owner',
      experience_years: vendor.experience_years || 0,
      is_active: true
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create staff: ${error.message}`);
  }
  
  console.log(`  ✅ Created staff: ${staffId} (${staff.name})`);
  
  return staffId;
}

/**
 * Create sample services for staff member
 */
async function createServicesForStaff(
  staffId: string,
  vendorId: string,
  roleType: string,
  enabledStyles: string[]
): Promise<number> {
  const sampleServices = SAMPLE_SERVICES_BY_ROLE[roleType] || [];
  let servicesCreated = 0;
  
  for (const template of sampleServices) {
    const applicableStyles = template.serviceStyles.filter((style: string) => 
      enabledStyles.includes(style)
    );
    
    for (const serviceStyle of applicableStyles) {
      const serviceId = generateId('service');
      const now = new Date().toISOString();
      
      // ✅ SQL: Create service
      const { error } = await db
        .from('staff_services')
        .insert({
          id: serviceId,
          staff_id: staffId,
          vendor_id: vendorId,
          service_name: template.serviceName,
          category: template.categoryName,
          sub_category: template.subCategoryName,
          price: template.price,
          duration_minutes: template.duration,
          service_style: serviceStyle,
          is_active: true
        });

      if (!error) {
        servicesCreated++;
      }
    }
  }
  
  console.log(`  ✅ Created ${servicesCreated} services for staff ${staffId}`);
  
  return servicesCreated;
}

export function staffServiceStyleSetupEndpointsSQL(app: Hono) {
  
  /**
   * POST /make-server-3dd53475/admin/setup-staff-service-styles
   * 
   * Initialize the system with staff members and service style configurations
   */
  app.post('/make-server-3dd53475/admin/setup-staff-service-styles', async (c) => {
    try {
      console.log('\n🚀 ========== STAFF SERVICE STYLE SETUP ==========\n');
      
      const results = {
        vendorsProcessed: 0,
        staffCreated: 0,
        staffUpdated: 0,
        preferencesCreated: 0,
        servicesCreated: 0,
        errors: [] as any[]
      };
      
      // ✅ SQL: Get all approved vendors
      const { data: vendors } = await db
        .from('vendors')
        .select('*')
        .eq('status', 'approved')
        .eq('is_active', true);
      
      console.log(`📊 Found ${vendors?.length || 0} approved vendors`);
      
      // Step 2: Process each vendor
      for (const vendor of vendors || []) {
        try {
          console.log(`\n📦 Processing: ${vendor.business_name} (${vendor.role_id})`);
          results.vendorsProcessed++;
          
          // ✅ SQL: Check if vendor already has staff
          const { data: existingStaff } = await db
            .from('staff')
            .select('id')
            .eq('vendor_id', vendor.id)
            .limit(1);
          
          let staffId: string;
          
          if (!existingStaff || existingStaff.length === 0) {
            // Create staff member from vendor
            console.log(`  🆕 No staff found, creating staff member...`);
            staffId = await createStaffFromVendor(vendor);
            results.staffCreated++;
          } else {
            // Use existing staff
            staffId = existingStaff[0].id;
            console.log(`  ℹ️  Using existing staff: ${staffId}`);
            results.staffUpdated++;
          }
          
          // Step 3: Get or create style preferences
          const { data: prefsSetting } = await db
            .from('platform_settings')
            .select('value')
            .eq('key', `staff:${staffId}:style_preferences`)
            .single();
          
          if (!prefsSetting) {
            console.log(`  🔧 Creating service style preferences...`);
            
            // Determine which styles to enable based on vendor's serviceStyles
            const vendorMetadata = vendor.metadata || {};
            const vendorStyles = vendorMetadata.serviceStyles || [vendorMetadata.serviceStyle || 'at_center'];
            const preferences = createStylePreferences(staffId, vendorStyles);
            
            // ✅ SQL: Store preferences
            await db
              .from('platform_settings')
              .upsert({
                key: `staff:${staffId}:style_preferences`,
                value: preferences
              }, {
                onConflict: 'key'
              });

            console.log(`  ✅ Style preferences created:`, {
              at_center: preferences.at_center.enabled,
              at_home: preferences.at_home.enabled,
              tele: preferences.tele.enabled
            });
            
            results.preferencesCreated++;
            
            // Step 4: Create sample services
            const enabledStyles = [];
            if (preferences.at_center.enabled) enabledStyles.push('at_center');
            if (preferences.at_home.enabled) enabledStyles.push('at_home');
            if (preferences.tele.enabled) enabledStyles.push('tele');
            
            if (enabledStyles.length > 0) {
              console.log(`  🛠️  Creating sample services for styles: ${enabledStyles.join(', ')}`);
              const servicesCreated = await createServicesForStaff(
                staffId,
                vendor.id,
                vendor.role_id || 'veterinarian',
                enabledStyles
              );
              results.servicesCreated += servicesCreated;
            }
          } else {
            console.log(`  ℹ️  Style preferences already exist, skipping...`);
          }
          
        } catch (error) {
          console.error(`❌ Error processing vendor ${vendor.business_name}:`, error);
          results.errors.push({
            vendor: vendor.business_name,
            error: String(error)
          });
        }
      }
      
      console.log('\n✅ ========== SETUP COMPLETE ==========');
      console.log(`📊 Vendors processed: ${results.vendorsProcessed}`);
      console.log(`🆕 Staff created: ${results.staffCreated}`);
      console.log(`🔄 Staff updated: ${results.staffUpdated}`);
      console.log(`⚙️  Preferences created: ${results.preferencesCreated}`);
      console.log(`📋 Services created: ${results.servicesCreated}`);
      
      if (results.errors.length > 0) {
        console.log(`\n⚠️  Errors encountered: ${results.errors.length}`);
        results.errors.forEach(e => {
          console.log(`  - ${e.vendor}: ${e.error}`);
        });
      }
      
      return c.json({
        success: true,
        message: 'Staff service style setup complete',
        results
      });
      
    } catch (error) {
      console.error('❌ Setup failed:', error);
      return c.json({ 
        success: false, 
        error: String(error) 
      }, 500);
    }
  });
  
  /**
   * GET /make-server-3dd53475/admin/staff-style-status
   * 
   * Get status of staff service style configuration across the system
   */
  app.get('/make-server-3dd53475/admin/staff-style-status', async (c) => {
    try {
      // ✅ SQL: Get all staff
      const { data: allStaff } = await db
        .from('staff')
        .select('id, role, vendor_id');
      
      const stats = {
        totalStaff: allStaff?.length || 0,
        withPreferences: 0,
        withoutPreferences: 0,
        byStyle: {
          at_center: 0,
          at_home: 0,
          tele: 0
        },
        byRole: {} as Record<string, any>
      };
      
      for (const staff of allStaff || []) {
        // ✅ SQL: Get preferences
        const { data: prefsSetting } = await db
          .from('platform_settings')
          .select('value')
          .eq('key', `staff:${staff.id}:style_preferences`)
          .single();
        
        const prefs = prefsSetting?.value;
        
        if (prefs) {
          stats.withPreferences++;
          
          if (prefs.at_center?.enabled) stats.byStyle.at_center++;
          if (prefs.at_home?.enabled) stats.byStyle.at_home++;
          if (prefs.tele?.enabled) stats.byStyle.tele++;
        } else {
          stats.withoutPreferences++;
        }
        
        // Track by role
        const roleType = staff.role;
        if (!stats.byRole[roleType]) {
          stats.byRole[roleType] = {
            total: 0,
            withPreferences: 0,
            at_center: 0,
            at_home: 0,
            tele: 0
          };
        }
        
        stats.byRole[roleType].total++;
        if (prefs) {
          stats.byRole[roleType].withPreferences++;
          if (prefs.at_center?.enabled) stats.byRole[roleType].at_center++;
          if (prefs.at_home?.enabled) stats.byRole[roleType].at_home++;
          if (prefs.tele?.enabled) stats.byRole[roleType].tele++;
        }
      }
      
      return c.json({
        success: true,
        stats
      });
    } catch (error) {
      console.error('❌ Failed to get status:', error);
      return c.json({ 
        success: false, 
        error: String(error) 
      }, 500);
    }
  });

  console.log('✅ Staff Service Style Setup endpoints (SQL-only) registered');
}

export default staffServiceStyleSetupEndpointsSQL;

