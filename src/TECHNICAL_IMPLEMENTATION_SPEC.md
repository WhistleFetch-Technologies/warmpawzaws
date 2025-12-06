# 🔧 TECHNICAL IMPLEMENTATION SPECIFICATION
**Purpose:** Detailed technical specs for implementing critical fixes  
**Target:** Development team  
**Priority:** Critical gaps identified in Platform Analysis Report

---

## 1️⃣ START OTP FOR TRAINERS/WALKERS/BEHAVIOURISTS

### Current State
```typescript
// booking-creation.tsx - Current implementation
const completionOTP = requiresOTP ? String(Math.floor(1000 + Math.random() * 9000)) : null;

booking = {
  ...
  requiresOTP: requiresOTP,
  completionOTP: completionOTP // Only ONE OTP
}
```

### Required State
```typescript
// Determine if service requires START + END OTP
const requiresStartOTP = isTrainerWalkerBehaviourist(service);
const startOTP = requiresStartOTP ? generateOTP() : null;
const completionOTP = requiresOTP ? generateOTP() : null;

booking = {
  ...
  requiresOTP: requiresOTP,
  requiresStartOTP: requiresStartOTP,
  startOTP: startOTP,
  completionOTP: completionOTP,
  startTime: null, // Filled when START OTP verified
  endTime: null,   // Filled when END OTP verified
  actualDuration: null // Calculated from start/end times
}
```

### Implementation Steps

#### Step 1: Add Service Category to Catalog
```typescript
// Update service-catalog-seed.tsx
interface ServiceDefinition {
  // ... existing fields
  category: 'veterinary' | 'grooming' | 'training' | 'walking' | 'behaviour' | 'daycare' | 'boarding' | 'other';
  requiresStartOTP?: boolean; // Auto-calculated from category
}

// Helper function
function getOTPRequirements(category: string) {
  const startOTPCategories = ['training', 'walking', 'behaviour'];
  return {
    requiresStartOTP: startOTPCategories.includes(category),
    requiresEndOTP: true // All services need completion OTP
  };
}
```

#### Step 2: Update Booking Creation
```typescript
// booking-creation.tsx

// Add after service fetching
const otpRequirements = getOTPRequirements(service.category);
const requiresStartOTP = otpRequirements.requiresStartOTP;
const requiresEndOTP = otpRequirements.requiresEndOTP && communicationType === 'in_person';

// Generate OTPs
const startOTP = requiresStartOTP ? generateOTP() : null;
const completionOTP = requiresEndOTP ? generateOTP() : null;

// Update booking object
const booking = {
  ...existingFields,
  
  // OTP Configuration
  requiresStartOTP: requiresStartOTP,
  requiresOTP: requiresEndOTP,
  startOTP: startOTP,
  completionOTP: completionOTP,
  
  // Tracking Fields
  startTime: null,
  endTime: null,
  actualDuration: null,
  
  // Service Info
  serviceCategory: service.category
};
```

#### Step 3: Update Package Occurrence Creation
```typescript
// index.tsx - createPackageOccurrences function

async function createPackageOccurrences(booking: any): Promise<any[]> {
  const occurrences = [];
  const { totalSessions, frequency, startDate } = booking.packageDetails;
  
  // Determine if this service requires START OTP
  const requiresStartOTP = booking.requiresStartOTP;
  
  for (let i = 0; i < totalSessions; i++) {
    const occurrence = {
      occurrenceId: `${booking.id}_occ_${i + 1}`,
      bookingId: booking.id,
      sessionNumber: i + 1,
      scheduledDate: calculatedDate,
      scheduledTime: baseTime,
      
      // OTPs
      startOTP: requiresStartOTP ? generateOTP() : null,
      otp: generateOTP(), // Completion OTP (kept as 'otp' for backward compatibility)
      completionOTP: generateOTP(), // Also store as completionOTP for clarity
      
      // Tracking
      status: 'pending',
      startTime: null,
      endTime: null,
      actualDuration: null,
      
      createdAt: new Date().toISOString()
    };
    
    occurrences.push(occurrence);
  }
  
  return occurrences;
}
```

