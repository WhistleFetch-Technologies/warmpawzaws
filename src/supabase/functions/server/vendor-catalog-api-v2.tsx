/**
 * VENDOR CATALOG API V2 - CORRECTED ARCHITECTURE
 * 
 * ✅ READS FROM: platform:service_catalog (single source of truth)
 * ✅ CATEGORIES: catalog:categories (only structure, no nested services)
 * 
 * Architecture:
 * - Services stored in platform:service_catalog with categoryId, subCategoryId, applicableRoles
 * - Categories in catalog:categories provide organizational structure only
 * - Vendor App filters services by applicableRoles
 */

import type { Hono } from "hono";
import * as kv from "./kv_store";

export function registerVendorCatalogAPIV2(app: Hono) {
  
  /**
   * Map role IDs used in Service Catalog to vendor app role IDs
   */
  const roleMappings: Record<string, string[]> = {
    // Vendor App Role → Service Catalog Roles
    'pet_groomer': ['groomer', 'pet_groomer'],
    'veterinarian': ['vet', 'veterinarian'],
    'veterinary_clinic': ['veterinary_clinic', 'vet'],
    'pet_trainer': ['trainer', 'pet_trainer'],
    'pet_walker': ['walker', 'pet_walker', 'dog_walker'],
    'pet_sitter': ['sitter', 'pet_sitter'],
    'pet_boarder': ['boarding', 'pet_boarder', 'pet_hotel'],
    'pet_cafe': ['cafe', 'pet_cafe'],
    'pet_transport': ['transport', 'pet_transport'],
    'pet_photographer': ['photographer', 'pet_photographer']
  };
  
  /**
   * Get services for a specific role (VENDOR APP)
   * ✅ READS FROM: platform:service_catalog
   */
  app.get("/make-server-3dd53475/service-catalog/role/:roleId", async (c) => {
    try {
      const roleId = c.req.param('roleId');
      const serviceStyle = c.req.query('serviceStyle') as 'at_home' | 'at_center' | 'tele' | undefined;
      
      console.log(`\n📋 ===== VENDOR SERVICE CATALOG REQUEST V2 =====`);
      console.log(`   Role ID: ${roleId}`);
      console.log(`   Service Style Filter: ${serviceStyle || 'all'}`);
      
      // ✅ Read from platform:service_catalog (single source of truth)
      const allServices = await kv.get('platform:service_catalog') || [];
      
      console.log(`   Total services in catalog: ${allServices.length}`);
      
      // Get acceptable role variations for this vendor role
      const acceptableRoles = roleMappings[roleId] || [roleId];
      console.log(`   Looking for services with roles: [${acceptableRoles.join(', ')}]`);
      
      // Filter services
      let filteredServices = allServices.filter((service: any) => {
        // Check if service's applicableRoles includes any of our acceptable roles
        if (!service.applicableRoles || !Array.isArray(service.applicableRoles)) {
          return false;
        }
        
        const hasMatchingRole = service.applicableRoles.some((role: string) => 
          acceptableRoles.includes(role)
        );
        
        if (!hasMatchingRole) {
          return false;
        }
        
        // Filter by service style if provided
        if (serviceStyle) {
          // Normalize style comparison (at_home vs at-home)
          const normalizedFilter = serviceStyle.replace('-', '_');
          const normalizedServiceStyle = service.serviceStyle?.replace('-', '_');
          
          if (normalizedServiceStyle !== normalizedFilter) {
            return false;
          }
        }

        // Only return Published services for vendors to see (unless we want draft previews)
        // For now, let's show all or filter by publishedStatus if needed.
        // Usually catalog browsing shows active templates.
        if (service.status === 'archived') return false;
        
        return true;
      });
      
      console.log(`   Services found after filtering: ${filteredServices.length}`);
      
      return c.json({ 
        success: true,
        roleId,
        serviceStyle: serviceStyle || 'all',
        services: filteredServices,
        total: filteredServices.length
      });
      
    } catch (error) {
      console.error('❌ Error fetching role services:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * GET /make-server-3dd53475/service-catalog/:serviceId
   * Get details of a specific catalog service
   */
  app.get("/make-server-3dd53475/service-catalog/:serviceId", async (c) => {
    try {
      const serviceId = c.req.param('serviceId');
      const allServices = await kv.get('platform:service_catalog') || [];
      
      const service = allServices.find((s: any) => s.id === serviceId);
      
      if (!service) {
        return c.json({ error: 'Service not found' }, 404);
      }
      
      return c.json({ success: true, service });
    } catch (error) {
      console.error('❌ Error fetching service details:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * POST /make-server-3dd53475/service-catalog/create
   * Create a new service in the master catalog
   */
  app.post("/make-server-3dd53475/service-catalog/create", async (c) => {
    try {
      const body = await c.req.json();
      const { 
        serviceName, 
        description, 
        basePrice, 
        duration, 
        serviceStyle, 
        applicableRoles,
        categoryId,
        subCategoryId 
      } = body;
      
      if (!serviceName || !basePrice) {
        return c.json({ error: 'Missing required fields' }, 400);
      }
      
      const newServiceId = `svc_cat_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      
      const newService = {
        id: newServiceId,
        serviceName,
        description: description || '',
        basePrice: Number(basePrice),
        duration: Number(duration) || 30,
        serviceStyle: serviceStyle || 'at_center',
        applicableRoles: applicableRoles || [],
        categoryId: categoryId || null,
        subCategoryId: subCategoryId || null,
        status: 'draft', // Default to draft
        approvalStatus: 'pending',
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        
        // Pricing Management
        pricing: {
          basePrice: Number(basePrice),
          addOns: [],
          packages: []
        },
        
        // Availability
        isActive: true
      };
      
      // Read current catalog
      const allServices = await kv.get('platform:service_catalog') || [];
      
      // Append new service
      allServices.push(newService);
      
      // Save back
      await kv.set('platform:service_catalog', allServices);
      
      console.log(`✅ Created new catalog service: ${newServiceId}`);
      
      return c.json({ success: true, service: newService });
      
    } catch (error) {
      console.error('❌ Error creating catalog service:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * PUT /make-server-3dd53475/service-catalog/:serviceId
   * Update an existing catalog service
   */
  app.put("/make-server-3dd53475/service-catalog/:serviceId", async (c) => {
    try {
      const serviceId = c.req.param('serviceId');
      const updates = await c.req.json();
      
      const allServices = await kv.get('platform:service_catalog') || [];
      const serviceIndex = allServices.findIndex((s: any) => s.id === serviceId);
      
      if (serviceIndex === -1) {
        return c.json({ error: 'Service not found' }, 404);
      }
      
      const currentService = allServices[serviceIndex];
      
      const updatedService = {
        ...currentService,
        ...updates,
        version: (currentService.version || 1) + 1, // Increment version
        updatedAt: new Date().toISOString()
      };
      
      allServices[serviceIndex] = updatedService;
      
      await kv.set('platform:service_catalog', allServices);
      
      console.log(`✅ Updated catalog service: ${serviceId} (v${updatedService.version})`);
      
      return c.json({ success: true, service: updatedService });
      
    } catch (error) {
      console.error('❌ Error updating catalog service:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * DELETE /make-server-3dd53475/service-catalog/:serviceId
   * Soft delete (archive) a catalog service
   */
  app.delete("/make-server-3dd53475/service-catalog/:serviceId", async (c) => {
    try {
      const serviceId = c.req.param('serviceId');
      
      const allServices = await kv.get('platform:service_catalog') || [];
      const serviceIndex = allServices.findIndex((s: any) => s.id === serviceId);
      
      if (serviceIndex === -1) {
        return c.json({ error: 'Service not found' }, 404);
      }
      
      // Option 1: Hard delete
      // allServices.splice(serviceIndex, 1);
      
      // Option 2: Soft delete (preferred for catalog)
      allServices[serviceIndex].status = 'archived';
      allServices[serviceIndex].isActive = false;
      allServices[serviceIndex].updatedAt = new Date().toISOString();
      
      await kv.set('platform:service_catalog', allServices);
      
      console.log(`✅ Archived catalog service: ${serviceId}`);
      
      return c.json({ success: true, message: 'Service archived' });
      
    } catch (error) {
      console.error('❌ Error deleting catalog service:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * POST /make-server-3dd53475/service-catalog/:serviceId/publish
   * Publish a service (make it visible to vendors)
   */
  app.post("/make-server-3dd53475/service-catalog/:serviceId/publish", async (c) => {
    try {
      const serviceId = c.req.param('serviceId');
      
      const allServices = await kv.get('platform:service_catalog') || [];
      const serviceIndex = allServices.findIndex((s: any) => s.id === serviceId);
      
      if (serviceIndex === -1) {
        return c.json({ error: 'Service not found' }, 404);
      }
      
      // Logic: Require approval before publishing?
      // For now, we'll assume this action includes approval
      
      allServices[serviceIndex].status = 'published';
      allServices[serviceIndex].approvalStatus = 'approved';
      allServices[serviceIndex].publishedAt = new Date().toISOString();
      allServices[serviceIndex].updatedAt = new Date().toISOString();
      
      await kv.set('platform:service_catalog', allServices);
      
      console.log(`✅ Published catalog service: ${serviceId}`);
      
      return c.json({ success: true, service: allServices[serviceIndex] });
      
    } catch (error) {
      console.error('❌ Error publishing catalog service:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * POST /make-server-3dd53475/service-catalog/:serviceId/unpublish
   * Unpublish a service (draft mode)
   */
  app.post("/make-server-3dd53475/service-catalog/:serviceId/unpublish", async (c) => {
    try {
      const serviceId = c.req.param('serviceId');
      
      const allServices = await kv.get('platform:service_catalog') || [];
      const serviceIndex = allServices.findIndex((s: any) => s.id === serviceId);
      
      if (serviceIndex === -1) {
        return c.json({ error: 'Service not found' }, 404);
      }
      
      allServices[serviceIndex].status = 'draft';
      allServices[serviceIndex].updatedAt = new Date().toISOString();
      
      await kv.set('platform:service_catalog', allServices);
      
      console.log(`✅ Unpublished catalog service: ${serviceId}`);
      
      return c.json({ success: true, service: allServices[serviceIndex] });
      
    } catch (error) {
      console.error('❌ Error unpublishing catalog service:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * POST /make-server-3dd53475/service-catalog/:serviceId/submit-approval
   * Submit a drafted service for admin approval
   */
  app.post("/make-server-3dd53475/service-catalog/:serviceId/submit-approval", async (c) => {
    try {
      const serviceId = c.req.param('serviceId');
      
      const allServices = await kv.get('platform:service_catalog') || [];
      const serviceIndex = allServices.findIndex((s: any) => s.id === serviceId);
      
      if (serviceIndex === -1) {
        return c.json({ error: 'Service not found' }, 404);
      }

      if (allServices[serviceIndex].status !== 'draft') {
        return c.json({ error: 'Only draft services can be submitted for approval' }, 400);
      }
      
      allServices[serviceIndex].status = 'pending_approval';
      allServices[serviceIndex].approvalStatus = 'pending';
      allServices[serviceIndex].submittedAt = new Date().toISOString();
      allServices[serviceIndex].updatedAt = new Date().toISOString();
      
      await kv.set('platform:service_catalog', allServices);
      
      console.log(`✅ Submitted service for approval: ${serviceId}`);
      return c.json({ success: true, service: allServices[serviceIndex] });
      
    } catch (error) {
      console.error('❌ Error submitting service:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * POST /make-server-3dd53475/service-catalog/:serviceId/approve
   * Admin approves a service
   */
  app.post("/make-server-3dd53475/service-catalog/:serviceId/approve", async (c) => {
    try {
      const serviceId = c.req.param('serviceId');
      // In real app, verify admin token here
      
      const allServices = await kv.get('platform:service_catalog') || [];
      const serviceIndex = allServices.findIndex((s: any) => s.id === serviceId);
      
      if (serviceIndex === -1) {
        return c.json({ error: 'Service not found' }, 404);
      }
      
      allServices[serviceIndex].status = 'published';
      allServices[serviceIndex].approvalStatus = 'approved';
      allServices[serviceIndex].approvedAt = new Date().toISOString();
      allServices[serviceIndex].updatedAt = new Date().toISOString();
      
      await kv.set('platform:service_catalog', allServices);
      
      console.log(`✅ Approved service: ${serviceId}`);
      return c.json({ success: true, service: allServices[serviceIndex] });
      
    } catch (error) {
      console.error('❌ Error approving service:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * POST /make-server-3dd53475/service-catalog/:serviceId/reject
   * Admin rejects a service
   */
  app.post("/make-server-3dd53475/service-catalog/:serviceId/reject", async (c) => {
    try {
      const serviceId = c.req.param('serviceId');
      const { reason } = await c.req.json();
      
      const allServices = await kv.get('platform:service_catalog') || [];
      const serviceIndex = allServices.findIndex((s: any) => s.id === serviceId);
      
      if (serviceIndex === -1) {
        return c.json({ error: 'Service not found' }, 404);
      }
      
      allServices[serviceIndex].status = 'draft'; // Revert to draft for editing
      allServices[serviceIndex].approvalStatus = 'rejected';
      allServices[serviceIndex].rejectionReason = reason || 'Does not meet guidelines';
      allServices[serviceIndex].rejectedAt = new Date().toISOString();
      allServices[serviceIndex].updatedAt = new Date().toISOString();
      
      await kv.set('platform:service_catalog', allServices);
      
      console.log(`❌ Rejected service: ${serviceId}`);
      return c.json({ success: true, service: allServices[serviceIndex] });
      
    } catch (error) {
      console.error('❌ Error rejecting service:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * POST /make-server-3dd53475/service-catalog/:serviceId/media
   * Upload/Manage media for a service
   */
  app.post("/make-server-3dd53475/service-catalog/:serviceId/media", async (c) => {
    try {
      const serviceId = c.req.param('serviceId');
      const { images, videos } = await c.req.json(); // Array of URLs
      
      const allServices = await kv.get('platform:service_catalog') || [];
      const serviceIndex = allServices.findIndex((s: any) => s.id === serviceId);
      
      if (serviceIndex === -1) {
        return c.json({ error: 'Service not found' }, 404);
      }
      
      // Update media
      if (images) allServices[serviceIndex].images = images;
      if (videos) allServices[serviceIndex].videos = videos;
      allServices[serviceIndex].updatedAt = new Date().toISOString();
      
      await kv.set('platform:service_catalog', allServices);
      
      return c.json({ success: true, service: allServices[serviceIndex] });
      
    } catch (error) {
      console.error('❌ Error updating service media:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * POST /make-server-3dd53475/service-catalog/:serviceId/toggle-availability
   * Toggle service availability (Enable/Disable)
   */
  app.post("/make-server-3dd53475/service-catalog/:serviceId/toggle-availability", async (c) => {
    try {
      const serviceId = c.req.param('serviceId');
      const { isActive } = await c.req.json();
      
      const allServices = await kv.get('platform:service_catalog') || [];
      const serviceIndex = allServices.findIndex((s: any) => s.id === serviceId);
      
      if (serviceIndex === -1) {
        return c.json({ error: 'Service not found' }, 404);
      }
      
      allServices[serviceIndex].isActive = isActive;
      allServices[serviceIndex].updatedAt = new Date().toISOString();
      
      await kv.set('platform:service_catalog', allServices);
      
      return c.json({ success: true, isActive: allServices[serviceIndex].isActive });
      
    } catch (error) {
      console.error('❌ Error toggling service availability:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * GET /make-server-3dd53475/service-catalog/:serviceId/analytics
   * Get analytics for a service
   */
  app.get("/make-server-3dd53475/service-catalog/:serviceId/analytics", async (c) => {
    try {
      const serviceId = c.req.param('serviceId');
      
      // In a real system, this would aggregate data from a 'bookings' table/collection
      // For now, we'll generate realistic mock data or aggregate from bookings if available
      
      // Try to fetch actual bookings count
      const allBookings = await kv.getByPrefix('booking:');
      const serviceBookings = allBookings.filter((b: any) => b.serviceId === serviceId);
      
      const bookingsCount = serviceBookings.length;
      const revenue = serviceBookings.reduce((sum: number, b: any) => sum + (Number(b.price) || 0), 0);
      const views = Math.floor(bookingsCount * (Math.random() * 10 + 5)) + 50; // Mock views based on bookings
      const conversionRate = views > 0 ? ((bookingsCount / views) * 100).toFixed(1) : 0;
      
      return c.json({
        success: true,
        analytics: {
          views,
          bookings: bookingsCount,
          revenue,
          conversionRate: `${conversionRate}%`,
          rating: 4.8, // Mock rating
          reviewsCount: Math.floor(bookingsCount * 0.3) // Mock review count
        }
      });
      
    } catch (error) {
      console.error('❌ Error fetching service analytics:', error);
      return c.json({ error: String(error) }, 500);
    }
  });
  
  /**
   * GET /make-server-3dd53475/service-catalog/:serviceId/reviews
   * Get reviews for a service
   */
  app.get("/make-server-3dd53475/service-catalog/:serviceId/reviews", async (c) => {
    try {
      const serviceId = c.req.param('serviceId');
      
      // Fetch reviews from a central reviews store or mock
      // Assuming reviews are stored as review:{bookingId}
      // We would need a secondary index review:service:{serviceId}
      
      // Mocking for now as Review System is separate
      const reviews = [
        { id: 'rev_1', user: 'Alice', rating: 5, comment: 'Great service!', date: '2023-10-01' },
        { id: 'rev_2', user: 'Bob', rating: 4, comment: 'Good, but late.', date: '2023-09-28' }
      ];
      
      return c.json({ success: true, reviews });
      
    } catch (error) {
      console.error('❌ Error fetching service reviews:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * Debug endpoint - Check catalog status
   */
  app.get("/make-server-3dd53475/service-catalog/debug/v2", async (c) => {
    try {
      const services = await kv.get('platform:service_catalog') || [];
      const categories = await kv.get('catalog:categories') || [];
      
      // Analyze services
      const roleSet = new Set<string>();
      const styleSet = new Set<string>();
      
      services.forEach((s: any) => {
        if (s.applicableRoles) {
          s.applicableRoles.forEach((r: string) => roleSet.add(r));
        }
        if (s.serviceStyle) {
          styleSet.add(s.serviceStyle);
        }
      });
      
      const byRole: Record<string, number> = {};
      services.forEach((s: any) => {
        if (s.applicableRoles) {
          s.applicableRoles.forEach((r: string) => {
            byRole[r] = (byRole[r] || 0) + 1;
          });
        }
      });
      
      const byStyle: Record<string, number> = {};
      services.forEach((s: any) => {
        if (s.serviceStyle) {
          byStyle[s.serviceStyle] = (byStyle[s.serviceStyle] || 0) + 1;
        }
      });
      
      return c.json({
        success: true,
        dataSource: 'platform:service_catalog',
        stats: {
          totalServices: services.length,
          totalCategories: categories.length,
          availableRoles: Array.from(roleSet),
          availableStyles: Array.from(styleSet),
          servicesByRole: byRole,
          servicesByStyle: byStyle
        },
        sampleServices: services.slice(0, 5).map((s: any) => ({
          name: s.serviceName,
          roles: s.applicableRoles,
          style: s.serviceStyle,
          category: s.categoryName,
          price: s.basePrice
        }))
      });
      
    } catch (error) {
      console.error('Error in debug:', error);
      return c.json({ error: String(error) }, 500);
    }
  });
}
