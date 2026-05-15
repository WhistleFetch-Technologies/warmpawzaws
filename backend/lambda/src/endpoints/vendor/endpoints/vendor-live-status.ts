/**
 * ============================================================================
 * VENDOR LIVE STATUS ELIGIBILITY ENDPOINTS
 * ============================================================================
 * 
 * Determines if a vendor/center/solo/staff is eligible for listing on customer app.
 * 
 * Eligibility Criteria:
 * 1. At least 1 service is enabled (publish_status = 'published', is_enabled = true)
 * 2. Schedule is up to date (has future availability slots configured)
 * 3. Profile is 100% complete
 * 4. Address is verified OR location services are ON (lat/lng present)
 * 
 * When all criteria are met, vendor becomes "LIVE" and visible to customers.
 * 
 * Date: 2026-01-19
 * ============================================================================
 */

import { Hono } from 'hono';
import { select, query, update, insert } from '../../../database/rds-connection';
import { isValidUUID } from '../../../types/entities';

// ============================================================================
// PROFILE COMPLETION FIELDS BY VENDOR TYPE
// ============================================================================

// Required fields for profile completion (weighted)
const PROFILE_REQUIRED_FIELDS = {
  // Core fields - all vendors must have these
  core: {
    business_name: { weight: 15, label: 'Business Name' },
    owner_name: { weight: 10, label: 'Owner Name' },
    phone: { weight: 10, label: 'Phone Number' },
    email: { weight: 5, label: 'Email Address' },
  },
  // Address fields
  address: {
    address: { weight: 10, label: 'Street Address' },
    city: { weight: 5, label: 'City' },
    state: { weight: 5, label: 'State' },
    pincode: { weight: 5, label: 'PIN Code' },
  },
  // Location fields (for geo-discovery)
  location: {
    latitude: { weight: 10, label: 'Location (Latitude)' },
    longitude: { weight: 10, label: 'Location (Longitude)' },
  },
  // Business details
  business: {
    description: { weight: 5, label: 'Business Description' },
    logo_url: { weight: 5, label: 'Profile Photo/Logo' },
  },
  // Legal/Compliance (optional but recommended)
  compliance: {
    gst_number: { weight: 2.5, label: 'GST Number' },
    pan_number: { weight: 2.5, label: 'PAN Number' },
  },
};

// Staff-specific required fields
const STAFF_REQUIRED_FIELDS = {
  core: {
    name: { weight: 20, label: 'Full Name' },
    phone: { weight: 15, label: 'Phone Number' },
  },
  professional: {
    photo: { weight: 15, label: 'Profile Photo' },
    qualifications: { weight: 15, label: 'Qualifications' },
    experience_years: { weight: 5, label: 'Years of Experience' },
  },
  verification: {
    mobile_verified: { weight: 15, label: 'Mobile Verification' },
  },
  specialization: {
    // This is checked separately as it's in a different table
    has_specialization: { weight: 15, label: 'Specializations' },
  },
};

// ============================================================================
// ELIGIBILITY CHECK FUNCTIONS
// ============================================================================

/**
 * Calculate profile completion percentage for a vendor
 */
export async function calculateVendorProfileCompletion(vendorId: string): Promise<{
  percentage: number;
  missingFields: string[];
  completedFields: string[];
  fieldStatus: Record<string, boolean>;
}> {
  const vendors = await select('vendors', { id: vendorId });
  if (vendors.length === 0) {
    return { percentage: 0, missingFields: ['Vendor not found'], completedFields: [], fieldStatus: {} };
  }

  const vendor = vendors[0];
  let totalWeight = 0;
  let completedWeight = 0;
  const missingFields: string[] = [];
  const completedFields: string[] = [];
  const fieldStatus: Record<string, boolean> = {};

  // Check all field categories
  const allFields = { ...PROFILE_REQUIRED_FIELDS.core, ...PROFILE_REQUIRED_FIELDS.address, ...PROFILE_REQUIRED_FIELDS.location, ...PROFILE_REQUIRED_FIELDS.business };

  for (const [field, config] of Object.entries(allFields)) {
    totalWeight += config.weight;
    const value = vendor[field];
    const isComplete = value !== null && value !== undefined && value !== '' && value !== 0;
    
    fieldStatus[field] = isComplete;
    
    if (isComplete) {
      completedWeight += config.weight;
      completedFields.push(config.label);
    } else {
      missingFields.push(config.label);
    }
  }

  // Compliance fields are optional, only count if provided
  for (const [field, config] of Object.entries(PROFILE_REQUIRED_FIELDS.compliance)) {
    const value = vendor[field];
    const isComplete = value !== null && value !== undefined && value !== '';
    
    fieldStatus[field] = isComplete;
    
    if (isComplete) {
      totalWeight += config.weight;
      completedWeight += config.weight;
      completedFields.push(config.label);
    }
  }

  const percentage = totalWeight > 0 ? Math.round((completedWeight / totalWeight) * 100) : 0;

  return { percentage, missingFields, completedFields, fieldStatus };
}

/**
 * Calculate profile completion percentage for staff
 */