#### Step 4: Create START OTP Endpoint
```typescript
// booking-management-endpoints.tsx

/**
 * Start a booking or package occurrence with START OTP
 * POST /booking/:bookingId/start
 * POST /booking/:bookingId/occurrence/:occurrenceId/start
 */
app.post('/make-server-3dd53475/booking/:bookingId/start', async (c) => {
  const { bookingId } = c.req.param();
  const { otp, staffId } = await c.req.json();
  
  const booking = await kv.get(`booking:${bookingId}`);
  
  if (!booking) {
    return c.json({ success: false, error: 'Booking not found' }, 404);
  }
  
  if (!booking.requiresStartOTP) {
    return c.json({ success: false, error: 'This service does not require START OTP' }, 400);
  }
  
  if (booking.startOTP !== otp) {
    return c.json({ success: false, error: 'Invalid START OTP' }, 400);
  }
  
  if (booking.startTime) {
    return c.json({ success: false, error: 'Service already started' }, 400);
  }
  
  // Update booking
  const now = new Date().toISOString();
  booking.startTime = now;
  booking.status = 'in_progress';
  booking.updatedAt = now;
  
  if (staffId) {
    booking.actualStaffId = staffId;
  }
  
  await kv.set(`booking:${bookingId}`, booking);
  
  return c.json({
    success: true,
    message: 'Service started successfully',
    startTime: now
  });
});

/**
 * Start a package occurrence with START OTP
 */
app.post('/make-server-3dd53475/booking/:bookingId/occurrence/:occurrenceId/start', async (c) => {
  const { bookingId, occurrenceId } = c.req.param();
  const { otp, staffId } = await c.req.json();
  
  const occurrences = await kv.get(`booking:${bookingId}:occurrences`) || [];
  const occurrenceIndex = occurrences.findIndex((o: any) => o.occurrenceId === occurrenceId);
  
  if (occurrenceIndex === -1) {
    return c.json({ success: false, error: 'Occurrence not found' }, 404);
  }
  
  const occurrence = occurrences[occurrenceIndex];
  
  if (!occurrence.startOTP) {
    return c.json({ success: false, error: 'This service does not require START OTP' }, 400);
  }
  
  if (occurrence.startOTP !== otp) {
    return c.json({ success: false, error: 'Invalid START OTP' }, 400);
  }
  
  if (occurrence.startTime) {
    return c.json({ success: false, error: 'Service already started' }, 400);
  }
  
  // Update occurrence
  const now = new Date().toISOString();
  occurrence.startTime = now;
  occurrence.status = 'in_progress';
  occurrence.updatedAt = now;
  
  if (staffId) {
    occurrence.actualStaffId = staffId;
  }
  
  occurrences[occurrenceIndex] = occurrence;
  await kv.set(`booking:${bookingId}:occurrences`, occurrences);
  
  // Update main booking
  const booking = await kv.get(`booking:${bookingId}`);
  booking.updatedAt = now;
  await kv.set(`booking:${bookingId}`, booking);
  
  return c.json({
    success: true,
    message: 'Service started successfully',
    startTime: now,
    occurrence: occurrence
  });
});
```

#### Step 5: Update Completion Endpoint to Calculate Duration
```typescript
// In existing completion endpoint, add:

if (booking.startTime && booking.requiresStartOTP) {
  const startTime = new Date(booking.startTime);
  const endTime = new Date();
  const durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / 60000);
  
  booking.actualDuration = durationMinutes;
  
  // Validate duration (e.g., 30min service shouldn't be 5 minutes)
  const expectedDuration = booking.duration || 30;
  if (durationMinutes < expectedDuration * 0.5) {
    console.warn(`⚠️  Service completed too quickly: ${durationMinutes}min vs expected ${expectedDuration}min`);
    // Could flag for review or send notification
  }
}
```

#### Step 6: Update OTPCompletionModal Component
```typescript
// OTPCompletionModal.tsx

interface OTPCompletionModalProps {
  bookingId: string;
  occurrenceId?: string;
  sessionNumber?: number;
  staffId?: string;
  mode: 'start' | 'complete'; // NEW: Determine which OTP to enter
  onClose: () => void;
  onSuccess: () => void;
}

export function OTPCompletionModal({ mode, ...props }: OTPCompletionModalProps) {
  const handleComplete = async () => {
    const endpoint = mode === 'start'
      ? occurrenceId
        ? `/booking/${bookingId}/occurrence/${occurrenceId}/start`
        : `/booking/${bookingId}/start`
      : occurrenceId
        ? `/booking/${bookingId}/occurrence/${occurrenceId}/complete`
        : `/booking/${bookingId}/complete`;
    
    // ... rest of implementation
  };
  
  return (
    <div>
      <h2>
        {mode === 'start' ? 'Start Service' : 'Complete Service'}
      </h2>
      <p>
        {mode === 'start' 
          ? 'Enter the START OTP to begin the service'
          : 'Enter the COMPLETION OTP to finish the service'}
      </p>
      {/* ... OTP input */}
    </div>
  );
}
```

