/**
 * ============================================================================
 * BOOKING VALIDATION ENDPOINTS - SQL-ONLY VERSION
 * ============================================================================
 * 
 * ✅ SQL-ONLY: Removed all KV usage, using SQL repositories only
 * 
 * Pre-flight validation before booking creation
 * Provides better UX by checking eligibility before payment
 * 
 * CHANGES:
 * - Removed `kv` imports
 * - Replaced all `kv.get()`, `kv.getByPrefix()` with SQL queries
 * - Uses `StaffRepository`, `ServicesRepository`, `BookingsRepository`
 * - Uses `staff`, `staff_services`, `platform_settings` tables
 * 
 * Date: 2025-01-28
 * Migration: Batch 17 - KV to SQL (8 KV operations removed)
 * ============================================================================
 */

import { Hono } from 'npm:hono@4';
import { getStaffRepository } from '../../lib/repositories/staff.ts';
import { getServicesRepository } from '../../lib/repositories/services.ts';
import { getBookingsRepository } from '../../lib/repositories/bookings.ts';
import { getDbClient } from '../../lib/db.ts';

const app = new Hono();
const db = getDbClient();
const staffRepo = getStaffRepository();
const servicesRepo = getServicesRepository();
const bookingsRepo = getBookingsRepository();

/**
 * POST /make-server-3dd53475/booking/validate
 * Validate if a booking can be created with given parameters
 */
app.post('/make-server-3dd53475/booking/validate', async (c) => {
  try {
    const { staffId, serviceId, serviceType, customerLocation } = await c.req.json();
    
    console.log('\n🔍 [BOOKING-VALIDATION] Pre-flight validation requested');
    console.log(`   Staff ID: ${staffId}`);
    console.log(`   Service ID: ${serviceId}`);
    console.log(`   Service Type: ${serviceType}`);
    
    const validationResult = {
      valid: true,
      errors: [] as string[],
      warnings: [] as string[],
      staffInfo: null as any,
      serviceInfo: null as any
    };
    
    // ============================================
    // VALIDATE STAFF EXISTS
    // ============================================
    
    if (staffId) {
      // ✅ SQL: Get staff
      const staff = await staffRepo.findById(staffId);
      
      if (!staff) {
        validationResult.valid = false;
        validationResult.errors.push('Staff member not found');
        return c.json(validationResult, 200);
      }
      
      validationResult.staffInfo = {
        id: staff.id,
        name: staff.name || staff.full_name,
        role: staff.role,
        specialization: staff.specialization
      };
      
      console.log(`   ✅ Staff exists: ${staff.name || staff.full_name}`);
      
      // ============================================
      // VALIDATE STAFF HAS SERVICE ASSIGNED
      // ============================================
      
      if (serviceId) {
        // ✅ SQL: Get staff services
        const { data: staffServices } = await db
          .from('staff_services')
          .select('*, services(*)')
          .eq('staff_id', staffId)
          .eq('is_active', true);
        
        if (!staffServices || staffServices.length === 0) {
          validationResult.valid = false;
          validationResult.errors.push('Staff member has no services assigned');
          return c.json(validationResult, 200);
        }
        
        // Check if staff has THIS specific service
        const hasService = staffServices.some((s: any) => 
          s.service_id === serviceId || s.services?.id === serviceId
        );
        
        if (!hasService) {
          validationResult.valid = false;
          const serviceNames = staffServices.map((s: any) => s.services?.name || s.service_name).join(', ');
          validationResult.errors.push(
            `Staff member is not assigned to this service. They offer: ${serviceNames}`
          );
          return c.json(validationResult, 200);
        }
        
        console.log(`   ✅ Staff has service assigned`);
        
        // Get service details
        const assignedService = staffServices.find((s: any) => 
          s.service_id === serviceId || s.services?.id === serviceId
        );
        
        validationResult.serviceInfo = {
          id: assignedService?.service_id || assignedService?.services?.id,
          name: assignedService?.services?.name || assignedService?.service_name,
          price: assignedService?.services?.price || assignedService?.price,
          duration: assignedService?.services?.duration || assignedService?.duration,
          category: assignedService?.services?.category || assignedService?.category
        };
      }
      
      // ============================================
      // VALIDATE SERVICE STYLE PREFERENCES
      // ============================================
      
      if (serviceType) {
        // ✅ SQL: Get style preferences from platform_settings
        const { data: styleSettings } = await db
          .from('platform_settings')
          .select('setting_value')
          .eq('setting_key', `staff:${staffId}:style_preferences`)
          .single();
        
        const stylePreferences = styleSettings?.setting_value || {};
        const styleConfig = stylePreferences[serviceType];
        
        if (!styleConfig || !styleConfig.enabled || !styleConfig.available) {
          const enabledStyles = Object.keys(stylePreferences)
            .filter((style: string) => 
              stylePreferences[style]?.enabled && 
              stylePreferences[style]?.available
            )
            .join(', ');
          
          validationResult.valid = false;
          
          if (enabledStyles) {
            validationResult.errors.push(
              `Staff member is not available for ${serviceType} services. They offer: ${enabledStyles}`
            );
          } else {
            validationResult.errors.push(
              `Staff member is not currently accepting ${serviceType} bookings`
            );
          }
          
          return c.json(validationResult, 200);
        }
        
        console.log(`   ✅ Service style validated: ${serviceType}`);
        
        // ============================================
        // CHECK DISTANCE FOR AT_HOME SERVICES
        // ============================================
        
        if (serviceType === 'at_home' && customerLocation) {
          const maxDistance = styleConfig.maxDistance || 10;
          validationResult.warnings.push(
            `Please ensure you are within ${maxDistance}km of the service provider`
          );
        }
      }
      
      // ============================================
      // CHECK STAFF VACATION MODE
      // ============================================
      
      // ✅ SQL: Get staff schedule from platform_settings
      const { data: scheduleData } = await db
        .from('platform_settings')
        .select('setting_value')
        .eq('setting_key', `staff:${staffId}:schedule`)
        .single();
      
      const staffSchedule = scheduleData?.setting_value;
      
      if (staffSchedule?.vacationMode) {
        validationResult.valid = false;
        validationResult.errors.push(
          `Staff member is currently on vacation until ${staffSchedule.vacationEndDate || 'further notice'}`
        );
        return c.json(validationResult, 200);
      }
    }
    
    console.log(`✅ [BOOKING-VALIDATION] All validations passed`);
    
    return c.json(validationResult, 200);
    
  } catch (error) {
    console.error('❌ [BOOKING-VALIDATION] Error:', error);
    return c.json({
      error: 'Validation failed',
      details: String(error)
    }, 500);
  }
});

