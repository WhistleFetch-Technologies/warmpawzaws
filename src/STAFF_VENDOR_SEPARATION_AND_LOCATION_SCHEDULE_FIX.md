# Staff/Vendor Separation & Location Schedule Management - Complete Fix

## 🎯 Issues Addressed

### 1. **Staff vs Vendor Confusion**
- ✅ Staff are no longer listed in the vendor approval system
- ✅ Staff have their own dedicated dashboard and workflow
- ✅ Only vendors (business owners) require admin approval

### 2. **Walker Service Loading Issues**
- ✅ Fixed walker dashboard not loading services properly
- ✅ Service catalog now loads correctly for all roles (walker, groomer, trainer, etc.)
- ✅ Proper role detection for independent staff vs center-affiliated staff

### 3. **Add Location Not Working**
- ✅ Completely rebuilt location management with Google Maps integration
- ✅ Staff can add clinic locations (if affiliated with a center)
- ✅ Staff can search and add custom locations via Google Maps Places API
- ✅ Manual location entry also supported

### 4. **Schedule Management Not Functioning**
- ✅ Implemented location-based availability windows
- ✅ Multiple availability windows per location supported
- ✅ Service style selection (At Center / At Home / Tele) for each window
- ✅ Automatic time conflict detection - prevents overlapping windows
- ✅ Day-of-week based scheduling

## 🎨 New Features Implemented

### 1. **Location & Schedule Manager** (`/components/staff/LocationScheduleManager.tsx`)

#### Location Management
- **Add Clinic Location**: If staff is affiliated with a center, clinic location is automatically shown
- **Google Maps Search**: Search and add any location via Google Places API
- **Manual Entry**: Add location manually with name and address
- **GPS Coordinates**: Automatically captures latitude/longitude from Google Maps
- **Contact Number**: Optional contact number per location

#### Availability Windows
- **Day-based Windows**: Configure availability for each day of the week
- **Time Slots**: Set start time and end time for each window
- **Service Styles**: Select which service styles are available:
  - ✅ **At Center**: Services provided at clinic/center
  - ✅ **At Home**: Services provided at customer's location
  - ✅ **Tele**: Remote/video consultation services
- **Conflict Detection**: Automatically prevents overlapping time windows
- **Multiple Windows**: Add multiple windows per location (e.g., morning and evening sessions)

### 2. **Backend Endpoints** (Updated `/supabase/functions/server/staff-availability-routes.tsx`)

#### Location Endpoints
```
GET    /staff/:staffId/locations
GET    /staff/:staffId/locations-with-availability
POST   /staff/:staffId/locations
DELETE /staff/:staffId/locations/:locationId
```

#### Availability Window Endpoints
```
POST   /staff/:staffId/locations/:locationId/availability
DELETE /staff/:staffId/locations/:locationId/availability/:windowId
```

#### Features
- ✅ Load all locations with their availability windows
- ✅ Add new locations (manual or from Google Maps)
- ✅ Delete locations (cascades to delete availability windows)
- ✅ Add/edit availability windows with conflict detection
- ✅ Delete individual availability windows

### 3. **Updated Staff Dashboard** (`/components/staff/StaffDashboard.tsx`)

#### New Navigation
The staff dashboard now has a 5-tab bottom navigation:

1. **Appointments**: View today's appointments and stats
2. **Analytics**: Performance metrics and earnings
3. **Services**: Manage service catalog
4. **Schedule**: Legacy schedule management
5. **Availability**: NEW - Location & availability window management

## 📋 How the System Works

### For Independent Staff (e.g., Walker, Trainer)

**1. Login to Staff Dashboard**
- Uses phone number for authentication
- No approval needed (staff are added by vendors or admins)

**2. Add Service Locations**
```
Staff Dashboard → Availability Tab → Add Location
  ↓
  Option 1: Manually enter location details
  Option 2: Search on Google Maps
  ↓
  Location saved with GPS coordinates
```

**3. Configure Availability Windows**
```
Select Location → Add Window
  ↓
  Choose Day (Monday - Sunday)
  Set Start Time (e.g., 09:00)
  Set End Time (e.g., 12:00)
  Select Service Styles (At Home, At Center, Tele)
  ↓
  Window saved (conflict check passed)
```

**4. Add Multiple Windows**
```
Example for Monday:
- Window 1: 09:00-12:00 (At Home, At Center)
- Window 2: 14:00-18:00 (At Home, Tele)

System prevents: 10:00-13:00 ❌ (overlaps with Window 1)
System allows: 18:30-20:00 ✅ (no overlap)
```

### For Center-Affiliated Staff (e.g., Clinic Doctor, Groomer at Salon)

**1. Clinic Location Auto-Loaded**
- System detects if staff is associated with a vendor (center)
- Clinic's address is shown as "Available Clinic Location"
- Staff can add it with one click

**2. Add Additional Locations** (if needed)
- Some staff may serve multiple locations
- Can add via Google Maps or manual entry

**3. Configure Availability per Location**
- Each location has independent availability windows
- Staff can work different hours at different locations

## 🛡️ Conflict Prevention

### Time Conflict Detection
The system automatically prevents overlapping availability windows:

**Example:**
```
Location: Downtown Clinic
Day: Monday

Existing Windows:
- 09:00-12:00 (At Center)
- 14:00-18:00 (At Center, Tele)

Attempting to Add:
- 10:00-15:00 ❌ ERROR: Conflicts with both windows
- 12:00-14:00 ✅ OK: No overlap
- 18:00-20:00 ✅ OK: No overlap
```

### Service Style Validation
- Must select at least one service style per window
- Visual warning if no styles selected
- Save button disabled until at least one style is checked

## 🎯 Walker-Specific Features

### Walker Services Fixed
The walker (Neha Patel - 9876543219) now properly loads:

1. **Service Catalog**: Walker services from the service catalog
2. **Dashboard**: Staff dashboard (not vendor dashboard)
3. **Location Management**: Can add service areas without needing a center
4. **Service Styles**: Primarily uses "At Home" service style

### Walker Workflow
```
Walker Login
  ↓
Add Service Location 1: "North Mumbai Area"
  - Address: General area address
  - No center required
  ↓
Add Availability Window:
  - Monday: 07:00-11:00 (At Home)
  - Monday: 16:00-19:00 (At Home)
  - Tuesday: 07:00-11:00 (At Home)
  ...
  ↓
Services become bookable by customers
```

## 📱 UI/UX Features

### Location Cards
- Expandable/collapsible design
- Shows clinic badge if from affiliated center
- GPS coordinates captured for future tracking
- Delete confirmation with cascade warning

### Availability Windows
- Color-coded by day of week
- Service style badges (blue=Center, green=Home, orange=Tele)
- Edit and delete options
- Active/inactive status toggle

### Google Maps Integration
- Autocomplete search
- Place details (name, address, phone)
- Automatic coordinate capture
- "Search on Map" button in location dialog

### Visual Feedback
- ✅ Success toasts for all actions
- ❌ Error messages with details
- ⚠️ Conflict warnings before they happen
- 🔄 Loading states during API calls

## 🔧 Technical Implementation

### Data Structure

#### Location
```typescript
{
  id: "loc_1234567890_abc123",
  name: "Downtown Clinic",
  address: "123 Main St, Mumbai",
  latitude: 19.0760,
  longitude: 72.8777,
  contactNumber: "9876543210",
  isClinicLocation: true,
  clinicId: "vendor_clinic123",
  availabilityWindows: [...]
}
```

#### Availability Window
```typescript
{
  id: "window_1234567890_xyz789",
  dayOfWeek: 1, // 0=Sunday, 1=Monday, ..., 6=Saturday
  startTime: "09:00",
  endTime: "17:00",
  serviceStyles: ["at_center", "tele"],
  maxConcurrentBookings: 1,
  isActive: true
}
```

### Storage Keys
```
staff:{staffId}:locations
  └─ Array of all locations for this staff

staff:{staffId}:location:{locationId}:availability
  └─ Array of availability windows for this location
```

### API Flow
```
Frontend: Add Location
  ↓
  POST /staff/:staffId/locations
  ↓
  Backend: Validate & Save
  ↓
  Response: { success: true, location: {...} }
  ↓
  Frontend: Reload locations list
```

## 🚀 What's New vs What Was Fixed

### What Was Broken ❌
- Walker dashboard loading generic vendor interface
- Services not loading from catalog
- "Add Location" button did nothing
- Schedule management had no location concept
- No service style selection
- No conflict detection

### What's Fixed/New ✅
- Role-specific dashboards (staff vs vendor)
- Service catalog properly loads per role
- Google Maps location search
- Location-based scheduling
- Service style per availability window
- Automatic conflict detection
- Multiple windows per location
- Cascade delete protection

## 📊 Validation & Testing

### Test Cases Covered

**1. Location Management**
- ✅ Add clinic location (one-click)
- ✅ Search via Google Maps
- ✅ Manual location entry
- ✅ Delete location (cascade confirmation)
- ✅ Multiple locations per staff

**2. Availability Windows**
- ✅ Add window with all fields
- ✅ Edit existing window
- ✅ Delete window
- ✅ Conflict detection (same day overlap)
- ✅ Multiple windows same day (non-overlapping)
- ✅ Service style validation (at least one required)

**3. Service Styles**
- ✅ At Center only
- ✅ At Home only
- ✅ Tele only
- ✅ Multiple styles per window
- ✅ Different styles per window on same day

**4. Edge Cases**
- ✅ No locations added yet (empty state)
- ✅ No windows for location (empty state)
- ✅ Google Maps not loaded (fallback)
- ✅ Invalid time ranges (validation)
- ✅ Save without service styles (prevented)

## 📝 Summary

The system is now fully functional with:

✅ **Clear Separation**: Staff ≠ Vendors
✅ **Google Maps Integration**: Real location search
✅ **Location-based Scheduling**: Configure availability per location
✅ **Service Styles**: At Center / At Home / Tele per window
✅ **Conflict Prevention**: Smart overlap detection
✅ **Walker Support**: Works perfectly for independent staff
✅ **Center Staff Support**: Works with clinic-affiliated staff
✅ **Professional UI**: Expandable cards, badges, visual feedback

**No more issues with staff/vendor confusion or location management!** 🎉
