/**
 * STAFF SERVICE STYLE SETUP SCRIPT
 * 
 * This script:
 * 1. Creates staff members for all approved vendors (vendor owner becomes default staff)
 * 2. Sets up service style preferences (at_home, at_center, tele) based on vendor's serviceStyles
 * 3. Creates sample services for each staff with proper serviceStyle tags
 * 4. Configures home service settings (maxDistance, travel charges, etc.)
 * 5. Configures tele service settings (video enabled, session duration, etc.)
 * 
 * Can be called via: POST /make-server-3dd53475/admin/setup-staff-service-styles
 */

import { Hono } from 'npm:hono@4';
import * as kv from './kv_store.tsx';

interface StylePreferences {
  staffId: string;
  at_center: {
    enabled: boolean;
    available: boolean;
  };
  at_home: {
    enabled: boolean;
    available: boolean;
    maxDistance: number; // in km
    travelChargePerKm: number; // ₹ per km
    acceptInstantBooking: boolean;
  };
  tele: {
    enabled: boolean;
    available: boolean;
    videoEnabled: boolean;
    chatEnabled: boolean;
    maxSessionDuration: number; // in minutes
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
      maxDistance: 10, // 10 km radius
      travelChargePerKm: 20, // ₹20 per km
      acceptInstantBooking: true
    },
    tele: {
      enabled: hasTele,
      available: hasTele,
      videoEnabled: true,
      chatEnabled: true,
      maxSessionDuration: 45, // 45 minutes max
      acceptInstantBooking: false // Tele requires scheduling
    },
    autoAcceptBookings: false, // Manual approval by default
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

/**
 * Create staff member from vendor profile
 */
async function createStaffFromVendor(vendor: any): Promise<string> {
  const staffId = generateId('staff');
  
  const staffMember = {
    id: staffId,
    staffId: staffId,
    vendorId: vendor.id || vendor.vendorId,
    
    // Personal Info
    fullName: vendor.fullName,
    phone: vendor.phone,
    email: vendor.email,
    photo: vendor.profilePhoto || null,
    
    // Role Information
    roleType: vendor.roleId,
    roleName: vendor.roleName,
    
    // Specializations (if any from vendor)
    specializations: vendor.specializations || [],
    
    // Experience
    experienceYears: parseInt(vendor.experience) || 0,
    qualifications: vendor.qualifications || [],
    
    // Status
    isActive: true,
    isOnline: false,
    status: 'active',
    
    // Location (inherit from vendor)
    lastKnownLocation: vendor.coordinates ? {
      latitude: vendor.coordinates.lat,
      longitude: vendor.coordinates.lng,
      address: vendor.address,
      updatedAt: new Date().toISOString()
    } : null,
    
    // Stats
    rating: vendor.rating || 4.5,
    reviewCount: vendor.totalReviews || 0,
    completedBookings: vendor.completedBookings || 0,
    
    // Metadata
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: 'system_setup'
  };
  
  // Save staff member
  await kv.set(`staff:${staffId}`, staffMember);
  
  // Create indexes
  const cleanPhone = vendor.phone.replace(/[^0-9]/g, '');
  await kv.set(`staff:phone:${cleanPhone}`, staffId);
  
  // Add to vendor's staff list
  const vendorStaffKey = `vendor:${vendor.id || vendor.vendorId}:staff`;
  const vendorStaff = await kv.get(vendorStaffKey) || [];
  if (!vendorStaff.includes(staffId)) {
    vendorStaff.push(staffId);
    await kv.set(vendorStaffKey, vendorStaff);
  }
  
  console.log(`  ✅ Created staff: ${staffId} (${staffMember.fullName})`);
  
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
    // Check which service styles are both enabled for staff and supported by service
    const applicableStyles = template.serviceStyles.filter((style: string) => 
      enabledStyles.includes(style)
    );
    
    // Create a service for each applicable style
    for (const serviceStyle of applicableStyles) {
      const serviceId = generateId('service');
      
      const service = {
        id: serviceId,
        serviceId: serviceId,
        staffId: staffId,
        vendorId: vendorId,
        
        // Service Details
        serviceName: template.serviceName,
        categoryName: template.categoryName,
        subCategoryName: template.subCategoryName,
        description: template.description,
        
        // Pricing & Duration
        price: template.price,
        duration: template.duration,
        
        // Service Style - CRITICAL!
        serviceStyle: serviceStyle,
        
        // Status
        isActive: true,
        isAvailable: true,
        
        // Metadata
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'system_setup'
      };
      
      await kv.set(`staff:${staffId}:service:${serviceId}`, service);
      servicesCreated++;
    }
  }
  
