/**
 * ============================================================================
 * PROBLEM GRID VENDOR MATCHER - SQL-ONLY VERSION
 * ============================================================================
 *
 * ✅ SQL-ONLY: Removed all KV usage, using SQL queries only
 *
 * Improved logic for matching vendors to problem grid queries
 * Handles multiple service storage formats and role ID variations
 *
 * CHANGES:
 * - Removed `kv` imports
 * - Replaced all `kv.get()` with SQL queries
 * - Uses `ServicesRepository` for vendor services
 * - Uses `VendorsRepository` for vendor data
 *
 * Date: 2025-01-28
 * Migration: Batch 10 - KV to SQL (2 KV operations removed)
 * ============================================================================
 */

import { getServicesRepository } from '../../lib/repositories/services.ts';
import { getVendorsRepository } from '../../lib/repositories/vendors.ts';
import { getDbClient } from '../../lib/db.ts';
import { 
  buildApplicableRolesSet as buildRolesUniversal,
  filterVendorsByRole,
  vendorRoleMatchesApplicableRoles,
  normalizeRoleId as normalizeRole
} from './role-id-normalizer.tsx';

const db = getDbClient();
const servicesRepo = getServicesRepository();
const vendorsRepo = getVendorsRepository();

export interface VendorServiceMatchResult {
  vendor: any;
  matchedServices: any[];
  serviceCount: number;
  serviceStyles: string[];
}

/**
 * Normalize role IDs for flexible matching
 * Handles both 'role_veterinarian' and 'veterinarian' formats
 * @deprecated Use normalizeRoleId from role-id-normalizer.tsx instead
 */
function normalizeRoleId(roleId: string): string {
  return normalizeRole(roleId) || roleId;
}

/**
 * Check if a vendor's role matches any of the applicable roles from services
 * @deprecated Use vendorRoleMatchesApplicableRoles from role-id-normalizer.tsx instead
 */
export function vendorRoleMatches(vendorRoleId: string, applicableRoles: Set<string>): boolean {
  return vendorRoleMatchesApplicableRoles(vendorRoleId, applicableRoles);
}

/**
 * Build a comprehensive set of applicable roles including variations
 * @deprecated Use buildApplicableRolesSet from role-id-normalizer.tsx instead
 */
export function buildApplicableRolesSet(matchingServices: any[]): Set<string> {
  return buildRolesUniversal(matchingServices);
}

/**
 * Check if vendor has published services that match the problem
 * Handles multiple service storage formats:
 * 1. SQL services table (new structured format)
 * 2. Legacy format (if needed)
 */
