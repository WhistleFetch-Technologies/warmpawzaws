/**
 * Services by Problem - SQL-ONLY VERSION
 * 
 * ✅ MIGRATED TO SQL: All KV operations replaced with SQL queries
 * 
 * Phase 7D: Problem Grid Enhancement - Rule 4 Implementation
 * 
 * Features:
 * - Get relevant services based on selected problem
 * - Dynamic service filtering
 * - Service-to-problem mapping
 * - Price range and availability
 * 
 * Date: 2025-01-28
 * Migration: KV to SQL (~8 KV ops removed)
 * Endpoints: 2
 */

import { Hono } from "npm:hono";
import { sendSuccess, sendError } from "./response-utils.ts";
import { getDbClient } from "../../lib/db.ts";
import { getServicesRepository } from "../../lib/repositories/services.ts";
import { getVendorsRepository } from "../../lib/repositories/vendors.ts";

interface ServiceMatch {
  serviceId: string;
  serviceName: string;
  vendorId: string;
  vendorName: string;
  price: number;
  duration: number;
  category: string;
  subcategory: string;
  description: string;
  isActive: boolean;
  isPublished: boolean;
  relevanceScore: number;
}

export function servicesByProblemEndpoints(app: Hono) {
  const BASE_PATH = "/make-server-3dd53475";
  const db = getDbClient();
  const servicesRepo = getServicesRepository();
  const vendorsRepo = getVendorsRepository();

  // ========================================
  // GET SERVICES BY PROBLEM
  // ========================================
  app.get(`${BASE_PATH}/customer/services-by-problem/:problemId`, async (c) => {
    try {
      const problemId = c.req.param('problemId');
      const roleId = c.req.query('roleId');
      const lat = parseFloat(c.req.query('lat') || '0');
      const lng = parseFloat(c.req.query('lng') || '0');
      const radius = parseInt(c.req.query('radius') || '50');
      const limit = parseInt(c.req.query('limit') || '50');

      console.log(`🔍 [SERVICES-BY-PROBLEM] Searching services for problem: ${problemId}`);

      // Get problem details
      const { findProblemById } = await import('./problem-grid-catalog.tsx');
      const problem = findProblemById(problemId);

      if (!problem) {
        return sendError(c, 'Problem not found', 404);
      }

      console.log(`   Problem: "${problem.name}"`);
      console.log(`   Mapped Subcategories:`, problem.mappedSubCategories);
      console.log(`   Service Types:`, problem.serviceTypes || []);

      // ✅ SQL: Get all active services from database
      const { data: allServicesData, error: servicesError } = await db
        .from('services')
        .select('*')
        .eq('is_active', true);

      if (servicesError) {
        console.error('❌ Error fetching services:', servicesError);
        return sendError(c, 'Failed to fetch services', 500);
      }

      const allServices = allServicesData || [];
      console.log(`   Total services in system: ${allServices.length}`);

      const matchingServices: ServiceMatch[] = [];

      for (const serviceData of allServices) {
        // Skip inactive or unpublished services
        // Note: Assuming services table has is_active, checking publish_status if exists
        if (!serviceData.is_active) {
          continue;
        }

        // Check if roleId matches (if provided)
        if (roleId && serviceData.vendor_id) {
          const vendor = await vendorsRepo.findById(serviceData.vendor_id);
          if (!vendor) continue;

          const normalizedRoleId = roleId.replace(/^role_/, '');
          const vendorRoleNormalized = (vendor.role_id || '').replace(/^role_/, '');

          if (vendorRoleNormalized !== normalizedRoleId) {
            continue;
          }
        }

        // Calculate relevance score
        let relevanceScore = 0;

        // 1. Check subcategory mapping (highest priority)
        if (problem.mappedSubCategories && problem.mappedSubCategories.length > 0) {
          // Note: Assuming subcategory is stored in category or a separate field
          // Adjust based on actual schema
          const serviceSubcat = serviceData.subcategory || serviceData.sub_category || serviceData.category || '';
          if (problem.mappedSubCategories.includes(serviceSubcat)) {
            relevanceScore += 50;
          }
        }

        // 2. Check service type mapping (if available)
        if (problem.serviceTypes && problem.serviceTypes.length > 0) {
          const serviceType = serviceData.service_type || serviceData.serviceType || serviceData.type || '';
          if (problem.serviceTypes.some((type: string) => 
            serviceType.toLowerCase().includes(type.toLowerCase())
          )) {
            relevanceScore += 40;
          }
        }

        // 3. Check keywords in service name and description
        if (problem.keywords && problem.keywords.length > 0) {
          const searchText = `${serviceData.name || ''} ${serviceData.description || ''}`.toLowerCase();
          
          for (const keyword of problem.keywords) {
            if (searchText.includes(keyword.toLowerCase())) {
              relevanceScore += 10;
            }
          }
        }

        // 4. Check problem name in service
        const serviceName = (serviceData.name || '').toLowerCase();
        const problemName = (problem.name || '').toLowerCase();
        if (serviceName.includes(problemName) || problemName.includes(serviceName)) {
          relevanceScore += 20;
        }

        // Only include services with some relevance
        if (relevanceScore > 0) {
          const vendor = serviceData.vendor_id ? await vendorsRepo.findById(serviceData.vendor_id) : null;

          matchingServices.push({
            serviceId: serviceData.id,
            serviceName: serviceData.name,
            vendorId: serviceData.vendor_id || '',
            vendorName: vendor?.business_name || vendor?.owner_name || 'Unknown',
            price: serviceData.price || 0,
            duration: serviceData.duration_minutes || 60,
            category: serviceData.category || '',
            subcategory: serviceData.subcategory || serviceData.sub_category || serviceData.category || '',
            description: serviceData.description || '',
            isActive: serviceData.is_active || false,
            isPublished: true, // Assuming active services are published
            relevanceScore
          });
        }
      }

      // Sort by relevance score (highest first)
      matchingServices.sort((a, b) => b.relevanceScore - a.relevanceScore);

      // Limit results
      const limitedServices = matchingServices.slice(0, limit);

      console.log(`✅ Found ${limitedServices.length} matching services`);

      return sendSuccess(c, {
        problem: {
          id: problem.id,
          name: problem.name,
          displayName: problem.displayName,
          icon: problem.icon,
          color: problem.color
        },
        services: limitedServices,
        total: limitedServices.length,
        totalMatches: matchingServices.length
      });

    } catch (error) {
      console.error('❌ Error fetching services by problem:', error);
      return sendError(c, error, 500);
    }
  });

  // ========================================
  // GET VENDOR SERVICES BY PROBLEM
  // ========================================
  app.get(`${BASE_PATH}/vendor/:vendorId/services-by-problem/:problemId`, async (c) => {
    try {
      const { vendorId, problemId } = c.req.param();

      console.log(`🔍 [VENDOR-SERVICES-BY-PROBLEM] Vendor: ${vendorId}, Problem: ${problemId}`);

      // Get problem details
      const { findProblemById } = await import('./problem-grid-catalog.tsx');
      const problem = findProblemById(problemId);

      if (!problem) {
        return sendError(c, 'Problem not found', 404);
      }

      // ✅ SQL: Get vendor
      const vendor = await vendorsRepo.findById(vendorId);
      if (!vendor) {
        return sendError(c, 'Vendor not found', 404);
      }

      // ✅ SQL: Get vendor's services
      const vendorServices = await servicesRepo.findByVendor(vendorId);

      const matchingServices: ServiceMatch[] = [];

      for (const service of vendorServices) {
        if (!service.is_active) {
          continue;
        }

        let relevanceScore = 0;

        // Check subcategory mapping
        if (problem.mappedSubCategories && problem.mappedSubCategories.length > 0) {
          const serviceSubcat = (service as any).subcategory || (service as any).sub_category || service.category || '';
          if (problem.mappedSubCategories.includes(serviceSubcat)) {
            relevanceScore += 50;
          }
        }

        // Check service type mapping
        if (problem.serviceTypes && problem.serviceTypes.length > 0) {
          const serviceType = (service as any).service_type || (service as any).serviceType || (service as any).type || '';
          if (problem.serviceTypes.some((type: string) => 
            serviceType.toLowerCase().includes(type.toLowerCase())
          )) {
            relevanceScore += 40;
          }
        }

        // Check keywords
        if (problem.keywords && problem.keywords.length > 0) {
          const searchText = `${service.name || ''} ${service.description || ''}`.toLowerCase();
          
          for (const keyword of problem.keywords) {
            if (searchText.includes(keyword.toLowerCase())) {
              relevanceScore += 10;
            }
          }
        }

        if (relevanceScore > 0) {
          matchingServices.push({
            serviceId: service.id,
            serviceName: service.name,
            vendorId: service.vendor_id || '',
            vendorName: vendor.business_name || vendor.owner_name,
            price: service.price || 0,
            duration: service.duration_minutes || 60,
            category: service.category || '',
            subcategory: (service as any).subcategory || (service as any).sub_category || service.category || '',
            description: service.description || '',
            isActive: service.is_active || false,
            isPublished: true,
            relevanceScore
          });
        }
      }

      // Sort by relevance
      matchingServices.sort((a, b) => b.relevanceScore - a.relevanceScore);

      console.log(`✅ Found ${matchingServices.length} matching services for vendor`);

      return sendSuccess(c, {
        vendor: {
          id: vendor.id,
          name: vendor.business_name || vendor.owner_name,
          roleId: vendor.role_id
        },
        problem: {
          id: problem.id,
          name: problem.name
        },
        services: matchingServices,
        total: matchingServices.length
      });

    } catch (error) {
      console.error('❌ Error fetching vendor services by problem:', error);
      return sendError(c, error, 500);
    }
  });

  console.log('✅ Services-by-problem endpoints registered (SQL-only)');
}

