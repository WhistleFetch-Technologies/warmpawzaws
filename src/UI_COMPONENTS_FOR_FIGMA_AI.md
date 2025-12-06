# Warmpawz UI Components - Implementation Guide for Figma AI

**Version:** 1.0  
**Date:** December 2, 2025  
**Base API URL:** `https://vpvpbdwtyugbknrntkho.supabase.co/functions/v1/make-server-3dd53475`

---

## Priority Components

### 🎯 Phase 1: High Priority (Build First)
1. **Region Management Dashboard** - Admin tool for managing regions and catalogs
2. **Service Catalog Manager** - Admin tool for service creation and management
3. **Booking Lifecycle with OTP** - Enhanced booking flow with OTP validation
4. **GPS Tracking Dashboard** - Real-time tracking for home services

### 📋 Phase 2: Medium Priority
5. **Vendor Discovery by Problem** - Enhanced problem-based search
6. **Staff Management Portal** - Vendor tool for managing staff
7. **Analytics Dashboard** - Vendor/Admin analytics
8. **Payment & Wallet UI** - Payment processing interface

### 🚀 Phase 3: Future Enhancements
9. **Multi-language Support**
10. **Advanced Filtering**
11. **Notification Center**
12. **Chat System Enhancement**

---

## 1. Region Management Dashboard (Priority #1)

### Component: `RegionManagementDashboard.tsx`
**Location:** `/components/admin/RegionManagementDashboard.tsx`

### Purpose
Admin interface for managing geographic regions, regional catalogs, and location-specific services across India.

### API Endpoints Used
```
GET    /make-server-3dd53475/regions                    # Get all regions
POST   /make-server-3dd53475/regions                    # Create region
PUT    /make-server-3dd53475/regions/:regionId          # Update region
DELETE /make-server-3dd53475/regions/:regionId          # Delete region
GET    /make-server-3dd53475/regions/:regionId/catalog  # Get regional catalog
POST   /make-server-3dd53475/regions/:regionId/catalog  # Update regional catalog
```

### Features
1. **Region List View**
   - Display all regions in a table/grid
   - Show: Region name, state, cities count, active services
   - Search and filter by state
   - Status badges (active/inactive)

2. **Region Creation Modal**
   - Form fields:
     - Region name (e.g., "Bangalore Metro")
     - State selection dropdown
     - Cities multi-select
     - Timezone selection
     - Service area map picker
   - Validation for required fields
   - Submit creates region via API

3. **Regional Catalog Editor**
   - View services available in region
   - Enable/disable services for specific region
   - Set region-specific pricing
   - Manage service availability
   - Bulk actions for service activation

4. **Region Analytics**
   - Vendors count per region
   - Bookings count per region
   - Revenue by region
   - Popular services by region

### Data Structure
```typescript
interface Region {
  id: string;
  name: string;
  state: string;
  cities: string[];
  timezone: string;
  isActive: boolean;
  serviceCategories: string[];
  vendorCount: number;
  createdAt: string;
}

interface RegionalCatalog {
  regionId: string;
  services: Array<{
    serviceId: string;
    serviceName: string;
    isEnabled: boolean;
    regionalPrice?: number;
    availability: 'available' | 'coming_soon' | 'unavailable';
  }>;
}
```

### UI Components Needed
- `<RegionTable>` - List all regions
- `<CreateRegionModal>` - Create new region
- `<EditRegionModal>` - Edit existing region
- `<RegionalCatalogEditor>` - Manage regional services
- `<RegionAnalyticsCard>` - Show region metrics
- `<StateSelector>` - Dropdown for Indian states
- `<CityMultiSelect>` - Multi-select for cities
- `<ServiceAvailabilityToggle>` - Enable/disable services

