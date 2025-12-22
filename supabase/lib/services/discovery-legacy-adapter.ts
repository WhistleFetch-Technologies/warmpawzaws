/**
 * DISCOVERY LEGACY ADAPTER
 * Adapter to migrate legacy KV-based discovery endpoints to SQL
 * TASKS 3-6: Update legacy endpoints
 */

import { getDiscoveryService, DiscoveryRequest } from "./discovery-service.ts";
import { getDiscoveryRepository } from "../repositories/discovery.ts";

/**
 * Adapter for universal-problem-discovery.tsx
 * Converts KV-based queries to SQL-based
 */
export async function adaptUniversalProblemDiscovery(params: {
  problemGridId?: string;
  roleId: string;
  customerLat?: number;
  customerLon?: number;
  feeMin?: number;
  feeMax?: number;
  sortBy?: string;
}) {
  const discoveryService = getDiscoveryService();
  
  const request: DiscoveryRequest = {
    problemGridId: params.problemGridId,
    roleId: params.roleId,
    customerLat: params.customerLat,
    customerLon: params.customerLon,
    feeMin: params.feeMin,
    feeMax: params.feeMax,
    sortBy: (params.sortBy || 'rating') as any
  };

  return await discoveryService.discoverByProblemGrid(request);
}

/**
 * Adapter for enhanced-problem-discovery.tsx
 * Converts KV-based queries to SQL-based
 */
export async function adaptEnhancedProblemDiscovery(params: {
  roleId: string;
  problemId: string;
  lat?: number;
  lng?: number;
  radius?: number;
}) {
  const discoveryService = getDiscoveryService();
  
  const request: DiscoveryRequest = {
    problemGridId: params.problemId,
    roleId: params.roleId,
    customerLat: params.lat,
    customerLon: params.lng,
    maxDistance: params.radius
  };

  return await discoveryService.discoverByProblemGrid(request);
}

/**
 * Adapter for universal-staff-problem-search.tsx
 * Converts KV-based queries to SQL-based
 */
export async function adaptStaffProblemSearch(params: {
  roleId: string;
  problemId: string;
  lat?: number;
  lng?: number;
  radius?: number;
  limit?: number;
  offset?: number;
}) {
  const discoveryRepo = getDiscoveryRepository();
  const { findProblemById } = await import("../../functions/server/problem-grid-catalog.tsx");
  
  const problem = findProblemById(params.problemId);
  if (!problem) {
    throw new Error('Problem not found');
  }

  const requiredSubCategories = problem.mappedSubCategories || [];
  
  const staff = await discoveryRepo.searchStaffBySubcategories(
    params.roleId,
    requiredSubCategories,
    params.lat,
    params.lng,
    params.radius,
    true // Check availability
  );

  // Paginate
  const total = staff.length;
  const paginatedStaff = staff.slice(params.offset || 0, (params.offset || 0) + (params.limit || 20));

  return {
    staff: paginatedStaff,
    total,
    problem
  };
}

/**
 * Adapter for staff-discovery-endpoints.tsx
 * Converts KV-based queries to SQL-based
 */
export async function adaptStaffDiscovery(params: {
  roleId: string;
  serviceStyle: 'at_home' | 'at_center' | 'tele';
  latitude?: number;
  longitude?: number;
  maxDistance?: number;
  serviceId?: string;
}) {
  const discoveryRepo = getDiscoveryRepository();
  
  // Get all eligible vendors for the role
  const vendors = await discoveryRepo.getEligibleVendors(params.roleId);
  const results: any[] = [];

  for (const vendor of vendors) {
    const staff = await discoveryRepo.getVendorStaff(vendor.vendorId);

    for (const staffMember of staff) {
      // Filter by service style
      const hasServiceStyle = staffMember.services.some(s => s.serviceStyle === params.serviceStyle);
      if (!hasServiceStyle) continue;

      // Filter by specific service if provided
      if (params.serviceId) {
        const hasService = staffMember.services.some(s => s.serviceId === params.serviceId);
        if (!hasService) continue;
      }

      // Check distance for at_home services
      if (params.serviceStyle === 'at_home' && params.latitude && params.longitude) {
        const distance = discoveryRepo.calculateDistance(
          params.latitude,
          params.longitude,
          vendor.location.latitude,
          vendor.location.longitude
        );

        if (params.maxDistance && distance > params.maxDistance) {
          continue;
        }

        staffMember.distance = distance;
      }

      // Check availability
      const hasAvailability = await discoveryRepo.checkStaffAvailability(staffMember.staffId);
      if (!hasAvailability) continue;

      results.push({
        ...staffMember,
        vendorName: vendor.businessName,
        vendorLocation: vendor.location
      });
    }
  }

  return results;
}

