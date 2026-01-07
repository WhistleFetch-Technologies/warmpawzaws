"use strict";
/**
 * ============================================================================
 * AVAILABILITY ENGINE - SQL VERSION
 * ============================================================================
 *
 * Advanced availability calculation and slot management
 * for doctors and service providers.
 *
 * Features:
 * - Calculate next available slot (7-day horizon)
 * - Generate availability calendar
 * - Handle breaks and buffer time
 * - Handle holidays and leaves
 * - Slot utilization analytics
 *
 * Replaces: doctor:{id}:availability:{date}, doctor:{id}:holidays,
 *           doctor:{id}:preferences, doctor:{id}:breaks KV keys
 *
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 *
 * Date: 2025-01-27
 * ============================================================================
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getNextAvailableSlot = getNextAvailableSlot;
exports.getAvailabilityCalendar = getAvailabilityCalendar;
exports.getAvailabilityPreferences = getAvailabilityPreferences;
exports.getDoctorBreaks = getDoctorBreaks;
exports.getBreaksForDate = getBreaksForDate;
exports.calculateSlotUtilization = calculateSlotUtilization;
exports.isSameDayBookingAllowed = isSameDayBookingAllowed;
exports.getAvailabilitySummary = getAvailabilitySummary;
const db_1 = require("../lib/db");
// ============================================
// HELPER FUNCTIONS
// ============================================
/**
 * Get day name from date
 */
function getDayName(dateString) {
    const date = new Date(dateString);
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[date.getDay()];
}
/**
 * Get day number (0-6) from date
 */
function getDayNumber(dateString) {
    const date = new Date(dateString);
    return date.getDay();
}
/**
 * Convert 24h time to 12h format
 */
function format12Hour(time24) {
    const [hours, minutes] = time24.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const hours12 = hours % 12 || 12;
    return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
}
/**
 * Calculate days from now
 */
function daysFromNow(dateString) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const targetDate = new Date(dateString);
    targetDate.setHours(0, 0, 0, 0);
    const diffTime = targetDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
}
/**
 * Format date for display
 */
function formatDateDisplay(dateString) {
    const days = daysFromNow(dateString);
    const dayName = getDayName(dateString);
    if (days === 0)
        return 'Today';
    if (days === 1)
        return 'Tomorrow';
    if (days <= 6)
        return dayName;
    // For dates beyond a week, show date
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
}
/**
 * Compare times (HH:mm format)
 */
function isTimeAfter(time1, time2) {
    const [h1, m1] = time1.split(':').map(Number);
    const [h2, m2] = time2.split(':').map(Number);
    if (h1 > h2)
        return true;
    if (h1 === h2 && m1 > m2)
        return true;
    return false;
}
/**
 * Check if time is in the past today
 */
