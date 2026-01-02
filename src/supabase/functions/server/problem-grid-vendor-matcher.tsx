/**
 * PROBLEM GRID VENDOR MATCHER
 * Improved logic for matching vendors to problem grid queries
 * Handles multiple service storage formats and role ID variations
 */

// ✅ SQL MIGRATION: All KV operations replaced with SQL repositories
import { getDbClient } from '../../../supabase/lib/db';
import { 
  buildApplicableRolesSet as buildRolesUniversal,
  filterVendorsByRole,
  vendorRoleMatchesApplicableRoles,
  normalizeRoleId as normalizeRole
} from './role-id-normalizer';

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
 * 1. vendor_services:${vendorId}:at_home|at_center|tele (new structured format)
 * 2. vendor:${vendorId}:services (array of enabled service IDs - legacy)
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
  
  // ✅ SQL: Method 1: Check NEW structure - vendor_services table
  const db = getDbClient();
  for (const serviceStyle of ['at_home', 'at_center', 'tele']) {
    const { data: vendorServicesData } = await db
      .from('vendor_services')
      .select('*')
      .eq('vendor_id', vendor.vendorId)
      .eq('service_style', serviceStyle)
      .eq('is_enabled', true)
      .in('publish_status', ['published', 'auto_published']);
    
    if (vendorServicesData && vendorServicesData.length > 0) {
      const allServices = vendorServicesData;
      debugInfo += `${serviceStyle}:${allServices.length} `;
      
      // Services are already filtered by SQL query, no need to filter again
      const publishedServices = allServices.map((s: any) => ({
        serviceId: s.service_id,
        serviceName: s.service_name,
        id: s.id,
        name: s.service_name,
        isEnabled: s.is_enabled,
        publishStatus: s.publish_status
      }));
      
      if (publishedServices.length > 0) {
        // Match by service ID or name
        const matches = publishedServices.filter((vs: any) => {
          const vsServiceId = vs.serviceId || vs.id;
          const vsServiceName = vs.serviceName || vs.name;
          
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
  
  // ✅ SQL: Method 2: Check services table (legacy support)
  if (!hasMatch) {
    const { data: legacyServices } = await db
      .from('services')
      .select('id')
      .eq('vendor_id', vendor.vendorId)
      .eq('is_active', true);
    
    const enabledServiceIds = legacyServices?.map((s: any) => s.id) || [];
    
    if (enabledServiceIds.length > 0) {
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
    matchingServices.map((s: any) => s.serviceName).filter(Boolean)
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
    const vendorRoleId = vendor.roleId || '';
    const roleMatch = vendorRoleMatches(vendorRoleId, applicableRoles);
    
    if (!roleMatch) {
      continue;
    }
    roleMatchCount++;
    
    // Step 2: Check approval and active status
    const isApproved = vendor.status === 'approved';
    const isActive = vendor.isActive !== false;
    
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
      console.log(`   [${checkedCount}] ${vendor.businessName || vendor.fullName} (${vendorRoleId}): ${debugInfo}${hasMatch ? ' ✅' : ' ❌'}`);
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