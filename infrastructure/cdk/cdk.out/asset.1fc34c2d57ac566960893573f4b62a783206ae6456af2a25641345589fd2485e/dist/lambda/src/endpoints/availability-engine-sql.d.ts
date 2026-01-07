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
export interface TimeSlot {
    start: string;
    end: string;
    status: 'available' | 'booked' | 'blocked' | 'break';
    bookingId?: string;
    petName?: string;
    customerName?: string;
}
export interface DayAvailability {
    date: string;
    dayName: string;
    isHoliday: boolean;
    holidayReason?: string;
    slots: TimeSlot[];
    breaks: Break[];
    availableCount: number;
    bookedCount: number;
    totalCount: number;
    utilizationPercent: number;
}
export interface Break {
    id: string;
    start: string;
    end: string;
    type: 'lunch' | 'tea' | 'personal' | 'emergency';
    label: string;
    isRecurring: boolean;
    recurringDay?: number;
}
export interface Holiday {
    date: string;
    type: 'full_day' | 'half_day';
    reason: string;
    isRecurring: boolean;
    recurringDay?: number;
}
export interface NextAvailableSlot {
    date: string;
    dayName: string;
    time: string;
    slot: TimeSlot;
    isToday: boolean;
    isTomorrow: boolean;
    daysFromNow: number;
    formattedDisplay: string;
}
export interface AvailabilityPreferences {
    slotDuration: number;
    bufferMinutes: number;
    advanceBookingDays: number;
    sameDayBookingCutoff: string;
}
/**
 * Get next available slot for a doctor
 * Checks next 7 days by default
 */
export declare function getNextAvailableSlot(doctorId: string, daysToCheck?: number): Promise<NextAvailableSlot | null>;
/**
 * Get availability calendar for next N days
 */
export declare function getAvailabilityCalendar(doctorId: string, days?: number): Promise<DayAvailability[]>;
/**
 * ✅ SQL: Get doctor's availability preferences
 */
export declare function getAvailabilityPreferences(doctorId: string): Promise<AvailabilityPreferences>;
/**
 * ✅ SQL: Get all breaks for a doctor
 */
export declare function getDoctorBreaks(doctorId: string): Promise<Break[]>;
/**
 * ✅ SQL: Get breaks for a specific date (including recurring breaks)
 */
export declare function getBreaksForDate(doctorId: string, dateString: string): Promise<Break[]>;
/**
 * ✅ SQL: Calculate slot utilization for a doctor
 */
export declare function calculateSlotUtilization(doctorId: string, startDate: string, endDate: string): Promise<{
    totalSlots: number;
    bookedSlots: number;
    availableSlots: number;
    utilization: number;
}>;
/**
 * Check if same-day booking is allowed
 */
export declare function isSameDayBookingAllowed(doctorId: string, slotTime: string): Promise<boolean>;
/**
 * Get availability summary for display
 */
export declare function getAvailabilitySummary(doctorId: string): Promise<{
    nextAvailable: NextAvailableSlot | null;
    availableToday: boolean;
    availableTomorrow: boolean;
    availableThisWeek: boolean;
    totalSlotsThisWeek: number;
    availableSlotsThisWeek: number;
}>;
declare const _default: {
    getNextAvailableSlot: typeof getNextAvailableSlot;
    getAvailabilityCalendar: typeof getAvailabilityCalendar;
    getAvailabilityPreferences: typeof getAvailabilityPreferences;
    getDoctorBreaks: typeof getDoctorBreaks;
    getBreaksForDate: typeof getBreaksForDate;
    calculateSlotUtilization: typeof calculateSlotUtilization;
    isSameDayBookingAllowed: typeof isSameDayBookingAllowed;
    getAvailabilitySummary: typeof getAvailabilitySummary;
};
export default _default;
//# sourceMappingURL=availability-engine-sql.d.ts.map