### Sample Implementation
```typescript
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

const BASE_URL = 'https://vpvpbdwtyugbknrntkho.supabase.co/functions/v1/make-server-3dd53475';

export function RegionManagementDashboard() {
  const [regions, setRegions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  
  const supabase = createClient(`https://${projectId}.supabase.co`, publicAnonKey);

  useEffect(() => {
    loadRegions();
  }, []);

  async function loadRegions() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(`${BASE_URL}/regions`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (!response.ok) throw new Error('Failed to load regions');
      
      const data = await response.json();
      setRegions(data.regions || []);
    } catch (error) {
      console.error('Error loading regions:', error);
    } finally {
      setLoading(false);
    }
  }

  async function createRegion(regionData: any) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(`${BASE_URL}/regions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(regionData)
      });

      if (!response.ok) throw new Error('Failed to create region');
      
      await loadRegions();
      setShowCreateModal(false);
    } catch (error) {
      console.error('Error creating region:', error);
    }
  }

  // Rest of component implementation...
}
```

---

## 2. Service Catalog Manager (Priority #2)

### Component: `ServiceCatalogManager.tsx`
**Location:** `/components/admin/ServiceCatalogManager.tsx`

### Purpose
Admin interface for creating, editing, and managing the master service catalog that vendors can subscribe to.

### API Endpoints Used
```
GET    /make-server-3dd53475/catalog/services           # Get all services
POST   /make-server-3dd53475/catalog/services           # Create service
PUT    /make-server-3dd53475/catalog/services/:id       # Update service
DELETE /make-server-3dd53475/catalog/services/:id       # Delete service
GET    /make-server-3dd53475/catalog/categories         # Get categories
POST   /make-server-3dd53475/catalog/categories         # Create category
GET    /make-server-3dd53475/catalog/services/:id/vendors # Get vendors offering service
```

### Features
1. **Service List with Filters**
   - Display all services in data table
   - Filter by: Category, Service style, Status, Region
   - Search by service name
   - Bulk actions: Activate, Deactivate, Delete
   - Sort by: Name, Popularity, Price, Created date

2. **Create Service Form**
   - Service name
   - Category selection
   - Sub-category selection
   - Service style: `at_home`, `at_center`, `tele_consultation`
   - Description (rich text)
   - Base price
   - Duration (minutes)
   - Pet types (Dog, Cat, Birds, etc.)
   - Image upload
   - Tags/Keywords
   - FAQ section
   - Availability settings

3. **Service Categories Manager**
   - Create/Edit categories
   - Manage subcategories
   - Set category icons
   - Reorder categories
   - Category-level settings

4. **Service Details View**
   - Full service information
   - Vendors offering this service
   - Booking statistics
   - Revenue data
   - Customer reviews
   - Edit/Delete actions

### Data Structure
```typescript
interface Service {
  id: string;
  name: string;
  category: string;
  subCategory?: string;
  serviceStyle: 'at_home' | 'at_center' | 'tele_consultation';
  description: string;
  basePrice: number;
  duration: number;
  petTypes: string[];
  imageUrl: string;
  tags: string[];
  isActive: boolean;
  regions: string[];
  vendorCount: number;
  bookingsCount: number;
  createdAt: string;
}

interface ServiceCategory {
  id: string;
  name: string;
  icon: string;
  description: string;
  subCategories: string[];
  serviceCount: number;
  displayOrder: number;
}
```

### UI Components Needed
- `<ServiceTable>` - List all services
- `<CreateServiceModal>` - Create new service
- `<EditServiceModal>` - Edit existing service
- `<ServiceDetailsPanel>` - Show service details
- `<CategoryManager>` - Manage categories
- `<ServiceStyleSelector>` - Select service delivery style
- `<PetTypeSelector>` - Multi-select for pet types
- `<ImageUploader>` - Upload service images
- `<PriceInput>` - Price input with currency
- `<DurationPicker>` - Duration in hours/minutes
- `<RegionSelector>` - Select applicable regions

---

## 3. Booking Lifecycle with OTP Validation (Priority #3)

### Component: `BookingLifecycleManager.tsx`
**Location:** `/components/admin/BookingLifecycleManager.tsx`

### Purpose
Enhanced booking management with OTP validation for booking confirmation and completion.

### API Endpoints Used
```
GET    /make-server-3dd53475/bookings/:bookingId        # Get booking details
POST   /make-server-3dd53475/bookings/:bookingId/otp/generate  # Generate OTP
POST   /make-server-3dd53475/bookings/:bookingId/otp/verify    # Verify OTP
POST   /make-server-3dd53475/bookings/:bookingId/status        # Update status
GET    /make-server-3dd53475/bookings/vendor/:vendorId         # Get vendor bookings
```

### Features
1. **Booking Status Tracking**
   - Visual status timeline
   - Status stages:
     - `pending` - Awaiting vendor confirmation
     - `confirmed` - Vendor confirmed (OTP sent)
     - `in_progress` - Service started
     - `completed` - Service completed (OTP verified)
     - `cancelled` - Booking cancelled
   - Real-time status updates

2. **OTP Generation & Verification**
   - Generate 6-digit OTP when booking confirmed
   - Send OTP to customer via SMS/Email
   - Vendor enters OTP to start service
   - Customer enters OTP to complete service
   - OTP expiry (10 minutes)
   - Resend OTP option

3. **Booking Actions Panel**
   - Accept booking (vendor)
   - Reject booking (vendor)
   - Start service (verify start OTP)
   - Complete service (verify completion OTP)
   - Cancel booking (customer/vendor)
   - Add notes
   - Upload photos

4. **Booking Timeline**
   - Show all status changes
   - Timestamp for each action
   - User who performed action
   - Notes/Comments history

### Data Structure
```typescript
interface Booking {
  id: string;
  customerId: string;
  vendorId: string;
  petId: string;
  serviceId: string;
  status: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
  bookingDate: string;
  bookingTime: string;
  price: number;
  otpStart?: string;
  otpComplete?: string;
  otpGeneratedAt?: string;
  statusHistory: Array<{
    status: string;
    timestamp: string;
    updatedBy: string;
    note?: string;
  }>;
}

interface OTPVerification {
  bookingId: string;
  otp: string;
  type: 'start' | 'complete';
  expiresAt: string;
}
```

### UI Components Needed
- `<BookingTimeline>` - Visual status timeline
- `<OTPGenerator>` - Generate OTP button
- `<OTPInput>` - 6-digit OTP input field
- `<BookingActionButtons>` - Accept/Reject/Cancel
- `<StatusBadge>` - Booking status badge
- `<BookingNotes>` - Add notes section
- `<PhotoUpload>` - Upload booking photos

### Sample OTP Flow Implementation
```typescript
async function generateStartOTP(bookingId: string) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const response = await fetch(`${BASE_URL}/bookings/${bookingId}/otp/generate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ type: 'start' })
    });

    if (!response.ok) throw new Error('Failed to generate OTP');
    
    const data = await response.json();
    console.log('OTP sent to customer:', data.otpSent);
    return data;
  } catch (error) {
    console.error('Error generating OTP:', error);
  }
}

