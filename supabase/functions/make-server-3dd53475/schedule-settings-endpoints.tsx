import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';

const app = new Hono();

/**
 * GET /make-server-3dd53475/admin/schedule-settings
 * Get global schedule management settings
 */
app.get('/make-server-3dd53475/admin/schedule-settings', async (c) => {
  try {
    console.log('\n📅 ===== GET SCHEDULE SETTINGS =====');
    
    // Get global settings
    const settings = await kv.get('platform:schedule_settings') || getDefaultSettings();
    
    console.log('✅ Schedule settings retrieved:', settings);
    
    return c.json({
      success: true,
      settings
    });
  } catch (error) {
    console.error('❌ Error getting schedule settings:', error);
    return c.json({
      success: false,
      error: error.message || 'Failed to get schedule settings'
    }, 500);
  }
});

/**
 * POST /make-server-3dd53475/admin/schedule-settings
 * Update global schedule management settings
 */
app.post('/make-server-3dd53475/admin/schedule-settings', async (c) => {
  try {
    const body = await c.req.json();
    console.log('\n📅 ===== UPDATE SCHEDULE SETTINGS =====');
    console.log('📝 New settings:', body);
    
    // Validate settings
    const validatedSettings = validateSettings(body);
    
    // Save to KV store
    await kv.set('platform:schedule_settings', validatedSettings);
    
    console.log('✅ Schedule settings updated successfully');
    
    return c.json({
      success: true,
      message: 'Schedule settings updated successfully',
      settings: validatedSettings
    });
  } catch (error) {
    console.error('❌ Error updating schedule settings:', error);
    return c.json({
      success: false,
      error: error.message || 'Failed to update schedule settings'
    }, 500);
  }
});

/**
 * GET /make-server-3dd53475/schedule-settings/public
 * Get schedule settings for customer/vendor apps (public endpoint)
 */
app.get('/make-server-3dd53475/schedule-settings/public', async (c) => {
  try {
    const settings = await kv.get('platform:schedule_settings') || getDefaultSettings();
    
    return c.json({
      success: true,
      settings
    });
  } catch (error) {
    console.error('❌ Error getting schedule settings:', error);
    return c.json({
      success: false,
      settings: getDefaultSettings() // Return defaults on error
    });
  }
});

/**
 * Default schedule settings
 */
function getDefaultSettings() {
  return {
    // Buffer times in minutes (time before appointment can be booked)
    bufferTime: {
      at_center: 30,      // 30 minutes for center appointments
      at_home: 120,       // 2 hours for home visits (travel time)
      tele: 15,           // 15 minutes for teleconsultation
      instant_video: 5    // 5 minutes for instant video calls
    },
    
    // Vendor-specific buffer times (optional overrides)
    vendorBufferTime: {
      veterinarian: {
        at_center: 30,
        at_home: 120,
        tele: 15
      },
      groomer: {
        at_center: 60,    // More prep time for grooming
        at_home: 180,     // 3 hours for home grooming (equipment setup)
        tele: 15
      },
      pet_trainer: {
        at_center: 30,
        at_home: 120,
        tele: 15
      },
      dog_walker: {
        at_home: 60       // 1 hour notice for walker
      },
      pet_behaviourist: {
        at_center: 30,
        at_home: 120,
        tele: 15
      },
      pet_sitter: {
        at_home: 180      // 3 hours notice for pet sitting
      },
      pet_boarding: {
        at_center: 240    // 4 hours notice for boarding
      }
    },
    
    // Booking window settings
    maxDaysAhead: 30,        // Maximum days in advance for booking
    minSlotDuration: 30,     // Minimum slot duration in minutes
    slotInterval: 30,        // Time interval between slots in minutes
    
    // Working hours (default if not set for vendor)
    defaultWorkingHours: {
      start: '09:00',
      end: '18:00'
    },
    
    // Emergency/instant booking settings
    allowInstantBooking: true,
    instantBookingBuffer: 5,  // 5 minutes for instant bookings
    
    // Cancellation settings
    cancellationBuffer: {
      at_center: 60,      // 1 hour before appointment
      at_home: 180,       // 3 hours before appointment
      tele: 30            // 30 minutes before appointment
    },
    
    // Break and holiday settings
    defaultBreakDuration: 60,  // 1 hour lunch break
    weeklyHoliday: 'sunday',   // Default weekly off
    
    // Multi-location settings
    travelTimeBetweenLocations: 30, // 30 minutes travel time between locations
    
    // Updated timestamp
    updatedAt: new Date().toISOString(),
    updatedBy: 'system'
  };
}

/**
 * Validate schedule settings
 */
function validateSettings(settings: any) {
  const defaultSettings = getDefaultSettings();
  
  return {
    bufferTime: {
      at_center: parseInt(settings.bufferTime?.at_center) || defaultSettings.bufferTime.at_center,
      at_home: parseInt(settings.bufferTime?.at_home) || defaultSettings.bufferTime.at_home,
      tele: parseInt(settings.bufferTime?.tele) || defaultSettings.bufferTime.tele,
      instant_video: parseInt(settings.bufferTime?.instant_video) || defaultSettings.bufferTime.instant_video
    },
    
    vendorBufferTime: settings.vendorBufferTime || defaultSettings.vendorBufferTime,
    
    maxDaysAhead: parseInt(settings.maxDaysAhead) || defaultSettings.maxDaysAhead,
    minSlotDuration: parseInt(settings.minSlotDuration) || defaultSettings.minSlotDuration,
    slotInterval: parseInt(settings.slotInterval) || defaultSettings.slotInterval,
    
    defaultWorkingHours: settings.defaultWorkingHours || defaultSettings.defaultWorkingHours,
    
    allowInstantBooking: settings.allowInstantBooking !== undefined ? settings.allowInstantBooking : defaultSettings.allowInstantBooking,
    instantBookingBuffer: parseInt(settings.instantBookingBuffer) || defaultSettings.instantBookingBuffer,
    
    cancellationBuffer: settings.cancellationBuffer || defaultSettings.cancellationBuffer,
    
    defaultBreakDuration: parseInt(settings.defaultBreakDuration) || defaultSettings.defaultBreakDuration,
    weeklyHoliday: settings.weeklyHoliday || defaultSettings.weeklyHoliday,
    
    travelTimeBetweenLocations: parseInt(settings.travelTimeBetweenLocations) || defaultSettings.travelTimeBetweenLocations,
    
    updatedAt: new Date().toISOString(),
    updatedBy: settings.updatedBy || 'admin'
  };
}

export default app;