#### Step 7: Update MyBookings Component
```typescript
// MyBookings.tsx - Display both OTPs

{booking.requiresStartOTP && (
  <div className="p-3 bg-green-50 border border-green-200 rounded-lg mb-2">
    <div className="flex items-center justify-between">
      <span className="text-xs font-semibold text-green-700">
        🟢 START OTP
      </span>
      <div className="flex items-center gap-2">
        <span className="text-2xl font-mono font-bold text-green-900">
          {booking.startOTP}
        </span>
        <button onClick={() => copyToClipboard(booking.startOTP)}>
          <Copy className="w-4 h-4" />
        </button>
      </div>
    </div>
    {booking.startTime && (
      <p className="text-xs text-green-600 mt-1">
        ✅ Started at {formatTime(booking.startTime)}
      </p>
    )}
  </div>
)}

<div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
  <div className="flex items-center justify-between">
    <span className="text-xs font-semibold text-orange-700">
      🔴 COMPLETION OTP
    </span>
    <div className="flex items-center gap-2">
      <span className="text-2xl font-mono font-bold text-orange-900">
        {booking.completionOTP}
      </span>
      <button onClick={() => copyToClipboard(booking.completionOTP)}>
        <Copy className="w-4 h-4" />
      </button>
    </div>
  </div>
  {booking.endTime && (
    <p className="text-xs text-orange-600 mt-1">
      ✅ Completed at {formatTime(booking.endTime)}
    </p>
  )}
</div>

{booking.actualDuration && (
  <p className="text-xs text-gray-500 mt-2">
    ⏱️ Actual Duration: {booking.actualDuration} minutes
  </p>
)}
```

---

## 2️⃣ AUTOMATIC STAFF ASSIGNMENT FOR HOME SERVICES

### Current State
- Customer selects staff member from list
- All service styles show staff selection UI

### Required State
- Home services: Auto-assign available staff within 5km
- At Centre: Optional staff selection (customer can choose or auto-assign)
- Tele: No staff selection

### Implementation Steps

