/**
 * PREVIOUS PROVIDERS SERVICE
 * Production-Grade Implementation
 * 
 * Features:
 * - Get customer's previous service providers
 * - Filter by service type, role, vendor
 * - Include ratings and booking history
 * - Quick re-booking support
 */

import { Hono } from 'npm:hono@4';
import * as kv from './kv_store.tsx';

interface PreviousProvider {
  vendorId: string;
  vendorName: string;
  staffId?: string;
  staffName?: string;
  roleId: string;
  roleName: string;
  serviceType: string;
  serviceStyle: 'at_home' | 'at_center' | 'tele';
  lastBookingDate: string;
  totalBookings: number;
  rating?: number;
  photo?: string;
  distance?: number;
  services: any[];
  canReBook: boolean;
}

export function previousProvidersServiceEndpoints(app: Hono) {
  const BASE = '/make-server-3dd53475';

  /**
   * GET /customer/:customerId/previous-providers
   * Get customer's previous service providers
   * 
   * Query params:
   * - serviceType: optional filter
   * - roleId: optional filter
   * - serviceStyle: optional filter
   * - limit: optional (default: 20)
   */
  app.get(`${BASE}/customer/:customerId/previous-providers`, async (c) => {
    try {
      const { customerId } = c.req.param();
      const serviceType = c.req.query('serviceType');
      const roleId = c.req.query('roleId');
      const serviceStyle = c.req.query('serviceStyle') as 'at_home' | 'at_center' | 'tele' | undefined;
      const limit = parseInt(c.req.query('limit') || '20');

      console.log(`📜 [PREVIOUS-PROVIDERS] Fetching for customer: ${customerId}`);

      // Get customer's booking history
      const customerPhone = await kv.get(`customer:${customerId}:phone`);
      if (!customerPhone) {
        return c.json({ error: 'Customer not found' }, 404);
      }

      const cleanPhone = customerPhone.replace(/[^0-9]/g, '');
      const bookingIds = await kv.get(`customer:bookings:${cleanPhone}`) || [];

      console.log(`   Found ${bookingIds.length} bookings`);

      // Group by vendor/staff
      const providerMap = new Map<string, PreviousProvider>();

      for (const bookingId of bookingIds) {
        const booking = await kv.get(`booking:${bookingId}`);
        if (!booking || booking.status === 'cancelled') continue;

        // Apply filters
        if (serviceType && booking.serviceType !== serviceType) continue;
        if (roleId && booking.vendorRoleId !== roleId) continue;
        if (serviceStyle && booking.serviceStyle !== serviceStyle) continue;

        const key = booking.staffId 
          ? `${booking.vendorId}:${booking.staffId}`
          : booking.vendorId;

        if (!providerMap.has(key)) {
          // Get vendor details
          const vendor = await kv.get(`vendor:${booking.vendorId}`);
          const staff = booking.staffId ? await kv.get(`staff:${booking.staffId}`) : null;

          // Get services
          const vendorServices = await kv.get(`vendor_services:${booking.vendorId}:${booking.serviceStyle || 'at_center'}`) || { services: [] };
          const activeServices = vendorServices.services?.filter((s: any) => s.isActive && s.publishStatus === 'published') || [];

          providerMap.set(key, {
            vendorId: booking.vendorId,
            vendorName: vendor?.businessName || vendor?.fullName || booking.vendorName,
            staffId: booking.staffId,
            staffName: staff?.fullName || staff?.name,
            roleId: booking.vendorRoleId || vendor?.roleId,
            roleName: booking.vendorRoleName || vendor?.roleName,
            serviceType: booking.serviceType,
            serviceStyle: booking.serviceStyle || 'at_center',
            lastBookingDate: booking.scheduledDate || booking.createdAt,
            totalBookings: 1,
            rating: vendor?.rating || staff?.rating,
            photo: vendor?.photos?.[0] || staff?.photo,
            services: activeServices,
            canReBook: true
          });
        } else {
          const provider = providerMap.get(key)!;
          provider.totalBookings += 1;
          const bookingDate = new Date(booking.scheduledDate || booking.createdAt);
          const lastDate = new Date(provider.lastBookingDate);
          if (bookingDate > lastDate) {
            provider.lastBookingDate = booking.scheduledDate || booking.createdAt;
          }
        }
      }

      // Convert to array and sort
      const providers = Array.from(providerMap.values())
        .sort((a, b) => new Date(b.lastBookingDate).getTime() - new Date(a.lastBookingDate).getTime())
        .slice(0, limit);

      console.log(`✅ [PREVIOUS-PROVIDERS] Returning ${providers.length} providers`);

      return c.json({
        success: true,
        providers,
        total: providers.length,
        filters: {
          serviceType: serviceType || null,
          roleId: roleId || null,
          serviceStyle: serviceStyle || null
        }
      });

    } catch (error) {
      console.error('❌ [PREVIOUS-PROVIDERS] Error:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * GET /customer/:customerId/previous-providers/:vendorId/services
   * Get services for a previous provider (for quick re-booking)
   */
  app.get(`${BASE}/customer/:customerId/previous-providers/:vendorId/services`, async (c) => {
    try {
      const { customerId, vendorId } = c.req.param();
      const serviceStyle = c.req.query('serviceStyle') as 'at_home' | 'at_center' | 'tele' || 'at_center';

      const vendorServices = await kv.get(`vendor_services:${vendorId}:${serviceStyle}`) || { services: [] };
      const activeServices = vendorServices.services?.filter((s: any) => s.isActive && s.publishStatus === 'published') || [];

      return c.json({
        success: true,
        services: activeServices,
        vendorId,
        serviceStyle
      });

    } catch (error) {
      console.error('❌ [PREVIOUS-PROVIDERS] Error:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  console.log('✅ Previous Providers Service endpoints registered');
}

