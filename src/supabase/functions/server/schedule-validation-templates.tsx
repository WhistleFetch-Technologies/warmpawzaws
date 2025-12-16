/**
 * ✅ SCHEDULE VALIDATION & TEMPLATES SYSTEM
 * Production-ready schedule configuration with validation and templates
 */

import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';
import { sendSuccess, sendError } from './response-utils.ts';

export function scheduleValidationTemplates(app: Hono) {
  const BASE_PATH = '/make-server-3dd53475';

  // =============================================
  // SCHEDULE VALIDATION
  // =============================================

  /**
   * ✅ POST /schedule/validate
   * Comprehensive schedule validation with conflict detection
   */
  app.post(`${BASE_PATH}/schedule/validate`, async (c) => {
    try {
      const { schedule, staffId, centerId, type } = await c.req.json();

      console.log(`🔍 Validating schedule for ${type}: ${staffId || centerId}`);

      const validation = await validateSchedule(schedule, staffId, centerId, type);

      return sendSuccess(c, {
        valid: validation.valid,
        errors: validation.errors,
        warnings: validation.warnings,
        suggestions: validation.suggestions,
        conflicts: validation.conflicts
      });

    } catch (error) {
      console.error('❌ Schedule validation error:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * ✅ POST /schedule/detect-conflicts
   * Detect scheduling conflicts
   */
  app.post(`${BASE_PATH}/schedule/detect-conflicts`, async (c) => {
    try {
      const { schedule, staffId, centerId, dateRange } = await c.req.json();

      console.log(`🔍 Detecting conflicts for schedule`);

      const conflicts = await detectScheduleConflicts(
        schedule,
        staffId,
        centerId,
        dateRange
      );

      return sendSuccess(c, {
        hasConflicts: conflicts.length > 0,
        conflicts,
        summary: {
          total: conflicts.length,
          critical: conflicts.filter(c => c.severity === 'critical').length,
          warning: conflicts.filter(c => c.severity === 'warning').length
        }
      });

    } catch (error) {
      console.error('❌ Conflict detection error:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * ✅ GET /schedule/optimization-suggestions
   * Get schedule optimization suggestions
   */
  app.get(`${BASE_PATH}/schedule/optimization-suggestions/:entityId`, async (c) => {
    try {
      const { entityId } = c.req.param();
      const type = c.req.query('type'); // 'staff' or 'center'

      console.log(`💡 Generating optimization suggestions for ${type}: ${entityId}`);

      // Get current schedule
      const schedule = await kv.get(`${type}_schedule:${entityId}`) || {};

      // Generate suggestions
      const suggestions = await generateOptimizationSuggestions(schedule, type);

      return sendSuccess(c, {
        suggestions,
        count: suggestions.length
      });

    } catch (error) {
      console.error('❌ Optimization suggestion error:', error);
      return sendError(c, error, 500);
    }
  });

  // =============================================
  // SCHEDULE TEMPLATES
  // =============================================

  /**
   * ✅ GET /schedule/templates
   * Get all schedule templates
   */
  app.get(`${BASE_PATH}/schedule/templates`, async (c) => {
    try {
      const category = c.req.query('category'); // 'standard', 'veterinary', 'grooming', etc.
      const type = c.req.query('type'); // 'staff' or 'center'

      console.log(`📋 Fetching schedule templates: ${category || 'all'}`);

      let templates = SCHEDULE_TEMPLATES;

      if (category) {
        templates = templates.filter(t => t.category === category);
      }

      if (type) {
        templates = templates.filter(t => t.type === type);
      }

      return sendSuccess(c, {
        templates,
        count: templates.length,
        categories: Array.from(new Set(SCHEDULE_TEMPLATES.map(t => t.category)))
      });

    } catch (error) {
      console.error('❌ Template fetch error:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * ✅ POST /schedule/apply-template
   * Apply template to staff/center
   */
  app.post(`${BASE_PATH}/schedule/apply-template`, async (c) => {
    try {
      const { templateId, entityId, type, customizations } = await c.req.json();

      console.log(`✨ Applying template ${templateId} to ${type}: ${entityId}`);

      // Get template
      const template = SCHEDULE_TEMPLATES.find(t => t.id === templateId);

      if (!template) {
        return sendError(c, 'Template not found', 404);
      }

      // Apply customizations
      const schedule = applyTemplateCustomizations(template.schedule, customizations);

      // Validate before saving
      const validation = await validateSchedule(schedule, 
        type === 'staff' ? entityId : null,
        type === 'center' ? entityId : null,
        type
      );

      if (!validation.valid) {
        return sendError(c, 'Template validation failed', 400, {
          errors: validation.errors
        });
      }

      // Save schedule
      await kv.set(`${type}_schedule:${entityId}`, schedule);

      console.log(`✅ Template applied successfully`);

      return sendSuccess(c, {
        schedule,
        template: template.name,
        validation
      }, 'Template applied successfully');

    } catch (error) {
      console.error('❌ Template application error:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * ✅ POST /schedule/save-as-template
   * Save current schedule as template
   */
  app.post(`${BASE_PATH}/schedule/save-as-template`, async (c) => {
    try {
      const { name, description, category, schedule, type, vendorId } = await c.req.json();

      console.log(`💾 Saving custom template: ${name}`);

      const templateId = `TEMPLATE-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

      const template = {
        id: templateId,
        name,
        description,
        category: category || 'custom',
        type,
        schedule,
        isCustom: true,
        vendorId,
        createdAt: new Date().toISOString()
      };

      await kv.set(`schedule_template:${templateId}`, template);

      // Index by vendor
      const vendorTemplates = await kv.get(`vendor:${vendorId}:schedule_templates`) || [];
      vendorTemplates.push(templateId);
      await kv.set(`vendor:${vendorId}:schedule_templates`, vendorTemplates);

      console.log(`✅ Custom template saved: ${templateId}`);

      return sendSuccess(c, { template }, 'Template saved successfully');

    } catch (error) {
      console.error('❌ Template save error:', error);
      return sendError(c, error, 500);
    }
  });

  console.log('✅ Schedule validation & templates endpoints registered');
}

// =============================================
// VALIDATION LOGIC
// =============================================

async function validateSchedule(
  schedule: any,
  staffId: string | null,
  centerId: string | null,
  type: string
): Promise<any> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const suggestions: string[] = [];

  // Basic structure validation
  if (!schedule || typeof schedule !== 'object') {
    errors.push('Schedule must be a valid object');
    return { valid: false, errors, warnings, suggestions, conflicts: [] };
  }

  // Validate weekly schedule
  if (schedule.weekly) {
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    
    for (const day of days) {
      if (schedule.weekly[day]) {
        const slots = schedule.weekly[day];
        
        // Validate time format
        for (const slot of slots) {
          if (!slot.startTime || !slot.endTime) {
            errors.push(`${day}: Missing start or end time`);
            continue;
          }

          // Validate time format (HH:MM)
          const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
          if (!timeRegex.test(slot.startTime) || !timeRegex.test(slot.endTime)) {
            errors.push(`${day}: Invalid time format (use HH:MM)`);
          }

          // Validate start < end
          const start = parseTime(slot.startTime);
          const end = parseTime(slot.endTime);
          
          if (start >= end) {
            errors.push(`${day}: Start time must be before end time`);
          }

          // Check for reasonable working hours
          const duration = (end - start) / 60; // minutes
          if (duration > 720) { // 12 hours
            warnings.push(`${day}: Shift duration exceeds 12 hours`);
          }

          if (duration < 60) { // 1 hour
            warnings.push(`${day}: Shift duration less than 1 hour`);
          }
        }

        // Check for overlapping slots
        for (let i = 0; i < slots.length; i++) {
          for (let j = i + 1; j < slots.length; j++) {
            if (slotsOverlap(slots[i], slots[j])) {
              errors.push(`${day}: Overlapping time slots detected`);
            }
          }
        }
      }
    }

    // Check for at least one working day
    const hasWorkingDays = days.some(day => 
      schedule.weekly[day] && schedule.weekly[day].length > 0
    );
    
    if (!hasWorkingDays) {
      errors.push('Schedule must have at least one working day');
    }

    // Suggestions for optimization
    const workingDays = days.filter(day => 
      schedule.weekly[day] && schedule.weekly[day].length > 0
    ).length;

    if (workingDays < 5) {
      suggestions.push('Consider adding more working days to increase availability');
    }

    if (workingDays === 7) {
      suggestions.push('Schedule has no rest days - consider adding breaks for work-life balance');
    }
  }

  // Validate breaks
  if (schedule.breaks) {
    for (const breakSlot of schedule.breaks) {
      if (!breakSlot.startTime || !breakSlot.endTime) {
        warnings.push('Break slot missing time information');
      }
      
      const duration = parseTime(breakSlot.endTime) - parseTime(breakSlot.startTime);
      if (duration > 120) { // 2 hours
        warnings.push('Break duration exceeds 2 hours');
      }
    }
  }

  // Detect conflicts
  const conflicts = await detectScheduleConflicts(schedule, staffId, centerId, {
    startDate: new Date().toISOString(),
    endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    suggestions,
    conflicts
  };
}

async function detectScheduleConflicts(
  schedule: any,
  staffId: string | null,
  centerId: string | null,
  dateRange: any
): Promise<any[]> {
  const conflicts: any[] = [];

  try {
    // Get existing bookings in date range
    const allBookings = await kv.getByPrefix('booking:') || [];
    const relevantBookings = allBookings
      .map((item: any) => item.value || item)
      .filter((booking: any) => {
        const bookingDate = new Date(booking.scheduledDate);
        const rangeStart = new Date(dateRange.startDate);
        const rangeEnd = new Date(dateRange.endDate);

        return bookingDate >= rangeStart && bookingDate <= rangeEnd &&
               (staffId ? booking.staffId === staffId : booking.centerId === centerId);
      });

    // Check each booking against schedule
    for (const booking of relevantBookings) {
      const bookingDay = new Date(booking.scheduledDate).toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
      const bookingTime = booking.scheduledTime;

      if (!schedule.weekly || !schedule.weekly[bookingDay]) {
        conflicts.push({
          type: 'day_off',
          severity: 'critical',
          bookingId: booking.id,
          message: `Booking scheduled on a day off (${bookingDay})`,
          date: booking.scheduledDate,
          time: bookingTime
        });
        continue;
      }

      const daySlots = schedule.weekly[bookingDay];
      const isWithinSchedule = daySlots.some((slot: any) => {
        return isTimeInSlot(bookingTime, slot.startTime, slot.endTime);
      });

      if (!isWithinSchedule) {
        conflicts.push({
          type: 'outside_hours',
          severity: 'critical',
          bookingId: booking.id,
          message: `Booking outside working hours`,
          date: booking.scheduledDate,
          time: bookingTime,
          availableSlots: daySlots
        });
      }
    }

    // Check for double bookings (same time slot)
    const bookingsByTime = new Map();
    for (const booking of relevantBookings) {
      const key = `${booking.scheduledDate}-${booking.scheduledTime}`;
      if (!bookingsByTime.has(key)) {
        bookingsByTime.set(key, []);
      }
      bookingsByTime.get(key).push(booking);
    }

    for (const [timeKey, bookings] of bookingsByTime.entries()) {
      if (bookings.length > 1) {
        conflicts.push({
          type: 'double_booking',
          severity: 'critical',
          message: `Multiple bookings at same time`,
          timeSlot: timeKey,
          bookings: bookings.map((b: any) => b.id)
        });
      }
    }

  } catch (error) {
    console.error('Error detecting conflicts:', error);
  }

  return conflicts;
}

async function generateOptimizationSuggestions(
  schedule: any,
  type: string
): Promise<any[]> {
  const suggestions: any[] = [];

  if (!schedule.weekly) {
    return suggestions;
  }

  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  
  // Analyze utilization
  const workingDays = days.filter(day => 
    schedule.weekly[day] && schedule.weekly[day].length > 0
  );

  // Calculate total hours
  let totalHours = 0;
  for (const day of workingDays) {
    const slots = schedule.weekly[day];
    for (const slot of slots) {
      const start = parseTime(slot.startTime);
      const end = parseTime(slot.endTime);
      totalHours += (end - start) / 60;
    }
  }

  // Suggestion 1: Increase weekend availability
  if (!workingDays.includes('saturday') && !workingDays.includes('sunday')) {
    suggestions.push({
      type: 'weekend_availability',
      priority: 'high',
      title: 'Add Weekend Hours',
      description: 'Consider adding weekend availability to capture more bookings',
      impact: '25-40% potential booking increase',
      implementation: 'Add Saturday 9:00-17:00 or Sunday 10:00-16:00'
    });
  }

  // Suggestion 2: Extend hours
  const avgHoursPerDay = totalHours / workingDays.length;
  if (avgHoursPerDay < 6) {
    suggestions.push({
      type: 'extend_hours',
      priority: 'medium',
      title: 'Extend Working Hours',
      description: 'Current average is below 6 hours/day',
      impact: '15-20% capacity increase',
      implementation: 'Add 2 hours to each working day'
    });
  }

  // Suggestion 3: Add early morning or evening slots
  const hasEarlySlots = workingDays.some(day => {
    const slots = schedule.weekly[day];
    return slots.some((slot: any) => parseTime(slot.startTime) < 540); // 9:00 AM
  });

  const hasEveningSlots = workingDays.some(day => {
    const slots = schedule.weekly[day];
    return slots.some((slot: any) => parseTime(slot.endTime) > 1080); // 6:00 PM
  });

  if (!hasEarlySlots) {
    suggestions.push({
      type: 'early_hours',
      priority: 'medium',
      title: 'Add Early Morning Slots',
      description: 'Capture customers who prefer early appointments',
      impact: '10-15% booking increase',
      implementation: 'Start at 7:00 AM or 8:00 AM'
    });
  }

  if (!hasEveningSlots) {
    suggestions.push({
      type: 'evening_hours',
      priority: 'high',
      title: 'Add Evening Hours',
      description: 'Many customers prefer after-work appointments',
      impact: '20-30% booking increase',
      implementation: 'Extend to 8:00 PM or 9:00 PM'
    });
  }

  // Suggestion 4: Balance workload
  const hoursByDay = workingDays.map(day => {
    const slots = schedule.weekly[day];
    let dayHours = 0;
    for (const slot of slots) {
      const start = parseTime(slot.startTime);
      const end = parseTime(slot.endTime);
      dayHours += (end - start) / 60;
    }
    return { day, hours: dayHours };
  });

  const maxHours = Math.max(...hoursByDay.map(d => d.hours));
  const minHours = Math.min(...hoursByDay.map(d => d.hours));

  if (maxHours - minHours > 3) {
    suggestions.push({
      type: 'balance_workload',
      priority: 'low',
      title: 'Balance Daily Hours',
      description: 'Significant variation in daily working hours detected',
      impact: 'Better work-life balance',
      implementation: 'Redistribute hours more evenly across days'
    });
  }

  return suggestions;
}

// =============================================
// HELPER FUNCTIONS
// =============================================

function parseTime(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

function slotsOverlap(slot1: any, slot2: any): boolean {
  const start1 = parseTime(slot1.startTime);
  const end1 = parseTime(slot1.endTime);
  const start2 = parseTime(slot2.startTime);
  const end2 = parseTime(slot2.endTime);

  return (start1 < end2 && end1 > start2);
}

function isTimeInSlot(time: string, slotStart: string, slotEnd: string): boolean {
  const t = parseTime(time);
  const start = parseTime(slotStart);
  const end = parseTime(slotEnd);

  return t >= start && t <= end;
}

function applyTemplateCustomizations(baseSchedule: any, customizations: any = {}): any {
  const schedule = JSON.parse(JSON.stringify(baseSchedule)); // Deep clone

  if (customizations.adjustStartTime) {
    // Adjust all start times by offset
    const offset = customizations.adjustStartTime; // in minutes
    
    for (const day in schedule.weekly) {
      if (schedule.weekly[day]) {
        schedule.weekly[day] = schedule.weekly[day].map((slot: any) => ({
          ...slot,
          startTime: adjustTime(slot.startTime, offset),
          endTime: adjustTime(slot.endTime, offset)
        }));
      }
    }
  }

  if (customizations.excludeDays) {
    for (const day of customizations.excludeDays) {
      delete schedule.weekly[day];
    }
  }

  if (customizations.includeDays) {
    for (const day of customizations.includeDays) {
      if (!schedule.weekly[day]) {
        schedule.weekly[day] = customizations.defaultSlot || [
          { startTime: '09:00', endTime: '17:00' }
        ];
      }
    }
  }

  return schedule;
}

function adjustTime(timeStr: string, offsetMinutes: number): string {
  const totalMinutes = parseTime(timeStr) + offsetMinutes;
  const hours = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

// =============================================
// SCHEDULE TEMPLATES
// =============================================

const SCHEDULE_TEMPLATES = [
  {
    id: 'standard_9to5',
    name: 'Standard 9-5 (Mon-Fri)',
    description: 'Regular business hours, Monday to Friday',
    category: 'standard',
    type: 'both',
    schedule: {
      weekly: {
        monday: [{ startTime: '09:00', endTime: '17:00' }],
        tuesday: [{ startTime: '09:00', endTime: '17:00' }],
        wednesday: [{ startTime: '09:00', endTime: '17:00' }],
        thursday: [{ startTime: '09:00', endTime: '17:00' }],
        friday: [{ startTime: '09:00', endTime: '17:00' }]
      }
    }
  },
  {
    id: 'extended_hours',
    name: 'Extended Hours (8AM-8PM)',
    description: 'Early start and late end, 6 days a week',
    category: 'standard',
    type: 'both',
    schedule: {
      weekly: {
        monday: [{ startTime: '08:00', endTime: '20:00' }],
        tuesday: [{ startTime: '08:00', endTime: '20:00' }],
        wednesday: [{ startTime: '08:00', endTime: '20:00' }],
        thursday: [{ startTime: '08:00', endTime: '20:00' }],
        friday: [{ startTime: '08:00', endTime: '20:00' }],
        saturday: [{ startTime: '09:00', endTime: '18:00' }]
      }
    }
  },
  {
    id: 'vet_clinic',
    name: 'Veterinary Clinic',
    description: 'Standard vet clinic hours with emergency coverage',
    category: 'veterinary',
    type: 'center',
    schedule: {
      weekly: {
        monday: [
          { startTime: '08:00', endTime: '12:00' },
          { startTime: '14:00', endTime: '19:00' }
        ],
        tuesday: [
          { startTime: '08:00', endTime: '12:00' },
          { startTime: '14:00', endTime: '19:00' }
        ],
        wednesday: [
          { startTime: '08:00', endTime: '12:00' },
          { startTime: '14:00', endTime: '19:00' }
        ],
        thursday: [
          { startTime: '08:00', endTime: '12:00' },
          { startTime: '14:00', endTime: '19:00' }
        ],
        friday: [
          { startTime: '08:00', endTime: '12:00' },
          { startTime: '14:00', endTime: '19:00' }
        ],
        saturday: [{ startTime: '09:00', endTime: '15:00' }],
        sunday: [{ startTime: '10:00', endTime: '14:00' }]
      }
    }
  },
  {
    id: 'grooming_salon',
    name: 'Grooming Salon',
    description: 'Full week availability with consistent hours',
    category: 'grooming',
    type: 'center',
    schedule: {
      weekly: {
        monday: [{ startTime: '10:00', endTime: '19:00' }],
        tuesday: [{ startTime: '10:00', endTime: '19:00' }],
        wednesday: [{ startTime: '10:00', endTime: '19:00' }],
        thursday: [{ startTime: '10:00', endTime: '19:00' }],
        friday: [{ startTime: '10:00', endTime: '19:00' }],
        saturday: [{ startTime: '09:00', endTime: '18:00' }],
        sunday: [{ startTime: '10:00', endTime: '17:00' }]
      }
    }
  },
  {
    id: 'part_time',
    name: 'Part-Time (3 days/week)',
    description: 'Flexible part-time schedule',
    category: 'standard',
    type: 'staff',
    schedule: {
      weekly: {
        monday: [{ startTime: '09:00', endTime: '17:00' }],
        wednesday: [{ startTime: '09:00', endTime: '17:00' }],
        friday: [{ startTime: '09:00', endTime: '17:00' }]
      }
    }
  },
  {
    id: 'split_shift',
    name: 'Split Shift',
    description: 'Morning and evening shifts with break',
    category: 'standard',
    type: 'staff',
    schedule: {
      weekly: {
        monday: [
          { startTime: '07:00', endTime: '11:00' },
          { startTime: '17:00', endTime: '21:00' }
        ],
        tuesday: [
          { startTime: '07:00', endTime: '11:00' },
          { startTime: '17:00', endTime: '21:00' }
        ],
        wednesday: [
          { startTime: '07:00', endTime: '11:00' },
          { startTime: '17:00', endTime: '21:00' }
        ],
        thursday: [
          { startTime: '07:00', endTime: '11:00' },
          { startTime: '17:00', endTime: '21:00' }
        ],
        friday: [
          { startTime: '07:00', endTime: '11:00' },
          { startTime: '17:00', endTime: '21:00' }
        ]
      }
    }
  },
  {
    id: 'weekend_only',
    name: 'Weekend Only',
    description: 'Saturday and Sunday availability',
    category: 'standard',
    type: 'staff',
    schedule: {
      weekly: {
        saturday: [{ startTime: '08:00', endTime: '18:00' }],
        sunday: [{ startTime: '09:00', endTime: '17:00' }]
      }
    }
  },
  {
    id: '24_7',
    name: '24/7 Coverage',
    description: 'Round-the-clock availability',
    category: 'emergency',
    type: 'center',
    schedule: {
      weekly: {
        monday: [{ startTime: '00:00', endTime: '23:59' }],
        tuesday: [{ startTime: '00:00', endTime: '23:59' }],
        wednesday: [{ startTime: '00:00', endTime: '23:59' }],
        thursday: [{ startTime: '00:00', endTime: '23:59' }],
        friday: [{ startTime: '00:00', endTime: '23:59' }],
        saturday: [{ startTime: '00:00', endTime: '23:59' }],
        sunday: [{ startTime: '00:00', endTime: '23:59' }]
      }
    }
  }
];

console.log('✅ Schedule validation & templates module loaded');
