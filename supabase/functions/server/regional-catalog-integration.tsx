import { Hono } from 'npm:hono@4';
import type { Region } from './region-types.tsx';

/**
 * REGIONAL CATALOG INTEGRATION
 * 
 * Phase 1 Backend Implementation:
 * - Extends packages with regional availability
 * - Supports regional pricing (₹, $, S$, AED)
 * - Filters packages by region
 * - Validates regional configuration
 * 
 * Architecture:
 * Level 1: Region Service Categories (serviceCatalog) - Already exists
 * Level 2: Package Regional Availability - This file
 * Level 3: Automatic Filtering - This file
 */

// ============================================
// INTERFACES & TYPES
// ============================================

export interface RegionalAvailability {
  mode: 'all' | 'specific' | 'exclude';
  regions: string[]; // ["india", "usa", "singapore"]
}

export interface RegionalPricing {
  regionId: string;
  basePrice: number;
  currency: string;
  symbol: string;
  taxRate?: number; // Override region default tax if needed
  customTaxName?: string; // Override region tax name if needed
}

export interface RegionalVariations {
  [regionId: string]: {
    name?: string; // Different name in different regions
    description?: string; // Different description
    duration?: number; // Different duration
    restrictions?: string[]; // Regional restrictions
    additionalInfo?: string; // Regional specific info
  };
}

export interface RegionalPackage {
  // Existing package fields
  id: string;
  vendorId: string;
  packageName: string;
  packageType: string;
  description: string;
  category: string;
  
  // Pricing (deprecated in favor of regionalPricing)
  packagePrice?: number; // Keep for backward compatibility
  originalPrice?: number;
  discount?: number;
  discountPercentage?: number;
  
  // NEW: Regional Configuration
  regionalAvailability: RegionalAvailability;
  regionalPricing: RegionalPricing[];
  regionalVariations?: RegionalVariations;
  
  // Existing fields
  validityType?: string;
  validityPeriod?: number;
  usageType?: string;
  totalSessions?: number;
  unlimitedUsage?: boolean;
  includedServices?: string[];
  includedServicesDetails?: any[];
  benefits?: string[];
  membershipPerks?: any;
  terms?: string[];
  refundPolicy?: string;
  cancellationPolicy?: string;
  isRecurring?: boolean;
  billingCycle?: string;
  status: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string | null;
  approvedAt?: string | null;
  totalPurchases?: number;
  totalRevenue?: number;
  activeSubscribers?: number;
}

// ============================================
// VALIDATION FUNCTIONS
// ============================================

/**
 * Validates regional availability configuration
 */
export function validateRegionalAvailability(
  availability: RegionalAvailability,
  allRegions: Region[]
): { valid: boolean; error?: string } {
  if (!availability.mode) {
    return { valid: false, error: 'Regional availability mode is required' };
  }
  
  if (!['all', 'specific', 'exclude'].includes(availability.mode)) {
    return { valid: false, error: 'Invalid availability mode' };
  }
  
  if (availability.mode !== 'all') {
    if (!availability.regions || availability.regions.length === 0) {
      return { valid: false, error: 'At least one region must be specified' };
    }
    
    // Validate all regions exist
    const validRegionIds = allRegions.map(r => r.regionId);
    const invalidRegions = availability.regions.filter(r => !validRegionIds.includes(r));
    
    if (invalidRegions.length > 0) {
      return {
        valid: false,
        error: `Invalid regions: ${invalidRegions.join(', ')}`
      };
    }
  }
  
  return { valid: true };
}

/**
 * Validates regional pricing configuration
 */
