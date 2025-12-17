/**
 * PROBLEM-FIRST SEARCH WINDOW
 * Production-Grade Implementation
 * 
 * Features:
 * - Search by problem → Services → Staff flow
 * - Service population based on problem
 * - Staff filtering by problem AND service
 * - Universal application across all vendors
 */

import { Hono } from 'npm:hono@4';
import * as kv from './kv_store.tsx';
import { findProblemById } from './problem-grid-catalog.tsx';

function getAllSpecializations(subCategories: string[]): Set<string> {
  return new Set(subCategories.map(s => s.toLowerCase()));
}
import { calculateDistance } from './schedule-utils.tsx';

interface ProblemSearchResult {
  problem: any;
  services: any[];
  staff: any[];
  vendors: any[];
  totalResults: number;
}

export function problemFirstSearchEndpoints(app: Hono) {
  const BASE = '/make-server-3dd53475';

  /**
   * GET /customer/problem-first-search
   * Search by problem → get services and staff
   * 
   * Query params:
   * - problemId: required
   * - roleId: required
   * - serviceStyle: optional (at_home | at_center | tele)
   * - customerLat, customerLng: optional (for distance calculation)
   * - serviceId: optional (filter by specific service)
   */
  app.get(`${BASE}/customer/problem-first-search`, async (c) => {
    try {
      const problemId = c.req.query('problemId');
      const roleId = c.req.query('roleId');
      const serviceStyle = c.req.query('serviceStyle') as 'at_home' | 'at_center' | 'tele' | undefined;
      const customerLat = parseFloat(c.req.query('customerLat') || '0');
      const customerLng = parseFloat(c.req.query('customerLng') || '0');
      const serviceId = c.req.query('serviceId');

      if (!problemId || !roleId) {
        return c.json({ error: 'problemId and roleId are required' }, 400);
      }

      console.log(`🔍 [PROBLEM-FIRST] Searching for problem: ${problemId}, role: ${roleId}`);

      // Get problem details
      const problem = findProblemById(problemId);
      if (!problem) {
        return c.json({ error: 'Problem not found' }, 404);
      }

      // Get all vendors with this role
      const allVendors = await kv.getByPrefix('vendor:vendor_');
      const roleVendors = allVendors.filter((v: any) => {
        const vendorRoleId = v.roleId?.replace('role_', '').toLowerCase();
        const targetRoleId = roleId.replace('role_', '').toLowerCase();
        return vendorRoleId === targetRoleId && 
               v.status === 'approved' && 
               v.isActive !== false;
      });

      console.log(`   Found ${roleVendors.length} vendors with role ${roleId}`);

      const services: any[] = [];
      const staff: any[] = [];
      const vendors: any[] = [];

      // Get problem specializations
      const allSpecializations = getAllSpecializations(problemSpecializations);

      for (const vendor of roleVendors) {
        // Check if vendor has this problem specialization
        const vendorSpecializations = vendor.specializations || [];
        const hasSpecialization = vendorSpecializations.some((s: string) => 
          allSpecializations.has(s.toLowerCase())
        );

        if (!hasSpecialization) continue;

        // Get vendor services
        const serviceStyles = serviceStyle ? [serviceStyle] : ['at_center', 'at_home', 'tele'];
        
        for (const style of serviceStyles) {
          const vendorServices = await kv.get(`vendor_services:${vendor.id}:${style}`) || { services: [] };
          const activeServices = vendorServices.services?.filter((s: any) => 
            s.isActive && s.publishStatus === 'published'
          ) || [];

          // Filter by serviceId if provided
          const filteredServices = serviceId
            ? activeServices.filter((s: any) => s.serviceId === serviceId)
            : activeServices;

          // Add services with vendor info
          for (const service of filteredServices) {
            if (!services.find(s => s.serviceId === service.serviceId && s.vendorId === vendor.id)) {
              services.push({
                ...service,
                vendorId: vendor.id,
                vendorName: vendor.businessName || vendor.fullName,
                serviceStyle: style,
                roleId: vendor.roleId,
                rating: vendor.rating
              });
            }
          }
        }

        // Get staff with matching specializations
        const staffIds = await kv.get(`vendor:${vendor.id}:staff`) || [];
        for (const staffId of staffIds) {
          const staffMember = await kv.get(`staff:${staffId}`);
          if (!staffMember || !staffMember.isActive) continue;

          // Check staff specialization
          const staffSpecializations = staffMember.specializations || [staffMember.specialization].filter(Boolean);
          const staffHasSpecialization = staffSpecializations.some((s: string) => 
            allSpecializations.has(s.toLowerCase())
          );

          if (!staffHasSpecialization) continue;

          // Check service style availability
          const stylePrefs = await kv.get(`staff:${staffId}:style_preferences`) || {
            at_home: { enabled: false, available: false },
            at_center: { enabled: true, available: true },
            tele: { enabled: false, available: false }
          };

          if (serviceStyle && !stylePrefs[serviceStyle]?.enabled) continue;

          // Get staff services
          const staffServices = staffMember.services || [];
          const activeStaffServices = staffServices.filter((s: any) => s.isActive && s.publishStatus === 'published');

          // Filter by serviceId if provided
          if (serviceId) {
            const hasService = activeStaffServices.some((s: any) => s.serviceId === serviceId);
            if (!hasService) continue;
          }

          // Calculate distance for home services
          let distance = 0;
          if (serviceStyle === 'at_home' && customerLat && customerLng) {
            const staffLocation = staffMember.lastKnownLocation || vendor.location;
            if (staffLocation?.latitude && staffLocation?.longitude) {
              distance = calculateDistance(
                customerLat,
                customerLng,
                staffLocation.latitude,
                staffLocation.longitude
              );
            }
          }

          staff.push({
            id: staffMember.id,
            name: staffMember.fullName || staffMember.name,
            vendorId: vendor.id,
            vendorName: vendor.businessName || vendor.fullName,
            roleId: vendor.roleId,
            serviceStyle: serviceStyle || 'at_center',
            services: activeStaffServices,
            rating: staffMember.rating || vendor.rating,
            photo: staffMember.photo || vendor.photos?.[0],
            distance: distance > 0 ? Math.round(distance * 10) / 10 : undefined
          });
        }

        // Add vendor to list
        vendors.push({
          id: vendor.id,
          name: vendor.businessName || vendor.fullName,
          roleId: vendor.roleId,
          rating: vendor.rating,
          photo: vendor.photos?.[0],
          address: vendor.address,
          city: vendor.city
        });
      }

      // Sort results
      if (serviceStyle === 'at_home' && customerLat && customerLng) {
        staff.sort((a, b) => (a.distance || 999) - (b.distance || 999));
      } else {
        staff.sort((a, b) => (b.rating || 0) - (a.rating || 0));
      }

      services.sort((a, b) => (b.rating || 0) - (a.rating || 0));
      vendors.sort((a, b) => (b.rating || 0) - (a.rating || 0));

      console.log(`✅ [PROBLEM-FIRST] Found ${services.length} services, ${staff.length} staff, ${vendors.length} vendors`);

      return c.json({
        success: true,
        problem,
        services,
        staff,
        vendors,
        totalResults: services.length + staff.length + vendors.length,
        filters: {
          problemId,
          roleId,
          serviceStyle: serviceStyle || null,
          serviceId: serviceId || null
        }
      });

    } catch (error) {
      console.error('❌ [PROBLEM-FIRST] Error:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  console.log('✅ Problem-First Search endpoints registered');
}