async function verifyOTP(bookingId: string, otp: string, type: 'start' | 'complete') {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const response = await fetch(`${BASE_URL}/bookings/${bookingId}/otp/verify`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ otp, type })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Invalid OTP');
    }
    
    const data = await response.json();
    return data.verified;
  } catch (error) {
    console.error('Error verifying OTP:', error);
    return false;
  }
}
```

---

## 4. GPS Tracking Dashboard (Priority #4)

### Component: `GPSTrackingDashboard.tsx`
**Location:** `/components/admin/GPSTrackingDashboard.tsx`

### Purpose
Real-time GPS tracking dashboard for monitoring active home service bookings with live vendor location updates.

### API Endpoints Used
```
GET    /make-server-3dd53475/tracking/active             # Get active tracking sessions
GET    /make-server-3dd53475/tracking/:bookingId         # Get specific booking location
POST   /make-server-3dd53475/tracking/:bookingId/update  # Update vendor location
GET    /make-server-3dd53475/tracking/:bookingId/history # Get location history
WebSocket: wss://vpvpbdwtyugbknrntkho.supabase.co/functions/v1/make-server-3dd53475/ws/tracking
```

### Features
1. **Live Map View**
   - Google Maps integration
   - Show all active bookings on map
   - Vendor current location (live updates)
   - Customer destination marker
   - Route between vendor and customer
   - ETA calculation
   - Traffic layer option

2. **Active Bookings List**
   - List of ongoing home services
   - Filter by: Service type, Status, Vendor
   - Search by booking ID or customer name
   - Quick actions: View details, Contact vendor

3. **Booking Tracking Details**
   - Vendor information
   - Customer information
   - Service details
   - Start time and ETA
   - Distance traveled
   - Current status
   - Location history trail
   - Speed and movement data

4. **Real-time Updates**
   - WebSocket connection for live updates
   - Auto-refresh every 30 seconds
   - Notification on status changes
   - Vendor location breadcrumb trail

5. **Tracking Controls**
   - Start tracking (vendor)
   - Update location (auto every 30s)
   - Pause tracking
   - End tracking (service complete)

### Data Structure
```typescript
interface TrackingSession {
  bookingId: string;
  vendorId: string;
  customerId: string;
  serviceType: string;
  status: 'en_route' | 'arrived' | 'in_progress' | 'completed';
  vendorLocation: {
    lat: number;
    lng: number;
    accuracy: number;
    timestamp: string;
  };
  customerLocation: {
    lat: number;
    lng: number;
    address: string;
  };
  route: Array<{lat: number, lng: number}>;
  distanceTraveled: number;
  eta: number; // minutes
  startedAt: string;
  updatedAt: string;
}