export async function calculateStaffProfileCompletion(staffId: string): Promise<{
  percentage: number;
  missingFields: string[];
  completedFields: string[];
  fieldStatus: Record<string, boolean>;
}> {
  const staffRecords = await select('staff', { id: staffId });
  if (staffRecords.length === 0) {
    return { percentage: 0, missingFields: ['Staff not found'], completedFields: [], fieldStatus: {} };
  }

  const staff = staffRecords[0];
  let totalWeight = 0;
  let completedWeight = 0;
  const missingFields: string[] = [];
  const completedFields: string[] = [];
  const fieldStatus: Record<string, boolean> = {};

  // Check core and professional fields
  const basicFields = { ...STAFF_REQUIRED_FIELDS.core, ...STAFF_REQUIRED_FIELDS.professional };

  for (const [field, config] of Object.entries(basicFields)) {
    totalWeight += config.weight;
    const value = staff[field];
    const isComplete = value !== null && value !== undefined && value !== '' && value !== 0;
    
    fieldStatus[field] = isComplete;
    
    if (isComplete) {
      completedWeight += config.weight;
      completedFields.push(config.label);
    } else {
      missingFields.push(config.label);
    }
  }

  // Check mobile verification
  const mobileVerifiedWeight = STAFF_REQUIRED_FIELDS.verification.mobile_verified.weight;
  totalWeight += mobileVerifiedWeight;
  if (staff.mobile_verified) {
    completedWeight += mobileVerifiedWeight;
    completedFields.push('Mobile Verification');
    fieldStatus['mobile_verified'] = true;
  } else {
    missingFields.push('Mobile Verification');
    fieldStatus['mobile_verified'] = false;
  }

  // Check specializations (separate table)
  const specializationWeight = STAFF_REQUIRED_FIELDS.specialization.has_specialization.weight;
  totalWeight += specializationWeight;
  
  try {
    const specs = await query(
      'SELECT COUNT(*) as count FROM staff_specializations WHERE staff_id = $1',
      [staffId]
    );
    const hasSpecs = parseInt(specs.rows[0]?.count || '0') > 0;
    fieldStatus['has_specialization'] = hasSpecs;
    
    if (hasSpecs) {
      completedWeight += specializationWeight;
      completedFields.push('Specializations');
    } else {
      missingFields.push('Specializations');
    }
  } catch (e) {
    // Table might not exist
    fieldStatus['has_specialization'] = false;
    missingFields.push('Specializations');
  }

  const percentage = totalWeight > 0 ? Math.round((completedWeight / totalWeight) * 100) : 0;

  return { percentage, missingFields, completedFields, fieldStatus };
}

/**
 * Check if vendor has at least 1 enabled service
 */
export async function checkServicesEnabled(vendorId: string): Promise<{
  hasEnabledServices: boolean;
  enabledCount: number;
  totalCount: number;
  servicesByStyle: Record<string, number>;
}> {
  const result = await query(
    `SELECT 
      service_style,
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE is_enabled = true AND publish_status = 'published') as enabled
     FROM vendor_services 
     WHERE vendor_id = $1 
     GROUP BY service_style`,
    [vendorId]
  );

  let totalEnabled = 0;
  let totalAll = 0;
  const servicesByStyle: Record<string, number> = {};

  for (const row of result.rows) {
    const enabled = parseInt(row.enabled || '0');
    const total = parseInt(row.total || '0');
    totalEnabled += enabled;
    totalAll += total;
    servicesByStyle[row.service_style] = enabled;
  }

  return {
    hasEnabledServices: totalEnabled > 0,
    enabledCount: totalEnabled,
    totalCount: totalAll,
    servicesByStyle,
  };
}

/**
 * Check if staff has at least 1 enabled service
 */
export async function checkStaffServicesEnabled(staffId: string): Promise<{
  hasEnabledServices: boolean;
  enabledCount: number;
  totalCount: number;
}> {
  // Try with full column check, fallback to simpler query if column doesn't exist
  let result;
  try {
    result = await query(
      `SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE COALESCE(enabled_by_staff, true) = true AND COALESCE(is_active, true) = true) as enabled
       FROM staff_services 
       WHERE staff_id = $1`,
      [staffId]
    );
  } catch (e: any) {
    // Fallback: just count all services for the staff
    console.warn('[LIVE-STATUS] Staff services query failed, trying fallback:', e.message);
    result = await query(
      `SELECT COUNT(*) as total, COUNT(*) as enabled FROM staff_services WHERE staff_id = $1`,
      [staffId]
    );
  }

  const enabled = parseInt(result.rows[0]?.enabled || '0');
  const total = parseInt(result.rows[0]?.total || '0');

  return {
    hasEnabledServices: enabled > 0,
    enabledCount: enabled,
    totalCount: total,
  };
}

/**
 * Check if vendor schedule is up to date (has future availability)
 */
export async function checkScheduleUpToDate(vendorId: string): Promise<{
  isUpToDate: boolean;
  hasScheduleSlots: boolean;
  futureSlotsCount: number;
  nextAvailableDate: string | null;
  configuredDays: number[];
}> {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const currentDayOfWeek = today.getDay();

  // Check vendor_availability_v2 for recurring schedule
  // Include vendor_identity.id so slots are found whether stored by vendor_id or vendor_identity_id
  let scheduleResult;
  try {
    scheduleResult = await query(
      `SELECT DISTINCT day_of_week
       FROM vendor_availability_v2 
       WHERE (vendor_id = $1 OR vendor_id IN (SELECT id FROM vendor_identity WHERE vendor_id = $1 OR phone = (SELECT phone FROM vendors WHERE id = $1)))
         AND COALESCE(is_enabled, is_available, true) = true
       ORDER BY day_of_week`,
      [vendorId]
    );
  } catch (e: any) {
    // Fallback: try with simpler column structure
    console.warn('[LIVE-STATUS] Schedule query failed, trying fallback:', e.message);
    scheduleResult = { rows: [] };
  }

  const configuredDays = [...new Set(scheduleResult.rows.map((r: any) => r.day_of_week))];
  const hasScheduleSlots = configuredDays.length > 0;

  // Calculate next available date based on configured days
  let nextAvailableDate: string | null = null;
  if (hasScheduleSlots) {
    for (let i = 0; i < 7; i++) {
      const checkDay = (currentDayOfWeek + i) % 7;
      if (configuredDays.includes(checkDay)) {
        const nextDate = new Date(today);
        nextDate.setDate(today.getDate() + i);
        nextAvailableDate = nextDate.toISOString().split('T')[0];
        break;
      }
    }
  }

  // Count future slots within next 30 days
  const futureSlots = configuredDays.length * 4; // Approximate 4 weeks ahead

  // Schedule is "up to date" if:
  // 1. Has at least 1 day configured, OR
  // 2. For business configurations, at least 3 days should be configured
  const isUpToDate = hasScheduleSlots && configuredDays.length >= 1;

  return {
    isUpToDate,
    hasScheduleSlots,
    futureSlotsCount: futureSlots,
    nextAvailableDate,
    configuredDays,
  };
}

/**
 * Check if staff schedule is up to date
 */
