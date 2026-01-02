import { Hono } from "hono";
import { sendSuccess, sendError } from "./response-utils";
import * as kv from "./kv_store";

/**
 * 🔍 SERVICES BY PROBLEM ENDPOINT
 * 
 * Phase 7D: Problem Grid Enhancement - Rule 4 Implementation
 * 
 * Features:
 * - Get relevant services based on selected problem
 * - Dynamic service filtering
 * - Service-to-problem mapping
 * - Price range and availability
 */

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

export function servicesByProblemEndpoints(app: Hono, kvStore: any) {
  const BASE_PATH = "/make-server-3dd53475";

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

      // Get all services from KV store
      const allServices = await kvStore.getByPrefix('service:') || [];

      console.log(`   Total services in system: ${allServices.length}`);

      const matchingServices: ServiceMatch[] = [];

      for (const serviceData of allServices) {
        // Skip inactive or unpublished services
        if (!serviceData.isActive || !serviceData.isPublished) {
          continue;
        }

        // Check if roleId matches (if provided)
        if (roleId) {
          const vendor = await kvStore.get(`vendor:${serviceData.vendorId}`);
          if (!vendor) continue;

          const normalizedRoleId = roleId.replace(/^role_/, '');
          const vendorRoleNormalized = (vendor.roleId || '').replace(/^role_/, '');

          if (vendorRoleNormalized !== normalizedRoleId) {
            continue;
          }
        }

        // Calculate relevance score
        let relevanceScore = 0;

        // 1. Check subcategory mapping (highest priority)
        if (problem.mappedSubCategories && problem.mappedSubCategories.length > 0) {
          const serviceSubcat = serviceData.subcategory || serviceData.subCategory || '';
          if (problem.mappedSubCategories.includes(serviceSubcat)) {
            relevanceScore += 50;
          }
        }

        // 2. Check service type mapping (if available)
        if (problem.serviceTypes && problem.serviceTypes.length > 0) {
          const serviceType = serviceData.serviceType || serviceData.type || '';
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
          const vendor = await kvStore.get(`vendor:${serviceData.vendorId}`);

          matchingServices.push({
            serviceId: serviceData.id || serviceData.serviceId,
            serviceName: serviceData.name || serviceData.serviceName,
            vendorId: serviceData.vendorId,
            vendorName: vendor?.businessName || vendor?.name || 'Unknown',
            price: serviceData.price || 0,
            duration: serviceData.duration || 60,
            category: serviceData.category || '',
            subcategory: serviceData.subcategory || serviceData.subCategory || '',
            description: serviceData.description || '',
            isActive: serviceData.isActive,
            isPublished: serviceData.isPublished,
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

      // Get vendor
      const vendor = await kvStore.get(`vendor:${vendorId}`);
      if (!vendor) {
        return sendError(c, 'Vendor not found', 404);
      }

      // Get vendor's services
      const vendorServices = await kvStore.get(`vendor:${vendorId}:services`) || [];

      const matchingServices: ServiceMatch[] = [];

      for (const serviceId of vendorServices) {
        const service = await kvStore.get(`service:${serviceId}`);
        
        if (!service || !service.isActive || !service.isPublished) {
          continue;
        }

        let relevanceScore = 0;

        // Check subcategory mapping
        if (problem.mappedSubCategories && problem.mappedSubCategories.length > 0) {
          const serviceSubcat = service.subcategory || service.subCategory || '';
          if (problem.mappedSubCategories.includes(serviceSubcat)) {
            relevanceScore += 50;
          }
        }

        // Check service type mapping
        if (problem.serviceTypes && problem.serviceTypes.length > 0) {
          const serviceType = service.serviceType || service.type || '';
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
            serviceId: service.id || service.serviceId,
            serviceName: service.name || service.serviceName,
            vendorId: service.vendorId,
            vendorName: vendor.businessName || vendor.name,
            price: service.price || 0,
            duration: service.duration || 60,
            category: service.category || '',
            subcategory: service.subcategory || service.subCategory || '',
            description: service.description || '',
            isActive: service.isActive,
            isPublished: service.isPublished,
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
          name: vendor.businessName || vendor.name,
          roleId: vendor.roleId
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

  console.log('✅ Services-by-problem endpoints registered');
}
