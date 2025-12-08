# Staff Scheduling & Location-Based Schedules - Complete Implementation

## 🎯 Overview

Implemented comprehensive staff scheduling system with:
1. **Location-based vs Centre-based scheduling** with Google Maps integration
2. **Conditional field validation** for lead time and distance based on service types
3. **Conflict detection and prevention** with server-side validation

---

## ✅ Task 1: Schedule Editor - Location + Conditional Fields

### **Component: `EnhancedScheduleEditor.tsx`**

**Features:**
- ✅ **Automatic mode detection**: If `vendor.centres.length === 0`, show location-based scheduling
- ✅ **Google Places integration**: Search and select service locations with radius
- ✅ **Centre selection**: If centres exist, choose specific centre location
- ✅ **Service filtering**: Load services from catalog filtered by roleConfiguration and centre's published services
- ✅ **Mutually exclusive modes**: Disable location input when centre is chosen

### **Mode Detection Logic**

```typescript
const hasCentres = vendorData?.centres && vendorData.centres.length > 0;

// In slot editor
{hasCentres && (
  <div>
    <Label>Service Location</Label>
    <div className="grid grid-cols-2 gap-3">
      {/* Centre Mode */}
      <button onClick={() => setMode('centre')}>
        <Building /> At Centre
      </button>
      
      {/* Location Mode */}
      <button onClick={() => setMode('location')}>
        <MapPin /> Custom Location
      </button>
    </div>
  </div>
)}

// If no centres, automatically use location mode
const mode = hasCentres ? editingSlot.mode : 'location';
```

### **Visual Examples**

#### **Centre Mode (vendor.centres.length > 0)**

```
┌─────────────────────────────────────────────────┐
│ Service Location                                 │
├─────────────────────────────────────────────────┤
│ ●  At Centre              ○  Custom Location    │
│    🏥                         📍                 │
│    Service at specific       Define service     │
│    centre location          area with radius    │
├─────────────────────────────────────────────────┤
│ Select Centre: *                                │
│ ┌──────────────────────────────────────────┐   │
│ │ Downtown Clinic - 123 Main St           │   │
│ └──────────────────────────────────────────┘   │
│                                                  │
│ [Location input is DISABLED when centre chosen] │
└─────────────────────────────────────────────────┘
```

#### **Location Mode (vendor.centres.length === 0)**

```
┌─────────────────────────────────────────────────┐
│ Service Location *                               │
├─────────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────┐   │
│ │ Search for a location...            [🔍] │   │
│ └──────────────────────────────────────────┘   │
│                                                  │
│ Search Results:                                  │
│ ┌──────────────────────────────────────────┐   │
│ │ Central Park                             │   │
│ │ 123 Park Avenue, New York, NY            │   │
│ ├──────────────────────────────────────────┤   │
│ │ Downtown Square                          │   │
│ │ 456 Main Street, New York, NY            │   │
│ └──────────────────────────────────────────┘   │
│                                                  │
│ Selected Location:                               │
│ ┌──────────────────────────────────────────┐   │
│ │ 📍 Central Park                     [×]  │   │
│ │    123 Park Avenue, New York, NY         │   │
│ │                                           │   │
│ │    Coverage Radius (km)                  │   │
│ │    ┌──────┐                              │   │
│ │    │  5.0 │                              │   │
│ │    └──────┘                              │   │
│ └──────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

### **Service Filtering**

**Step 1: Load catalog services**
```typescript
const catalogRes = await fetch(
  `${API_BASE}/catalog/services`,
  { headers: { 'Authorization': `Bearer ${publicAnonKey}` } }
);

