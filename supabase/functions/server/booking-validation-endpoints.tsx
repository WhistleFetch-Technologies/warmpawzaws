import { Hono } from 'npm:hono@4';
import * as kv from './kv_store.tsx';

/**
 * BOOKING VALIDATION ENDPOINTS
 * Pre-flight validation before booking creation
 * Provides better UX by checking eligibility before payment
 */

const app = new Hono();

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
      const staff = await kv.get(`staff:${staffId}`);
      
      if (!staff) {
        validationResult.valid = false;
        validationResult.errors.push('Staff member not found');
        
        return c.json(validationResult, 200);
      }
      
      validationResult.staffInfo = {
        id: staff.id,
        name: staff.name,
        role: staff.role,
        specialization: staff.specialization
      };
      
      console.log(`   ✅ Staff exists: ${staff.name}`);
      
      // ============================================
      // VALIDATE STAFF HAS SERVICE ASSIGNED
      // ============================================
      
      if (serviceId) {
        const staffServices = await kv.getByPrefix(`staff:${staffId}:service:`);
        
        if (staffServices.length === 0) {
          validationResult.valid = false;
          validationResult.errors.push('Staff member has no services assigned');
          
          return c.json(validationResult, 200);
        }
        
        // Check if staff has THIS specific service
        const hasService = staffServices.some((s: any) => {
          if (s.serviceId === serviceId) return true;
          if (s.id === serviceId) return true;
          return false;
        });
        
        if (!hasService) {
          validationResult.valid = false;
          validationResult.errors.push(
            `Staff member is not assigned to this service. They offer: ${staffServices.map((s: any) => s.serviceName).join(', ')}`
          );
          
          return c.json(validationResult, 200);
        }
        
        console.log(`   ✅ Staff has service assigned`);
        
        // Get service details
        const assignedService = staffServices.find((s: any) => 
          s.serviceId === serviceId || s.id === serviceId
        );
        
        validationResult.serviceInfo = {
          id: assignedService.id,
          name: assignedService.serviceName,
          price: assignedService.price,
          duration: assignedService.duration,
          category: assignedService.category
        };
      }
      
      // ============================================
      // VALIDATE SERVICE STYLE PREFERENCES
      // ============================================
      
      if (serviceType) {
        const stylePreferences = await kv.get(`staff:${staffId}:style_preferences`) || {};
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
          
          // TODO: Add actual distance calculation
          // For now, just add a warning
          validationResult.warnings.push(
            `Please ensure you are within ${maxDistance}km of the service provider`
          );
        }
      }
      
      // ============================================
      // CHECK STAFF VACATION MODE
      // ============================================
      
      const staffSchedule = await kv.get(`staff:${staffId}:schedule`);
      
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
    
    const staff = await kv.get(`staff:${staffId}`);
    
    if (!staff) {
      return c.json({
        eligible: false,
        reason: 'Staff member not found'
      }, 404);
    }
    
    // Check vacation mode
    const schedule = await kv.get(`staff:${staffId}:schedule`);
    if (schedule?.vacationMode) {
      return c.json({
        eligible: false,
        reason: 'Staff member is on vacation',
        vacationEndDate: schedule.vacationEndDate
      }, 200);
    }
    
    // Check if has any services assigned
    const services = await kv.getByPrefix(`staff:${staffId}:service:`);
    if (services.length === 0) {
      return c.json({
        eligible: false,
        reason: 'Staff member has no services assigned'
      }, 200);
    }
    
    // Check if any service style is enabled
    const stylePreferences = await kv.get(`staff:${staffId}:style_preferences`) || {};
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
      staffName: staff.name,
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

export default app;