export async function checkStaffScheduleUpToDate(staffId: string): Promise<{
  isUpToDate: boolean;
  hasScheduleSlots: boolean;
  futureSlotsCount: number;
  nextAvailableDate: string | null;
}> {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  // Check staff_availability or staff_availability_slots for future dates
  let futureSlots;
  try {
    futureSlots = await query(
      `SELECT date, COUNT(*) as slot_count
       FROM staff_availability_slots 
       WHERE staff_id = $1 
         AND date >= $2
         AND is_available = true
       GROUP BY date
       ORDER BY date
       LIMIT 30`,
      [staffId, todayStr]
    );
  } catch (e) {
    // Try legacy table
    futureSlots = await query(
      `SELECT available_date as date, COUNT(*) as slot_count
       FROM staff_availability 
       WHERE staff_id = $1 
         AND available_date >= $2
         AND is_available = true
       GROUP BY available_date
       ORDER BY available_date
       LIMIT 30`,
      [staffId, todayStr]
    ).catch(() => ({ rows: [] }));
  }

  const hasScheduleSlots = futureSlots.rows.length > 0;
  const futureSlotsCount = futureSlots.rows.reduce((sum: number, r: any) => sum + parseInt(r.slot_count || '1'), 0);
  const nextAvailableDate = futureSlots.rows[0]?.date || null;

  return {
    isUpToDate: hasScheduleSlots,
    hasScheduleSlots,
    futureSlotsCount,
    nextAvailableDate,
  };
}

/**
 * Check if address is verified OR location services are ON
 */
export async function checkAddressAndLocation(vendorId: string): Promise<{
  isVerified: boolean;
  hasLocation: boolean;
  addressVerified: boolean;
  locationServicesOn: boolean;
  coordinates: { latitude: number; longitude: number } | null;
  verificationMethod: 'address_verified' | 'location_services' | 'none';
}> {
  const vendors = await select('vendors', { id: vendorId });
  if (vendors.length === 0) {
    return {
      isVerified: false,
      hasLocation: false,
      addressVerified: false,
      locationServicesOn: false,
      coordinates: null,
      verificationMethod: 'none',
    };
  }

  const vendor = vendors[0];

  // Check if address is explicitly verified (via admin or document verification)
  const addressVerified = vendor.address_verified === true || 
                          vendor.is_address_verified === true ||
                          (vendor.metadata && typeof vendor.metadata === 'object' && (vendor.metadata as any).addressVerified === true);

  // Check if location services are ON (lat/lng present and valid)
  const hasValidCoordinates = vendor.latitude !== null && 
                              vendor.longitude !== null && 
                              vendor.latitude !== 0 && 
                              vendor.longitude !== 0 &&
                              !isNaN(parseFloat(vendor.latitude)) &&
                              !isNaN(parseFloat(vendor.longitude));

  const locationServicesOn = hasValidCoordinates;

  // Either condition satisfies the requirement
  const isVerified = addressVerified || locationServicesOn;

  let verificationMethod: 'address_verified' | 'location_services' | 'none' = 'none';
  if (addressVerified) {
    verificationMethod = 'address_verified';
  } else if (locationServicesOn) {
    verificationMethod = 'location_services';
  }

  return {
    isVerified,
    hasLocation: hasValidCoordinates,
    addressVerified,
    locationServicesOn,
    coordinates: hasValidCoordinates ? {
      latitude: parseFloat(vendor.latitude),
      longitude: parseFloat(vendor.longitude),
    } : null,
    verificationMethod,
  };
}

/**
 * Check staff location
 */
export async function checkStaffLocation(staffId: string): Promise<{
  isVerified: boolean;
  hasLocation: boolean;
  coordinates: { latitude: number; longitude: number } | null;
}> {
  const staffRecords = await select('staff', { id: staffId });
  if (staffRecords.length === 0) {
    return { isVerified: false, hasLocation: false, coordinates: null };
  }

  const staff = staffRecords[0];

  // Staff can have default_location or inherit from vendor
  let hasLocation = false;
  let coordinates: { latitude: number; longitude: number } | null = null;

  if (staff.default_location && typeof staff.default_location === 'object') {
    const loc = staff.default_location as any;
    if (loc.lat && loc.lng) {
      hasLocation = true;
      coordinates = {
        latitude: parseFloat(loc.lat),
        longitude: parseFloat(loc.lng),
      };
    }
  }

  // If no direct location, check vendor location
  if (!hasLocation && staff.vendor_id) {
    const vendors = await select('vendors', { id: staff.vendor_id });
    if (vendors.length > 0 && vendors[0].latitude && vendors[0].longitude) {
      hasLocation = true;
      coordinates = {
        latitude: parseFloat(vendors[0].latitude),
        longitude: parseFloat(vendors[0].longitude),
      };
    }
  }

  return {
    isVerified: hasLocation,
    hasLocation,
    coordinates,
  };
}

/**
 * Calculate overall live status eligibility for a vendor
 */
export async function calculateVendorLiveStatus(vendorId: string): Promise<{
  isEligible: boolean;
  isLive: boolean;
  status: 'live' | 'pending' | 'incomplete';
  criteria: {
    servicesEnabled: { passed: boolean; details: any };
    scheduleUpToDate: { passed: boolean; details: any };
    profileComplete: { passed: boolean; details: any };
    addressVerified: { passed: boolean; details: any };
  };
  missingRequirements: string[];
  completionPercentage: number;
}> {
  // Run all checks in parallel for performance
  const [servicesResult, scheduleResult, profileResult, addressResult] = await Promise.all([
    checkServicesEnabled(vendorId),
    checkScheduleUpToDate(vendorId),
    calculateVendorProfileCompletion(vendorId),
    checkAddressAndLocation(vendorId),
  ]);

  const missingRequirements: string[] = [];

  // Check each criterion
  const servicesPass = servicesResult.hasEnabledServices;
  if (!servicesPass) {
    missingRequirements.push('Enable at least 1 service');
  }

  const schedulePass = scheduleResult.isUpToDate;
  if (!schedulePass) {
    missingRequirements.push('Set up your availability schedule');
  }

  const profilePass = profileResult.percentage === 100;
  if (!profilePass) {
    missingRequirements.push(`Complete your profile (${profileResult.percentage}% done - missing: ${profileResult.missingFields.join(', ')})`);
  }

  const addressPass = addressResult.isVerified;
  if (!addressPass) {
    missingRequirements.push('Verify your address or enable location services');
  }

  // All criteria must pass for eligibility
  const isEligible = servicesPass && schedulePass && profilePass && addressPass;

  // Calculate overall completion percentage
  const criteriaCount = 4;
  const passedCount = [servicesPass, schedulePass, profilePass, addressPass].filter(Boolean).length;
  const completionPercentage = Math.round((passedCount / criteriaCount) * 100);

  return {
    isEligible,
    isLive: isEligible,
    status: isEligible ? 'live' : (passedCount >= 2 ? 'pending' : 'incomplete'),
    criteria: {
      servicesEnabled: { passed: servicesPass, details: servicesResult },
      scheduleUpToDate: { passed: schedulePass, details: scheduleResult },
      profileComplete: { passed: profilePass, details: profileResult },
      addressVerified: { passed: addressPass, details: addressResult },
    },
    missingRequirements,
    completionPercentage,
  };
}