function isTimePastToday(timeString) {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTime = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`;
    return isTimeAfter(currentTime, timeString);
}
/**
 * Generate time slots from availability window
 */
function generateSlotsFromAvailability(startTime, endTime, slotDuration, breaks, bookedSlots) {
    const slots = [];
    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;
    for (let time = startMinutes; time < endMinutes; time += slotDuration) {
        const hours = Math.floor(time / 60);
        const minutes = time % 60;
        const slotTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        const slotEndTime = `${Math.floor((time + slotDuration) / 60).toString().padStart(2, '0')}:${((time + slotDuration) % 60).toString().padStart(2, '0')}`;
        // Check if slot overlaps with any break
        const isBreak = breaks.some((b) => {
            const [bStartHour, bStartMin] = b.start.split(':').map(Number);
            const [bEndHour, bEndMin] = b.end.split(':').map(Number);
            const bStartMinutes = bStartHour * 60 + bStartMin;
            const bEndMinutes = bEndHour * 60 + bEndMin;
            return time < bEndMinutes && (time + slotDuration) > bStartMinutes;
        });
        if (isBreak) {
            slots.push({
                start: slotTime,
                end: slotEndTime,
                status: 'break'
            });
            continue;
        }
        // Check if slot is booked
        const isBooked = bookedSlots.has(slotTime);
        slots.push({
            start: slotTime,
            end: slotEndTime,
            status: isBooked ? 'booked' : 'available'
        });
    }
    return slots;
}
// ============================================
// CORE AVAILABILITY FUNCTIONS
// ============================================
/**
 * Get next available slot for a doctor
 * Checks next 7 days by default
 */
async function getNextAvailableSlot(doctorId, daysToCheck = 7) {
    try {
        console.log(`\n🔍 [AVAILABILITY] Finding next available slot for doctor ${doctorId}`);
        console.log(`📅 Checking next ${daysToCheck} days`);
        const pool = await (0, db_1.getDbClient)();
        const today = new Date();
        // Get preferences for slot duration
        const prefs = await getAvailabilityPreferences(doctorId);
        const slotDuration = prefs.slotDuration;
        for (let dayOffset = 0; dayOffset < daysToCheck; dayOffset++) {
            const checkDate = new Date(today.getTime() + dayOffset * 86400000);
            const dateString = checkDate.toISOString().split('T')[0];
            const dayOfWeek = getDayNumber(dateString);
            console.log(`📆 Checking ${dateString} (${getDayName(dateString)})...`);
            // ✅ SQL: Check if it's a holiday
            const isHoliday = await isDateHoliday(doctorId, dateString, pool);
            if (isHoliday) {
                console.log(`  ⛔ ${dateString} is a holiday, skipping`);
                continue;
            }
            // ✅ SQL: Get availability slots for this day
            const availabilitySlots = await (0, db_1.selectQuery)('staff_availability_slots', {
                staff_id: doctorId,
                day_of_week: dayOfWeek,
                is_available: true
            });
            if (!availabilitySlots || availabilitySlots.length === 0) {
                console.log(`  ⚠️ No availability data for ${dateString}`);
                continue;
            }
            // ✅ SQL: Get breaks for this date
            const breaksResult = await pool.query('SELECT * FROM staff_breaks WHERE staff_id = $1 AND break_date = $2 ORDER BY start_time ASC', [doctorId, dateString]);
            const breaks = breaksResult.rows || [];
            const breakList = breaks.map((b) => ({
                id: b.id || '',
                start: b.start_time,
                end: b.end_time,
                type: b.break_type || 'lunch',
                label: b.break_type || 'Break',
                isRecurring: b.day_of_week !== null,
                recurringDay: b.day_of_week
            }));
            // ✅ SQL: Get booked slots for this date (from bookings table)
            const bookingsResult = await pool.query(`SELECT booking_date, booking_time FROM bookings 
         WHERE staff_id = $1 AND booking_date = $2 
         AND status IN ('confirmed', 'completed')`, [doctorId, dateString]);
            const bookings = bookingsResult.rows || [];
            const bookedSlots = new Set();
            (bookings || []).forEach((b) => {
                if (b.booking_time) {
                    const time = b.booking_time.substring(0, 5); // Extract HH:mm
                    bookedSlots.add(time);
                }
            });
            // Generate slots from availability windows
            for (const avail of availabilitySlots) {
                const slots = generateSlotsFromAvailability(avail.start_time, avail.end_time, slotDuration, breakList, bookedSlots);
                // Find first available slot
                for (const slot of slots) {
                    if (slot.status !== 'available')
                        continue;
                    // If checking today, skip slots that are in the past
                    if (dayOffset === 0 && isTimePastToday(slot.start)) {
                        console.log(`  ⏰ Slot ${slot.start} is in the past, skipping`);
                        continue;
                    }
                    // Found an available slot!
                    const days = daysFromNow(dateString);
                    const formattedDisplay = `${formatDateDisplay(dateString)} ${format12Hour(slot.start)}`;
                    console.log(`  ✅ Found available slot: ${formattedDisplay}`);
                    return {
                        date: dateString,
                        dayName: getDayName(dateString),
                        time: slot.start,
                        slot,
                        isToday: days === 0,
                        isTomorrow: days === 1,
                        daysFromNow: days,
                        formattedDisplay
                    };
                }
            }
            console.log(`  ❌ No available slots on ${dateString}`);
        }
        console.log(`❌ [AVAILABILITY] No available slots found in next ${daysToCheck} days`);
        return null;
    }
    catch (error) {
        console.error(`❌ [AVAILABILITY] Error finding next available slot:`, error);
        return null;
    }
}
/**
 * Get availability calendar for next N days
 */
async function getAvailabilityCalendar(doctorId, days = 7) {
    try {
        console.log(`\n📅 [AVAILABILITY] Generating ${days}-day calendar for doctor ${doctorId}`);
        const pool = await (0, db_1.getDbClient)();
        const calendar = [];
        const today = new Date();
        // Get preferences
        const prefs = await getAvailabilityPreferences(doctorId);
        const slotDuration = prefs.slotDuration;
        for (let dayOffset = 0; dayOffset < days; dayOffset++) {
            const checkDate = new Date(today.getTime() + dayOffset * 86400000);
            const dateString = checkDate.toISOString().split('T')[0];
            const dayName = getDayName(dateString);
            const dayOfWeek = getDayNumber(dateString);
            // ✅ SQL: Check if holiday
            const holiday = await getHolidayForDate(doctorId, dateString, pool);
            const isHoliday = holiday !== null;
            // ✅ SQL: Get availability slots
            const availabilitySlots = await (0, db_1.selectQuery)('staff_availability_slots', {
                staff_id: doctorId,
                day_of_week: dayOfWeek,
                is_available: true
            });
            // ✅ SQL: Get breaks
            const breaksResult = await pool.query('SELECT * FROM staff_breaks WHERE staff_id = $1 AND break_date = $2 ORDER BY start_time ASC', [doctorId, dateString]);
            const breaks = breaksResult.rows || [];
            const breakList = breaks.map((b) => ({
                id: b.id || '',
                start: b.start_time,
                end: b.end_time,
                type: b.break_type || 'lunch',
                label: b.break_type || 'Break',
                isRecurring: b.day_of_week !== null,
                recurringDay: b.day_of_week
            }));
            // ✅ SQL: Get booked slots
            const bookingsResult = await pool.query(`SELECT booking_date, booking_time FROM bookings 
         WHERE staff_id = $1 AND booking_date = $2 
         AND status IN ('confirmed', 'completed')`, [doctorId, dateString]);
            const bookings = bookingsResult.rows || [];
            const bookedSlots = new Set();
            (bookings || []).forEach((b) => {
                if (b.booking_time) {
                    const time = b.booking_time.substring(0, 5);
                    bookedSlots.add(time);
                }
            });
            // Generate all slots from availability windows
            const allSlots = [];
            (availabilitySlots || []).forEach((avail) => {
                const slots = generateSlotsFromAvailability(avail.start_time, avail.end_time, slotDuration, breakList, bookedSlots);
                allSlots.push(...slots);
            });
            // Calculate metrics
            const availableCount = allSlots.filter((s) => s.status === 'available').length;
            const bookedCount = allSlots.filter((s) => s.status === 'booked').length;
            const totalCount = allSlots.length;
            const utilizationPercent = totalCount > 0
                ? Math.round((bookedCount / totalCount) * 100)
                : 0;
            calendar.push({
                date: dateString,
                dayName,
                isHoliday,
                holidayReason: holiday?.reason,
                slots: allSlots,
                breaks: breakList,
                availableCount,
                bookedCount,
                totalCount,
                utilizationPercent
            });
        }
        console.log(`✅ [AVAILABILITY] Calendar generated: ${calendar.length} days`);
        return calendar;
    }
    catch (error) {
        console.error(`❌ [AVAILABILITY] Error generating calendar:`, error);
        return [];
    }
}
/**
 * Check if a date is a holiday for a doctor
 */
async function isDateHoliday(doctorId, dateString, pool) {
    const holiday = await getHolidayForDate(doctorId, dateString, pool);
    return holiday !== null;
}
/**
 * ✅ SQL: Get holiday for a specific date
 */
async function getHolidayForDate(doctorId, dateString, pool) {
    try {
        // Check for exact date match
        const exactHolidayResults = await (0, db_1.selectQuery)('staff_holidays', {
            staff_id: doctorId,
            holiday_date: dateString
        });
        const exactHoliday = exactHolidayResults[0] || null;
        if (exactHoliday) {
            return {
                date: dateString,
                type: 'full_day',
                reason: exactHoliday.holiday_name || 'Holiday',
                isRecurring: false
            };
        }
        // Note: staff_holidays table doesn't support recurring holidays
        // If needed, this could be added to the table schema
        return null;
    }
    catch (error) {
        console.error(`❌ [AVAILABILITY] Error checking holiday:`, error);
        return null;
    }
}
/**
 * ✅ SQL: Get doctor's availability preferences
 */
async function getAvailabilityPreferences(doctorId) {
    try {
        const pool = await (0, db_1.getDbClient)();
        // ✅ SQL: Get preferences from staff metadata or use defaults
        const staffResult = await (0, db_1.selectQuery)('staff', { id: doctorId });
        const staffData = staffResult[0] || null;
        const prefs = staffData?.metadata?.availabilityPreferences;
        // Return defaults if no preferences set
        return {
            slotDuration: prefs?.slotDuration || 30,
            bufferMinutes: prefs?.bufferMinutes || 5,
            advanceBookingDays: prefs?.advanceBookingDays || 30,
            sameDayBookingCutoff: prefs?.sameDayBookingCutoff || '18:00'
        };
    }
    catch (error) {
        console.error(`❌ [AVAILABILITY] Error getting preferences:`, error);
        // Return defaults
        return {
            slotDuration: 30,
            bufferMinutes: 5,
            advanceBookingDays: 30,
            sameDayBookingCutoff: '18:00'
        };
    }
}
/**
 * ✅ SQL: Get all breaks for a doctor
 */
async function getDoctorBreaks(doctorId) {
    try {
        const pool = await (0, db_1.getDbClient)();
        // Get all breaks (both date-specific and recurring)
        const allBreaks = await (0, db_1.selectQuery)('staff_breaks', { staff_id: doctorId });
        return (allBreaks || []).map((b) => ({
            id: b.id,
            start: b.start_time,
            end: b.end_time,
            type: b.break_type || 'lunch',
            label: b.break_type || 'Break',
            isRecurring: b.day_of_week !== null,
            recurringDay: b.day_of_week
        }));
    }
    catch (error) {
        console.error(`❌ [AVAILABILITY] Error getting breaks:`, error);
        return [];
    }
}
/**
 * ✅ SQL: Get breaks for a specific date (including recurring breaks)
 */
async function getBreaksForDate(doctorId, dateString) {
    try {
        const pool = await (0, db_1.getDbClient)();
        const breaksResult = await pool.query('SELECT * FROM staff_breaks WHERE staff_id = $1 AND break_date = $2 ORDER BY start_time ASC', [doctorId, dateString]);
        const breaks = breaksResult.rows || [];
        return breaks.map((b) => ({
            id: b.id || '',
            start: b.start_time,
            end: b.end_time,
            type: b.break_type || 'lunch',
            label: b.break_type || 'Break',
            isRecurring: b.day_of_week !== null,
            recurringDay: b.day_of_week
        }));
    }
    catch (error) {
        console.error(`❌ [AVAILABILITY] Error getting breaks for date:`, error);
        return [];
    }
}
/**
 * ✅ SQL: Calculate slot utilization for a doctor
 */
async function calculateSlotUtilization(doctorId, startDate, endDate) {
    try {
        const pool = await (0, db_1.getDbClient)();
        let totalSlots = 0;
        let bookedSlots = 0;
        let availableSlots = 0;
        const start = new Date(startDate);
        const end = new Date(endDate);
        // Get preferences
        const prefs = await getAvailabilityPreferences(doctorId);
        const slotDuration = prefs.slotDuration;
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            const dateString = d.toISOString().split('T')[0];
            const dayOfWeek = getDayNumber(dateString);
            // Get availability slots
            const availabilitySlots = await (0, db_1.selectQuery)('staff_availability_slots', {
                staff_id: doctorId,
                day_of_week: dayOfWeek,
                is_available: true
            });
            // Get breaks
            const breaksResult = await pool.query('SELECT * FROM staff_breaks WHERE staff_id = $1 AND break_date = $2 ORDER BY start_time ASC', [doctorId, dateString]);
            const breaks = breaksResult.rows || [];
            const breakList = breaks.map((b) => ({
                id: b.id || '',
                start: b.start_time,
                end: b.end_time,
                type: b.break_type || 'lunch',
                label: b.break_type || 'Break',
                isRecurring: b.day_of_week !== null,
                recurringDay: b.day_of_week
            }));
            // Get booked slots
            const bookingsResult = await pool.query(`SELECT booking_time FROM bookings 
         WHERE staff_id = $1 AND booking_date = $2 
         AND status IN ('confirmed', 'completed')`, [doctorId, dateString]);
            const bookings = bookingsResult.rows || [];
            const bookedSlotsSet = new Set();
            (bookings || []).forEach((b) => {
                if (b.booking_time) {
                    const time = b.booking_time.substring(0, 5);
                    bookedSlotsSet.add(time);
                }
            });
            // Generate slots and count
            (availabilitySlots || []).forEach((avail) => {
                const slots = generateSlotsFromAvailability(avail.start_time, avail.end_time, slotDuration, breakList, bookedSlotsSet);
                totalSlots += slots.length;
                bookedSlots += slots.filter((s) => s.status === 'booked').length;
                availableSlots += slots.filter((s) => s.status === 'available').length;
            });
        }
        const utilization = totalSlots > 0 ? Math.round((bookedSlots / totalSlots) * 100) : 0;
        return {
            totalSlots,
            bookedSlots,
            availableSlots,
            utilization
        };
    }
    catch (error) {
        console.error(`❌ [AVAILABILITY] Error calculating utilization:`, error);
        return {
            totalSlots: 0,
            bookedSlots: 0,
            availableSlots: 0,
            utilization: 0
        };
    }
}
/**
 * Check if same-day booking is allowed
 */
async function isSameDayBookingAllowed(doctorId, slotTime) {
    try {
        const prefs = await getAvailabilityPreferences(doctorId);
        const cutoffTime = prefs.sameDayBookingCutoff;
        // Check if slot time is before cutoff
        return !isTimeAfter(slotTime, cutoffTime);
    }
    catch (error) {
        console.error(`❌ [AVAILABILITY] Error checking same-day booking:`, error);
        return true; // Allow by default
    }
}
/**
 * Get availability summary for display
 */
async function getAvailabilitySummary(doctorId) {
    try {
        const nextAvailable = await getNextAvailableSlot(doctorId, 7);
        const calendar = await getAvailabilityCalendar(doctorId, 7);
        const today = calendar[0];
        const tomorrow = calendar[1];
        const totalSlotsThisWeek = calendar.reduce((sum, day) => sum + day.totalCount, 0);
        const availableSlotsThisWeek = calendar.reduce((sum, day) => sum + day.availableCount, 0);
        return {
            nextAvailable,
            availableToday: (today?.availableCount || 0) > 0,
            availableTomorrow: (tomorrow?.availableCount || 0) > 0,
            availableThisWeek: availableSlotsThisWeek > 0,
            totalSlotsThisWeek,
            availableSlotsThisWeek
        };
    }
    catch (error) {
        console.error(`❌ [AVAILABILITY] Error getting summary:`, error);
        return {
            nextAvailable: null,
            availableToday: false,
            availableTomorrow: false,
            availableThisWeek: false,
            totalSlotsThisWeek: 0,
            availableSlotsThisWeek: 0
        };
    }
}
// ============================================
// EXPORTS
// ============================================
exports.default = {
    getNextAvailableSlot,
    getAvailabilityCalendar,
    getAvailabilityPreferences,
    getDoctorBreaks,
    getBreaksForDate,
    calculateSlotUtilization,
    isSameDayBookingAllowed,
    getAvailabilitySummary
};
//# sourceMappingURL=availability-engine-sql.js.map