export function validateRegionalPricing(
  pricing: RegionalPricing[],
  availability: RegionalAvailability,
  allRegions: Region[]
): { valid: boolean; error?: string } {
  if (!pricing || pricing.length === 0) {
    return { valid: false, error: 'At least one regional pricing must be specified' };
  }
  
  // Get regions where package should be available
  let requiredRegions: string[] = [];
  
  if (availability.mode === 'all') {
    requiredRegions = allRegions.filter(r => r.isActive).map(r => r.regionId);
  } else if (availability.mode === 'specific') {
    requiredRegions = availability.regions;
  } else if (availability.mode === 'exclude') {
    const excludedRegions = availability.regions;
    requiredRegions = allRegions
      .filter(r => r.isActive && !excludedRegions.includes(r.regionId))
      .map(r => r.regionId);
  }
  
  // Validate pricing exists for all required regions
  const pricedRegions = pricing.map(p => p.regionId);
  const missingPricing = requiredRegions.filter(r => !pricedRegions.includes(r));
  
  if (missingPricing.length > 0) {
    return {
      valid: false,
      error: `Missing pricing for regions: ${missingPricing.join(', ')}`
    };
  }
  
  // Validate each pricing entry
  for (const price of pricing) {
    const region = allRegions.find(r => r.regionId === price.regionId);
    
    if (!region) {
      return { valid: false, error: `Region ${price.regionId} not found` };
    }
    
    if (!price.basePrice || price.basePrice <= 0) {
      return {
        valid: false,
        error: `Invalid base price for region ${price.regionId}`
      };
    }
    
    if (!price.currency) {
      return { valid: false, error: `Currency required for region ${price.regionId}` };
    }
    
    if (!price.symbol) {
      return { valid: false, error: `Currency symbol required for region ${price.regionId}` };
    }
    
    // Warn if currency doesn't match region (but allow it)
    if (price.currency !== region.currency.code) {
      console.warn(
        `⚠️ Currency mismatch for ${price.regionId}: expected ${region.currency.code}, got ${price.currency}`
      );
    }
  }
  
  return { valid: true };
}

// ============================================
// FILTERING FUNCTIONS
// ============================================

/**
 * Filters packages by region rules
 * 
 * Returns only packages that:
 * 1. Have the service category enabled in region
 * 2. Are available in the region (based on regionalAvailability)
 * 3. Have pricing configured for the region
 */
export async function filterPackagesByRegion(
  packages: RegionalPackage[],
  regionId: string,
  region: Region
): Promise<RegionalPackage[]> {
  console.log(`🔍 [REGIONAL-CATALOG] Filtering ${packages.length} packages for region: ${regionId}`);
  
  const filteredPackages = packages.filter(pkg => {
    // Rule 1: Service category must be enabled in region
    // Map package category to service catalog key
    const serviceCatalogKey = mapCategoryToServiceCatalog(pkg.category);
    
    if (serviceCatalogKey && region.serviceCatalog[serviceCatalogKey] === false) {
      console.log(`❌ Package ${pkg.id} filtered: Category ${pkg.category} disabled in region`);
      return false;
    }
    
    // Rule 2: Package must be available in this region
    if (!isPackageAvailableInRegion(pkg, regionId)) {
      console.log(`❌ Package ${pkg.id} filtered: Not available in region`);
      return false;
    }
    
    // Rule 3: Package must have pricing for this region
    const hasRegionalPricing = pkg.regionalPricing?.some(p => p.regionId === regionId);
    
    if (!hasRegionalPricing) {
      console.log(`❌ Package ${pkg.id} filtered: No pricing for region`);
      return false;
    }
    
    return true;
  });
  
  console.log(`✅ [REGIONAL-CATALOG] ${filteredPackages.length} packages available in ${regionId}`);
  
  return filteredPackages;
}

/**
 * Checks if a package is available in a specific region
 */
export function isPackageAvailableInRegion(
  pkg: RegionalPackage,
  regionId: string
): boolean {
  // If no regional availability set, assume available everywhere (backward compatibility)
  if (!pkg.regionalAvailability) {
    return true;
  }
  
  const { mode, regions } = pkg.regionalAvailability;
  
  if (mode === 'all') {
    return true;
  }
  
  if (mode === 'specific') {
    return regions.includes(regionId);
  }
  
  if (mode === 'exclude') {
    return !regions.includes(regionId);
  }
  
  return false;
}

/**
 * Maps package category to service catalog key
 */
function mapCategoryToServiceCatalog(category: string): keyof Region['serviceCatalog'] | null {
  const categoryMap: Record<string, keyof Region['serviceCatalog']> = {
    'veterinary': 'veterinary',
    'vet': 'veterinary',
    'healthcare': 'veterinary',
    'grooming': 'grooming',
    'training': 'training',
    'walking': 'walking',
    'walker': 'walking',
    'behavioral': 'behavioral',
    'behaviourist': 'behavioral',
    'boarding': 'boarding',
    'adoption': 'adoption',
    'sunset': 'sunset',
    'insurance': 'insurance',
    'pharmacy': 'pharmacy',
    'petcafe': 'petCafe',
    'pet_cafe': 'petCafe',
  };
  
  const normalized = category?.toLowerCase().replace(/[^a-z]/g, '');
  return categoryMap[normalized] || null;
}

