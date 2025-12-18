/**
 * Search Service - Customer Mobile App
 * Elastic search integration for staff, centers, and services
 * Supports problem grid discovery and location-based filtering
 */

import { API_BASE_URL, publicAnonKey } from '../config/api';
import LocationService from './LocationService';

export interface SearchFilters {
  roleId?: string;
  problemId?: string;
  location?: {
    lat: number;
    lng: number;
    radius?: number; // in km, default 50
  };
  minRating?: number;
  maxFee?: number;
  minFee?: number;
  serviceStyle?: 'at_home' | 'at_center' | 'both';
  sortBy?: 'rating' | 'distance' | 'price' | 'relevance';
  entityType?: 'all' | 'staff' | 'center';
}

export interface SearchResult {
  id: string;
  type: 'vendor' | 'staff' | 'center' | 'service';
  entityType?: 'staff' | 'center';
  name: string;
  businessName?: string;
  fullName?: string;
  description?: string;
  rating?: number;
  reviews?: number;
  distance?: number;
  location?: {
    address?: string;
    lat?: number;
    lng?: number;
  };
  specializations?: string[];
  consultationFee?: number;
  serviceStyle?: 'at_home' | 'at_center' | 'both';
  vendorId?: string;
  staffId?: string;
  score?: number; // relevance score
}

export interface SearchResponse {
  results: SearchResult[];
  totalResults: number;
  query: string;
  filters?: SearchFilters;
}

