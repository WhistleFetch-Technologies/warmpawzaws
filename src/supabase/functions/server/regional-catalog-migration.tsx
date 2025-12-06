import { Hono } from 'npm:hono@4';
import type { Region } from './region-types.tsx';
import type { RegionalPackage, RegionalAvailability, RegionalPricing } from './regional-catalog-integration.tsx';

/**
 * REGIONAL CATALOG MIGRATION UTILITIES
 * 
 * Helps migrate existing packages to regional format:
 * - Converts old packages without regional configuration
 * - Adds default regional pricing based on region settings
 * - Validates and fixes regional data
 */

// ============================================
// MIGRATION FUNCTIONS
// ============================================

/**
 * Migrates an old package to regional format
 * 
 * @param oldPackage - Package without regional configuration
 * @param defaultRegionId - Default region to assign (e.g., "india")
 * @param region - Region configuration for pricing
 */
export function migratePackageToRegional(
  oldPackage: any,
  defaultRegionId: string,
  region: Region
): RegionalPackage {
  console.log(`🔄 [MIGRATION] Migrating package ${oldPackage.id} to regional format`);
  
  // Create regional availability (default to specific region)
  const regionalAvailability: RegionalAvailability = {
    mode: 'specific',
    regions: [defaultRegionId],
  };
  
  // Create regional pricing from old price
  const basePrice = oldPackage.packagePrice || oldPackage.originalPrice || 0;
  
  const regionalPricing: RegionalPricing[] = [
    {
      regionId: defaultRegionId,
      basePrice,
      currency: region.currency.code,
      symbol: region.currency.symbol,
      taxRate: region.business.taxRate,
    },
  ];
  
  // Create migrated package
  const migratedPackage: RegionalPackage = {
    ...oldPackage,
    regionalAvailability,
    regionalPricing,
    regionalVariations: {},
  };
  
  console.log(`✅ [MIGRATION] Package ${oldPackage.id} migrated successfully`);
  
  return migratedPackage;
}

/**
 * Migrates all packages in the system to regional format
 */
export async function migrateAllPackagesToRegional(
  kvStore: any,
  defaultRegionId: string = 'india'
): Promise<{
  success: boolean;
  migrated: number;
  skipped: number;
  errors: string[];
}> {
  console.log('🚀 [MIGRATION] Starting bulk package migration');
  
  const results = {
    success: true,
    migrated: 0,
    skipped: 0,
    errors: [] as string[],
  };
  
  try {
    // Get default region
    const region = await kvStore.get<Region>(`region_${defaultRegionId}`);
    
    if (!region) {
      throw new Error(`Default region ${defaultRegionId} not found`);
    }
    
    // Get all packages
    const allPackages = await kvStore.getByPrefix('package:');
    
    console.log(`📦 [MIGRATION] Found ${allPackages.length} packages to check`);
    
    for (const pkg of allPackages) {
      try {
        // Skip if already has regional configuration
        if (pkg.regionalAvailability && pkg.regionalPricing) {
          console.log(`⏭️ [MIGRATION] Skipping ${pkg.id} - already regional`);
          results.skipped++;
          continue;
        }
        
        // Migrate package
        const migratedPackage = migratePackageToRegional(pkg, defaultRegionId, region);
        
        // Save migrated package
        await kvStore.set(`package:${pkg.id}`, migratedPackage);
        
        // Update vendor-specific copy if exists
        if (pkg.vendorId && pkg.vendorId !== 'platform') {
          await kvStore.set(
            `package:vendor:${pkg.vendorId}:${pkg.id}`,
            migratedPackage
          );
        }
        
        results.migrated++;
      } catch (error) {
        console.error(`❌ [MIGRATION] Error migrating package ${pkg.id}:`, error);
        results.errors.push(`${pkg.id}: ${String(error)}`);
      }
    }
    
    console.log(`✅ [MIGRATION] Completed: ${results.migrated} migrated, ${results.skipped} skipped`);
    
  } catch (error) {
    console.error('❌ [MIGRATION] Fatal error:', error);
    results.success = false;
    results.errors.push(String(error));
  }
  
  return results;
}

/**
 * Adds regional pricing for a new region to all compatible packages
 */
