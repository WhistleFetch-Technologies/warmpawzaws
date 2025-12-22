// NO KV STORE - Use SQL utilities
import { 
  getScheduleSettings, 
  getStaffNextAvailableSlot, 
  getCenterNextAvailableSlot,
  getStaffAvailabilityByLocation,
  calculateDistance
} from '../../../supabase/lib/utils/schedule-utils-sql.ts';

// Re-export for backward compatibility
export { calculateDistance, getStaffNextAvailableSlot, getCenterNextAvailableSlot, getStaffAvailabilityByLocation };

// All functions now imported from SQL-based utilities above
// This file is now a thin wrapper for backward compatibility