#### Step 1: Create Auto-Assignment Algorithm
```typescript
// Create new file: /supabase/functions/server/staff-auto-assignment.tsx

export async function autoAssignStaff(params: {
  vendorId: string;
  serviceType: string;
  scheduledDate: string;
  scheduledTime: string;
  customerLocation?: { latitude: number; longitude: number };
}): Promise<string | null> {
  const { vendorId, serviceType, scheduledDate, scheduledTime, customerLocation } = params;
  
  console.log(`[Auto-Assign] Finding staff for ${serviceType} on ${scheduledDate} at ${scheduledTime}`);
  
  // Get all staff for this vendor
  const staffList = await kv.get(`vendor:${vendorId}:staff`) || [];
  console.log(`[Auto-Assign] Found ${staffList.length} staff members`);
  
  const availableStaff = [];
  
  for (const staffId of staffList) {
    const staff = await kv.get(`staff:${staffId}`);
    
    if (!staff || !staff.isActive) {
      console.log(`[Auto-Assign] Staff ${staffId} is inactive`);
      continue;
    }
    
    // Check if staff can perform this service type
    const staffServices = staff.services || [];
    if (!staffServices.includes(serviceType) && !staffServices.includes('all')) {
      console.log(`[Auto-Assign] Staff ${staffId} cannot perform ${serviceType}`);
      continue;
    }
    
    // Check staff availability for this time slot
    const isAvailable = await checkStaffAvailability(staffId, scheduledDate, scheduledTime);
    if (!isAvailable) {
      console.log(`[Auto-Assign] Staff ${staffId} not available at this time`);
      continue;
    }
    
    // Calculate distance if location provided
    let distance = 0;
    if (customerLocation && staff.location) {
      distance = calculateDistance(
        customerLocation.latitude,
        customerLocation.longitude,
        staff.location.latitude,
        staff.location.longitude
      );
      
      if (distance > 5) {
        console.log(`[Auto-Assign] Staff ${staffId} too far: ${distance}km`);
        continue;
      }
    }
    
    availableStaff.push({
      staffId: staffId,
      staff: staff,
      distance: distance
    });
  }
  
  if (availableStaff.length === 0) {
    console.log(`[Auto-Assign] No available staff found`);
    return null;
  }
  
  // Sort by distance (closest first)
  availableStaff.sort((a, b) => a.distance - b.distance);
  
  const assigned = availableStaff[0];
  console.log(`[Auto-Assign] Assigned staff ${assigned.staffId} (${assigned.distance}km away)`);
  
  return assigned.staffId;
}

async function checkStaffAvailability(
  staffId: string,
  date: string,
  time: string
): Promise<boolean> {
  // Check staff schedule
  const schedule = await kv.get(`staff:${staffId}:schedule`) || {};
  const dayOfWeek = new Date(date).toLocaleDateString('en-US', { weekday: 'lowercase' });
  
  // Check if day is enabled
  if (!schedule[dayOfWeek]?.isEnabled) {
    return false;
  }
  
  // Check if time falls within working hours
  const timeWindows = schedule[dayOfWeek]?.timeWindows || [];
  const timeMinutes = timeToMinutes(time.split(' - ')[0]);
  
  const inWorkingHours = timeWindows.some((window: any) => {
    if (!window.isEnabled) return false;
    const start = timeToMinutes(window.startTime);
    const end = timeToMinutes(window.endTime);
    return timeMinutes >= start && timeMinutes < end;
  });
  
  if (!inWorkingHours) {
    return false;
  }
  
  // Check for breaks
  const breaks = await kv.get(`staff:${staffId}:breaks:${date}`) || [];
  const duringBreak = breaks.some((b: any) => {
    const breakStart = timeToMinutes(b.startTime);
    const breakEnd = timeToMinutes(b.endTime);
    return timeMinutes >= breakStart && timeMinutes < breakEnd;
  });
  
  if (duringBreak) {
    return false;
  }
  
  // Check for holidays
  const holidays = await kv.get(`staff:${staffId}:holidays`) || [];
  const isHoliday = holidays.some((h: any) => h.date === date);
  
  if (isHoliday) {
    return false;
  }
  
  // Check for existing bookings at this time
  const staffBookings = await kv.get(`staff:${staffId}:bookings`) || [];
  for (const bookingId of staffBookings) {
    const booking = await kv.get(`booking:${bookingId}`);
    if (booking && 
        booking.scheduledDate === date && 
        booking.scheduledTime === time &&
        booking.status !== 'cancelled' &&
        booking.status !== 'completed') {
      return false;
    }
  }
  
  return true;
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}
```

#### Step 2: Integrate into Booking Creation
```typescript
// booking-creation.tsx

// After vendor validation
let assignedStaffId = staffId; // From request (may be null)

// Auto-assign staff for home services if not provided
if (service.serviceStyle === 'at_home' && !assignedStaffId) {
  console.log(`🤖 Auto-assigning staff for home service...`);
  
  assignedStaffId = await autoAssignStaff({
    vendorId: vendorId,
    serviceType: serviceType,
    scheduledDate: scheduledDate,
    scheduledTime: scheduledTime,
    customerLocation: customerLocation // Should be passed from frontend
  });
  
  if (!assignedStaffId) {
    throw new Error('No available staff found for this time slot');
  }
  
  console.log(`✅ Auto-assigned staff: ${assignedStaffId}`);
}

// Update booking object
const booking = {
  ...existingFields,
  staffId: assignedStaffId,
  staffAssignmentType: staffId ? 'manual' : 'auto' // Track how staff was assigned
};
```

#### Step 3: Update Frontend to Skip Staff Selection for Home Services
```typescript
// VetServiceRouter.tsx (and similar routers)

// In slot selection step
const showStaffSelection = serviceStyle !== 'at_home';

{showStaffSelection && (
  <StaffSelectionUI />
)}

// If home service, proceed directly to payment after slot selection
if (serviceStyle === 'at_home') {
  // Skip staff selection, let backend auto-assign
  handleProceedToPayment();
}
```

---

## 3️⃣ 5KM RADIUS ENFORCEMENT FOR HOME SERVICES

### Implementation Steps

