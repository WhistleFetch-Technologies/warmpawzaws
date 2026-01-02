/**
 * VENDOR CATALOG API - Fetches services from admin-created catalog
 * This file contains the corrected endpoint that reads from catalog:categories
 * where admin actually creates services through the UI
 * 
 * DATA STRUCTURE:
 * - Category has: vendorType ("boarding", "veterinary", "walking", "cafe", etc.)
 * - Category has: serviceStyle ("at-home", "at-center")
 * - Service has: serviceType ("at-home", "at-center")
 * - Service does NOT have applicableRoles (inherited from category.vendorType)
 */

// ✅ SQL MIGRATION: All KV operations replaced with SQL repositories
import type { Hono } from "hono";
import { getDbClient } from '../../../supabase/lib/db';

export function registerVendorCatalogAPI(app: Hono) {
  
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
   * ✅ READS FROM catalog:categories (where admin creates services via UI)
   */
  app.get("/make-server-3dd53475/service-catalog/role/:roleId", async (c) => {
    try {
      const roleId = c.req.param('roleId');
      const serviceStyle = c.req.query('serviceStyle') as 'at-home' | 'at-center' | 'tele' | undefined;
      
      console.log(`\n📋 ===== VENDOR SERVICE CATALOG REQUEST =====`);
      console.log(`   Role ID: ${roleId}`);
      console.log(`   Service Style Filter: ${serviceStyle || 'all'}`);
      
      // ✅ SQL: Read from catalog_categories table (where admin creates services)
      const db = getDbClient();
      const { data: categoriesData } = await db
        .from('catalog_categories')
        .select('*')
        .order('created_at', { ascending: true });
      
      const categories = categoriesData || [];
      
      console.log(`   Total categories in catalog: ${categories.length}`);
      
      // Get vendor types for this role
      const vendorTypes = roleToVendorTypeMap[roleId] || [];
      console.log(`   Looking for vendor types: [${vendorTypes.join(', ')}]`);
      
      // Flatten and filter services
      const allServices: any[] = [];
      
      categories.forEach((category: any) => {
        const categoryVendorType = category.vendorType;
        const categoryServiceStyle = category.serviceStyle;
        
        console.log(`   Category "${category.name}": vendorType="${categoryVendorType}", serviceStyle="${categoryServiceStyle}"`);
        
        // Check if this category matches the requested role
        const categoryMatchesRole = vendorTypes.includes(categoryVendorType);
        
        if (!categoryMatchesRole) {
          console.log(`      ❌ Category vendor type "${categoryVendorType}" doesn't match role "${roleId}"`);
          return; // Skip this category
        }
        
        console.log(`      ✅ Category matches role!`);
        
        // Process subcategories and services
        if (category.subCategories && Array.isArray(category.subCategories)) {
          category.subCategories.forEach((subCategory: any) => {
            if (subCategory.services && Array.isArray(subCategory.services)) {
              console.log(`         SubCategory "${subCategory.name}" has ${subCategory.services.length} services`);
              
              subCategory.services.forEach((service: any) => {
                // Filter by serviceStyle if provided
                // Map "at-home" to "at_home" for consistency
                const normalizedServiceStyle = serviceStyle?.replace('_', '-');
                const serviceTypeNormalized = service.serviceType?.replace('_', '-');
                
                if (serviceStyle && serviceTypeNormalized !== normalizedServiceStyle) {
                  console.log(`            ⚠️ Service "${service.name}" type="${service.serviceType}" doesn't match filter="${serviceStyle}"`);
                  return; // Skip this service
                }
                
                console.log(`            ✅ Adding service "${service.name}"`);
                
                // Add service with inherited category info
                allServices.push({
                  ...service,
                  // Inherited from category
                  vendorType: categoryVendorType,
                  categoryServiceStyle: categoryServiceStyle,
                  // Category/subcategory info
                  categoryId: category.id,
                  categoryName: category.name,
                  subCategoryId: subCategory.id,
                  subCategoryName: subCategory.name,
                  // Normalize field names
                  serviceStyle: service.serviceType, // Map serviceType to serviceStyle
                  applicableRoles: [roleId] // Add for compatibility
                });
              });
            }
          });
        }
      });
      
      console.log(`   Total services found: ${allServices.length}`);
      
      // If no services found
      if (allServices.length === 0) {
        console.log(`   ❌ NO SERVICES FOUND!`);
        
        // Debug info
        const availableVendorTypes = categories
          .map((c: any) => c.vendorType)
          .filter(Boolean);
        
        console.log(`   Available vendor types in catalog: [${[...new Set(availableVendorTypes)].join(', ')}]`);
        
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
        serviceName: service.name,
        name: service.name,
        code: service.code,
        description: service.description || '',
        basePrice: service.basePrice || 0,
        duration: service.duration || '',
        serviceStyle: service.serviceStyle, // Already normalized
        serviceType: service.serviceType, // Keep original too
        applicableRoles: service.applicableRoles,
        vendorType: service.vendorType,
        categoryId: service.categoryId,
        categoryName: service.categoryName,
        subCategoryId: service.subCategoryId,
        subCategoryName: service.subCategoryName,
        status: service.status,
        gstRate: service.gstRate,
        gstInclusion: service.gstInclusion,
        showFinalPrice: service.showFinalPrice,
        isPackage: service.isPackage || false,
        packageDetails: service.packageDetails,
        subscriptionConfig: service.subscriptionConfig
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
      // ✅ SQL: Read from catalog_categories table
      const db = getDbClient();
      const { data: categoriesData } = await db
        .from('catalog_categories')
        .select('*')
        .order('created_at', { ascending: true });
      
      const categories = categoriesData || [];
      
      // Flatten services
      const allServices: any[] = [];
      const vendorTypes = new Set<string>();
      
      categories.forEach((category: any) => {
        if (category.vendorType) vendorTypes.add(category.vendorType);
        
        if (category.subCategories && Array.isArray(category.subCategories)) {
          category.subCategories.forEach((subCategory: any) => {
            if (subCategory.services && Array.isArray(subCategory.services)) {
              allServices.push(...subCategory.services.map((s: any) => ({
                ...s,
                vendorType: category.vendorType,
                categoryName: category.name
              })));
            }
          });
        }
      });
      
      const stats = {
        totalServices: allServices.length,
        totalCategories: categories.length,
        byServiceType: {
          'at-home': allServices.filter((s: any) => s.serviceType === 'at-home').length,
          'at-center': allServices.filter((s: any) => s.serviceType === 'at-center').length,
          'tele': allServices.filter((s: any) => s.serviceType === 'tele').length
        },
        byVendorType: {} as any,
        availableVendorTypes: Array.from(vendorTypes),
        sampleServices: allServices.slice(0, 5).map((s: any) => ({
          name: s.name,
          serviceType: s.serviceType,
          vendorType: s.vendorType,
          category: s.categoryName,
          price: s.basePrice
        }))
      };
      
      // Count by vendor type
      Array.from(vendorTypes).forEach((vt: string) => {
        stats.byVendorType[vt] = allServices.filter((s: any) => s.vendorType === vt).length;
      });
      
      return c.json({
        success: true,
        catalogStatus: allServices.length > 0 ? 'has_services' : 'empty',
        dataSource: 'catalog:categories',
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
      // ✅ SQL: Read from catalog_categories table
      const db = getDbClient();
      const { data: categoriesData } = await db
        .from('catalog_categories')
        .select('*')
        .order('created_at', { ascending: true });
      
      const categories = categoriesData || [];
      
      console.log('\n🔍 ===== RAW CATALOG DUMP =====');
      console.log(`Total categories: ${categories.length}`);
      
      // Show first category structure
      if (categories.length > 0) {
        console.log('First category structure:', JSON.stringify(categories[0], null, 2));
      }
      
      return c.json({
        success: true,
        rawCategories: categories,
        totalCategories: categories.length
      });
    } catch (error) {
      console.error('Error dumping catalog:', error);
      return c.json({ error: String(error) }, 500);
    }
  });
}
