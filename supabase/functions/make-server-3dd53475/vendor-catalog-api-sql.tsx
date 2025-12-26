/**
 * VENDOR CATALOG API - SQL-ONLY VERSION
 * 
 * ✅ MIGRATED TO SQL: All KV operations replaced with SQL queries
 * 
 * Fetches services from admin-created catalog
 * Reads from service_catalog table (where admin creates services through the UI)
 * 
 * Date: 2025-01-27
 * Migration: KV to SQL (3 KV operations → 0)
 * Endpoints: 3
 */

import type { Hono } from "npm:hono@4.6.14";
import { getDbClient } from "../../lib/db.ts";
import { getServicesRepository } from "../../lib/repositories/services.ts";

export function registerVendorCatalogAPISQL(app: Hono) {
  const db = getDbClient();
  const servicesRepo = getServicesRepository();
  
  /**
   * Map vendor type (from category) to role ID (from vendor app)
   */
  const vendorTypeToRoleMap: Record<string, string> = {
    'grooming': 'pet_groomer',
    'veterinary': 'veterinarian',
    'boarding': 'pet_boarder',
    'walking': 'pet_walker',
    'training': 'pet_trainer',
    'sitting': 'pet_sitter',
    'cafe': 'pet_cafe',
    'transport': 'pet_transport',
    'photography': 'pet_photographer'
  };
  
  /**
   * Reverse map - from role ID to vendor types
   */
  const roleToVendorTypeMap: Record<string, string[]> = {
    'pet_groomer': ['grooming'],
    'veterinarian': ['veterinary'],
    'pet_boarder': ['boarding'],
    'pet_walker': ['walking'],
    'pet_trainer': ['training'],
    'pet_sitter': ['sitting'],
    'pet_cafe': ['cafe'],
    'pet_transport': ['transport'],
    'pet_photographer': ['photography']
  };
  
  /**
   * Get services for a specific role and optional service style
   * ✅ READS FROM service_catalog table (where admin creates services via UI)
   */
  app.get("/make-server-3dd53475/service-catalog/role/:roleId", async (c) => {
    try {
      const roleId = c.req.param('roleId');
      const serviceStyle = c.req.query('serviceStyle') as 'at-home' | 'at-center' | 'tele' | undefined;
      
      console.log(`\n📋 ===== VENDOR SERVICE CATALOG REQUEST =====`);
      console.log(`   Role ID: ${roleId}`);
      console.log(`   Service Style Filter: ${serviceStyle || 'all'}`);
      
      // ✅ SQL: Read from service_catalog table
      const { data: catalogServices, error } = await db
        .from('service_catalog')
        .select('*')
        .eq('status', 'active')
        .eq('publish_status', 'published');
      
      if (error) throw error;
      
      console.log(`   Total services in catalog: ${catalogServices?.length || 0}`);
      
      // Get vendor types for this role
      const vendorTypes = roleToVendorTypeMap[roleId] || [];
      console.log(`   Looking for vendor types: [${vendorTypes.join(', ')}]`);
      
      // Filter services by role and service style
      const allServices: any[] = [];
      
      (catalogServices || []).forEach((service: any) => {
        // Check if service's applicable_roles includes this role
        const applicableRoles = service.applicable_roles || [];
        const matchesRole = applicableRoles.includes(roleId) || 
                           (service.category_name && vendorTypes.includes(service.category_name.toLowerCase()));
        
        if (!matchesRole) {
          return; // Skip this service
        }
        
        // Filter by serviceStyle if provided
        const serviceStyleNormalized = serviceStyle?.replace('_', '-');
        const serviceTypeNormalized = service.service_style?.replace('_', '-');
        
        if (serviceStyle && serviceTypeNormalized !== serviceStyleNormalized) {
          return; // Skip this service
        }
        
        console.log(`            ✅ Adding service "${service.service_name}"`);
        
        // Add service
        allServices.push({
          ...service,
          // Normalize field names
          serviceStyle: service.service_style,
          applicableRoles: applicableRoles,
          vendorType: service.category_name?.toLowerCase()
        });
      });
      
      console.log(`   Total services found: ${allServices.length}`);
      
      // If no services found
      if (allServices.length === 0) {
        console.log(`   ❌ NO SERVICES FOUND!`);
        
        return c.json({ 
          success: true,
          roleId,
          serviceStyle: serviceStyle || 'all',
          services: [],
          total: 0,
          message: `No services found for role "${roleId}" with style "${serviceStyle || 'all'}"`
        });
      }
      
      // Format services for vendor app
      const formattedServices = allServices.map((service: any) => ({
        id: service.id,
        catalogId: service.id,
        serviceName: service.service_name,
        name: service.service_name,
        code: service.service_code,
        description: service.description || '',
        basePrice: parseFloat(service.base_price || '0'),
        duration: service.duration_minutes || '',
        serviceStyle: service.service_style,
        serviceType: service.service_style,
        applicableRoles: service.applicable_roles || [],
        vendorType: service.category_name?.toLowerCase(),
        categoryId: service.category_id,
        categoryName: service.category_name,
        subCategoryId: service.sub_category_id,
        subCategoryName: service.sub_category_name,
        status: service.status,
        gstRate: (service.metadata as any)?.gst_rate,
        gstInclusion: (service.metadata as any)?.gst_inclusion,
        showFinalPrice: (service.metadata as any)?.show_final_price,
        isPackage: (service.metadata as any)?.is_package || false,
        packageDetails: (service.metadata as any)?.package_details,
        subscriptionConfig: (service.metadata as any)?.subscription_config
      }));
      
      console.log(`   ✅ Returning ${formattedServices.length} services`);
      if (formattedServices.length > 0) {
        console.log(`   Sample:`, {
          name: formattedServices[0].name,
          style: formattedServices[0].serviceStyle,
          price: formattedServices[0].basePrice
        });
      }
      
      return c.json({ 
        success: true, 
        roleId,
        serviceStyle: serviceStyle || 'all',
        services: formattedServices,
        total: formattedServices.length
      });
    } catch (error) {
      console.error('❌ Error fetching role services:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * Quick diagnostic endpoint to check catalog status
   */
  app.get("/make-server-3dd53475/service-catalog/debug", async (c) => {
    try {
      // ✅ SQL: Get all services from service_catalog
      const { data: services, error } = await db
        .from('service_catalog')
        .select('*');
      
      if (error) throw error;
      
      // Flatten services
      const allServices: any[] = services || [];
      const vendorTypes = new Set<string>();
      
      allServices.forEach((service: any) => {
        if (service.category_name) {
          vendorTypes.add(service.category_name.toLowerCase());
        }
      });
      
      const stats = {
        totalServices: allServices.length,
        totalCategories: new Set(allServices.map(s => s.category_name)).size,
        byServiceType: {
          'at-home': allServices.filter((s: any) => s.service_style === 'at-home' || s.service_style === 'at_home').length,
          'at-center': allServices.filter((s: any) => s.service_style === 'at-center' || s.service_style === 'at_center').length,
          'tele': allServices.filter((s: any) => s.service_style === 'tele').length
        },
        byVendorType: {} as any,
        availableVendorTypes: Array.from(vendorTypes),
        sampleServices: allServices.slice(0, 5).map((s: any) => ({
          name: s.service_name,
          serviceType: s.service_style,
          vendorType: s.category_name?.toLowerCase(),
          category: s.category_name,
          price: parseFloat(s.base_price || '0')
        }))
      };
      
      // Count by vendor type
      Array.from(vendorTypes).forEach((vt: string) => {
        stats.byVendorType[vt] = allServices.filter((s: any) => s.category_name?.toLowerCase() === vt).length;
      });
      
      return c.json({
        success: true,
        catalogStatus: allServices.length > 0 ? 'has_services' : 'empty',
        dataSource: 'service_catalog',
        stats
      });
    } catch (error) {
      console.error('Error in catalog debug:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * RAW DUMP - See exact catalog structure
   */
  app.get("/make-server-3dd53475/service-catalog/raw-dump", async (c) => {
    try {
      // ✅ SQL: Get all services from service_catalog
      const { data: services, error } = await db
        .from('service_catalog')
        .select('*')
        .limit(100); // Limit for performance
      
      if (error) throw error;
      
      console.log('\n🔍 ===== RAW CATALOG DUMP =====');
      console.log(`Total services: ${services?.length || 0}`);
      
      return c.json({
        success: true,
        rawServices: services || [],
        totalServices: services?.length || 0
      });
    } catch (error) {
      console.error('Error dumping catalog:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  console.log('✅ Vendor catalog API registered (SQL-only)');
}