#### Step 1: Capture Customer Location
```typescript
// CustomerHomeWrapper.tsx or main app wrapper

const [customerLocation, setCustomerLocation] = useState<{
  latitude: number;
  longitude: number;
} | null>(null);

useEffect(() => {
  // Request location permission
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCustomerLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        });
        
        // Store in localStorage for persistence
        localStorage.setItem('customerLocation', JSON.stringify({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        }));
      },
      (error) => {
        console.error('Error getting location:', error);
        // Fallback: Ask user to enter pincode
      }
    );
  }
}, []);
```

#### Step 2: Update Search Endpoint to Filter by Distance
```typescript
// universal-customer-search.tsx

app.get('/make-server-3dd53475/customer/search', async (c) => {
  const { serviceType, serviceStyle, latitude, longitude, radius = 5 } = c.req.query();
  
  // ... existing search logic
  
  // Filter by distance for home services
  if (serviceStyle === 'at_home' && latitude && longitude) {
    const customerLat = parseFloat(latitude);
    const customerLon = parseFloat(longitude);
    
    vendors = vendors.filter((vendor: any) => {
      if (!vendor.location) return false;
      
      const distance = calculateDistance(
        customerLat,
        customerLon,
        vendor.location.latitude,
        vendor.location.longitude
      );
      
      return distance <= parseFloat(radius);
    });
    
    // Sort by distance
    vendors.sort((a: any, b: any) => {
      const distA = calculateDistance(customerLat, customerLon, a.location.latitude, a.location.longitude);
      const distB = calculateDistance(customerLat, customerLon, b.location.latitude, b.location.longitude);
      return distA - distB;
    });
  }
  
  // ... return results
});
```

#### Step 3: Update VendorListingScreen to Pass Location
```typescript
// VendorListingScreen.tsx

const loadVendors = async () => {
  const location = JSON.parse(localStorage.getItem('customerLocation') || 'null');
  
  const params = new URLSearchParams({
    serviceType: selectedService,
    serviceStyle: serviceStyle,
    ...(location && serviceStyle === 'at_home' && {
      latitude: location.latitude.toString(),
      longitude: location.longitude.toString(),
      radius: '5'
    })
  });
  
  const response = await fetch(`${apiUrl}/customer/search?${params}`);
  // ... rest
};
```

---

## 4️⃣ PACKAGE SESSIONS PER DAY (2x/day Support)

### Implementation

#### Step 1: Update Package Details Schema
```typescript
interface PackageDetails {
  totalDays: number; // e.g., 7 days
  sessionsPerDay: number; // e.g., 2 (morning + evening)
  sessionDuration: number; // e.g., 30 minutes per session
  frequency: 'daily' | 'weekly' | 'monthly' | 'alternate_days';
  timeSlots?: string[]; // e.g., ['09:00', '17:00'] for 2x/day
}

// Total sessions = totalDays × sessionsPerDay
```

#### Step 2: Update Occurrence Creation
```typescript
async function createPackageOccurrences(booking: any): Promise<any[]> {
  const occurrences = [];
  const { totalDays, sessionsPerDay, frequency, timeSlots } = booking.packageDetails;
  
  const totalSessions = totalDays * sessionsPerDay;
  const baseDate = new Date(booking.bookingDate);
  
  let sessionCount = 0;
  
  for (let day = 0; day < totalDays; day++) {
    let scheduledDate = new Date(baseDate);
    
    // Calculate date based on frequency
    if (frequency === 'daily') {
      scheduledDate.setDate(baseDate.getDate() + day);
    } else if (frequency === 'alternate_days') {
      scheduledDate.setDate(baseDate.getDate() + (day * 2));
    } else if (frequency === 'weekly') {
      scheduledDate.setDate(baseDate.getDate() + (day * 7));
    }
    
    // Create sessions for this day
    for (let session = 0; session < sessionsPerDay; session++) {
      sessionCount++;
      
      const scheduledTime = timeSlots && timeSlots[session]
        ? timeSlots[session]
        : booking.bookingTime;
      
      const occurrence = {
        occurrenceId: `${booking.id}_occ_${sessionCount}`,
        bookingId: booking.id,
        sessionNumber: sessionCount,
        dayNumber: day + 1,
        sessionOfDay: session + 1,
        scheduledDate: scheduledDate.toISOString().split('T')[0],
        scheduledTime: scheduledTime,
        
        startOTP: booking.requiresStartOTP ? generateOTP() : null,
        completionOTP: generateOTP(),
        
        status: 'pending',
        startTime: null,
        endTime: null,
        actualDuration: null,
        
        createdAt: new Date().toISOString()
      };
      
      occurrences.push(occurrence);
    }
  }
  
  console.log(`[Package] Created ${occurrences.length} occurrences (${totalDays} days × ${sessionsPerDay} sessions/day)`);
  
  return occurrences;
}
```