interface LocationUpdate {
  bookingId: string;
  lat: number;
  lng: number;
  accuracy: number;
  speed?: number;
  heading?: number;
  timestamp: string;
}
```

### UI Components Needed
- `<TrackingMap>` - Google Maps with markers
- `<ActiveBookingsList>` - List of tracked bookings
- `<TrackingDetailsPanel>` - Booking tracking info
- `<LocationHistory>` - Route history timeline
- `<ETADisplay>` - Estimated time of arrival
- `<VendorMarker>` - Custom vendor map marker
- `<CustomerMarker>` - Custom customer map marker
- `<RoutePolyline>` - Route path on map
- `<TrackingControls>` - Start/Pause/Stop controls

### Sample Implementation
```typescript
import { useEffect, useState } from 'react';
import { GoogleMap, Marker, Polyline } from '@react-google-maps/api';

export function GPSTrackingDashboard() {
  const [activeSessions, setActiveSessions] = useState<TrackingSession[]>([]);
  const [selectedBooking, setSelectedBooking] = useState<string | null>(null);
  const [ws, setWs] = useState<WebSocket | null>(null);

  useEffect(() => {
    loadActiveSessions();
    connectWebSocket();

    return () => {
      if (ws) ws.close();
    };
  }, []);

  async function loadActiveSessions() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(`${BASE_URL}/tracking/active`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (!response.ok) throw new Error('Failed to load tracking sessions');
      
      const data = await response.json();
      setActiveSessions(data.sessions || []);
    } catch (error) {
      console.error('Error loading tracking sessions:', error);
    }
  }

  function connectWebSocket() {
    const wsUrl = 'wss://vpvpbdwtyugbknrntkho.supabase.co/functions/v1/make-server-3dd53475/ws/tracking';
    const socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      console.log('WebSocket connected');
    };

    socket.onmessage = (event) => {
      const update = JSON.parse(event.data);
      
      setActiveSessions(prev => prev.map(session => 
        session.bookingId === update.bookingId
          ? { ...session, vendorLocation: update.location, updatedAt: update.timestamp }
          : session
      ));
    };

    socket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    socket.onclose = () => {
      console.log('WebSocket disconnected');
      // Attempt reconnect after 5 seconds
      setTimeout(connectWebSocket, 5000);
    };

    setWs(socket);
  }

  async function updateVendorLocation(bookingId: string, lat: number, lng: number) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(`${BASE_URL}/tracking/${bookingId}/update`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          lat,
          lng,
          accuracy: 10,
          timestamp: new Date().toISOString()
        })
      });

      if (!response.ok) throw new Error('Failed to update location');
    } catch (error) {
      console.error('Error updating location:', error);
    }
  }

  // Map component rendering...
  return (
    <div className="h-screen flex">
      {/* Sidebar with active bookings list */}
      <div className="w-80 bg-white shadow-lg overflow-y-auto">
        <ActiveBookingsList
          sessions={activeSessions}
          selectedBooking={selectedBooking}
          onSelectBooking={setSelectedBooking}
        />
      </div>

      {/* Main map view */}
      <div className="flex-1">
        <GoogleMap
          zoom={12}
          center={activeSessions[0]?.vendorLocation || { lat: 12.9716, lng: 77.5946 }}
          mapContainerClassName="w-full h-full"
        >
          {activeSessions.map(session => (
            <Marker
              key={session.bookingId}
              position={session.vendorLocation}
              icon={{
                url: '/vendor-marker.png',
                scaledSize: new google.maps.Size(40, 40)
              }}
            />
          ))}
        </GoogleMap>
      </div>
    </div>
  );
}
```

---

## Implementation Checklist

### Phase 1 (Week 1)
- [ ] Set up API client utility (`/utils/api/client.ts`)
- [ ] Create `RegionManagementDashboard` component
- [ ] Create `ServiceCatalogManager` component
- [ ] Test region CRUD operations
- [ ] Test service CRUD operations

### Phase 2 (Week 2)
- [ ] Create `BookingLifecycleManager` component
- [ ] Implement OTP generation/verification
- [ ] Create `GPSTrackingDashboard` component
- [ ] Integrate Google Maps API
- [ ] Implement WebSocket connection for live tracking

### Phase 3 (Week 3)
- [ ] Add error handling and loading states
- [ ] Implement responsive design
- [ ] Add accessibility features
- [ ] Write component tests
- [ ] Documentation and code comments

---

## API Integration Utilities

### Create: `/utils/api/client.ts`

```typescript
import { projectId, publicAnonKey } from '../supabase/info';
import { createClient } from '@supabase/supabase-js';