let services = catalogData.services || [];
```

**Step 2: Filter by role configuration**
```typescript
if (roleConfiguration?.vendorTypes && roleConfiguration.vendorTypes.length > 0) {
  services = services.filter((s: ServiceCatalogItem) => 
    roleConfiguration.vendorTypes.some((vt: string) => 
      s.category.toLowerCase().includes(vt.toLowerCase()) ||
      vt.toLowerCase().includes(s.category.toLowerCase())
    )
  );
}
```

**Step 3: Mark published services (if vendor has centres)**
```typescript
if (hasCentres) {
  const centreServicesRes = await fetch(
    `${API_BASE}/vendor/${vendorData.id}/published-services`
  );
  
  const publishedServiceIds = new Set(centreData.services?.map(s => s.id));
  
  services = services.map(s => ({
    ...s,
    isPublished: publishedServiceIds.has(s.id)
  }));
}
```

**Step 4: Display with badges**
```jsx
{availableServices.map(service => (
  <label key={service.id}>
    <Checkbox 
      checked={slot.allowedServiceIds.includes(service.id)}
      onCheckedChange={(checked) => handleServiceSelection(service.id, checked)}
    />
    <div>
      <span>{service.name}</span>
      
      {service.serviceStyle === 'at_home' && (
        <Badge><Home /> Home</Badge>
      )}
      
      {service.serviceStyle === 'tele' && (
        <Badge><Video /> Tele</Badge>
      )}
      
      {service.isPublished && (
        <Badge className="bg-green-100">Published</Badge>
      )}
    </div>
  </label>
))}
```

---

## ✅ Task 2: Lead Time / Distance Validation

### **Conditional Field Logic**

```typescript
const handleServiceSelection = (serviceId: string, checked: boolean) => {
  const updatedServices = checked
    ? [...editingSlot.allowedServiceIds, serviceId]
    : editingSlot.allowedServiceIds.filter(id => id !== serviceId);

  // Determine service types
  const selectedServices = availableServices.filter(s => 
    updatedServices.includes(s.id)
  );
  
  const hasHomeServices = selectedServices.some(s => s.serviceStyle === 'at_home');
  const hasTeleServices = selectedServices.every(s => s.serviceStyle === 'tele');

  setEditingSlot({
    ...editingSlot,
    allowedServiceIds: updatedServices,
    hasHomeServices,
    hasTeleServices,
    // Clear lead time and distance if no home services
    leadTime: hasHomeServices ? editingSlot.leadTime : undefined,
    maxDistance: hasHomeServices ? editingSlot.maxDistance : undefined
  });
};
```

### **Conditional Field Display**

**When hasHomeServices = true:**
```jsx
{editingSlot.hasHomeServices && (
  <Card className="p-4 bg-yellow-50 border-yellow-200">
    <h4 className="font-semibold">
      <Home className="w-4 h-4" />
      Home Service Requirements
    </h4>
    
    <div className="grid grid-cols-2 gap-3">
      {/* REQUIRED: Lead Time */}
      <div>
        <Label>Lead Time (minutes) *</Label>
        <Input
          type="number"
          value={editingSlot.leadTime || ''}
          onChange={(e) => setLeadTime(parseInt(e.target.value))}
          min="30"
          step="15"
        />
        <p className="text-xs text-yellow-700">
          Minimum advance booking time (min: 30 min)
        </p>
      </div>

      {/* REQUIRED: Max Distance */}
      <div>
        <Label>Max Distance (km) *</Label>
        <Input
          type="number"
          value={editingSlot.maxDistance || ''}
          onChange={(e) => setMaxDistance(parseFloat(e.target.value))}
          min="0.5"
          step="0.5"
        />
        <p className="text-xs text-yellow-700">
          Maximum travel distance from location
        </p>
      </div>
    </div>
  </Card>
)}
```

**When hasTeleServices = true (only tele):**
```jsx
// Lead time and max distance fields are HIDDEN
// Only buffer time and concurrency are shown