/**
 * Enriches packages with regional pricing for a specific region
 */
export function enrichPackagesWithRegionalPricing(
  packages: RegionalPackage[],
  regionId: string,
  region: Region
): any[] {
  return packages.map(pkg => {
    const pricing = pkg.regionalPricing?.find(p => p.regionId === regionId);
    
    if (!pricing) {
      console.warn(`⚠️ Package ${pkg.id} missing pricing for ${regionId}`);
      return pkg;
    }
    
    // Calculate final price with tax
    const taxRate = pricing.taxRate !== undefined ? pricing.taxRate : region.business.taxRate;
    const taxAmount = (pricing.basePrice * taxRate) / 100;
    const finalPrice = pricing.basePrice + taxAmount;
    
    // Get regional variations if any
    const variations = pkg.regionalVariations?.[regionId];
    
    return {
      ...pkg,
      // Add current region pricing
      currentRegionPricing: {
        regionId,
        basePrice: pricing.basePrice,
        currency: pricing.currency,
        symbol: pricing.symbol,
        taxRate,
        taxName: pricing.customTaxName || region.business.taxName,
        taxAmount,
        finalPrice,
      },
      // Apply regional variations
      ...(variations?.name && { packageName: variations.name }),
      ...(variations?.description && { description: variations.description }),
      ...(variations?.duration && { validityPeriod: variations.duration }),
      // Add regional metadata
      regionalMetadata: {
        hasVariations: !!variations,
        restrictions: variations?.restrictions || [],
        additionalInfo: variations?.additionalInfo || '',
      },
    };
  });
}

// ============================================
// API ENDPOINTS
// ============================================