/**
 * GET /make-server-3dd53475/staff/:staffId/booking-eligibility
 * Check if staff can accept bookings right now
 */
app.get('/make-server-3dd53475/staff/:staffId/booking-eligibility', async (c) => {
  try {
    const { staffId } = c.req.param();
    
    // ✅ SQL: Get staff
    const staff = await staffRepo.findById(staffId);
    
    if (!staff) {
      return c.json({
        eligible: false,
        reason: 'Staff member not found'
      }, 404);
    }
    
    // ✅ SQL: Check vacation mode
    const { data: scheduleData } = await db
      .from('platform_settings')
      .select('setting_value')
      .eq('setting_key', `staff:${staffId}:schedule`)
      .single();
    
    const schedule = scheduleData?.setting_value;
    if (schedule?.vacationMode) {
      return c.json({
        eligible: false,
        reason: 'Staff member is on vacation',
        vacationEndDate: schedule.vacationEndDate
      }, 200);
    }
    
    // ✅ SQL: Check if has any services assigned
    const { data: services } = await db
      .from('staff_services')
      .select('id')
      .eq('staff_id', staffId)
      .eq('is_active', true);
    
    if (!services || services.length === 0) {
      return c.json({
        eligible: false,
        reason: 'Staff member has no services assigned'
      }, 200);
    }
    
    // ✅ SQL: Check if any service style is enabled
    const { data: styleSettings } = await db
      .from('platform_settings')
      .select('setting_value')
      .eq('setting_key', `staff:${staffId}:style_preferences`)
      .single();
    
    const stylePreferences = styleSettings?.setting_value || {};
    const hasEnabledStyle = Object.keys(stylePreferences).some((style: string) =>
      stylePreferences[style]?.enabled && stylePreferences[style]?.available
    );
    
    if (!hasEnabledStyle) {
      return c.json({
        eligible: false,
        reason: 'Staff member is not currently accepting bookings'
      }, 200);
    }
    
    return c.json({
      eligible: true,
      staffName: staff.name || staff.full_name,
      totalServices: services.length,
      availableStyles: Object.keys(stylePreferences)
        .filter((style: string) => 
          stylePreferences[style]?.enabled && 
          stylePreferences[style]?.available
        )
    }, 200);
    
  } catch (error) {
    console.error('Error checking booking eligibility:', error);
    return c.json({ error: String(error) }, 500);
  }
});

console.log('✅ Booking Validation Endpoints (SQL-only) registered');

export default app;

