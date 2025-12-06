/**
 * CRITICAL STAFF FIXES
 * 
 * 1. Sync staff services from assignedServices array
 * 2. Get staff appointments
 * 3. Auto-sync on login if services are missing
 */

import { Hono } from 'npm:hono@4';
import * as kv from './kv_store.tsx';

export function staffCriticalFixes(app: Hono) {
  
  /**
   * Sync services from staff.assignedServices to staff:service:* records
   * POST /make-server-3dd53475/staff/:staffId/sync-services
   */
  app.post('/make-server-3dd53475/staff/:staffId/sync-services', async (c) => {
    try {
      const { staffId } = c.req.param();
      
      console.log(`🔄 [SYNC] Starting service sync for staff: ${staffId}`);
      
      // Get staff record
      const staff = await kv.get(`staff:${staffId}`);
      
      if (!staff) {
        return c.json({ error: 'Staff not found' }, 404);
      }
      
      // Get vendor record if staff is associated with one
      let vendor = null;
      if (staff.vendorId) {
        vendor = await kv.get(`vendor:${staff.vendorId}`);
      }
      
      // Get assigned services (list of service IDs)
      const assignedServiceIds = staff.assignedServices || staff.services?.map((s: any) => s.serviceId || s.id) || [];
      
      if (assignedServiceIds.length === 0) {
        console.log(`⚠️  [SYNC] No assigned services found for staff ${staffId}`);
        return c.json({
          success: true,
          message: 'No services to sync',
          servicesCreated: 0
        });
      }
      
      console.log(`📋 [SYNC] Found ${assignedServiceIds.length} assigned service IDs:`, assignedServiceIds);
      
      // Get existing staff services to avoid duplicates
      const existingStaffServices = await kv.getByPrefix(`staff:${staffId}:service:`);
      const existingServiceIds = new Set(existingStaffServices.map((s: any) => s.serviceId));
      
      console.log(`📋 [SYNC] Existing staff service records: ${existingStaffServices.length}`);
      
      let servicesCreated = 0;
      let errors = [];
      
      // For each assigned service, create staff service record if it doesn't exist
      for (const serviceId of assignedServiceIds) {
        try {
          // Skip if already exists
          if (existingServiceIds.has(serviceId)) {
            console.log(`   ⏭️  Service ${serviceId} already exists, skipping`);
            continue;
          }
          
          // Get service details from vendor
          if (!vendor || !staff.vendorId) {
            console.log(`   ⚠️  No vendor found for service ${serviceId}, skipping`);
            continue;
          }
          
          // Search for service in all service styles
          let serviceDetails = null;
          let serviceStyle = null;
          
          for (const style of ['at_center', 'at_home', 'tele']) {
            const vendorServices = await kv.get(`vendor_services:${vendor.id}:${style}`);
            
            if (vendorServices && vendorServices.services) {
              const found = vendorServices.services.find((s: any) => 
                s.serviceId === serviceId || s.id === serviceId
              );
              
              if (found) {
                serviceDetails = found;
                serviceStyle = style;
                break;
              }
            }
          }
          
          if (!serviceDetails) {
            console.log(`   ⚠️  Service details not found for ${serviceId}, skipping`);
            continue;
          }
          
          // Create staff service record
          const staffServiceId = `staffsvc_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
          
          const staffService = {
            id: staffServiceId,
            staffId,
            serviceId,
            serviceName: serviceDetails.serviceName || serviceDetails.name,
            category: serviceDetails.category,
            categoryName: serviceDetails.categoryName,
            price: serviceDetails.price || serviceDetails.customPrice || 0,
            duration: serviceDetails.duration || serviceDetails.customDuration || 30,
            description: serviceDetails.description || '',
            serviceStyle: serviceStyle,
            
            // Metadata
            isCustom: false, // From clinic
            clinicName: vendor.businessName || vendor.clinicName || 'Clinic',
            vendorId: vendor.id,
            
            // Status - auto-activate
            isActive: true,
            
            // Service style preferences
            maxTravelDistance: serviceStyle === 'at_home' ? 10 : undefined, // Default 10km for home services
            teleVideoEnabled: serviceStyle === 'tele' ? true : undefined,
            teleChatEnabled: serviceStyle === 'tele' ? true : undefined,
            
            // Timestamps
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            syncedAt: new Date().toISOString() // Mark as synced
          };
          
          // Save staff service
          await kv.set(`staff:${staffId}:service:${staffServiceId}`, staffService);
          
          servicesCreated++;
          console.log(`   ✅ Created staff service: ${serviceDetails.serviceName} (${serviceStyle})`);
          
        } catch (error) {
          console.error(`   ❌ Error creating service ${serviceId}:`, error);
          errors.push({ serviceId, error: String(error) });
        }
      }
      
      console.log(`✅ [SYNC] Service sync complete: ${servicesCreated} services created`);
      
      return c.json({
        success: true,
        message: `Synced ${servicesCreated} services successfully`,
        servicesCreated,
        totalAssigned: assignedServiceIds.length,
        errors: errors.length > 0 ? errors : undefined
      });
      
    } catch (error) {
      console.error('❌ [SYNC] Error syncing services:', error);
      return c.json({ error: String(error) }, 500);
    }
  });
  
  /**
   * Get appointments for staff member
   * GET /make-server-3dd53475/staff/:staffId/appointments
   */
  app.get('/make-server-3dd53475/staff/:staffId/appointments', async (c) => {
    try {
      const { staffId } = c.req.param();
      const status = c.req.query('status'); // Filter by status
      const date = c.req.query('date'); // Filter by date (YYYY-MM-DD)
      const limit = parseInt(c.req.query('limit') || '50');
      
      console.log(`📅 [APPOINTMENTS] Fetching appointments for staff: ${staffId}`);
      
      // Get all bookings
      const allBookings = await kv.getByPrefix('booking:');
      
      // Filter bookings for this staff
      let staffAppointments = allBookings.filter((booking: any) => {
        // Check if staff is assigned
        if (booking.assignedStaffId !== staffId && booking.staffId !== staffId) {
          return false;
        }
        
        // Filter by status if provided
        if (status && booking.status !== status) {
          return false;
        }
        
        // Filter by date if provided
        if (date && booking.appointmentDate) {
          const bookingDate = booking.appointmentDate.split('T')[0];
          if (bookingDate !== date) {
            return false;
          }
        }
        
        return true;
      });
      
      // Sort by appointment date (newest first)
      staffAppointments.sort((a: any, b: any) => {
        const dateA = new Date(a.appointmentDate || a.createdAt).getTime();
        const dateB = new Date(b.appointmentDate || b.createdAt).getTime();
        return dateB - dateA;
      });
      
      // Apply limit
      if (limit) {
        staffAppointments = staffAppointments.slice(0, limit);
      }
      
      // Enhance with customer details
      const enhancedAppointments = await Promise.all(
        staffAppointments.map(async (appointment: any) => {
          let customer = null;
          
          if (appointment.customerId) {
            customer = await kv.get(`customer:${appointment.customerId}`);
          }
          
          return {
            ...appointment,
            customerName: customer?.name || customer?.fullName || 'Unknown',
            customerPhone: customer?.phone || 'Unknown',
            customerPhoto: customer?.photo || null
          };
        })
      );
      
      console.log(`✅ [APPOINTMENTS] Found ${enhancedAppointments.length} appointments`);
      
      return c.json({
        success: true,
        appointments: enhancedAppointments,
        total: enhancedAppointments.length
      });
      
    } catch (error) {
      console.error('❌ [APPOINTMENTS] Error fetching appointments:', error);
      return c.json({ error: String(error) }, 500);
    }
  });
  
  /**
   * Check if staff needs service sync (used on login)
   * GET /make-server-3dd53475/staff/:staffId/check-sync-needed
   */
  app.get('/make-server-3dd53475/staff/:staffId/check-sync-needed', async (c) => {
    try {
      const { staffId } = c.req.param();
      
      // Get staff record
      const staff = await kv.get(`staff:${staffId}`);
      
      if (!staff) {
        return c.json({ error: 'Staff not found' }, 404);
      }
      
      // Get staff services
      const staffServices = await kv.getByPrefix(`staff:${staffId}:service:`);
      
      // Get assigned services
      const assignedServiceIds = staff.assignedServices || staff.services?.map((s: any) => s.serviceId || s.id) || [];
      
      // Check if sync is needed
      const syncNeeded = assignedServiceIds.length > 0 && staffServices.length === 0;
      
      return c.json({
        success: true,
        syncNeeded,
        assignedServicesCount: assignedServiceIds.length,
        staffServicesCount: staffServices.length,
        message: syncNeeded 
          ? `Staff has ${assignedServiceIds.length} assigned services but no service records. Sync recommended.`
          : 'Services are in sync'
      });
      
    } catch (error) {
      console.error('❌ [CHECK-SYNC] Error checking sync status:', error);
      return c.json({ error: String(error) }, 500);
    }
  });
}

export default staffCriticalFixes;