export function regionalCatalogEndpoints(app: Hono, kvStore: any) {
  
  /**
   * Get packages filtered by region
   * GET /make-server-3dd53475/packages/by-region/:regionId
   * 
   * Returns only packages available in the specified region with regional pricing
   */
  app.get('/make-server-3dd53475/packages/by-region/:regionId', async (c) => {
    try {
      const { regionId } = c.req.param();
      
      console.log(`📦 [REGIONAL-CATALOG] Getting packages for region: ${regionId}`);
      
      // Get region configuration
      const region = await kvStore.get<Region>(`region_${regionId}`);
      
      if (!region) {
        return c.json({
          success: false,
          error: `Region ${regionId} not found`
        }, 404);
      }
      
      if (!region.isActive) {
        return c.json({
          success: false,
          error: `Region ${regionId} is not active`
        }, 400);
      }
      
      // Get all packages
      const allPackages = await kvStore.getByPrefix<RegionalPackage>('package:');
      
      console.log(`📋 [REGIONAL-CATALOG] Found ${allPackages.length} total packages`);
      
      // Filter by region rules
      const availablePackages = await filterPackagesByRegion(
        allPackages,
        regionId,
        region
      );
      
      // Enrich with regional pricing
      const enrichedPackages = enrichPackagesWithRegionalPricing(
        availablePackages,
        regionId,
        region
      );
      
      return c.json({
        success: true,
        region: {
          regionId: region.regionId,
          regionName: region.regionName,
          regionCode: region.regionCode,
          currency: region.currency,
          timezone: region.localization.timezone,
        },
        packages: enrichedPackages,
        count: enrichedPackages.length,
        metadata: {
          totalPackagesInSystem: allPackages.length,
          availableInRegion: enrichedPackages.length,
          filteredOut: allPackages.length - enrichedPackages.length,
        },
      });
    } catch (error) {
      console.error('❌ [REGIONAL-CATALOG] Error getting regional packages:', error);
      return c.json({
        success: false,
        error: String(error)
      }, 500);
    }
  });
  
  /**
   * Create package with regional configuration
   * POST /make-server-3dd53475/admin/packages
   * 
   * Creates a new package with regional availability and pricing
   */
  app.post('/make-server-3dd53475/admin/packages', async (c) => {
    try {
      const packageData = await c.req.json();
      
      console.log('📦 [REGIONAL-CATALOG] Creating regional package');
      
      // Validate required fields
      if (!packageData.packageName) {
        return c.json({
          success: false,
          error: 'Package name is required'
        }, 400);
      }
      
      if (!packageData.category) {
        return c.json({
          success: false,
          error: 'Package category is required'
        }, 400);
      }
      
      // Validate regional availability
      if (!packageData.regionalAvailability) {
        return c.json({
          success: false,
          error: 'Regional availability configuration is required'
        }, 400);
      }
      
      // Get all regions for validation
      const allRegions = await kvStore.getByPrefix<Region>('region_');
      
      const availabilityValidation = validateRegionalAvailability(
        packageData.regionalAvailability,
        allRegions
      );
      
      if (!availabilityValidation.valid) {
        return c.json({
          success: false,
          error: availabilityValidation.error
        }, 400);
      }
      
      // Validate regional pricing
      if (!packageData.regionalPricing || packageData.regionalPricing.length === 0) {
        return c.json({
          success: false,
          error: 'Regional pricing is required'
        }, 400);
      }
      
      const pricingValidation = validateRegionalPricing(
        packageData.regionalPricing,
        packageData.regionalAvailability,
        allRegions
      );
      
      if (!pricingValidation.valid) {
        return c.json({
          success: false,
          error: pricingValidation.error
        }, 400);
      }
      
      // Generate package ID
      const packageId = `pkg_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      
      // Create package object
      const packageObj: RegionalPackage = {
        id: packageId,
        vendorId: packageData.vendorId || 'platform', // Platform-created packages
        packageName: packageData.packageName,
        packageType: packageData.packageType || 'bundle',
        description: packageData.description || '',
        category: packageData.category,
        
        // Regional configuration
        regionalAvailability: packageData.regionalAvailability,
        regionalPricing: packageData.regionalPricing,
        regionalVariations: packageData.regionalVariations || {},
        
        // Optional fields
        validityType: packageData.validityType,
        validityPeriod: packageData.validityPeriod,
        usageType: packageData.usageType,
        totalSessions: packageData.totalSessions,
        unlimitedUsage: packageData.unlimitedUsage || false,
        includedServices: packageData.includedServices || [],
        includedServicesDetails: packageData.includedServicesDetails || [],
        benefits: packageData.benefits || [],
        membershipPerks: packageData.membershipPerks,
        terms: packageData.terms || [],
        refundPolicy: packageData.refundPolicy || '',
        cancellationPolicy: packageData.cancellationPolicy || '',
        isRecurring: packageData.isRecurring || false,
        billingCycle: packageData.billingCycle || 'monthly',
        
        // Status
        status: 'active',
        isActive: true,
        
        // Metadata
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        publishedAt: new Date().toISOString(),
        approvedAt: new Date().toISOString(),
        
        // Analytics
        totalPurchases: 0,
        totalRevenue: 0,
        activeSubscribers: 0,
      };
      
      // Save package
      await kvStore.set(`package:${packageId}`, packageObj);
      
      // If vendor-specific, also save with vendor prefix
      if (packageData.vendorId && packageData.vendorId !== 'platform') {
        await kvStore.set(
          `package:vendor:${packageData.vendorId}:${packageId}`,
          packageObj
        );
      }
      
      console.log('✅ [REGIONAL-CATALOG] Package created:', packageId);
      
      return c.json({
        success: true,
        packageId,
        package: packageObj,
      });
    } catch (error) {
      console.error('❌ [REGIONAL-CATALOG] Error creating package:', error);
      return c.json({
        success: false,
        error: String(error)
      }, 500);
    }
  });
  
  /**
   * Update package with regional configuration
   * PUT /make-server-3dd53475/admin/packages/:packageId
   */
  app.put('/make-server-3dd53475/admin/packages/:packageId', async (c) => {
    try {
      const { packageId } = c.req.param();
      const updates = await c.req.json();
      
      console.log('🔄 [REGIONAL-CATALOG] Updating package:', packageId);
      
      // Get existing package
      const existingPackage = await kvStore.get<RegionalPackage>(`package:${packageId}`);
      
      if (!existingPackage) {
        return c.json({
          success: false,
          error: `Package ${packageId} not found`
        }, 404);
      }
      
      // If updating regional configuration, validate
      if (updates.regionalAvailability || updates.regionalPricing) {
        const allRegions = await kvStore.getByPrefix<Region>('region_');
        
        const availability = updates.regionalAvailability || existingPackage.regionalAvailability;
        const pricing = updates.regionalPricing || existingPackage.regionalPricing;
        
        if (updates.regionalAvailability) {
          const availabilityValidation = validateRegionalAvailability(availability, allRegions);
          if (!availabilityValidation.valid) {
            return c.json({
              success: false,
              error: availabilityValidation.error
            }, 400);
          }
        }
        
        if (updates.regionalPricing) {
          const pricingValidation = validateRegionalPricing(pricing, availability, allRegions);
          if (!pricingValidation.valid) {
            return c.json({
              success: false,
              error: pricingValidation.error
            }, 400);
          }
        }
      }
      
      // Update package
      const updatedPackage: RegionalPackage = {
        ...existingPackage,
        ...updates,
        id: packageId, // Ensure ID doesn't change
        updatedAt: new Date().toISOString(),
      };
      
      // Save updated package
      await kvStore.set(`package:${packageId}`, updatedPackage);
      
      // Update vendor-specific copy if exists
      if (existingPackage.vendorId && existingPackage.vendorId !== 'platform') {
        await kvStore.set(
          `package:vendor:${existingPackage.vendorId}:${packageId}`,
          updatedPackage
        );
      }
      
      console.log('✅ [REGIONAL-CATALOG] Package updated:', packageId);
      
      return c.json({
        success: true,
        package: updatedPackage,
      });
    } catch (error) {
      console.error('❌ [REGIONAL-CATALOG] Error updating package:', error);
      return c.json({
        success: false,
        error: String(error)
      }, 500);
    }
  });
  
  /**
   * Get package by ID with regional pricing
   * GET /make-server-3dd53475/packages/:packageId/region/:regionId
   */
  app.get('/make-server-3dd53475/packages/:packageId/region/:regionId', async (c) => {
    try {
      const { packageId, regionId } = c.req.param();
      
      console.log(`📦 [REGIONAL-CATALOG] Getting package ${packageId} for region ${regionId}`);
      
      // Get package
      const pkg = await kvStore.get<RegionalPackage>(`package:${packageId}`);
      
      if (!pkg) {
        return c.json({
          success: false,
          error: `Package ${packageId} not found`
        }, 404);
      }
      
      // Get region
      const region = await kvStore.get<Region>(`region_${regionId}`);
      
      if (!region) {
        return c.json({
          success: false,
          error: `Region ${regionId} not found`
        }, 404);
      }
      
      // Check if package is available in region
      if (!isPackageAvailableInRegion(pkg, regionId)) {
        return c.json({
          success: false,
          error: `Package ${packageId} is not available in region ${regionId}`
        }, 404);
      }
      
      // Enrich with regional pricing
      const enrichedPackages = enrichPackagesWithRegionalPricing([pkg], regionId, region);
      
      return c.json({
        success: true,
        package: enrichedPackages[0],
      });
    } catch (error) {
      console.error('❌ [REGIONAL-CATALOG] Error getting package:', error);
      return c.json({
        success: false,
        error: String(error)
      }, 500);
    }
  });
  
  /**
   * Get active packages count per region
   * GET /make-server-3dd53475/admin/packages/stats/by-region
   */
  app.get('/make-server-3dd53475/admin/packages/stats/by-region', async (c) => {
    try {
      console.log('📊 [REGIONAL-CATALOG] Getting package stats by region');
      
      // Get all regions
      const allRegions = await kvStore.getByPrefix<Region>('region_');
      
      // Get all packages
      const allPackages = await kvStore.getByPrefix<RegionalPackage>('package:');
      
      // Calculate stats for each region
      const stats = await Promise.all(
        allRegions.map(async (region) => {
          const availablePackages = await filterPackagesByRegion(
            allPackages,
            region.regionId,
            region
          );
          
          return {
            regionId: region.regionId,
            regionName: region.regionName,
            regionCode: region.regionCode,
            isActive: region.isActive,
            totalPackages: availablePackages.length,
            packagesByCategory: availablePackages.reduce((acc, pkg) => {
              const category = pkg.category || 'uncategorized';
              acc[category] = (acc[category] || 0) + 1;
              return acc;
            }, {} as Record<string, number>),
          };
        })
      );
      
      return c.json({
        success: true,
        stats,
        totals: {
          totalRegions: allRegions.length,
          activeRegions: allRegions.filter(r => r.isActive).length,
          totalPackages: allPackages.length,
        },
      });
    } catch (error) {
      console.error('❌ [REGIONAL-CATALOG] Error getting stats:', error);
      return c.json({
        success: false,
        error: String(error)
      }, 500);
    }
  });
}

// Export types for use in other files
export type { RegionalPackage, RegionalAvailability, RegionalPricing, RegionalVariations };