export async function addRegionToAllPackages(
  kvStore: any,
  regionId: string,
  defaultBasePrice?: number
): Promise<{
  success: boolean;
  updated: number;
  skipped: number;
  errors: string[];
}> {
  console.log(`🌍 [REGION-ADD] Adding region ${regionId} to all packages`);
  
  const results = {
    success: true,
    updated: 0,
    skipped: 0,
    errors: [] as string[],
  };
  
  try {
    // Get region configuration
    const region = await kvStore.get<Region>(`region_${regionId}`);
    
    if (!region) {
      throw new Error(`Region ${regionId} not found`);
    }
    
    // Get all packages
    const allPackages = await kvStore.getByPrefix<RegionalPackage>('package:');
    
    console.log(`📦 [REGION-ADD] Processing ${allPackages.length} packages`);
    
    for (const pkg of allPackages) {
      try {
        // Skip if package mode is 'exclude' and includes this region
        if (pkg.regionalAvailability?.mode === 'exclude' &&
            pkg.regionalAvailability.regions.includes(regionId)) {
          console.log(`⏭️ [REGION-ADD] Skipping ${pkg.id} - explicitly excluded`);
          results.skipped++;
          continue;
        }
        
        // Skip if package mode is 'specific' and doesn't include this region
        if (pkg.regionalAvailability?.mode === 'specific' &&
            !pkg.regionalAvailability.regions.includes(regionId)) {
          console.log(`⏭️ [REGION-ADD] Skipping ${pkg.id} - not in specific regions list`);
          results.skipped++;
          continue;
        }
        
        // Skip if already has pricing for this region
        if (pkg.regionalPricing?.some(p => p.regionId === regionId)) {
          console.log(`⏭️ [REGION-ADD] Skipping ${pkg.id} - already has pricing`);
          results.skipped++;
          continue;
        }
        
        // Calculate base price (use default or convert from existing pricing)
        let basePrice = defaultBasePrice || 0;
        
        if (!basePrice && pkg.regionalPricing && pkg.regionalPricing.length > 0) {
          // Use first region's price as reference (admin can adjust later)
          basePrice = pkg.regionalPricing[0].basePrice;
          console.log(`💡 [REGION-ADD] Using reference price: ${basePrice}`);
        }
        
        // Add new regional pricing
        const newPricing: RegionalPricing = {
          regionId,
          basePrice,
          currency: region.currency.code,
          symbol: region.currency.symbol,
          taxRate: region.business.taxRate,
        };
        
        const updatedPricing = [...(pkg.regionalPricing || []), newPricing];
        
        // Update package
        const updatedPackage = {
          ...pkg,
          regionalPricing: updatedPricing,
          updatedAt: new Date().toISOString(),
        };
        
        // Save updated package
        await kvStore.set(`package:${pkg.id}`, updatedPackage);
        
        // Update vendor-specific copy if exists
        if (pkg.vendorId && pkg.vendorId !== 'platform') {
          await kvStore.set(
            `package:vendor:${pkg.vendorId}:${pkg.id}`,
            updatedPackage
          );
        }
        
        console.log(`✅ [REGION-ADD] Added ${regionId} pricing to ${pkg.id}`);
        results.updated++;
      } catch (error) {
        console.error(`❌ [REGION-ADD] Error updating package ${pkg.id}:`, error);
        results.errors.push(`${pkg.id}: ${String(error)}`);
      }
    }
    
    console.log(`✅ [REGION-ADD] Completed: ${results.updated} updated, ${results.skipped} skipped`);
    
  } catch (error) {
    console.error('❌ [REGION-ADD] Fatal error:', error);
    results.success = false;
    results.errors.push(String(error));
  }
  
  return results;
}

/**
 * Validates regional configuration for all packages
 */
