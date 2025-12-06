/**
 * CATALOG SEEDING API V2 - CORRECT ARCHITECTURE
 * 
 * ✅ Seeds services into: platform:service_catalog
 * ✅ Seeds categories into: catalog:categories (structure only)
 * ✅ No duplication - single source of truth
 */

import type { Hono } from "npm:hono@4.6.14";
import * as kv from "./kv_store.tsx";
import { SEED_CATEGORIES, SEED_SERVICES } from "./catalog-seed-data-v2.tsx";

export async function ensureCatalogSeeded() {
  try {
    console.log('🌱 Checking if catalog needs seeding...');
    const existingServices = await kv.get('platform:service_catalog');
    
    if (existingServices && existingServices.length > 0) {
      console.log('✅ Catalog already seeded.');
      return;
    }
    
    console.log('⚠️ Catalog missing. Auto-seeding now...');
    
    // 1. Filter new categories (avoid duplicates)
    const existingCategories = await kv.get('catalog:categories') || [];
    const existingCategoryIds = new Set(existingCategories.map((c: any) => c.id));
    const newCategories = SEED_CATEGORIES.filter(c => !existingCategoryIds.has(c.id));
    
    // 2. Filter new services (avoid duplicates by serviceName + categoryId)
    const existingServicesList = existingServices || [];
    const existingServiceKeys = new Set(
      existingServicesList.map((s: any) => `${s.serviceName}_${s.categoryId}_${s.serviceStyle}`)
    );
    
    const newServices = SEED_SERVICES.filter(s => 
      !existingServiceKeys.has(`${s.serviceName}_${s.categoryId}_${s.serviceStyle}`)
    );
    
    // 3. Add timestamps to new data
    const timestamp = new Date().toISOString();
    
    const categoriesWithTimestamps = newCategories.map(cat => ({
      ...cat,
      createdAt: timestamp,
      updatedAt: timestamp
    }));
    
    const servicesWithIds = newServices.map((service, index) => {
      const id = `cat_srv_${Date.now()}_${index}`;
      return {
        ...service,
        id: id,
        catalogId: id,
        createdAt: timestamp,
        updatedAt: timestamp
      };
    });
    
    // 4. Merge and save
    const updatedCategories = [...existingCategories, ...categoriesWithTimestamps];
    const updatedServices = [...existingServicesList, ...servicesWithIds];
    
    await kv.set('catalog:categories', updatedCategories);
    await kv.set('platform:service_catalog', updatedServices);
    
    console.log(`✅ Auto-seeded ${newCategories.length} categories and ${newServices.length} services.`);
    
  } catch (error) {
    console.error('❌ Error auto-seeding catalog:', error);
  }
}

