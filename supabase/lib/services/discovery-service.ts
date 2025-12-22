/**
 * DISCOVERY SERVICE
 * SQL-based service for problem-driven discovery
 * NO KV STORE - All data from SQL
 */

import { getDiscoveryRepository, DiscoveryRepository } from "../repositories/discovery.ts";
import { findProblemById, getProblemGridByRole } from "../../functions/server/problem-grid-catalog.tsx";
import { subcategoryIdToNames, serviceMatchesSubcategories } from "../../functions/server/problem-subcategory-mapping.tsx";

export interface DiscoveryRequest {
  problemGridId?: string;
  roleId: string;
  customerLat?: number;
  customerLon?: number;
  maxDistance?: number;
  feeMin?: number;
  feeMax?: number;
  sortBy?: 'rating' | 'distance' | 'fee_low' | 'fee_high' | 'experience';
}

export interface DiscoveryResult {
  vendors: any[];
  staff: any[];
  totalCount: number;
  problemGrid?: {
    id: string;
    displayName: string;
    description: string;
    icon: string;
    mappedSubCategories: string[];
  };
}

export class DiscoveryService {
  private discoveryRepo: DiscoveryRepository;

  constructor(discoveryRepo?: DiscoveryRepository) {
    this.discoveryRepo = discoveryRepo || getDiscoveryRepository();
  }

  /**
   * Discover vendors and staff by problem grid
   */
  async discoverByProblemGrid(request: DiscoveryRequest): Promise<DiscoveryResult> {
    const { problemGridId, roleId, customerLat, customerLon, maxDistance, feeMin, feeMax, sortBy } = request;

    // Step 1: Get problem grid configuration
    let problemGrid = null;
    let requiredSubCategories: string[] = [];

    if (problemGridId) {
      problemGrid = findProblemById(problemGridId);
      
      if (!problemGrid) {
        throw new Error(`Problem grid not found: ${problemGridId}`);
      }

      requiredSubCategories = problemGrid.mappedSubCategories || [];

      if (requiredSubCategories.length === 0) {
        console.warn(`⚠️ Problem grid ${problemGridId} has no mapped subcategories`);
        return {
          vendors: [],
          staff: [],
          totalCount: 0,
          problemGrid: {
            id: problemGridId,
            displayName: problemGrid.displayName || problemGrid.name,
            description: problemGrid.description || '',
            icon: problemGrid.icon || '🔍',
            mappedSubCategories: []
          }
        };
      }
    }

    // Step 2: Search vendors by subcategories
    const vendors = await this.discoveryRepo.searchVendorsBySubcategories(
      roleId,
      requiredSubCategories,
      customerLat,
      customerLon,
      maxDistance
    );

    // Step 3: Search staff by subcategories (with availability check)
    const staff = await this.discoveryRepo.searchStaffBySubcategories(
      roleId,
      requiredSubCategories,
      customerLat,
      customerLon,
      maxDistance,
      true // TASK 1: Check schedule availability
    );

    // Step 4: Apply fee filters
    let filteredVendors = vendors;
    let filteredStaff = staff;

    if (feeMin !== undefined || feeMax !== undefined) {
      filteredStaff = staff.filter(s => {
        const fee = s.consultationFee || 0;
        return (!feeMin || fee >= feeMin) && (!feeMax || fee <= feeMax);
      });
    }

    // Step 5: Sort results
    if (sortBy === 'distance' && customerLat && customerLon) {
      filteredVendors.sort((a, b) => (a.distance || 999) - (b.distance || 999));
      filteredStaff.sort((a, b) => (a.distance || 999) - (b.distance || 999));
    } else if (sortBy === 'rating') {
      filteredVendors.sort((a, b) => (b.rating || 0) - (a.rating || 0));
      filteredStaff.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    } else if (sortBy === 'fee_low') {
      filteredStaff.sort((a, b) => (a.consultationFee || 0) - (b.consultationFee || 0));
    } else if (sortBy === 'fee_high') {
      filteredStaff.sort((a, b) => (b.consultationFee || 0) - (a.consultationFee || 0));
    }

    // Step 6: Format results
    const formattedVendors = filteredVendors.map(v => ({
      entityType: 'center',
      entityId: v.vendorId,
      vendorId: v.vendorId,
      name: v.businessName,
      businessName: v.businessName,
      address: v.location.address,
      city: v.location.city,
      state: v.location.state,
      location: {
        coordinates: {
          lat: v.location.latitude,
          lng: v.location.longitude
        },
        address: v.location.address
      },
      distance: v.distance,
      rating: v.rating,
      reviewCount: v.totalReviews,
      staffCount: v.staffCount,
      serviceCount: v.matchingServices.length,
      matchingServices: v.matchingServices.length
    }));

    const formattedStaff = filteredStaff.map(s => ({
      entityType: 'staff',
      entityId: s.staffId,
      staffId: s.staffId,
      fullName: s.fullName,
      name: s.fullName,
      specialization: s.specialization,
      specializations: s.specializations,
      consultationFee: s.consultationFee,
      rating: s.rating,
      services: s.services,
      serviceCount: s.services.length,
      distance: s.distance,
      vendorId: s.vendorId
    }));

    return {
      vendors: formattedVendors,
      staff: formattedStaff,
      totalCount: formattedVendors.length + formattedStaff.length,
      problemGrid: problemGrid ? {
        id: problemGrid.id || problemGridId || '',
        displayName: problemGrid.displayName || problemGrid.name,
        description: problemGrid.description || '',
        icon: problemGrid.icon || '🔍',
        mappedSubCategories: requiredSubCategories
      } : undefined
    };
  }

  /**
   * Validate vendor status (approved and active)
   */
  async validateVendorStatus(vendorId: string): Promise<boolean> {
    const vendors = await this.discoveryRepo.getEligibleVendors('');
    return vendors.some(v => v.vendorId === vendorId);
  }

  /**
   * Validate service is published and enabled
   */
  async validateServicePublished(vendorId: string, serviceId: string): Promise<boolean> {
    const services = await this.discoveryRepo.getVendorPublishedServices(vendorId);
    return services.some(s => s.serviceId === serviceId);
  }

  /**
   * Update search indexes when data changes
   */
  async syncSearchIndexes(entityType: 'vendor' | 'staff', entityId: string): Promise<void> {
    if (entityType === 'vendor') {
      await this.discoveryRepo.updateVendorSearchIndex(entityId);
    } else if (entityType === 'staff') {
      await this.discoveryRepo.updateStaffSearchIndex(entityId);
    }
  }
}

let discoveryServiceInstance: DiscoveryService | null = null;

export function getDiscoveryService(): DiscoveryService {
  if (!discoveryServiceInstance) {
    discoveryServiceInstance = new DiscoveryService();
  }
  return discoveryServiceInstance;
}