---

## 5️⃣ SERVICE PERMISSION MATRIX

### Implementation

#### Step 1: Create Permission Schema
```typescript
// Platform Admin defines which services each vendor role can offer

interface ServicePermission {
  roleId: string; // e.g., 'pet_groomer'
  allowedServices: string[]; // Array of service codes
  canCreateCustomServices: boolean; // Only true for 'at_center' roles
  serviceStyleRestrictions?: string[]; // e.g., ['at_center'] only
}

// Store in KV
await kv.set('service:permissions:pet_groomer', {
  roleId: 'pet_groomer',
  allowedServices: ['grooming_bath', 'grooming_haircut', 'grooming_nail'],
  canCreateCustomServices: false,
  serviceStyleRestrictions: ['at_center', 'at_home']
});
```

#### Step 2: Validation in Vendor Service Creation
```typescript
// vendor-service-management.tsx

app.post('/make-server-3dd53475/vendor/:vendorId/services', async (c) => {
  const { vendorId } = c.req.param();
  const serviceData = await c.req.json();
  
  const vendor = await kv.get(`vendor:${vendorId}`);
  const permissions = await kv.get(`service:permissions:${vendor.roleId}`);
  
  // Check if service is allowed
  if (!permissions.allowedServices.includes(serviceData.serviceCode)) {
    return c.json({
      success: false,
      error: `Service ${serviceData.serviceCode} is not permitted for ${vendor.roleId}`
    }, 403);
  }
  
  // Check if service style is allowed
  if (permissions.serviceStyleRestrictions && 
      !permissions.serviceStyleRestrictions.includes(serviceData.serviceStyle)) {
    return c.json({
      success: false,
      error: `Service style ${serviceData.serviceStyle} is not permitted for ${vendor.roleId}`
    }, 403);
  }
  
  // Proceed with service creation
});
```

#### Step 3: Custom Service Restriction
```typescript
// custom-service-endpoints.tsx

app.post('/make-server-3dd53475/vendor/:vendorId/custom-service', async (c) => {
  const { vendorId } = c.req.param();
  const vendor = await kv.get(`vendor:${vendorId}`);
  
  // Only 'at_center' vendors can create custom services
  if (vendor.primaryServiceStyle !== 'at_center') {
    return c.json({
      success: false,
      error: 'Only centre-based vendors can create custom services'
    }, 403);
  }
  
  // Proceed with custom service creation
});
```

---

## 🧪 TESTING CHECKLIST

### START OTP Testing
- [ ] Trainer service creates START + END OTP
- [ ] Walker service creates START + END OTP
- [ ] Behaviourist service creates START + END OTP
- [ ] Veterinary service creates only END OTP
- [ ] Grooming service creates only END OTP
- [ ] Package occurrences for walker have both OTPs per session
- [ ] START OTP endpoint accepts correct OTP
- [ ] START OTP endpoint rejects incorrect OTP
- [ ] END OTP cannot be used before START OTP
- [ ] Duration is calculated correctly
- [ ] Warning triggered if service too short

### Staff Auto-Assignment Testing
- [ ] Home service auto-assigns staff
- [ ] At centre service allows manual selection
- [ ] Staff availability checked correctly
- [ ] Distance calculation works (< 5km)
- [ ] No available staff returns error
- [ ] Breaks excluded from assignment
- [ ] Holidays excluded from assignment
- [ ] Already booked staff excluded

### 5km Radius Testing
- [ ] Location permission requested
- [ ] Home services filtered by 5km
- [ ] At centre services NOT filtered by distance
- [ ] Vendors sorted by distance (closest first)
- [ ] No location = show all vendors (fallback)

### Package Sessions Per Day Testing
- [ ] 2x/day walker package creates 14 sessions (7 days)
- [ ] Each session has unique OTPs
- [ ] Morning and evening time slots assigned
- [ ] Alternate days packages work correctly
- [ ] Weekly packages work correctly

### Service Permission Testing
- [ ] Groomer cannot add veterinary services
- [ ] Vet cannot add grooming services
- [ ] Home service vendor cannot create custom services
- [ ] At centre vendor CAN create custom services
- [ ] Service style restrictions enforced

---

**End of Technical Specification**