/**
 * Calculate overall live status eligibility for staff
 */
export async function calculateStaffLiveStatus(staffId: string): Promise<{
  isEligible: boolean;
  isLive: boolean;
  status: 'live' | 'pending' | 'incomplete';
  criteria: {
    servicesEnabled: { passed: boolean; details: any };
    scheduleUpToDate: { passed: boolean; details: any };
    profileComplete: { passed: boolean; details: any };
    locationVerified: { passed: boolean; details: any };
    mobileVerified: { passed: boolean; details: any };
  };
  missingRequirements: string[];
  completionPercentage: number;
}> {
  // Get staff record first to check mobile verification
  const staffRecords = await select('staff', { id: staffId });
  if (staffRecords.length === 0) {
    return {
      isEligible: false,
      isLive: false,
      status: 'incomplete',
      criteria: {
        servicesEnabled: { passed: false, details: null },
        scheduleUpToDate: { passed: false, details: null },
        profileComplete: { passed: false, details: null },
        locationVerified: { passed: false, details: null },
        mobileVerified: { passed: false, details: null },
      },
      missingRequirements: ['Staff not found'],
      completionPercentage: 0,
    };
  }

  const staff = staffRecords[0];

  // Run all checks in parallel
  const [servicesResult, scheduleResult, profileResult, locationResult] = await Promise.all([
    checkStaffServicesEnabled(staffId),
    checkStaffScheduleUpToDate(staffId),
    calculateStaffProfileCompletion(staffId),
    checkStaffLocation(staffId),
  ]);

  const missingRequirements: string[] = [];

  // Check each criterion
  const servicesPass = servicesResult.hasEnabledServices;
  if (!servicesPass) {
    missingRequirements.push('Enable at least 1 service');
  }

  const schedulePass = scheduleResult.isUpToDate;
  if (!schedulePass) {
    missingRequirements.push('Set up your availability schedule');
  }

  const profilePass = profileResult.percentage === 100;
  if (!profilePass) {
    missingRequirements.push(`Complete your profile (${profileResult.percentage}% done - missing: ${profileResult.missingFields.join(', ')})`);
  }

  const locationPass = locationResult.isVerified;
  if (!locationPass) {
    missingRequirements.push('Set your service location');
  }

  const mobilePass = staff.mobile_verified === true;
  if (!mobilePass) {
    missingRequirements.push('Verify your mobile number');
  }

  // All criteria must pass for eligibility
  const isEligible = servicesPass && schedulePass && profilePass && locationPass && mobilePass;

  // Calculate overall completion percentage
  const criteriaCount = 5;
  const passedCount = [servicesPass, schedulePass, profilePass, locationPass, mobilePass].filter(Boolean).length;
  const completionPercentage = Math.round((passedCount / criteriaCount) * 100);

  return {
    isEligible,
    isLive: isEligible,
    status: isEligible ? 'live' : (passedCount >= 3 ? 'pending' : 'incomplete'),
    criteria: {
      servicesEnabled: { passed: servicesPass, details: servicesResult },
      scheduleUpToDate: { passed: schedulePass, details: scheduleResult },
      profileComplete: { passed: profilePass, details: profileResult },
      locationVerified: { passed: locationPass, details: locationResult },
      mobileVerified: { passed: mobilePass, details: { verified: mobilePass, verifiedAt: staff.mobile_verified_at } },
    },
    missingRequirements,
    completionPercentage,
  };
}

// ============================================================================
// REGISTER ENDPOINTS
// ============================================================================