export function registerCatalogSeedAPIV2(app: Hono) {
  
  /**
   * Preview seed data without executing
   */
  app.get("/make-server-3dd53475/admin/catalog/seed-preview", async (c) => {
    try {
      console.log('\n👁️ ===== PREVIEW CATALOG SEED DATA =====');
      
      // Get existing data to show what would be added
      const existingCategories = await kv.get('catalog:categories') || [];
      const existingServices = await kv.get('platform:service_catalog') || [];
      
      console.log(`   📦 Existing categories: ${existingCategories.length}`);
      console.log(`   📋 Existing services: ${existingServices.length}`);
      
      // Filter what would be new
      const existingCategoryIds = new Set(existingCategories.map((c: any) => c.id));
      const newCategories = SEED_CATEGORIES.filter(c => !existingCategoryIds.has(c.id));
      
      const existingServiceKeys = new Set(
        existingServices.map((s: any) => `${s.serviceName}_${s.categoryId}_${s.serviceStyle}`)
      );
      
      const newServices = SEED_SERVICES.filter(s => 
        !existingServiceKeys.has(`${s.serviceName}_${s.categoryId}_${s.serviceStyle}`)
      );
      
      // Calculate stats for NEW services only
      const roleStats: Record<string, number> = {};
      newServices.forEach((s: any) => {
        if (s.applicableRoles && Array.isArray(s.applicableRoles)) {
          s.applicableRoles.forEach((role: string) => {
            roleStats[role] = (roleStats[role] || 0) + 1;
          });
        }
      });
      
      // Calculate stats for EXISTING services
      const existingRoleStats: Record<string, number> = {};
      existingServices.forEach((s: any) => {
        if (s.applicableRoles && Array.isArray(s.applicableRoles)) {
          s.applicableRoles.forEach((role: string) => {
            existingRoleStats[role] = (existingRoleStats[role] || 0) + 1;
          });
        }
      });
      
      // Get existing categories grouped
      const existingCategorySummary = existingCategories.map((cat: any) => ({
        id: cat.id,
        name: cat.name,
        status: cat.status
      }));
      
      // Get existing services summary (first 10 as sample)
      const existingServicesSummary = existingServices.slice(0, 15).map((s: any) => ({
        name: s.serviceName,
        category: s.categoryId,
        role: s.applicableRoles?.[0] || 'unknown',
        style: s.serviceStyle,
        price: s.basePrice
      }));
      
      // Get role mapping for preview
      const roleMapping = await kv.get('platform:role_service_category_mapping') || [];
      
      return c.json({
        success: true,
        // EXISTING DATA (what you already have)
        existing: {
          categories: existingCategorySummary,
          categoriesCount: existingCategories.length,
          services: existingServicesSummary,
          servicesCount: existingServices.length,
          servicesByRole: existingRoleStats
        },
        // NEW DATA (what will be added)
        new: {
          categories: newCategories.map(cat => ({
            id: cat.id,
            name: cat.name,
            parent_category: cat.parentCategory,
            description: cat.description
          })),
          services: newServices.map(s => ({
            name: s.serviceName,
            description: s.description,
            category: s.categoryId,
            role_type: s.applicableRoles?.[0] || 'unknown',
            service_style: s.serviceStyle,
            base_price: s.basePrice,
            duration_minutes: s.duration
          })),
          servicesByRole: roleStats
        },
        // LEGACY FORMAT (for backward compatibility)
        categories: newCategories.map(cat => ({
          id: cat.id,
          name: cat.name,
          parent_category: cat.parentCategory,
          description: cat.description
        })),
        services: newServices.map(s => ({
          name: s.serviceName,
          description: s.description,
          category: s.categoryId,
          role_type: s.applicableRoles?.[0] || 'unknown',
          service_style: s.serviceStyle,
          base_price: s.basePrice,
          duration_minutes: s.duration
        })),
        roleMapping: roleMapping,
        summary: {
          totalCategories: newCategories.length,
          totalServices: newServices.length,
          servicesByRole: roleStats
        }
      });
      
    } catch (error: any) {
      console.error('Preview seed error:', error);
      return c.json({
        success: false,
        error: error.message || 'Failed to preview seed data'
      }, 500);
    }
  });
  
  /**
   * Seed comprehensive catalog data
   * - Adds categories to catalog:categories (structure only)
   * - Adds services to platform:service_catalog (single source of truth)
   */
  app.post("/make-server-3dd53475/admin/catalog/seed", async (c) => {
    try {
      console.log('\n🌱 ===== SEEDING CATALOG V2 (CORRECT ARCHITECTURE) =====');
      
      // 1. Get existing data
      const existingCategories = await kv.get('catalog:categories') || [];
      const existingServices = await kv.get('platform:service_catalog') || [];
      
      console.log(`   Existing categories: ${existingCategories.length}`);
      console.log(`   Existing services: ${existingServices.length}`);
      
      // 2. Filter new categories (avoid duplicates)
      const existingCategoryIds = new Set(existingCategories.map((c: any) => c.id));
      const newCategories = SEED_CATEGORIES.filter(c => !existingCategoryIds.has(c.id));
      
      console.log(`   New categories to add: ${newCategories.length}`);
      
      // 3. Filter new services (avoid duplicates by serviceName + categoryId)
      const existingServiceKeys = new Set(
        existingServices.map((s: any) => `${s.serviceName}_${s.categoryId}_${s.serviceStyle}`)
      );
      
      const newServices = SEED_SERVICES.filter(s => 
        !existingServiceKeys.has(`${s.serviceName}_${s.categoryId}_${s.serviceStyle}`)
      );
      
      console.log(`   New services to add: ${newServices.length}`);
      
      if (newCategories.length === 0 && newServices.length === 0) {
        return c.json({
          success: true,
          message: "All seed data already exists",
          added: { categories: 0, services: 0 },
          total: { 
            categories: existingCategories.length,
            services: existingServices.length
          }
        });
      }
      
      // 4. Add timestamps to new data
      const timestamp = new Date().toISOString();
      
      const categoriesWithTimestamps = newCategories.map(cat => ({
        ...cat,
        createdAt: timestamp,
        updatedAt: timestamp
      }));
      
      const servicesWithIds = newServices.map((service, index) => {
        const id = `cat_srv_${Date.now()}_${index}`;
        return {
          ...service,
          id: id, // PRIMARY ID
          catalogId: id, // ALIAS for backward compatibility
          createdAt: timestamp,
          updatedAt: timestamp
        };
      });
      
      // 5. Merge and save
      const updatedCategories = [...existingCategories, ...categoriesWithTimestamps];
      const updatedServices = [...existingServices, ...servicesWithIds];
      
      await kv.set('catalog:categories', updatedCategories);
      await kv.set('platform:service_catalog', updatedServices);
      
      console.log(`   ✅ Added ${newCategories.length} categories`);
      console.log(`   ✅ Added ${newServices.length} services`);
      console.log(`   Total categories now: ${updatedCategories.length}`);
      console.log(`   Total services now: ${updatedServices.length}`);
      
      // 6. Calculate stats
      const roleStats: Record<string, number> = {};
      updatedServices.forEach((s: any) => {
        if (s.applicableRoles && Array.isArray(s.applicableRoles)) {
          s.applicableRoles.forEach((role: string) => {
            roleStats[role] = (roleStats[role] || 0) + 1;
          });
        }
      });
      
      return c.json({
        success: true,
        message: "Catalog seeded successfully",
        categoriesCreated: newCategories.length,
        servicesCreated: newServices.length,
        summary: {
          servicesByRole: roleStats
        }
      });
      
    } catch (error) {
      console.error('❌ Error seeding catalog:', error);
      return c.json({ error: String(error) }, 500);
    }
  });
  
  /**
   * 🔧 MIGRATION: Add ID field to existing services
   * This fixes services that were seeded before the id field was added
   */
  app.post("/make-server-3dd53475/admin/catalog/fix-service-ids", async (c) => {
    try {
      console.log('\n🔧 ===== FIXING SERVICE IDs =====');
      
      const serviceCatalog = await kv.get('platform:service_catalog') || [];
      console.log(`   Total services: ${serviceCatalog.length}`);
      
      let fixedCount = 0;
      const fixedServices = serviceCatalog.map((service: any, index: number) => {
        // If service doesn't have an id field, add it
        if (!service.id) {
          fixedCount++;
          const id = service.catalogId || `cat_srv_${Date.now()}_${index}`;
          return {
            ...service,
            id: id,
            catalogId: id
          };
        }
        return service;
      });
      
      if (fixedCount > 0) {
        await kv.set('platform:service_catalog', fixedServices);
        console.log(`   ✅ Fixed ${fixedCount} services`);
      } else {
        console.log(`   ℹ️ All services already have IDs`);
      }
      
      return c.json({
        success: true,
        message: `Fixed ${fixedCount} services`,
        totalServices: fixedServices.length,
        fixedCount
      });
      
    } catch (error) {
      console.error('❌ Error fixing service IDs:', error);
      return c.json({ error: String(error) }, 500);
    }
  });
  
  /**
   * 🗑️ CLEAR CATALOG: Delete all catalog data (for re-seeding with fixed roles)
   */
  app.delete("/make-server-3dd53475/admin/catalog/clear", async (c) => {
    try {
      console.log('\n🗑️ ===== CLEARING CATALOG DATA =====');
      
      const serviceCatalog = await kv.get('platform:service_catalog') || [];
      const categories = await kv.get('catalog:categories') || [];
      
      console.log(`   Deleting ${serviceCatalog.length} services`);
      console.log(`   Deleting ${categories.length} categories`);
      
      // Clear both catalog keys
      await kv.del('platform:service_catalog');
      await kv.del('catalog:categories');
      
      console.log('   ✅ Catalog cleared successfully');
      
      return c.json({
        success: true,
        message: 'Catalog cleared successfully',
        deleted: {
          services: serviceCatalog.length,
          categories: categories.length
        }
      });
      
    } catch (error) {
      console.error('❌ Error clearing catalog:', error);
      return c.json({ error: String(error) }, 500);
    }
  });
}