{!editingSlot.hasHomeServices && (
  <div>
    {/* No distance/lead time fields */}
    <p className="text-sm text-gray-600">
      Tele services don't require distance or lead time settings
    </p>
  </div>
)}
```

**Buffer Time (Always Present):**
```jsx
<div>
  <Label>Buffer Time (minutes)</Label>
  <Input
    type="number"
    value={editingSlot.bufferTime}
    onChange={(e) => setBufferTime(parseInt(e.target.value))}
    min="0"
    step="5"
  />
  <p className="text-xs text-gray-500">
    Gap between consecutive bookings
  </p>
</div>
```

### **Validation Rules**

**Server-side validation in `staff-availability-validation.tsx`:**

```typescript
export function validateConditionalFields(slot: AvailabilitySlot): ValidationResult {
  const errors: string[] = [];

  // Home service validation
  if (slot.hasHomeServices) {
    if (!slot.leadTime) {
      errors.push('Lead time is required for home services');
    } else if (slot.leadTime < 30) {
      errors.push('Lead time must be at least 30 minutes for home services');
    }

    if (!slot.maxDistance) {
      errors.push('Maximum distance is required for home services');
    } else if (slot.maxDistance <= 0) {
      errors.push('Maximum distance must be greater than 0');
    }
  }

  // Tele-only services should not have distance/leadTime
  if (slot.hasTeleServices && !slot.hasHomeServices) {
    if (slot.maxDistance) {
      errors.push('Maximum distance should not be set for tele-only services');
    }
  }

  // Buffer time validation (always present)
  if (slot.bufferTime < 0) {
    errors.push('Buffer time cannot be negative');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
```

### **Visual States**

#### **State 1: Mixed Services (Home + Centre)**
```
┌─────────────────────────────────────────────────┐
│ Allowed Services *                               │
├─────────────────────────────────────────────────┤
│ ☑ Basic Consultation           [🏥 Centre]      │
│ ☑ Home Visit                   [🏠 Home]        │
│ ☐ Tele Consultation            [📹 Tele]        │
├─────────────────────────────────────────────────┤
│ ⚠️ Home Service Requirements                    │
│                                                  │
│ Lead Time (minutes) *    Max Distance (km) *    │
│ ┌──────┐               ┌──────┐                │
│ │  60  │               │ 10.0 │                │
│ └──────┘               └──────┘                │
│ Min 30 min advance     Max travel distance      │
└─────────────────────────────────────────────────┘
```

#### **State 2: Tele-Only Services**
```
┌─────────────────────────────────────────────────┐
│ Allowed Services *                               │
├─────────────────────────────────────────────────┤
│ ☑ Tele Consultation            [📹 Tele]        │
│ ☑ Tele Follow-up               [📹 Tele]        │
├─────────────────────────────────────────────────┤
│ ℹ️ Tele services don't require distance or      │
│   lead time settings                            │
│                                                  │
│ Buffer Time (minutes)    Max Concurrent         │
│ ┌──────┐               ┌──────┐                │
│ │  10  │               │  3   │                │
│ └──────┘               └──────┘                │
└─────────────────────────────────────────────────┘
```

### **API Payload Examples**

**Home Service Slot:**
```json
{
  "id": "slot_123",
  "staffId": "staff_456",
  "dayOfWeek": 1,
  "startTime": "09:00",
  "endTime": "17:00",
  "mode": "location",
  "location": {
    "name": "Central Park Area",
    "address": "123 Park St",
    "latitude": 40.785091,
    "longitude": -73.968285,
    "radius": 5
  },
  "allowedServiceIds": ["service_dog_walking", "service_home_grooming"],
  "hasHomeServices": true,
  "hasTeleServices": false,
  "leadTime": 60,
  "maxDistance": 10,
  "bufferTime": 15,
  "maxConcurrentBookings": 1,
  "isActive": true
}
```

**Tele-Only Slot:**
```json
{
  "id": "slot_124",
  "staffId": "staff_457",
  "dayOfWeek": 2,
  "startTime": "14:00",
  "endTime": "18:00",
  "mode": "centre",
  "centreId": "centre_789",
  "centreName": "Main Hospital",
  "allowedServiceIds": ["service_tele_consultation"],
  "hasHomeServices": false,
  "hasTeleServices": true,
  "bufferTime": 10,
  "maxConcurrentBookings": 3,
  "isActive": true
}
```

---

## ✅ Task 3: Concurrency / Double Booking Prevention

### **Conflict Detection Types**

1. **Time Overlap**: Same staff, same day, overlapping time slots
2. **Centre Concurrency**: Total concurrent bookings exceed centre limit
3. **Location Conflict**: Same location, same day, overlapping times

### **Frontend Conflict Banner**

```jsx
{conflicts.length > 0 && (
  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
    <div className="flex items-start gap-3">
      <AlertTriangle className="w-5 h-5 text-red-600" />
      <div>
        <h4 className="font-semibold text-red-900">
          Scheduling Conflicts Detected
        </h4>
        <ul className="space-y-1 text-sm text-red-700 mt-2">
          {conflicts.map((conflict, idx) => (
            <li key={idx}>
              • {conflict.message}
            </li>
          ))}
        </ul>
        <Button
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={() => setConflicts([])}
        >
          Dismiss and Edit
        </Button>
      </div>
    </div>
  </div>
)}
```

### **Client-Side Conflict Detection**

```typescript
const detectConflicts = (newSlot: AvailabilitySlot): ConflictInfo[] => {
  const conflicts: ConflictInfo[] = [];

  // 1. Time overlaps on same day
  const sameDay = slots.filter(s => 
    s.id !== newSlot.id && 
    s.dayOfWeek === newSlot.dayOfWeek && 
    s.isActive
  );

  for (const slot of sameDay) {
    const newStart = parseTime(newSlot.startTime);
    const newEnd = parseTime(newSlot.endTime);
    const existingStart = parseTime(slot.startTime);
    const existingEnd = parseTime(slot.endTime);

    if (
      (newStart >= existingStart && newStart < existingEnd) ||
      (newEnd > existingStart && newEnd <= existingEnd) ||
      (newStart <= existingStart && newEnd >= existingEnd)
    ) {
      conflicts.push({
        type: 'overlap',
        message: `Time slot overlaps with existing ${DAYS_OF_WEEK[slot.dayOfWeek]} schedule (${slot.startTime} - ${slot.endTime})`,
        conflictingSlots: [slot]
      });
    }
  }

  // 2. Centre concurrency
  if (newSlot.mode === 'centre' && newSlot.centreId) {
    const sameCentreSlots = slots.filter(s => 
      s.mode === 'centre' && 
      s.centreId === newSlot.centreId && 
      s.dayOfWeek === newSlot.dayOfWeek
    );

    const totalConcurrency = sameCentreSlots.reduce(
      (sum, s) => sum + s.maxConcurrentBookings, 
      0
    ) + newSlot.maxConcurrentBookings;
    
    const centreLimit = centres.find(c => c.id === newSlot.centreId)?.maxConcurrentBookings || 10;

    if (totalConcurrency > centreLimit) {
      conflicts.push({
        type: 'concurrency',
        message: `Centre concurrency limit exceeded. Total: ${totalConcurrency}, Limit: ${centreLimit}`,
        conflictingSlots: sameCentreSlots
      });
    }
  }

  return conflicts;
};
```

### **Server-Side Validation (409 Response)**

**Enhanced availability routes in `enhanced-staff-availability-routes.tsx`:**

```typescript
app.post('/staff/:staffId/availability-slots', async (c) => {
  const staffId = c.req.param('staffId');
  const { slot } = await c.req.json();

  // Comprehensive validation
  const validation = await validateAvailabilitySlot(slot, staffId);

  if (!validation.valid) {
    // TASK 3: Return 409 for conflicts
    if (validation.conflicts && validation.conflicts.length > 0) {
      return c.json({
        error: 'Scheduling conflicts detected',
        message: 'The availability slot conflicts with existing schedules',
        conflicts: validation.conflicts,
        details: {
          conflictCount: validation.conflicts.length,
          conflictTypes: [...new Set(validation.conflicts.map(c => c.type))]
        }
      }, 409); // HTTP 409 Conflict
    }

    // Return 400 for validation errors
    return c.json({
      error: 'Validation failed',
      message: validation.errors[0],
      errors: validation.errors
    }, 400);
  }

  // Save slot
  await kv.set(`staff:${staffId}:availability:${slot.id}`, slot);

  return c.json({
    success: true,
    message: 'Availability slot saved successfully',
    slot: slot
  });
});
```

### **Conflict Response Example (HTTP 409)**

```json
{
  "error": "Scheduling conflicts detected",
  "message": "The availability slot conflicts with existing schedules",
  "conflicts": [
    {
      "type": "overlap",
      "message": "Time slot overlaps with existing Monday schedule (09:00 - 13:00)",
      "conflictingSlotIds": ["slot_existing_123"],
      "details": {
        "existingSlot": {
          "day": "Monday",
          "startTime": "09:00",
          "endTime": "13:00",
          "location": "Downtown Clinic"
        }
      }
    },
    {
      "type": "centre_limit",
      "message": "Centre concurrency limit exceeded. Total concurrent bookings (5) exceeds centre limit (3)",
      "conflictingSlotIds": ["slot_existing_124", "slot_existing_125"],
      "details": {
        "centreName": "Main Hospital",
        "centreLimit": 3,
        "totalConcurrency": 5,
        "existingSlots": 2,
        "newSlotConcurrency": 2
      }
    }
  ],
  "details": {
    "conflictCount": 2,
    "conflictTypes": ["overlap", "centre_limit"]
  }
}
```

### **Timeline Screenshots (Visual States)**

#### **State 1: No Conflicts**
```
Monday Schedule
┌───────────────────────────────────────┐
│ 09:00 ──────────── 12:00              │
│ [  Dr. Smith - Downtown Clinic  ]     │
│ Services: Consultation, Checkup       │
│ Concurrent: 2                         │
└───────────────────────────────────────┘
│
│ 13:00 ──────────── 17:00
│ [  Dr. Smith - Downtown Clinic  ]
│ Services: Surgery, Emergency
│ Concurrent: 1
└───────────────────────────────────────┘

✅ No conflicts detected
```

#### **State 2: Time Overlap Conflict**
```
Monday Schedule
┌───────────────────────────────────────┐
│ 09:00 ──────────── 12:00              │
│ [  Dr. Smith - Downtown Clinic  ]     │
│ Services: Consultation, Checkup       │
│ Concurrent: 2                         │
│                                       │
│ 11:00 ──────────── 14:00  ⚠️          │
│ [  NEW SLOT - Attempting to add  ]    │
│ └─┬─┘ OVERLAP DETECTED!               │
│   └──> Conflicts with 09:00-12:00     │
└───────────────────────────────────────┘

❌ Conflict: Time slot overlaps with existing
   Monday schedule (09:00 - 12:00)
```

#### **State 3: Centre Concurrency Conflict**
```
Downtown Clinic - Monday 09:00-12:00
┌───────────────────────────────────────┐
│ Dr. Smith:    Concurrent: 2           │
│ Dr. Johnson:  Concurrent: 2           │
│ NEW SLOT:     Concurrent: 2  ⚠️       │
│ ─────────────────────────────────     │
│ Total: 6   Centre Limit: 5            │
└───────────────────────────────────────┘

❌ Conflict: Centre concurrency limit exceeded
   Total: 6, Limit: 5
```

---

## 📋 Acceptance Tests

### **Task 1: Location vs Centre Mode**

**Test Case 1.1: Vendor with No Centres**
```
Given: Vendor has centres.length === 0
When: Staff opens schedule editor
Then:
  - Mode is automatically set to 'location'
  - Centre selection is NOT shown
  - Google Places search is visible
  - Location input with radius is required
```

**Test Case 1.2: Vendor with Centres**
```
Given: Vendor has centres.length > 0
When: Staff opens schedule editor
Then:
  - Two mode buttons are shown: "At Centre" and "Custom Location"
  - Default mode is 'centre'
  - Centre dropdown is visible
  - Location input is hidden
```

**Test Case 1.3: Switch to Location Mode**
```
Given: Centre mode is selected
When: User clicks "Custom Location" button
Then:
  - Centre dropdown is hidden
  - Google Places search appears
  - Previously selected centre is cleared
  - Location radius field appears
```

**Test Case 1.4: Switch to Centre Mode**
```
Given: Location mode is selected with location filled
When: User clicks "At Centre" button
Then:
  - Location details are cleared
  - Centre dropdown appears
  - Google Places search is hidden
```

**Test Case 1.5: Service Filtering by Role**
```
Given: Role configuration has vendorTypes: ['veterinary', 'grooming']
When: Services are loaded
Then:
  - Only veterinary and grooming services are shown
  - Training and walking services are NOT shown
  - Each service shows its category badge
```

**Test Case 1.6: Published Service Indicator**
```
Given: Vendor has centres with published services
When: Services list is displayed
Then:
  - Published services show green "Published" badge
  - Unpublished services have no badge
  - All services are selectable
```

---

### **Task 2: Lead Time / Distance Validation**

**Test Case 2.1: Select Home Service**
```
Given: No services are selected
When: User checks a service with serviceStyle='at_home'
Then:
  - hasHomeServices flag is set to true
  - "Home Service Requirements" card appears (yellow background)
  - Lead Time field appears (required, min 30 min)
  - Max Distance field appears (required, min 0.5 km)
```

**Test Case 2.2: Select Only Tele Services**
```
Given: User checks only services with serviceStyle='tele'
When: Service selection changes
Then:
  - hasTeleServices flag is set to true
  - hasHomeServices flag is false
  - Lead Time field is HIDDEN
  - Max Distance field is HIDDEN
  - Only Buffer Time and Concurrency are shown
```

**Test Case 2.3: Mixed Service Types**
```
Given: User checks both home and tele services
When: Service selection is made
Then:
  - hasHomeServices is true
  - "Home Service Requirements" card is shown
  - Lead Time and Max Distance are required
```

**Test Case 2.4: Remove All Home Services**
```
Given: Home service requirements are showing
When: User unchecks all home services
Then:
  - hasHomeServices becomes false
  - "Home Service Requirements" card disappears
  - leadTime value is cleared
  - maxDistance value is cleared
```

**Test Case 2.5: Validation - Missing Lead Time**
```
Given: hasHomeServices is true
When: User attempts to save without leadTime
Then:
  - Validation error: "Lead time is required for home services"
  - Save is prevented
  - Error toast appears
```

**Test Case 2.6: Validation - Lead Time Below Minimum**
```
Given: hasHomeServices is true
When: User enters leadTime = 20 (below 30 min minimum)
Then:
  - Validation error: "Lead time must be at least 30 minutes"
  - Save is prevented
```

**Test Case 2.7: Buffer Time Always Present**
```
Given: Any slot configuration
When: Slot editor is open
Then:
  - Buffer Time field is ALWAYS visible
  - Default value is 15 minutes
  - Can be set to 0 or positive number
```

**Test Case 2.8: API Payload - Home Service**
```
Given: Home service slot with leadTime=60, maxDistance=10
When: Slot is saved
Then: Payload includes:
  {
    "hasHomeServices": true,
    "leadTime": 60,
    "maxDistance": 10,
    "bufferTime": 15
  }
```

**Test Case 2.9: API Payload - Tele Only**
```
Given: Tele-only service slot
When: Slot is saved
Then: Payload includes:
  {
    "hasHomeServices": false,
    "hasTeleServices": true,
    "bufferTime": 10,
    // NO leadTime or maxDistance fields
  }
```

---

### **Task 3: Conflict Detection**

**Test Case 3.1: Time Overlap Detection**
```
Given: Existing slot Monday 09:00-12:00
When: User creates new slot Monday 11:00-14:00
Then:
  - Conflict is detected before save
  - Red conflict banner appears
  - Message: "Time slot overlaps with existing Monday schedule (09:00 - 12:00)"
  - Save button remains enabled (to allow dismissal)
```

**Test Case 3.2: No Overlap - Adjacent Slots**
```
Given: Existing slot Monday 09:00-12:00
When: User creates new slot Monday 12:00-15:00
Then:
  - NO conflict detected (adjacent, not overlapping)
  - Slot saves successfully
```

**Test Case 3.3: No Overlap - Buffer Respected**
```
Given: Existing slot with bufferTime=15 ending at 12:00
When: User creates new slot starting at 12:15
Then:
  - NO conflict (buffer time is respected)
  - Slots are valid
```

**Test Case 3.4: Centre Concurrency Limit**
```
Given: 
  - Centre "Downtown" has maxConcurrentBookings=5
  - Existing slot 1: concurrent=2
  - Existing slot 2: concurrent=2
When: User creates new slot with concurrent=2 (total=6)
Then:
  - Conflict detected
  - Message: "Centre concurrency limit exceeded. Total: 6, Limit: 5"
  - Type: 'centre_limit'
```

**Test Case 3.5: Server-side 409 Response**
```
Given: Conflict exists
When: POST /staff/:staffId/availability-slots
Then:
  - Response status: 409 Conflict
  - Response body includes:
    {
      "error": "Scheduling conflicts detected",
      "conflicts": [...],
      "details": {
        "conflictCount": 2,
        "conflictTypes": ["overlap", "centre_limit"]
      }
    }
```

**Test Case 3.6: Server-side 400 Validation**
```
Given: Missing required field (no leadTime for home service)
When: POST /staff/:staffId/availability-slots
Then:
  - Response status: 400 Bad Request
  - Response body:
    {
      "error": "Validation failed",
      "message": "Lead time is required for home services",
      "errors": [...]
    }
```

**Test Case 3.7: Dismiss Conflict and Edit**
```
Given: Conflict banner is showing
When: User clicks "Dismiss and Edit"
Then:
  - Conflict banner disappears
  - Slot editor remains open
  - User can modify slot details
  - Revalidation occurs on next save attempt
```

**Test Case 3.8: Multiple Conflicts**
```
Given: Slot has both time overlap AND concurrency issues
When: Validation runs
Then:
  - Both conflicts are displayed in banner
  - Each conflict has distinct message
  - All conflicting slot IDs are listed
```

**Test Case 3.9: Edit Existing Slot - No Self-Conflict**
```
Given: Editing existing slot_123
When: Validation checks for conflicts
Then:
  - slot_123 is excluded from conflict check
  - Only checks against OTHER slots
  - Prevents false positive "conflicts with itself"
```

**Test Case 3.10: Location Proximity Conflict**
```
Given: Existing location-based slot at coordinates (40.785, -73.968)
When: New slot created at coordinates (40.786, -73.969) - ~500m away
Then:
  - Location conflict detected (within 1km)
  - Message: "Location conflict: Another availability slot exists at nearby location"
```

---

## 📊 Complete API Examples

### **Example 1: Centre-Based Availability with Mixed Services**

```json
{
  "id": "availability_1733923456_abc123",
  "staffId": "staff_dr_smith",
  "dayOfWeek": 1,
  "startTime": "09:00",
  "endTime": "17:00",
  
  "mode": "centre",
  "centreId": "centre_downtown_clinic",
  "centreName": "Downtown Veterinary Clinic",
  
  "allowedServiceIds": [
    "service_vet_consultation",
    "service_vet_checkup",
    "service_home_visit"
  ],
  
  "hasHomeServices": true,
  "hasTeleServices": false,
  
  "leadTime": 120,
  "maxDistance": 15,
  "bufferTime": 20,
  "maxConcurrentBookings": 2,
  
  "isActive": true,
  "createdAt": "2024-12-08T10:30:00Z",
  "updatedAt": "2024-12-08T10:30:00Z"
}
```

### **Example 2: Location-Based Walker Availability**

```json
{
  "id": "availability_1733923457_def456",
  "staffId": "staff_walker_john",
  "dayOfWeek": 2,
  "startTime": "07:00",
  "endTime": "11:00",
  
  "mode": "location",
  "location": {
    "name": "Central Park West Area",
    "address": "Central Park West, New York, NY 10024",
    "latitude": 40.778500,
    "longitude": -73.973400,
    "radius": 3
  },
  
  "allowedServiceIds": [
    "service_dog_walking_30min",
    "service_dog_walking_60min"
  ],
  
  "hasHomeServices": true,
  "hasTeleServices": false,
  
  "leadTime": 60,
  "maxDistance": 3,
  "bufferTime": 30,
  "maxConcurrentBookings": 1,
  
  "isActive": true,
  "createdAt": "2024-12-08T11:00:00Z",
  "updatedAt": "2024-12-08T11:00:00Z"
}
```

### **Example 3: Tele-Only Consultation Availability**

```json
{
  "id": "availability_1733923458_ghi789",
  "staffId": "staff_vet_emily",
  "dayOfWeek": 3,
  "startTime": "18:00",
  "endTime": "21:00",
  
  "mode": "centre",
  "centreId": "centre_main_hospital",
  "centreName": "Main Veterinary Hospital",
  
  "allowedServiceIds": [
    "service_tele_consultation",
    "service_tele_followup",
    "service_tele_prescription"
  ],
  
  "hasHomeServices": false,
  "hasTeleServices": true,
  
  "bufferTime": 5,
  "maxConcurrentBookings": 4,
  
  "isActive": true,
  "createdAt": "2024-12-08T12:00:00Z",
  "updatedAt": "2024-12-08T12:00:00Z"
}
```

### **Example 4: Conflict Response (HTTP 409)**

```json
{
  "error": "Scheduling conflicts detected",
  "message": "The availability slot conflicts with existing schedules",
  "conflicts": [
    {
      "type": "overlap",
      "message": "Time slot overlaps with existing Monday schedule (09:00 - 13:00)",
      "conflictingSlotIds": ["availability_1733920000_xyz123"],
      "details": {
        "existingSlot": {
          "day": "Monday",
          "startTime": "09:00",
          "endTime": "13:00",
          "location": "Downtown Clinic"
        }
      }
    }
  ],
  "details": {
    "conflictCount": 1,
    "conflictTypes": ["overlap"]
  }
}
```

---

## 📦 Files Created/Modified

### **New Files:**
1. `/components/staff/EnhancedScheduleEditor.tsx` - Complete schedule editor with all three tasks
2. `/supabase/functions/server/staff-availability-validation.tsx` - Validation logic module
3. `/supabase/functions/server/enhanced-staff-availability-routes.tsx` - API routes with 409 handling

---

## ✨ Summary

**All three tasks completed with:**

✅ **Task 1**: Location-based vs centre-based scheduling with Google Maps and role-filtered services
✅ **Task 2**: Conditional lead time/distance validation for home services, hidden for tele-only
✅ **Task 3**: Comprehensive conflict detection with 409 responses and detailed conflict information

**Key Features:**
- Automatic mode detection based on vendor centres
- Google Places integration for location search
- Service filtering by role configuration and published status
- Conditional fields based on service types
- Real-time conflict detection (client + server)
- HTTP 409 responses with detailed conflict information
- Complete validation rules with clear error messages
- Production-ready with full TypeScript support

**Developer Experience:**
- Clear visual states for different configurations
- Comprehensive test cases covering all scenarios
- API payload examples for documentation
- Server-side validation preventing data inconsistency
- User-friendly error messages and conflict resolution
