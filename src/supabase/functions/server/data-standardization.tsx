/**
 * =====================================================
 * DATA STANDARDIZATION & MIGRATION UTILITIES
 * =====================================================
 * 
 * PERMANENT FIX: Ensures consistent data structure across entire platform
 * 
 * CRITICAL FIELDS:
 * 1. Vendors MUST have: roleId (not role_type, role, or roleType)
 * 2. Services MUST have: id, catalogId, applicableRoles[]
 * 3. All role references use standardized role IDs from platform:settings:roles
 * 
 * USE CASES:
 * - Migrate existing data to new structure
 * - Validate new data on creation
 * - Standardize data on read operations
 */

import type { Hono } from "npm:hono@4.6.14";
import * as kv from "./kv_store.tsx";

export function registerDataStandardization(app: Hono) {
  
  /**
   * ========================================
   * VENDOR DATA STANDARDIZATION
   * ========================================
   */
  
  /**
   * Standardize vendor object - ensures roleId exists
   */
  function standardizeVendor(vendor: any): any {
    if (!vendor) return vendor;
    
    // Ensure roleId exists (primary field)
    if (!vendor.roleId) {
      vendor.roleId = vendor.role_type || vendor.role || vendor.roleType || 'pet_groomer';
    }
    
    // Keep legacy fields for backwards compatibility
    vendor.role_type = vendor.roleId;
    vendor.role = vendor.roleId;
    vendor.roleType = vendor.roleId;
    
    return vendor;
  }
  
  /**
   * ========================================
   * SERVICE DATA STANDARDIZATION
   * ========================================
   */
  
  /**
   * Standardize service object - ensures id, catalogId, applicableRoles exist
   */
  function standardizeService(service: any, index?: number): any {
    if (!service) return service;
    
    // Ensure id exists
    if (!service.id) {
      service.id = service.catalogId || `srv_${Date.now()}_${index || Math.random().toString(36).substr(2, 9)}`;
    }
    
    // Ensure catalogId exists
    if (!service.catalogId) {
      service.catalogId = service.id;
    }
    
    // Ensure applicableRoles is array
    if (!service.applicableRoles) {
      // Try to infer from legacy fields
      if (service.role_type) {
        service.applicableRoles = [service.role_type];
      } else if (service.roleId) {
        service.applicableRoles = [service.roleId];
      } else {
        service.applicableRoles = [];
      }
    } else if (!Array.isArray(service.applicableRoles)) {
      service.applicableRoles = [service.applicableRoles];
    }
    
    return service;
  }
  
  /**
   * ========================================
   * MIGRATION ENDPOINTS
   * ========================================
   */
  
  /**
   * 🔧 MIGRATE ALL VENDORS - Standardize roleId
   */
  app.post("/make-server-3dd53475/admin/migrate/vendors", async (c) => {
    try {
      console.log('\n🔧 ===== MIGRATING ALL VENDORS =====');
      
      // Get all vendor keys
      const allVendorKeys = await kv.getByPrefix('vendor:vendor_');
      console.log(`   Found ${allVendorKeys.length} vendor records`);
      
      let migratedCount = 0;
      let alreadyCorrectCount = 0;
      
      for (const entry of allVendorKeys) {
        const vendor = entry.value;
        const vendorId = vendor.id;
        
        // Skip if no vendor ID
        if (!vendorId) continue;
        
        // Check if migration needed
        const needsMigration = !vendor.roleId || 
                              vendor.roleId !== vendor.role_type ||
                              vendor.roleId !== vendor.role;
        
        if (needsMigration) {
          const oldVendor = { ...vendor };
          const migratedVendor = standardizeVendor(vendor);
          
          await kv.set(`vendor:${vendorId}`, migratedVendor);
          migratedCount++;
          
          console.log(`   ✅ Migrated vendor ${vendorId}:`);
          console.log(`      Old: roleId=${oldVendor.roleId}, role_type=${oldVendor.role_type}, role=${oldVendor.role}`);
          console.log(`      New: roleId=${migratedVendor.roleId}`);
        } else {
          alreadyCorrectCount++;
        }
      }
      
      console.log(`\n✅ Migration complete!`);
      console.log(`   Migrated: ${migratedCount}`);
      console.log(`   Already correct: ${alreadyCorrectCount}`);
      
      return c.json({
        success: true,
        message: 'Vendor migration complete',
        totalVendors: allVendorKeys.length,
        migratedCount,
        alreadyCorrectCount
      });
      
    } catch (error) {
      console.error('❌ Vendor migration error:', error);
      return c.json({ error: String(error) }, 500);
    }
  });
  
  /**
   * 🔧 MIGRATE ALL SERVICES - Standardize id, catalogId, applicableRoles
   */
  app.post("/make-server-3dd53475/admin/migrate/services", async (c) => {
    try {
      console.log('\n🔧 ===== MIGRATING ALL SERVICES =====');
      
      const serviceCatalog = await kv.get('platform:service_catalog') || [];
      console.log(`   Total services: ${serviceCatalog.length}`);
      
      let migratedCount = 0;
      let alreadyCorrectCount = 0;
      
      const migratedServices = serviceCatalog.map((service: any, index: number) => {
        // Check if migration needed
        const needsMigration = !service.id || 
                              !service.catalogId || 
                              !service.applicableRoles ||
                              !Array.isArray(service.applicableRoles);
        
        if (needsMigration) {
          const oldService = { ...service };
          const migratedService = standardizeService(service, index);
          migratedCount++;
          
          console.log(`   ✅ Migrated service "${service.name}":`);
          console.log(`      Old: id=${oldService.id}, catalogId=${oldService.catalogId}, applicableRoles=${JSON.stringify(oldService.applicableRoles)}`);
          console.log(`      New: id=${migratedService.id}, catalogId=${migratedService.catalogId}, applicableRoles=${JSON.stringify(migratedService.applicableRoles)}`);
          
          return migratedService;
        } else {
          alreadyCorrectCount++;
          return service;
        }
      });
      
      if (migratedCount > 0) {
        await kv.set('platform:service_catalog', migratedServices);
      }
      
      console.log(`\n✅ Migration complete!`);
      console.log(`   Migrated: ${migratedCount}`);
      console.log(`   Already correct: ${alreadyCorrectCount}`);
      
      return c.json({
        success: true,
        message: 'Service migration complete',
        totalServices: serviceCatalog.length,
        migratedCount,
        alreadyCorrectCount
      });
      
    } catch (error) {
      console.error('❌ Service migration error:', error);
      return c.json({ error: String(error) }, 500);
    }
  });
  
  /**
   * 🔧 MIGRATE EVERYTHING - Run all migrations
   */
  app.post("/make-server-3dd53475/admin/migrate/all", async (c) => {
    try {
      console.log('\n🔧 ===== RUNNING FULL PLATFORM MIGRATION =====');
      
      // Migrate vendors
      const vendorResult = await fetch(
        `${c.req.url.replace('/migrate/all', '/migrate/vendors')}`,
        { method: 'POST', headers: c.req.raw.headers }
      ).then(r => r.json());
      
      // Migrate services
      const serviceResult = await fetch(
        `${c.req.url.replace('/migrate/all', '/migrate/services')}`,
        { method: 'POST', headers: c.req.raw.headers }
      ).then(r => r.json());
      
      console.log('\n✅ FULL MIGRATION COMPLETE!');
      
      return c.json({
        success: true,
        message: 'Full platform migration complete',
        vendors: vendorResult,
        services: serviceResult
      });
      
    } catch (error) {
      console.error('❌ Full migration error:', error);
      return c.json({ error: String(error) }, 500);
    }
  });
  
  /**
   * ========================================
   * VALIDATION MIDDLEWARE
   * ========================================
   */
  
  /**
   * Validate service data before creation/update
   */
  function validateServiceData(serviceData: any): { valid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Required fields
    if (!serviceData.name) errors.push('Service name is required');
    if (!serviceData.description) warnings.push('Service description is recommended');
    
    // applicableRoles validation
    if (!serviceData.applicableRoles || !Array.isArray(serviceData.applicableRoles)) {
      errors.push('applicableRoles must be an array');
    } else if (serviceData.applicableRoles.length === 0) {
      warnings.push('No applicable roles specified - service won\'t be visible to any vendors');
    }
    
    // Pricing validation
    if (serviceData.basePrice !== undefined && serviceData.basePrice < 0) {
      errors.push('basePrice cannot be negative');
    }
    
    // Duration validation
    if (serviceData.durationMinutes !== undefined && serviceData.durationMinutes <= 0) {
      errors.push('durationMinutes must be positive');
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
  
  /**
   * Validate vendor data before creation/update
   */
  function validateVendorData(vendorData: any): { valid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Required fields
    if (!vendorData.fullName && !vendorData.businessName) {
      errors.push('Either fullName or businessName is required');
    }
    if (!vendorData.phone) errors.push('Phone number is required');
    if (!vendorData.email) errors.push('Email is required');
    if (!vendorData.roleId) errors.push('roleId is required');
    
    // Phone format validation
    if (vendorData.phone && !/^\d{10}$/.test(vendorData.phone.replace(/[^0-9]/g, ''))) {
      warnings.push('Phone number should be 10 digits');
    }
    
    // Email format validation
    if (vendorData.email && !/.+@.+\..+/.test(vendorData.email)) {
      errors.push('Invalid email format');
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
  
  /**
   * ========================================
   * GETTER FUNCTIONS WITH AUTO-STANDARDIZATION
   * ========================================
   */
  
  /**
   * Get vendor with auto-standardization
   */
  async function getVendor(vendorId: string): Promise<any> {
    const vendor = await kv.get(`vendor:${vendorId}`);
    if (!vendor) return null;
    
    return standardizeVendor(vendor);
  }
  
  /**
   * Get all services with auto-standardization
   */
  async function getServiceCatalog(): Promise<any[]> {
    const catalog = await kv.get('platform:service_catalog') || [];
    return catalog.map((service: any, index: number) => standardizeService(service, index));
  }
  
  /**
   * ========================================
   * EXPORT UTILITIES
   * ========================================
   */
  
  return {
    standardizeVendor,
    standardizeService,
    validateServiceData,
    validateVendorData,
    getVendor,
    getServiceCatalog
  };
}