const BASE_URL = 'https://vpvpbdwtyugbknrntkho.supabase.co/functions/v1/make-server-3dd53475';
const supabase = createClient(`https://${projectId}.supabase.co`, publicAnonKey);

interface ApiOptions {
  method?: string;
  body?: any;
  requiresAuth?: boolean;
}

export async function apiCall(endpoint: string, options: ApiOptions = {}) {
  const { method = 'GET', body, requiresAuth = true } = options;

  let headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (requiresAuth) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('No active session');
    }
    headers['Authorization'] = `Bearer ${session.access_token}`;
  } else {
    headers['Authorization'] = `Bearer ${publicAnonKey}`;
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'API request failed');
  }

  return response.json();
}

// Region APIs
export const regionApi = {
  getAll: () => apiCall('/regions'),
  getById: (id: string) => apiCall(`/regions/${id}`),
  create: (data: any) => apiCall('/regions', { method: 'POST', body: data }),
  update: (id: string, data: any) => apiCall(`/regions/${id}`, { method: 'PUT', body: data }),
  delete: (id: string) => apiCall(`/regions/${id}`, { method: 'DELETE' }),
  getCatalog: (id: string) => apiCall(`/regions/${id}/catalog`),
  updateCatalog: (id: string, data: any) => apiCall(`/regions/${id}/catalog`, { method: 'POST', body: data }),
};

// Service Catalog APIs
export const catalogApi = {
  getServices: () => apiCall('/catalog/services'),
  getServiceById: (id: string) => apiCall(`/catalog/services/${id}`),
  createService: (data: any) => apiCall('/catalog/services', { method: 'POST', body: data }),
  updateService: (id: string, data: any) => apiCall(`/catalog/services/${id}`, { method: 'PUT', body: data }),
  deleteService: (id: string) => apiCall(`/catalog/services/${id}`, { method: 'DELETE' }),
  getCategories: () => apiCall('/catalog/categories'),
  createCategory: (data: any) => apiCall('/catalog/categories', { method: 'POST', body: data }),
};

// Booking APIs
export const bookingApi = {
  getById: (id: string) => apiCall(`/bookings/${id}`),
  generateOTP: (id: string, type: 'start' | 'complete') => 
    apiCall(`/bookings/${id}/otp/generate`, { method: 'POST', body: { type } }),
  verifyOTP: (id: string, otp: string, type: 'start' | 'complete') => 
    apiCall(`/bookings/${id}/otp/verify`, { method: 'POST', body: { otp, type } }),
  updateStatus: (id: string, status: string, note?: string) => 
    apiCall(`/bookings/${id}/status`, { method: 'POST', body: { status, note } }),
};

// Tracking APIs
export const trackingApi = {
  getActive: () => apiCall('/tracking/active'),
  getByBooking: (id: string) => apiCall(`/tracking/${id}`),
  updateLocation: (id: string, location: { lat: number; lng: number; accuracy: number }) =>
    apiCall(`/tracking/${id}/update`, { method: 'POST', body: location }),
  getHistory: (id: string) => apiCall(`/tracking/${id}/history`),
};
```

---

## Next Steps

1. **Review existing components** in `/components/admin/` to avoid duplication
2. **Start with RegionManagementDashboard** as it's foundational
3. **Enhance ServiceCatalogManager** with the documented features
4. **Build OTP system** for booking lifecycle
5. **Implement GPS tracking** with Google Maps integration

All backend APIs are ready at: `https://vpvpbdwtyugbknrntkho.supabase.co/functions/v1/make-server-3dd53475`

---

**END OF DOCUMENTATION**