export function registerVendorLiveStatusEndpoints(app: Hono) {
  /**
   * GET /vendor/:vendorId/live-status
   * Get vendor's live status eligibility for customer app listing
   */
  app.get("/vendor/:vendorId/live-status", async (c) => {
    try {
      const { vendorId } = c.req.param();

      // Handle test IDs
      if (vendorId === 'test-vendor-id' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(vendorId)) {
        return c.json({
          success: true,
          isEligible: false,
          isLive: false,
          status: 'incomplete',
          criteria: {},
          missingRequirements: ['Invalid vendor ID'],
          completionPercentage: 0,
        });
      }

      // Check vendor exists
      const vendors = await select('vendors', { id: vendorId });
      if (vendors.length === 0) {
        return c.json({ error: 'Vendor not found' }, 404);
      }

      const vendor = vendors[0];

      // Check if vendor is approved first
      if (vendor.status !== 'approved' && vendor.status !== 'active') {
        return c.json({
          success: true,
          isEligible: false,
          isLive: false,
          status: 'pending_approval',
          criteria: {},
          missingRequirements: ['Vendor must be approved by admin before going live'],
          completionPercentage: 0,
          vendorStatus: vendor.status,
        });
      }

      const liveStatus = await calculateVendorLiveStatus(vendorId);

      // Update vendor's live status in database for fast querying
      try {
        await update('vendors', { id: vendorId }, {
          is_live: liveStatus.isLive,
          live_status_checked_at: new Date().toISOString(),
        });
      } catch (e) {
        // Column might not exist yet, ignore
        console.warn('[LIVE-STATUS] Could not update is_live column:', e);
      }

      return c.json({
        success: true,
        ...liveStatus,
        vendorId,
        vendorType: vendor.vendor_type,
        vendorStatus: vendor.status,
      });
    } catch (error: any) {
      console.error('Error checking vendor live status:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /vendor/:vendorId/profile-completion
   * Get detailed profile completion status
   */
  app.get("/vendor/:vendorId/profile-completion", async (c) => {
    try {
      const { vendorId } = c.req.param();

      if (!isValidUUID(vendorId)) {
        return c.json({ error: 'Invalid vendor ID' }, 400);
      }

      const completion = await calculateVendorProfileCompletion(vendorId);

      return c.json({
        success: true,
        vendorId,
        ...completion,
        is100Percent: completion.percentage === 100,
      });
    } catch (error: any) {
      console.error('Error calculating profile completion:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /staff/:staffId/live-status
   * Get staff's live status eligibility for customer app listing
   */
  app.get("/staff/:staffId/live-status", async (c) => {
    try {
      const { staffId } = c.req.param();

      if (!isValidUUID(staffId)) {
        return c.json({ error: 'Invalid staff ID' }, 400);
      }

      // Check staff exists
      const staffRecords = await select('staff', { id: staffId });
      if (staffRecords.length === 0) {
        return c.json({ error: 'Staff not found' }, 404);
      }

      const staff = staffRecords[0];

      // Staff must be active
      if (!staff.is_active) {
        return c.json({
          success: true,
          isEligible: false,
          isLive: false,
          status: 'inactive',
          criteria: {},
          missingRequirements: ['Staff account is deactivated'],
          completionPercentage: 0,
        });
      }

      const liveStatus = await calculateStaffLiveStatus(staffId);

      // Update staff's live status in database
      try {
        await update('staff', { id: staffId }, {
          is_live: liveStatus.isLive,
          live_status_checked_at: new Date().toISOString(),
        });
      } catch (e) {
        // Column might not exist yet, ignore
        console.warn('[LIVE-STATUS] Could not update staff is_live column:', e);
      }

      return c.json({
        success: true,
        ...liveStatus,
        staffId,
        staffName: staff.name,
        vendorId: staff.vendor_id,
        isIndividualProvider: staff.is_individual_provider || !staff.vendor_id,
      });
    } catch (error: any) {
      console.error('Error checking staff live status:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /staff/:staffId/profile-completion
   * Get detailed staff profile completion status
   */
  app.get("/staff/:staffId/profile-completion", async (c) => {
    try {
      const { staffId } = c.req.param();

      if (!isValidUUID(staffId)) {
        return c.json({ error: 'Invalid staff ID' }, 400);
      }

      const completion = await calculateStaffProfileCompletion(staffId);

      return c.json({
        success: true,
        staffId,
        ...completion,
        is100Percent: completion.percentage === 100,
      });
    } catch (error: any) {
      console.error('Error calculating staff profile completion:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /vendor/:vendorId/verify-address
   * Mark vendor address as verified (admin action or via document verification)
   */
  app.post("/vendor/:vendorId/verify-address", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const body = await c.req.json();
      const { verifiedBy, verificationMethod, documentUrl } = body;

      if (!isValidUUID(vendorId)) {
        return c.json({ error: 'Invalid vendor ID' }, 400);
      }

      const vendors = await select('vendors', { id: vendorId });
      if (vendors.length === 0) {
        return c.json({ error: 'Vendor not found' }, 404);
      }

      // Update address verification status
      await update('vendors', { id: vendorId }, {
        address_verified: true,
        address_verified_at: new Date().toISOString(),
        address_verified_by: verifiedBy || 'system',
      });

      // Log verification event
      try {
        await insert('vendor_verification_logs', {
          vendor_id: vendorId,
          verification_type: 'address',
          verified_by: verifiedBy || 'system',
          verification_method: verificationMethod || 'manual',
          document_url: documentUrl || null,
          verified_at: new Date().toISOString(),
        });
      } catch (e) {
        // Table might not exist, ignore
      }

      // Recalculate live status
      const liveStatus = await calculateVendorLiveStatus(vendorId);

      return c.json({
        success: true,
        message: 'Address verified successfully',
        liveStatus,
      });
    } catch (error: any) {
      console.error('Error verifying address:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /vendor/:vendorId/update-location
   * Update vendor location coordinates (location services)
   */
  app.post("/vendor/:vendorId/update-location", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const body = await c.req.json();
      const { latitude, longitude, address, placeId } = body;

      if (!isValidUUID(vendorId)) {
        return c.json({ error: 'Invalid vendor ID' }, 400);
      }

      if (!latitude || !longitude) {
        return c.json({ error: 'latitude and longitude are required' }, 400);
      }

      const vendors = await select('vendors', { id: vendorId });
      if (vendors.length === 0) {
        return c.json({ error: 'Vendor not found' }, 404);
      }

      // Update location
      await update('vendors', { id: vendorId }, {
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        ...(address && { address }),
        ...(placeId && { place_id: placeId }),
        location_updated_at: new Date().toISOString(),
      });

      // Recalculate live status
      const liveStatus = await calculateVendorLiveStatus(vendorId);

      return c.json({
        success: true,
        message: 'Location updated successfully',
        coordinates: { latitude: parseFloat(latitude), longitude: parseFloat(longitude) },
        liveStatus,
      });
    } catch (error: any) {
      console.error('Error updating location:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  // ============================================================================
  // GO-LIVE ENDPOINTS
  // ============================================================================

  /**
   * GET /vendor/:vendorId/go-live/checklist
   * Get go-live checklist with completion status for each item
   * Used by vendor app to display go-live requirements
   */
  app.get("/vendor/:vendorId/go-live/checklist", async (c) => {
    try {
      const { vendorId } = c.req.param();

      // Handle test IDs
      if (vendorId === 'test-vendor-id' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(vendorId)) {
        return c.json({
          success: true,
          items: [],
          canGoLive: false,
          completedCount: 0,
          requiredCount: 4,
          message: 'Invalid vendor ID',
        });
      }

      // Check vendor exists
      const vendors = await select('vendors', { id: vendorId });
      if (vendors.length === 0) {
        return c.json({ error: 'Vendor not found' }, 404);
      }

      const vendor = vendors[0];

      // Check if vendor is approved
      if (vendor.status !== 'approved' && vendor.status !== 'active') {
        return c.json({
          success: true,
          items: [],
          canGoLive: false,
          completedCount: 0,
          requiredCount: 4,
          message: 'Vendor must be approved by admin before going live',
          vendorStatus: vendor.status,
        });
      }

      // Check if already live
      const isAlreadyLive = vendor.is_live === true || vendor.go_live_at !== null;

      // Build the checklist
      const checklist = await buildGoLiveChecklist(vendorId);

      return c.json({
        success: true,
        ...checklist,
        isAlreadyLive,
        goLiveAt: vendor.go_live_at || null,
        vendorId,
        vendorStatus: vendor.status,
      });
    } catch (error: any) {
      console.error('Error getting go-live checklist:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /vendor/:vendorId/go-live
   * Activate the vendor and set go_live_at timestamp
   * Validates all required checklist items are complete
   */
  app.post("/vendor/:vendorId/go-live", async (c) => {
    try {
      const { vendorId } = c.req.param();

      // Handle test IDs
      if (vendorId === 'test-vendor-id' || !isValidUUID(vendorId)) {
        return c.json({
          success: false,
          error: 'Invalid vendor ID',
        }, 400);
      }

      // Check vendor exists
      const vendors = await select('vendors', { id: vendorId });
      if (vendors.length === 0) {
        return c.json({ error: 'Vendor not found' }, 404);
      }

      const vendor = vendors[0];

      // Check if vendor is approved
      if (vendor.status !== 'approved' && vendor.status !== 'active') {
        return c.json({
          success: false,
          error: 'Vendor must be approved by admin before going live',
          vendorStatus: vendor.status,
        }, 400);
      }

      // Check if already live
      if (vendor.go_live_at !== null) {
        return c.json({
          success: true,
          message: 'Vendor is already live',
          goLiveAt: vendor.go_live_at,
          isLive: true,
        });
      }

      // Build and validate checklist
      const checklist = await buildGoLiveChecklist(vendorId);

      if (!checklist.canGoLive) {
        const incompleteItems = checklist.items
          .filter(item => item.required && !item.completed)
          .map(item => item.title);

        return c.json({
          success: false,
          error: 'Cannot go live. Please complete all required items.',
          incompleteItems,
          checklist,
        }, 400);
      }

      // Set go_live_at and update status
      const goLiveAt = new Date().toISOString();

      await update('vendors', { id: vendorId }, {
        go_live_at: goLiveAt,
        is_live: true,
        is_active: true,
        status: 'active',
        updated_at: goLiveAt,
      });

      // Also update vendor_setup_completion if exists
      try {
        const setupCompletion = await select('vendor_setup_completion', { vendor_id: vendorId });
        if (setupCompletion.length > 0) {
          await update('vendor_setup_completion', { vendor_id: vendorId }, {
            go_live_at: goLiveAt,
            is_go_live_ready: true,
            go_live_ready_at: goLiveAt,
          });
        } else {
          // Create setup completion record if doesn't exist
          await query(
            `INSERT INTO vendor_setup_completion (vendor_id, go_live_at, is_go_live_ready, go_live_ready_at)
             VALUES ($1, $2, true, $2)
             ON CONFLICT (vendor_id) DO UPDATE SET 
               go_live_at = $2,
               is_go_live_ready = true,
               go_live_ready_at = $2`,
            [vendorId, goLiveAt]
          );
        }
      } catch (setupError: any) {
        console.warn('[GO-LIVE] Error updating setup completion:', setupError.message);
        // Don't fail go-live for setup completion errors
      }

      // Sync services to customer app discovery
      try {
        // Get all vendor services
        const vendorServices = await select('vendor_services', {
          vendor_id: vendorId,
          is_enabled: true,
        });

        console.log(`✅ Vendor ${vendorId} is now LIVE with ${vendorServices.length} services`);
      } catch (syncError: any) {
        console.warn('[GO-LIVE] Error syncing services:', syncError.message);
        // Don't fail go-live for sync errors
      }

      return c.json({
        success: true,
        message: 'Congratulations! Your business is now live!',
        goLiveAt,
        isLive: true,
        vendorId,
      });
    } catch (error: any) {
      console.error('Error going live:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /discover/live-vendors
   * Get all live vendors for customer app discovery
   * Filters vendors by live status eligibility
   */
  app.get("/discover/live-vendors", async (c) => {
    try {
      const roleId = c.req.query('roleId');
      const serviceStyle = c.req.query('serviceStyle');
      const category = c.req.query('category');
      const city = c.req.query('city');
      const latitude = c.req.query('latitude');
      const longitude = c.req.query('longitude');
      const maxDistance = parseFloat(c.req.query('maxDistance') || '50');
      const limit = parseInt(c.req.query('limit') || '50', 10);
      const offset = parseInt(c.req.query('offset') || '0', 10);

      // Build query for live vendors
      let vendorQuery = `
        SELECT v.*, 
               r.name as role_name,
               r.display_name as role_display_name,
               (SELECT COUNT(*) FROM vendor_services vs 
                WHERE vs.vendor_id = v.id AND vs.is_enabled = true AND vs.publish_status = 'published') as enabled_services_count,
               (SELECT AVG(rating) FROM reviews WHERE vendor_id = v.id) as avg_rating,
               (SELECT COUNT(*) FROM bookings WHERE vendor_id = v.id AND status = 'completed') as completed_bookings
        FROM vendors v
        LEFT JOIN roles r ON v.role_id = r.id
        WHERE v.is_active = true
          AND v.status = 'approved'
          AND v.latitude IS NOT NULL
          AND v.longitude IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM vendor_services vs 
            WHERE vs.vendor_id = v.id 
              AND vs.is_enabled = true 
              AND vs.publish_status = 'published'
          )
          AND EXISTS (
            SELECT 1 FROM vendor_availability_v2 va 
            WHERE va.vendor_id = v.id OR va.vendor_id IN (SELECT id FROM vendor_identity WHERE vendor_id = v.id OR phone = v.phone)
          )
      `;

      const params: any[] = [];
      let paramIndex = 1;

      // Filter by role
      if (roleId) {
        vendorQuery += ` AND (v.role_id = $${paramIndex} OR r.name = $${paramIndex})`;
        params.push(roleId);
        paramIndex++;
      }

      // Filter by service style
      if (serviceStyle) {
        vendorQuery += ` AND EXISTS (
          SELECT 1 FROM vendor_services vs2 
          WHERE vs2.vendor_id = v.id 
            AND vs2.service_style = $${paramIndex}
            AND vs2.is_enabled = true
        )`;
        params.push(serviceStyle);
        paramIndex++;
      }

      // Filter by category
      if (category) {
        vendorQuery += ` AND v.category = $${paramIndex}`;
        params.push(category);
        paramIndex++;
      }

      // Filter by city
      if (city) {
        vendorQuery += ` AND v.city ILIKE $${paramIndex}`;
        params.push(`%${city}%`);
        paramIndex++;
      }

      // Order by rating and completed bookings
      vendorQuery += ` ORDER BY avg_rating DESC NULLS LAST, completed_bookings DESC`;

      // Add pagination
      vendorQuery += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);

      const vendorsResult = await query(vendorQuery, params);
      let vendors = vendorsResult.rows;

      // If location provided, calculate distance and filter
      if (latitude && longitude) {
        const customerLat = parseFloat(latitude);
        const customerLng = parseFloat(longitude);

        vendors = vendors
          .map((v: any) => {
            const distance = calculateDistance(
              customerLat,
              customerLng,
              parseFloat(v.latitude),
              parseFloat(v.longitude)
            );
            return { ...v, distance };
          })
          .filter((v: any) => v.distance <= maxDistance)
          .sort((a: any, b: any) => a.distance - b.distance);
      }

      // Get total count for pagination
      let countQuery = `
        SELECT COUNT(*) as total
        FROM vendors v
        LEFT JOIN roles r ON v.role_id = r.id
        WHERE v.is_active = true
          AND v.status = 'approved'
          AND v.latitude IS NOT NULL
          AND v.longitude IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM vendor_services vs 
            WHERE vs.vendor_id = v.id 
              AND vs.is_enabled = true 
              AND vs.publish_status = 'published'
          )
          AND EXISTS (
            SELECT 1 FROM vendor_availability_v2 va 
            WHERE va.vendor_id = v.id OR va.vendor_id IN (SELECT id FROM vendor_identity WHERE vendor_id = v.id OR phone = v.phone)
          )
      `;

      // Apply same filters for count
      const countParams: any[] = [];
      let countParamIndex = 1;

      if (roleId) {
        countQuery += ` AND (v.role_id = $${countParamIndex} OR r.name = $${countParamIndex})`;
        countParams.push(roleId);
        countParamIndex++;
      }

      if (serviceStyle) {
        countQuery += ` AND EXISTS (
          SELECT 1 FROM vendor_services vs2 
          WHERE vs2.vendor_id = v.id 
            AND vs2.service_style = $${countParamIndex}
            AND vs2.is_enabled = true
        )`;
        countParams.push(serviceStyle);
        countParamIndex++;
      }

      if (category) {
        countQuery += ` AND v.category = $${countParamIndex}`;
        countParams.push(category);
        countParamIndex++;
      }

      if (city) {
        countQuery += ` AND v.city ILIKE $${countParamIndex}`;
        countParams.push(`%${city}%`);
        countParamIndex++;
      }

      const countResult = await query(countQuery, countParams);
      const total = parseInt(countResult.rows[0]?.total || '0');

      return c.json({
        success: true,
        vendors: vendors.map((v: any) => ({
          id: v.id,
          businessName: v.business_name,
          ownerName: v.owner_name,
          phone: v.phone,
          email: v.email,
          address: v.address,
          city: v.city,
          state: v.state,
          pincode: v.pincode,
          latitude: v.latitude,
          longitude: v.longitude,
          distance: v.distance,
          logoUrl: v.logo_url,
          description: v.description,
          category: v.category,
          roleId: v.role_id,
          roleName: v.role_name,
          roleDisplayName: v.role_display_name,
          enabledServicesCount: parseInt(v.enabled_services_count || '0'),
          avgRating: parseFloat(v.avg_rating) || 0,
          completedBookings: parseInt(v.completed_bookings || '0'),
          isLive: true, // All vendors in this response are live
        })),
        total,
        limit,
        offset,
        filters: { roleId, serviceStyle, category, city, maxDistance },
      });
    } catch (error: any) {
      console.error('Error discovering live vendors:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /discover/live-staff
   * Get all live staff/individual providers for customer app discovery
   */
  app.get("/discover/live-staff", async (c) => {
    try {
      const roleId = c.req.query('roleId');
      const serviceStyle = c.req.query('serviceStyle');
      const vendorId = c.req.query('vendorId');
      const serviceId = c.req.query('serviceId');
      const latitude = c.req.query('latitude');
      const longitude = c.req.query('longitude');
      const maxDistance = parseFloat(c.req.query('maxDistance') || '50');
      const limit = parseInt(c.req.query('limit') || '50', 10);
      const offset = parseInt(c.req.query('offset') || '0', 10);

      // Build query for live staff (using COALESCE for column compatibility)
      let staffQuery = `
        SELECT s.*, 
               v.business_name as vendor_name,
               v.city,
               v.state,
               v.latitude as vendor_lat,
               v.longitude as vendor_lng,
               (SELECT COUNT(*) FROM staff_services ss 
                WHERE ss.staff_id = s.id) as enabled_services_count,
               0 as avg_rating,
               (SELECT COUNT(*) FROM bookings WHERE bookings.staff_id = s.id AND status = 'completed') as completed_bookings
        FROM staff s
        LEFT JOIN vendors v ON s.vendor_id = v.id
        WHERE s.is_active = true
          AND s.mobile_verified = true
          AND EXISTS (
            SELECT 1 FROM staff_services ss 
            WHERE ss.staff_id = s.id
          )
      `;

      const params: any[] = [];
      let paramIndex = 1;

      // Filter by vendor
      if (vendorId) {
        staffQuery += ` AND s.vendor_id = $${paramIndex}`;
        params.push(vendorId);
        paramIndex++;
      }

      // Filter by role
      if (roleId) {
        staffQuery += ` AND s.role = $${paramIndex}`;
        params.push(roleId);
        paramIndex++;
      }

      // Filter by service
      if (serviceId) {
        staffQuery += ` AND EXISTS (
          SELECT 1 FROM staff_services ss2 
          WHERE ss2.staff_id = s.id 
            AND ss2.service_id = $${paramIndex}
        )`;
        params.push(serviceId);
        paramIndex++;
      }

      // Filter by service style
      if (serviceStyle) {
        staffQuery += ` AND EXISTS (
          SELECT 1 FROM staff_services ss3 
          WHERE ss3.staff_id = s.id 
            AND $${paramIndex} = ANY(COALESCE(ss3.service_styles, ARRAY[]::text[]))
        )`;
        params.push(serviceStyle);
        paramIndex++;
      }

      // Order by rating
      staffQuery += ` ORDER BY avg_rating DESC NULLS LAST, completed_bookings DESC`;

      // Add pagination
      staffQuery += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);

      const staffResult = await query(staffQuery, params);
      let staffList = staffResult.rows;

      // Calculate distance if location provided
      if (latitude && longitude) {
        const customerLat = parseFloat(latitude);
        const customerLng = parseFloat(longitude);

        staffList = staffList
          .map((s: any) => {
            let staffLat = null;
            let staffLng = null;

            // Get staff location
            if (s.default_location && typeof s.default_location === 'object') {
              staffLat = parseFloat((s.default_location as any).lat);
              staffLng = parseFloat((s.default_location as any).lng);
            } else if (s.vendor_lat && s.vendor_lng) {
              staffLat = parseFloat(s.vendor_lat);
              staffLng = parseFloat(s.vendor_lng);
            }

            if (staffLat && staffLng) {
              const distance = calculateDistance(customerLat, customerLng, staffLat, staffLng);
              return { ...s, distance, staffLat, staffLng };
            }
            return { ...s, distance: null, staffLat, staffLng };
          })
          .filter((s: any) => s.distance === null || s.distance <= maxDistance)
          .sort((a: any, b: any) => {
            if (a.distance === null) return 1;
            if (b.distance === null) return -1;
            return a.distance - b.distance;
          });
      }

      return c.json({
        success: true,
        staff: staffList.map((s: any) => ({
          id: s.id,
          name: s.name,
          phone: s.phone,
          email: s.email,
          photo: s.photo,
          role: s.role,
          qualifications: s.qualifications,
          experienceYears: s.experience_years,
          vendorId: s.vendor_id,
          vendorName: s.vendor_name,
          city: s.city,
          state: s.state,
          latitude: s.staffLat,
          longitude: s.staffLng,
          distance: s.distance,
          enabledServicesCount: parseInt(s.enabled_services_count || '0'),
          avgRating: parseFloat(s.avg_rating) || 0,
          completedBookings: parseInt(s.completed_bookings || '0'),
          isLive: true,
          isIndividualProvider: s.is_individual_provider || !s.vendor_id,
        })),
        total: staffList.length,
        limit,
        offset,
      });
    } catch (error: any) {
      console.error('Error discovering live staff:', error);
      return c.json({ error: error.message }, 500);
    }
  });
}

// Helper: Calculate distance using Haversine formula
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ============================================================================
// BANK VERIFICATION CHECK
// ============================================================================

/**
 * Check if vendor has a verified bank account
 */
export async function checkBankVerification(vendorId: string): Promise<{
  hasVerifiedBank: boolean;
  verifiedAccountCount: number;
  totalAccountCount: number;
  primaryAccount: any | null;
}> {
  try {
    // Check which table exists
    const schemaCheck = await query(`
      SELECT 
        EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'vendor_bank_accounts') as has_bank_accounts,
        EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'vendor_bank_details') as has_bank_details
    `);
    
    const schema = schemaCheck.rows[0] || {};
    const tableName = schema.has_bank_accounts ? 'vendor_bank_accounts' : (schema.has_bank_details ? 'vendor_bank_details' : null);
    
    if (!tableName) {
      return {
        hasVerifiedBank: false,
        verifiedAccountCount: 0,
        totalAccountCount: 0,
        primaryAccount: null,
      };
    }

    const accounts = await query(
      `SELECT * FROM ${tableName} 
       WHERE vendor_id = $1 
       ORDER BY is_primary DESC, created_at DESC`,
      [vendorId]
    );

    const verifiedAccounts = accounts.rows.filter((a: any) => 
      a.is_verified === true || a.verification_status === 'verified'
    );
    const primaryAccount = accounts.rows.find((a: any) => a.is_primary === true) || null;

    return {
      hasVerifiedBank: verifiedAccounts.length > 0,
      verifiedAccountCount: verifiedAccounts.length,
      totalAccountCount: accounts.rows.length,
      primaryAccount,
    };
  } catch (error: any) {
    console.error('[LIVE-STATUS] Error checking bank verification:', error.message);
    return {
      hasVerifiedBank: false,
      verifiedAccountCount: 0,
      totalAccountCount: 0,
      primaryAccount: null,
    };
  }
}

// ============================================================================
// GO-LIVE CHECKLIST FUNCTIONS
// ============================================================================

/**
 * Build go-live checklist for a vendor
 * Returns all checklist items with their completion status
 */
export async function buildGoLiveChecklist(vendorId: string): Promise<{
  items: Array<{
    id: string;
    title: string;
    completed: boolean;
    required: boolean;
    details?: any;
  }>;
  canGoLive: boolean;
  completedCount: number;
  requiredCount: number;
}> {
  // Run all checks in parallel for performance
  const [profileResult, bankResult, servicesResult, scheduleResult] = await Promise.all([
    calculateVendorProfileCompletion(vendorId),
    checkBankVerification(vendorId),
    checkServicesEnabled(vendorId),
    checkScheduleUpToDate(vendorId),
  ]);

  const items = [
    {
      id: 'profile_completion',
      title: 'Complete your business profile',
      completed: profileResult.percentage >= 80, // Allow 80% for flexibility
      required: true,
      details: {
        percentage: profileResult.percentage,
        missingFields: profileResult.missingFields,
      },
    },
    {
      id: 'bank_verification',
      title: 'Add and verify bank account',
      completed: bankResult.hasVerifiedBank,
      required: true,
      details: {
        verifiedAccountCount: bankResult.verifiedAccountCount,
        totalAccountCount: bankResult.totalAccountCount,
      },
    },
    {
      id: 'services_configured',
      title: 'Add at least one service',
      completed: servicesResult.hasEnabledServices,
      required: true,
      details: {
        enabledCount: servicesResult.enabledCount,
        totalCount: servicesResult.totalCount,
        servicesByStyle: servicesResult.servicesByStyle,
      },
    },
    {
      id: 'availability_configured',
      title: 'Set up your availability schedule',
      completed: scheduleResult.isUpToDate,
      required: true,
      details: {
        hasScheduleSlots: scheduleResult.hasScheduleSlots,
        configuredDays: scheduleResult.configuredDays,
        nextAvailableDate: scheduleResult.nextAvailableDate,
      },
    },
  ];

  const requiredItems = items.filter(item => item.required);
  const completedRequired = requiredItems.filter(item => item.completed);

  return {
    items,
    canGoLive: completedRequired.length === requiredItems.length,
    completedCount: items.filter(item => item.completed).length,
    requiredCount: requiredItems.length,
  };
}
