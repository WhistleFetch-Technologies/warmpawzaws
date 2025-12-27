/**
 * ============================================================================
 * SCHEDULE SETTINGS ENDPOINTS - SQL-ONLY VERSION
 * ============================================================================
 *
 * ✅ SQL-ONLY: Removed all KV usage, using SQL queries only
 *
 * Global schedule management settings
 *
 * CHANGES:
 * - Removed `kv` imports
 * - Replaced all `kv.get()`, `kv.set()` with SQL queries
 * - Uses `platform_settings` table for schedule settings
 *
 * Date: 2025-01-28
 * Migration: Batch 9 - KV to SQL (3 KV operations removed)
 * ============================================================================
 */

import { Hono } from 'npm:hono';
import { getDbClient } from '../../lib/db.ts';

const app = new Hono();
const db = getDbClient();

/**
 * GET /make-server-3dd53475/admin/schedule-settings
 * Get global schedule management settings
 */
app.get('/make-server-3dd53475/admin/schedule-settings', async (c) => {
  try {
    console.log('\n📅 ===== GET SCHEDULE SETTINGS =====');
    
    // ✅ SQL: Get global settings from platform_settings
    const { data: settingsRow, error } = await db
      .from('platform_settings')
      .select('value')
      .eq('key', 'schedule_settings')
      .single();

    let settings;
    if (settingsRow && settingsRow.value) {
      settings = settingsRow.value;
    } else {
      settings = getDefaultSettings();
      // Save defaults if not exists
      await db
        .from('platform_settings')
        .upsert({
          key: 'schedule_settings',
          value: settings,
          updated_at: new Date().toISOString(),
        });
    }
    
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
    
    // ✅ SQL: Save to platform_settings
    await db
      .from('platform_settings')
      .upsert({
        key: 'schedule_settings',
        value: validatedSettings,
        updated_at: new Date().toISOString(),
      });
    
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
    // ✅ SQL: Get settings from platform_settings
    const { data: settingsRow } = await db
      .from('platform_settings')
      .select('value')
      .eq('key', 'schedule_settings')
      .single();

    const settings = settingsRow?.value || getDefaultSettings();
    
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
    
    // Rescheduling settings
    reschedulingBuffer: {
      at_center: 60,      // 1 hour before appointment
      at_home: 180,       // 3 hours before appointment
      tele: 30            // 30 minutes before appointment
    },
    
    // Slot generation settings
    autoGenerateSlots: true,
    slotGenerationDays: 30,  // Generate slots for next 30 days
    
    // Timezone settings
    defaultTimezone: 'Asia/Kolkata',
    
    // Holiday settings
    respectHolidays: true,
    respectVendorHolidays: true
  };
}

/**
 * Validate and sanitize settings
 */
function validateSettings(input: any): any {
  const defaults = getDefaultSettings();
  
  return {
    bufferTime: input.bufferTime || defaults.bufferTime,
    vendorBufferTime: input.vendorBufferTime || defaults.vendorBufferTime,
    maxDaysAhead: input.maxDaysAhead || defaults.maxDaysAhead,
    minSlotDuration: input.minSlotDuration || defaults.minSlotDuration,
    slotInterval: input.slotInterval || defaults.slotInterval,
    defaultWorkingHours: input.defaultWorkingHours || defaults.defaultWorkingHours,
    allowInstantBooking: input.allowInstantBooking !== undefined ? input.allowInstantBooking : defaults.allowInstantBooking,
    instantBookingBuffer: input.instantBookingBuffer || defaults.instantBookingBuffer,
    cancellationBuffer: input.cancellationBuffer || defaults.cancellationBuffer,
    reschedulingBuffer: input.reschedulingBuffer || defaults.reschedulingBuffer,
    autoGenerateSlots: input.autoGenerateSlots !== undefined ? input.autoGenerateSlots : defaults.autoGenerateSlots,
    slotGenerationDays: input.slotGenerationDays || defaults.slotGenerationDays,
    defaultTimezone: input.defaultTimezone || defaults.defaultTimezone,
    respectHolidays: input.respectHolidays !== undefined ? input.respectHolidays : defaults.respectHolidays,
    respectVendorHolidays: input.respectVendorHolidays !== undefined ? input.respectVendorHolidays : defaults.respectVendorHolidays,
  };
}

export default app;