  console.log(`  ✅ Created ${servicesCreated} services for staff ${staffId}`);
  
  return servicesCreated;
}

export function staffServiceStyleSetupEndpoints(app: Hono) {
  
  /**
   * POST /make-server-3dd53475/admin/setup-staff-service-styles
   * 
   * Initialize the system with staff members and service style configurations
   * This endpoint:
   * 1. Finds all approved vendors
   * 2. Creates staff members for vendors that don't have staff
   * 3. Sets up service style preferences
   * 4. Creates sample services with proper service styles
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
      
      // Step 1: Get all approved vendors
      const allVendors = await kv.getByPrefix('vendor:vendor_');
      const approvedVendors = allVendors.filter((v: any) => v.applicationStatus === 'approved');
      
      console.log(`📊 Found ${approvedVendors.length} approved vendors`);
      
      // Step 2: Process each vendor
      for (const vendor of approvedVendors) {
        try {
          console.log(`\n📦 Processing: ${vendor.fullName} (${vendor.roleId})`);
          results.vendorsProcessed++;
          
          // Check if vendor already has staff
          const vendorStaffKey = `vendor:${vendor.id || vendor.vendorId}:staff`;
          let vendorStaff = await kv.get(vendorStaffKey) || [];
          
          let staffId: string;
          
          if (vendorStaff.length === 0) {
            // Create staff member from vendor
            console.log(`  🆕 No staff found, creating staff member...`);
            staffId = await createStaffFromVendor(vendor);
            results.staffCreated++;
          } else {
            // Use existing staff
            staffId = vendorStaff[0];
            console.log(`  ℹ️  Using existing staff: ${staffId}`);
            results.staffUpdated++;
          }
          
          // Step 3: Get or create style preferences
          const prefsKey = `staff:${staffId}:style_preferences`;
          let existingPrefs = await kv.get(prefsKey);
          
          if (!existingPrefs) {
            console.log(`  🔧 Creating service style preferences...`);
            
            // Determine which styles to enable based on vendor's serviceStyles
            const vendorStyles = vendor.serviceStyles || [vendor.serviceStyle || 'at_center'];
            const preferences = createStylePreferences(staffId, vendorStyles);
            
            await kv.set(prefsKey, preferences);
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
                vendor.id || vendor.vendorId,
                vendor.roleId,
                enabledStyles
              );
              results.servicesCreated += servicesCreated;
            }
          } else {
            console.log(`  ℹ️  Style preferences already exist, skipping...`);
          }
          
        } catch (error) {
          console.error(`❌ Error processing vendor ${vendor.fullName}:`, error);
          results.errors.push({
            vendor: vendor.fullName,
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
      const allStaff = await kv.getByPrefix('staff:staff_');
      
      const stats = {
        totalStaff: allStaff.length,
        withPreferences: 0,
        withoutPreferences: 0,
        byStyle: {
          at_center: 0,
          at_home: 0,
          tele: 0
        },
        byRole: {} as Record<string, any>
      };
      
      for (const staff of allStaff) {
        const prefs = await kv.get(`staff:${staff.id}:style_preferences`);
        
        if (prefs) {
          stats.withPreferences++;
          
          if (prefs.at_center?.enabled) stats.byStyle.at_center++;
          if (prefs.at_home?.enabled) stats.byStyle.at_home++;
          if (prefs.tele?.enabled) stats.byStyle.tele++;
        } else {
          stats.withoutPreferences++;
        }
        
        // Track by role
        const roleType = staff.roleType;
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
}

export default staffServiceStyleSetupEndpoints;