export async function vendorHasMatchingServices(
  vendor: any,
  matchingServices: any[],
  matchingServiceNames: Set<string>,
  matchingServiceIds: Set<string>
): Promise<{hasMatch: boolean, matchCount: number, debugInfo: string}> {
  let hasMatch = false;
  let matchCount = 0;
  let debugInfo = '';
  
  // ✅ SQL: Get vendor services from services table
  const vendorServices = await servicesRepo.findByVendor(vendor.vendorId || vendor.id);
  
  if (vendorServices && vendorServices.length > 0) {
    // Group services by service style (if available in metadata)
    const servicesByStyle: Record<string, any[]> = {
      at_home: [],
      at_center: [],
      tele: []
    };
    
    vendorServices.forEach((service: any) => {
      // Check service metadata for style, or default to at_center
      const style = service.metadata?.service_style || service.service_style || 'at_center';
      if (servicesByStyle[style]) {
        servicesByStyle[style].push(service);
      }
    });
    
    // Method 1: Check NEW structure - services by style
    for (const serviceStyle of ['at_home', 'at_center', 'tele']) {
      const allServices = servicesByStyle[serviceStyle];
      if (allServices.length > 0) {
        debugInfo += `${serviceStyle}:${allServices.length} `;
        
        // Filter to only enabled and published services
        const publishedServices = allServices.filter((s: any) => 
          s.is_active === true
        );
        
        if (publishedServices.length > 0) {
          // Match by service ID or name
          const matches = publishedServices.filter((vs: any) => {
            const vsServiceId = vs.id;
            const vsServiceName = vs.name;
            
            // Check if this vendor service matches any of our target services
            const idMatch = vsServiceId && matchingServiceIds.has(vsServiceId);
            const nameMatch = vsServiceName && matchingServiceNames.has(vsServiceName);
            
            return idMatch || nameMatch;
          });
          
          if (matches.length > 0) {
            hasMatch = true;
            matchCount += matches.length;
            debugInfo += `[${serviceStyle}:${matches.length}✓] `;
          }
        }
      }
    }
  }
  
  // Method 2: Check LEGACY structure - if no matches found, check vendor metadata
  if (!hasMatch && vendor.metadata?.enabled_service_ids) {
    const enabledServiceIds = vendor.metadata.enabled_service_ids;
    
    if (Array.isArray(enabledServiceIds) && enabledServiceIds.length > 0) {
      debugInfo += `legacy:${enabledServiceIds.length} `;
      
      // Check if any enabled service IDs match our target service IDs
      const matchedIds = enabledServiceIds.filter((id: string) => matchingServiceIds.has(id));
      
      if (matchedIds.length > 0) {
        hasMatch = true;
        matchCount = matchedIds.length;
        debugInfo += `[legacy:${matchedIds.length}✓] `;
      }
    }
  }
  
  return { hasMatch, matchCount, debugInfo: debugInfo.trim() || 'no-services' };
}

/**
 * Filter vendors by problem - main function
 * Returns only vendors that:
 * 1. Have matching roleId
 * 2. Are approved and active
 * 3. Have published services matching the problem
 */
export async function filterVendorsByProblem(
  allVendors: any[],
  matchingServices: any[],
  applicableRoles: Set<string>
): Promise<any[]> {
  const matchingVendors: any[] = [];
  
  // Build lookup sets for efficient matching
  const matchingServiceNames = new Set(
    matchingServices.map((s: any) => s.serviceName || s.name).filter(Boolean)
  );
  const matchingServiceIds = new Set(
    matchingServices.map((s: any) => s.id || s.serviceId).filter(Boolean)
  );
  
  console.log(`\n🔍 Filtering ${allVendors.length} vendors against ${matchingServices.length} services`);
  console.log(`   Applicable roles:`, Array.from(applicableRoles));
  
  let checkedCount = 0;
  let roleMatchCount = 0;
  let approvedCount = 0;
  
  for (const vendor of allVendors) {
    checkedCount++;
    
    // Step 1: Check role match
    const vendorRoleId = vendor.roleId || vendor.role_id || '';
    const roleMatch = vendorRoleMatches(vendorRoleId, applicableRoles);
    
    if (!roleMatch) {
      continue;
    }
    roleMatchCount++;
    
    // Step 2: Check approval and active status
    const isApproved = vendor.status === 'approved';
    const isActive = vendor.is_active !== false;
    
    if (!isApproved || !isActive) {
      continue;
    }
    approvedCount++;
    
    // Step 3: Check if vendor has published matching services
    const { hasMatch, matchCount, debugInfo } = await vendorHasMatchingServices(
      vendor,
      matchingServices,
      matchingServiceNames,
      matchingServiceIds
    );
    
    if (checkedCount <= 5 || hasMatch) {
      console.log(`   [${checkedCount}] ${vendor.business_name || vendor.businessName || vendor.fullName} (${vendorRoleId}): ${debugInfo}${hasMatch ? ' ✅' : ' ❌'}`);
    }
    
    if (hasMatch) {
      matchingVendors.push({
        ...vendor,
        _matchedServiceCount: matchCount
      });
    }
  }
  
  console.log(`\n📊 Filtering Results:`);
  console.log(`   Total vendors checked: ${checkedCount}`);
  console.log(`   Role matches: ${roleMatchCount}`);
  console.log(`   Approved & active: ${approvedCount}`);
  console.log(`   With matching published services: ${matchingVendors.length}`);
  
  return matchingVendors;
}