export async function validateAllPackagesRegionalConfig(
  kvStore: any
): Promise<{
  valid: number;
  invalid: number;
  issues: Array<{ packageId: string; issue: string }>;
}> {
  console.log('🔍 [VALIDATION] Validating regional configuration for all packages');
  
  const results = {
    valid: 0,
    invalid: 0,
    issues: [] as Array<{ packageId: string; issue: string }>,
  };
  
  try {
    // Get all regions
    const allRegions = await kvStore.getByPrefix<Region>('region_');
    const activeRegions = allRegions.filter(r => r.isActive);
    
    // Get all packages
    const allPackages = await kvStore.getByPrefix<RegionalPackage>('package:');
    
    console.log(`📦 [VALIDATION] Validating ${allPackages.length} packages`);
    
    for (const pkg of allPackages) {
      const packageIssues: string[] = [];
      
      // Check 1: Has regional configuration
      if (!pkg.regionalAvailability) {
        packageIssues.push('Missing regionalAvailability');
      }
      
      if (!pkg.regionalPricing || pkg.regionalPricing.length === 0) {
        packageIssues.push('Missing regionalPricing');
      }
      
      // Check 2: Regional pricing matches availability
      if (pkg.regionalAvailability && pkg.regionalPricing) {
        let requiredRegions: string[] = [];
        
        if (pkg.regionalAvailability.mode === 'all') {
          requiredRegions = activeRegions.map(r => r.regionId);
        } else if (pkg.regionalAvailability.mode === 'specific') {
          requiredRegions = pkg.regionalAvailability.regions;
        } else if (pkg.regionalAvailability.mode === 'exclude') {
          const excluded = pkg.regionalAvailability.regions;
          requiredRegions = activeRegions
            .filter(r => !excluded.includes(r.regionId))
            .map(r => r.regionId);
        }
        
        const pricedRegions = pkg.regionalPricing.map(p => p.regionId);
        const missingPricing = requiredRegions.filter(r => !pricedRegions.includes(r));
        
        if (missingPricing.length > 0) {
          packageIssues.push(`Missing pricing for regions: ${missingPricing.join(', ')}`);
        }
      }
      
      // Check 3: Pricing values are valid
      if (pkg.regionalPricing) {
        for (const pricing of pkg.regionalPricing) {
          if (!pricing.basePrice || pricing.basePrice <= 0) {
            packageIssues.push(`Invalid price for region ${pricing.regionId}`);
          }
          
          if (!pricing.currency || !pricing.symbol) {
            packageIssues.push(`Missing currency info for region ${pricing.regionId}`);
          }
        }
      }
      
      // Record results
      if (packageIssues.length > 0) {
        results.invalid++;
        packageIssues.forEach(issue => {
          results.issues.push({
            packageId: pkg.id,
            issue,
          });
        });
      } else {
        results.valid++;
      }
    }
    
    console.log(`✅ [VALIDATION] Completed: ${results.valid} valid, ${results.invalid} invalid`);
    
  } catch (error) {
    console.error('❌ [VALIDATION] Error:', error);
  }
  
  return results;
}

// ============================================
// API ENDPOINTS
// ============================================

export function regionalCatalogMigrationEndpoints(app: Hono, kvStore: any) {
  
  /**
   * Migrate all packages to regional format
   * POST /make-server-3dd53475/admin/packages/migrate/regional
   */
  app.post('/make-server-3dd53475/admin/packages/migrate/regional', async (c) => {
    try {
      const { defaultRegionId } = await c.req.json();
      
      console.log('🚀 [MIGRATION-API] Starting package migration');
      
      const results = await migrateAllPackagesToRegional(
        kvStore,
        defaultRegionId || 'india'
      );
      
      return c.json(results);
    } catch (error) {
      console.error('❌ [MIGRATION-API] Error:', error);
      return c.json({
        success: false,
        error: String(error)
      }, 500);
    }
  });
  
  /**
   * Add a new region to all compatible packages
   * POST /make-server-3dd53475/admin/packages/add-region
   */
  app.post('/make-server-3dd53475/admin/packages/add-region', async (c) => {
    try {
      const { regionId, defaultBasePrice } = await c.req.json();
      
      if (!regionId) {
        return c.json({
          success: false,
          error: 'regionId is required'
        }, 400);
      }
      
      console.log(`🌍 [MIGRATION-API] Adding region ${regionId} to packages`);
      
      const results = await addRegionToAllPackages(
        kvStore,
        regionId,
        defaultBasePrice
      );
      
      return c.json(results);
    } catch (error) {
      console.error('❌ [MIGRATION-API] Error:', error);
      return c.json({
        success: false,
        error: String(error)
      }, 500);
    }
  });
  
  /**
   * Validate regional configuration for all packages
   * GET /make-server-3dd53475/admin/packages/validate/regional
   */
  app.get('/make-server-3dd53475/admin/packages/validate/regional', async (c) => {
    try {
      console.log('🔍 [MIGRATION-API] Validating packages');
      
      const results = await validateAllPackagesRegionalConfig(kvStore);
      
      return c.json({
        success: true,
        ...results,
      });
    } catch (error) {
      console.error('❌ [MIGRATION-API] Error:', error);
      return c.json({
        success: false,
        error: String(error)
      }, 500);
    }
  });
}