class SearchService {
  /**
   * Universal search - searches vendors, staff, services
   */
  async universalSearch(
    query: string,
    filters: SearchFilters = {}
  ): Promise<SearchResponse> {
    try {
      const response = await fetch(
        `${API_BASE_URL}/advanced-search/universal`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({
            query,
            filters,
            limit: 50,
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        
        // Transform results to unified format
        const results: SearchResult[] = [];
        
        // Add vendors
        if (data.vendors) {
          data.vendors.forEach((vendor: any) => {
            results.push({
              id: vendor.id || vendor.vendorId,
              type: 'vendor',
              entityType: 'center',
              name: vendor.businessName || vendor.name,
              businessName: vendor.businessName,
              description: vendor.description,
              rating: vendor.rating,
              reviews: vendor.totalReviews,
              location: vendor.location,
              distance: vendor.distance,
              serviceStyle: vendor.serviceStyle,
              vendorId: vendor.id || vendor.vendorId,
              score: vendor.score,
            });
          });
        }

        // Add staff
        if (data.staff) {
          data.staff.forEach((staff: any) => {
            results.push({
              id: staff.id || staff.staffId,
              type: 'staff',
              entityType: 'staff',
              name: staff.fullName || staff.name,
              fullName: staff.fullName,
              description: staff.bio,
              rating: staff.rating,
              reviews: staff.reviews,
              specializations: staff.specializations,
              consultationFee: staff.consultationFee,
              serviceStyle: staff.serviceStyle,
              vendorId: staff.vendorId,
              staffId: staff.id || staff.staffId,
              score: staff.score,
            });
          });
        }

        return {
          results,
          totalResults: data.totalResults || results.length,
          query,
          filters,
        };
      }

      return { results: [], totalResults: 0, query, filters };
    } catch (error) {
      console.error('Universal search error:', error);
      return { results: [], totalResults: 0, query, filters };
    }
  }

  /**
   * Problem-based discovery
   * Uses problem grid to find relevant vendors/staff
   */
  async discoverByProblem(
    problemId: string,
    roleId: string,
    filters: SearchFilters = {}
  ): Promise<SearchResponse> {
    try {
      const params = new URLSearchParams({
        problemGridId: problemId,
        roleId: roleId,
        sortBy: filters.sortBy || 'rating',
        feeMin: (filters.minFee || 0).toString(),
        feeMax: (filters.maxFee || 999999).toString(),
      });

      // Add location if available
      if (filters.location) {
        params.append('lat', filters.location.lat.toString());
        params.append('lon', filters.location.lng.toString());
        if (filters.location.radius) {
          params.append('radius', filters.location.radius.toString());
        }
      }

      const response = await fetch(
        `${API_BASE_URL}/customer/universal-problem-discovery?${params}`,
        {
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        
        // Transform results
        const results: SearchResult[] = (data.results || []).map((result: any) => ({
          id: result.id || result.vendorId || result.staffId,
          type: result.entityType === 'center' ? 'vendor' : 'staff',
          entityType: result.entityType,
          name: result.businessName || result.fullName || result.name,
          businessName: result.businessName,
          fullName: result.fullName,
          description: result.description || result.bio,
          rating: result.rating,
          reviews: result.totalReviews || result.reviews,
          distance: result.distance,
          location: result.location,
          specializations: result.specializations,
          consultationFee: result.consultationFee || result.fee,
          serviceStyle: result.serviceStyle,
          vendorId: result.vendorId,
          staffId: result.staffId,
        }));

        return {
          results,
          totalResults: results.length,
          query: `Problem: ${problemId}`,
          filters,
        };
      }

      return { results: [], totalResults: 0, query: `Problem: ${problemId}`, filters };
    } catch (error) {
      console.error('Problem discovery error:', error);
      return { results: [], totalResults: 0, query: `Problem: ${problemId}`, filters };
    }
  }

  /**
   * Enhanced problem-based discovery (v2 API)
   * More advanced filtering and results
   */
  async discoverByProblemV2(
    problemId: string,
    roleId: string,
    filters: SearchFilters = {}
  ): Promise<SearchResponse> {
    try {
      const params = new URLSearchParams();
      
      if (filters.location) {
        params.append('lat', filters.location.lat.toString());
        params.append('lng', filters.location.lng.toString());
        params.append('radius', (filters.location.radius || 50).toString());
      }

      const response = await fetch(
        `${API_BASE_URL}/customer/discover-by-problem-v2/${roleId}/${problemId}?${params}`,
        {
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        
        const results: SearchResult[] = (data.results || []).map((result: any) => ({
          id: result.id || result.vendorId || result.staffId,
          type: result.entityType === 'center' ? 'vendor' : 'staff',
          entityType: result.entityType,
          name: result.businessName || result.fullName || result.name,
          businessName: result.businessName,
          fullName: result.fullName,
          description: result.description || result.bio,
          rating: result.rating,
          reviews: result.totalReviews || result.reviews,
          distance: result.distance,
          location: result.location,
          specializations: result.specializations,
          consultationFee: result.consultationFee || result.fee,
          serviceStyle: result.serviceStyle,
          vendorId: result.vendorId,
          staffId: result.staffId,
        }));

        return {
          results,
          totalResults: results.length,
          query: `Problem: ${problemId}`,
          filters,
        };
      }

      return { results: [], totalResults: 0, query: `Problem: ${problemId}`, filters };
    } catch (error) {
      console.error('Problem discovery v2 error:', error);
      return { results: [], totalResults: 0, query: `Problem: ${problemId}`, filters };
    }
  }

  /**
   * Get user location for search
   */
  async getUserLocation(): Promise<{ lat: number; lng: number } | null> {
    try {
      const hasPermission = await LocationService.requestLocationPermission();
      if (!hasPermission) {
        return null;
      }

      const location = await LocationService.getCurrentLocation();
      if (location) {
        return {
          lat: location.latitude,
          lng: location.longitude,
        };
      }

      return null;
    } catch (error) {
      console.error('Error getting user location:', error);
      return null;
    }
  }

  /**
   * Search with automatic location detection
   */
  async searchWithLocation(
    query: string,
    filters: SearchFilters = {}
  ): Promise<SearchResponse> {
    // Get location if not provided
    if (!filters.location) {
      const location = await this.getUserLocation();
      if (location) {
        filters.location = {
          ...location,
          radius: 50, // default 50km radius
        };
      }
    }

    // ✅ NEW: Try enhanced search first, fallback to universal search
    try {
      return await this.enhancedSearch(query, filters);
    } catch (error) {
      console.warn('Enhanced search failed, falling back to universal search:', error);
      return this.universalSearch(query, filters);
    }
  }

  /**
   * ✅ NEW: Enhanced search using Elasticsearch endpoints
   * Falls back to universal search if Elasticsearch unavailable
   */
  async enhancedSearch(
    query: string,
    filters: SearchFilters = {}
  ): Promise<SearchResponse> {
    try {
      const params = new URLSearchParams({
        q: query,
        limit: '20',
        offset: '0',
        sortBy: filters.sortBy || 'relevance',
      });

      if (filters.roleId) {
        params.append('roleId', filters.roleId);
      }

      if (filters.location) {
        params.append('lat', filters.location.lat.toString());
        params.append('lng', filters.location.lng.toString());
        params.append('radius', (filters.location.radius || 10).toString() + 'km');
      }

      if (filters.minFee !== undefined) {
        params.append('priceMin', filters.minFee.toString());
      }

      if (filters.maxFee !== undefined) {
        params.append('priceMax', filters.maxFee.toString());
      }

      // Search vendors
      const vendorResponse = await fetch(
        `${API_BASE_URL}/search/vendors/enhanced?${params}`,
        {
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
          },
        }
      );

      // Search staff
      const staffResponse = await fetch(
        `${API_BASE_URL}/search/staff/enhanced?${params}`,
        {
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
          },
        }
      );

      const results: SearchResult[] = [];

      if (vendorResponse.ok) {
        const vendorData = await vendorResponse.json();
        if (vendorData.results) {
          vendorData.results.forEach((vendor: any) => {
            results.push({
              id: vendor.id,
              type: 'vendor',
              entityType: 'center',
              name: vendor.businessName || vendor.name,
              businessName: vendor.businessName,
              description: vendor.description,
              rating: vendor.rating,
              reviews: vendor.reviews,
              distance: vendor.distance,
              location: vendor.location,
              serviceStyle: vendor.serviceStyle,
              vendorId: vendor.id,
              score: vendor.score,
            });
          });
        }
      }

      if (staffResponse.ok) {
        const staffData = await staffResponse.json();
        if (staffData.results) {
          staffData.results.forEach((staff: any) => {
            results.push({
              id: staff.id,
              type: 'staff',
              entityType: 'staff',
              name: staff.fullName || staff.name,
              fullName: staff.fullName,
              description: staff.bio,
              rating: staff.rating,
              reviews: staff.reviews,
              specializations: staff.specializations,
              consultationFee: staff.consultationFee,
              serviceStyle: staff.serviceStyle,
              vendorId: staff.vendorId,
              staffId: staff.id,
              score: staff.score,
            });
          });
        }
      }

      // Filter by entity type if specified
      let filteredResults = results;
      if (filters.entityType && filters.entityType !== 'all') {
        filteredResults = results.filter(
          (r) => r.entityType === filters.entityType
        );
      }

      // Sort results
      if (filters.sortBy === 'distance' && filters.location) {
        filteredResults.sort((a, b) => (a.distance || 0) - (b.distance || 0));
      } else if (filters.sortBy === 'rating') {
        filteredResults.sort((a, b) => (b.rating || 0) - (a.rating || 0));
      } else if (filters.sortBy === 'price') {
        filteredResults.sort((a, b) => (a.consultationFee || 0) - (b.consultationFee || 0));
      }

      return {
        results: filteredResults,
        totalResults: filteredResults.length,
        query,
        filters,
      };
    } catch (error) {
      console.error('Enhanced search error:', error);
      throw error; // Let caller handle fallback
    }
  }
}

export default new SearchService();

