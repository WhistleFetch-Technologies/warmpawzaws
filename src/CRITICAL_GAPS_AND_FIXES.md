# 🚨 CRITICAL GAPS & IMPLEMENTATION FIXES
## Warmpawz Vendor Journey - Missing Components

**Date:** November 16, 2025  
**Priority:** URGENT - Production Blockers Identified  
**Estimated Fix Time:** 10-12 days

---

## 🎯 OVERVIEW

After comprehensive UAT testing of the vendor journey, **4 CRITICAL BLOCKERS** were identified that prevent the system from functioning as designed:

1. ❌ **Re-Onboarding Flow** - Vendors cannot respond to admin feedback
2. ❌ **Notification System** - No communication of status changes
3. ❌ **Custom Service Wizard** - Cannot create custom services
4. ❌ **Customer App Integration** - Service visibility unverified

---

## 🔴 BLOCKER #1: RE-ONBOARDING FLOW

### Problem Statement:
When admin requests more info or rejects a vendor application, the vendor sees the feedback but **CANNOT edit their application**. The "Correct & Resubmit" button exists but leads nowhere.

### Current Code Analysis:

**VendorClarificationRequested.tsx (Line 88):**
```typescript
<Button onClick={onCorrectAndResubmit}>
  Correct & Resubmit Application
</Button>
```

**VendorApplicationRejected.tsx (Line 89):**
```typescript
<Button onClick={onCorrectAndResubmit}>
  Correct & Resubmit Application
</Button>
```

**VendorLandingPage.tsx (Lines 139-141):**
```typescript
} else if (vendor.status === 'more_info_required' || vendor.status === 'clarification_requested') {
  console.log('📝 More info/clarification requested - showing status screen');
  setStatus('clarification');
```

**❌ Missing Implementation:**
- No handler to re-open DynamicVendorOnboarding
- No mechanism to pre-fill form with existing data
- No endpoint to load previous application
- No resubmit endpoint

### Impact:
- **100% failure rate** for clarification/rejection scenarios
- Vendors are STUCK after rejection
- Admin feedback loop broken
- Business process BLOCKED

### Solution Design:

#### Component Changes Required:

**1. Update VendorLandingPage.tsx:**

```typescript
// Add state for re-editing
const [isReEditing, setIsReEditing] = useState(false);
const [existingApplicationData, setExistingApplicationData] = useState<any>(null);

// Add handler
const handleCorrectAndResubmit = async () => {
  try {
    // Load existing application data
    const response = await fetch(
      `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/${vendorId}/application`,
      { headers: { 'Authorization': `Bearer ${publicAnonKey}` }}
    );
    
    if (response.ok) {
      const data = await response.json();
      setExistingApplicationData(data.application);
      setIsReEditing(true);
      // This will show DynamicVendorOnboarding with pre-filled data
    }
  } catch (error) {
    console.error('Error loading application:', error);
    toast.error('Failed to load application data');
  }
};

// In render section
if (isReEditing && existingApplicationData) {
  return (
    <DynamicVendorOnboarding
      roleId={vendorData.roleId}
      roleName={vendorData.roleName}
      phone={phone}
      vendorId={vendorId}
      initialData={existingApplicationData} // ✅ NEW PROP
      isResubmit={true} // ✅ NEW PROP
      onComplete={() => {
        setIsReEditing(false);
        setExistingApplicationData(null);
        // Reload vendor status
        checkVendorStatus();
      }}
    />
  );
}

// Pass handler to status screens
if (status === 'clarification') {
  return (
    <VendorClarificationRequested
      applicationId={vendorData.applicationId}
      clarificationNotes={vendorData.infoRequestMessage || ''}
      onCorrectAndResubmit={handleCorrectAndResubmit} // ✅ NOW IMPLEMENTED
    />
  );
}

if (status === 'rejected') {
  return (
    <VendorApplicationRejected
      applicationId={vendorData.applicationId}
      rejectionReason={vendorData.rejectionReason || ''}
      allowResubmit={true}
      onResubmit={() => {
        // Start fresh
        setIsReEditing(true);
        setExistingApplicationData(null);
      }}
      onCorrectAndResubmit={handleCorrectAndResubmit} // ✅ NOW IMPLEMENTED
    />
  );
}
```

**2. Update DynamicVendorOnboarding.tsx:**

```typescript
// Add new props
interface DynamicVendorOnboardingProps {
  roleId: string;
  roleName: string;
  phone: string;
  vendorId?: string; // ✅ NEW - for resubmissions
  initialData?: any; // ✅ NEW - pre-fill data
  isResubmit?: boolean; // ✅ NEW - submission mode
  onComplete: (data: any) => void;
}

export function DynamicVendorOnboarding({
  roleId,
  roleName,
  phone,
  vendorId,
  initialData,
  isResubmit = false,
  onComplete
}: DynamicVendorOnboardingProps) {
  
  // Pre-fill form fields from initialData
  useEffect(() => {
    if (initialData) {
      console.log('📋 Pre-filling form with existing data:', initialData);
      
      // Set form values
      setFormData({
        fullName: initialData.fullName || '',
        businessName: initialData.businessName || '',
        email: initialData.email || '',
        address: initialData.address || '',
        ...initialData
      });
      
      // Pre-populate documents if they exist
      if (initialData.documents) {
        setExistingDocuments(initialData.documents);
      }
    }
  }, [initialData]);
  
  // Change submit endpoint based on mode
  const handleSubmit = async () => {
    const endpoint = isResubmit
      ? `/vendor/${vendorId}/resubmit-application`
      : `/vendor/onboard`;
    
    const response = await fetch(
      `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475${endpoint}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`
        },
        body: JSON.stringify({
          ...formData,
          phone,
          roleId,
          isResubmission: isResubmit,
          previousApplicationId: initialData?.id
        })
      }
    );
    
    // ... rest of submission logic
  };
  
  // ... rest of component
}
```

#### Backend Endpoints Required:

**3. Add GET /vendor/:vendorId/application:**

```typescript
// In vendor-onboarding.tsx
app.get("/make-server-3dd53475/vendor/:vendorId/application", async (c) => {
  try {
    const { vendorId } = c.req.param();
    
    const vendor = await kvStore.get(`vendor:${vendorId}`);
    if (!vendor) {
      return c.json({ error: 'Vendor not found' }, 404);
    }
    
    // Return full application data for editing
    return c.json({
      success: true,
      application: {
        id: vendor.applicationId,
        fullName: vendor.fullName,
        businessName: vendor.businessName,
        email: vendor.email,
        phone: vendor.phone,
        address: vendor.address,
        location: vendor.location,
        documents: vendor.documents || [],
        bankDetails: vendor.bankDetails,
        additionalInfo: vendor.additionalInfo,
        // ... all other fields
      }
    });
  } catch (error) {
    console.error('Error loading application:', error);
    return c.json({ error: String(error) }, 500);
  }
});
```

**4. Add POST /vendor/:vendorId/resubmit-application:**

```typescript
// In vendor-onboarding.tsx
app.post("/make-server-3dd53475/vendor/:vendorId/resubmit-application", async (c) => {
  try {
    const { vendorId } = c.req.param();
    const updatedData = await c.req.json();
    
    console.log('📝 Resubmitting application for vendor:', vendorId);
    
    const vendor = await kvStore.get(`vendor:${vendorId}`);
    if (!vendor) {
      return c.json({ error: 'Vendor not found' }, 404);
    }
    
    // Update vendor with new data
    const updatedVendor = {
      ...vendor,
      ...updatedData,
      status: 'resubmitted', // ✅ NEW STATUS
      resubmittedAt: new Date().toISOString(),
      resubmissionCount: (vendor.resubmissionCount || 0) + 1,
      updatedAt: new Date().toISOString()
    };
    
    await kvStore.set(`vendor:${vendorId}`, updatedVendor);
    
    // Create history entry
    await kvStore.set(
      `vendor:history:${vendorId}:${Date.now()}`,
      {
        vendorId,
        action: 'resubmitted',
        previousStatus: vendor.status,
        newStatus: 'resubmitted',
        timestamp: new Date().toISOString(),
        changes: updatedData
      }
    );
    
    console.log('✅ Application resubmitted successfully');
    
    return c.json({
      success: true,
      vendor: updatedVendor,
      message: 'Application resubmitted for review'
    });
  } catch (error) {
    console.error('Error resubmitting application:', error);
    return c.json({ error: String(error) }, 500);
  }
});
```

### Implementation Checklist:

- [ ] Add `handleCorrectAndResubmit` to VendorLandingPage
- [ ] Add `isReEditing` and `existingApplicationData` state
- [ ] Update VendorClarificationRequested props
- [ ] Update VendorApplicationRejected props
- [ ] Add `initialData` prop to DynamicVendorOnboarding
- [ ] Add `isResubmit` prop to DynamicVendorOnboarding
- [ ] Implement pre-fill logic in DynamicVendorOnboarding
- [ ] Create GET /vendor/:vendorId/application endpoint
- [ ] Create POST /vendor/:vendorId/resubmit-application endpoint
- [ ] Add resubmission history tracking
- [ ] Test rejected → edit → resubmit → approve flow
- [ ] Test clarification → edit → resubmit → approve flow

**Estimated Time:** 2-3 days

---

## 🔴 BLOCKER #2: NOTIFICATION SYSTEM

### Problem Statement:
No notification system exists to alert vendors about status changes, admin messages, or required actions. Vendors must manually check their status.

### Current State:
- No notification bell/icon
- No unread message count
- No notification list
- Admin messages hidden in status screens
- No "mark as read" functionality

### Impact:
- Vendors miss critical admin feedback
- Poor user experience
- Delayed responses to admin requests
- Increased support burden

### Solution Design:

#### Components to Create:

**1. Create VendorNotificationBanner.tsx:**

```typescript
// /components/vendor/VendorNotificationBanner.tsx
import { useState, useEffect } from 'react';
import { Bell, X, AlertCircle, CheckCircle, Info } from 'lucide-react';
import { Button } from '../ui/button';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  actionLabel?: string;
  actionUrl?: string;
  createdAt: string;
  read: boolean;
}

interface VendorNotificationBannerProps {
  vendorId: string;
  onActionClick?: (notification: Notification) => void;
}

export function VendorNotificationBanner({ 
  vendorId, 
  onActionClick 
}: VendorNotificationBannerProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  
  useEffect(() => {
    loadNotifications();
  }, [vendorId]);
  
  const loadNotifications = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/${vendorId}/notifications`,
        { headers: { 'Authorization': `Bearer ${publicAnonKey}` }}
      );
      
      if (response.ok) {
        const data = await response.json();
        setNotifications(data.notifications || []);
      }
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const markAsRead = async (notificationId: string) => {
    try {
      await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/${vendorId}/notifications/${notificationId}/read`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }
      );
      
      // Update local state
      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
      );
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };
  
  const unreadCount = notifications.filter(n => !n.read).length;
  const activeNotification = notifications.find(n => !n.read);
  
  if (!activeNotification && !showAll) return null;
  
  return (
    <div className="w-full max-w-[430px] mx-auto">
      {/* Notification Badge */}
      <div className="sticky top-0 z-50 bg-white border-b">
        <div className="flex items-center justify-between p-3">
          <button
            onClick={() => setShowAll(!showAll)}
            className="flex items-center gap-2 text-gray-700 hover:text-[#FF8C42]"
          >
            <Bell className="w-5 h-5" />
            <span className="text-sm font-medium">Notifications</span>
            {unreadCount > 0 && (
              <span className="bg-[#FF8C42] text-white text-xs rounded-full px-2 py-0.5">
                {unreadCount}
              </span>
            )}
          </button>
        </div>
      </div>
      
      {/* Active/Latest Notification */}
      {activeNotification && !showAll && (
        <div className={`p-4 border-l-4 ${
          activeNotification.type === 'error' ? 'bg-red-50 border-red-500' :
          activeNotification.type === 'warning' ? 'bg-orange-50 border-orange-500' :
          activeNotification.type === 'success' ? 'bg-green-50 border-green-500' :
          'bg-blue-50 border-blue-500'
        }`}>
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-0.5">
              {activeNotification.type === 'error' && <AlertCircle className="w-5 h-5 text-red-600" />}
              {activeNotification.type === 'warning' && <AlertCircle className="w-5 h-5 text-orange-600" />}
              {activeNotification.type === 'success' && <CheckCircle className="w-5 h-5 text-green-600" />}
              {activeNotification.type === 'info' && <Info className="w-5 h-5 text-blue-600" />}
            </div>
            
            <div className="flex-1">
              <h4 className="font-semibold text-gray-900 mb-1">
                {activeNotification.title}
              </h4>
              <p className="text-sm text-gray-700 mb-3">
                {activeNotification.message}
              </p>
              
              {activeNotification.actionLabel && (
                <Button
                  size="sm"
                  className="bg-[#FF8C42] hover:bg-[#FF7A2E]"
                  onClick={() => onActionClick?.(activeNotification)}
                >
                  {activeNotification.actionLabel}
                </Button>
              )}
            </div>
            
            <button
              onClick={() => markAsRead(activeNotification.id)}
              className="flex-shrink-0 text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
      
      {/* All Notifications List */}
      {showAll && (
        <div className="max-h-96 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <Bell className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No notifications</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map(notification => (
                <div
                  key={notification.id}
                  className={`p-4 ${notification.read ? 'bg-gray-50' : 'bg-white'}`}
                >
                  {/* Similar content as above */}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

**2. Update VendorLandingPage to include notifications:**

```typescript
// Add to imports
import { VendorNotificationBanner } from './VendorNotificationBanner';

// In render, add before main content
return (
  <div className="min-h-screen bg-white w-full max-w-[430px] mx-auto">
    {/* Notification Banner */}
    {vendorData && (
      <VendorNotificationBanner
        vendorId={vendorData.id}
        onActionClick={(notification) => {
          // Handle notification action clicks
          if (notification.actionUrl === 'resubmit') {
            handleCorrectAndResubmit();
          }
        }}
      />
    )}
    
    {/* Rest of content */}
    {/* ... */}
  </div>
);
```

#### Backend Endpoints Required:

**3. Create notification endpoints:**

```typescript
// In vendor-approval-workflow.tsx

// GET notifications
app.get("/make-server-3dd53475/vendor/:vendorId/notifications", async (c) => {
  try {
    const { vendorId } = c.req.param();
    
    // Get all notifications for vendor
    const notifications = await kvStore.getByPrefix(`notification:${vendorId}:`);
    
    // Sort by date, newest first
    const sorted = notifications.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    
    return c.json({
      success: true,
      notifications: sorted,
      unreadCount: sorted.filter(n => !n.read).length
    });
  } catch (error) {
    console.error('Error loading notifications:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// Mark notification as read
app.post("/make-server-3dd53475/vendor/:vendorId/notifications/:notificationId/read", async (c) => {
  try {
    const { vendorId, notificationId } = c.req.param();
    
    const notification = await kvStore.get(`notification:${vendorId}:${notificationId}`);
    if (!notification) {
      return c.json({ error: 'Notification not found' }, 404);
    }
    
    const updated = { ...notification, read: true, readAt: new Date().toISOString() };
    await kvStore.set(`notification:${vendorId}:${notificationId}`, updated);
    
    return c.json({ success: true, notification: updated });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// Create notification (helper function)
async function createNotification(vendorId: string, notification: {
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  actionLabel?: string;
  actionUrl?: string;
}) {
  const notificationId = `notif_${Date.now()}`;
  const notificationData = {
    id: notificationId,
    ...notification,
    vendorId,
    read: false,
    createdAt: new Date().toISOString()
  };
  
  await kvStore.set(
    `notification:${vendorId}:${notificationId}`,
    notificationData
  );
  
  return notificationData;
}

// Update approval endpoints to create notifications
// In approve endpoint:
await createNotification(vendorId, {
  type: 'success',
  title: 'Application Approved! 🎉',
  message: 'Congratulations! Your vendor application has been approved. You can now set up your services.',
  actionLabel: 'Set Up Services',
  actionUrl: 'service-setup'
});

// In reject endpoint:
await createNotification(vendorId, {
  type: 'error',
  title: 'Application Needs Revision',
  message: `Your application was reviewed and requires some changes: ${reason}`,
  actionLabel: 'Correct & Resubmit',
  actionUrl: 'resubmit'
});

// In request-info endpoint:
await createNotification(vendorId, {
  type: 'warning',
  title: 'More Information Required',
  message: `The admin has requested additional information: ${message}`,
  actionLabel: 'View Details',
  actionUrl: 'resubmit'
});
```

### Implementation Checklist:

- [ ] Create VendorNotificationBanner component
- [ ] Add notification bell icon with unread count
- [ ] Create GET /vendor/:vendorId/notifications endpoint
- [ ] Create POST /vendor/:vendorId/notifications/:id/read endpoint
- [ ] Add createNotification helper function
- [ ] Update approve endpoint to create notification
- [ ] Update reject endpoint to create notification
- [ ] Update request-info endpoint to create notification
- [ ] Integrate banner into VendorLandingPage
- [ ] Test notification flow end-to-end

**Estimated Time:** 1-2 days

---

## 🔴 BLOCKER #3: CUSTOM SERVICE WIZARD

### Problem Statement:
Vendors cannot create custom services like "Beach Walk" or "Sunset Grooming Session". Only catalog services can be enabled.

### Current State:
- No "+ Add Custom Service" button
- No custom service creation form
- No admin approval flow for custom services
- Business requirement UNMET

### Impact:
- Vendors limited to predefined catalog
- Cannot differentiate their offerings
- Reduced platform flexibility
- Competitive disadvantage

### Solution Design:

#### Components to Create:

**1. Create AddCustomServiceWizard.tsx:**

```typescript
// /components/vendor/AddCustomServiceWizard.tsx
import { useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Upload } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Select } from '../ui/select';
import { toast } from 'sonner@2.0.3';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

interface AddCustomServiceWizardProps {
  vendorId: string;
  serviceStyle: 'at_home' | 'at_center' | 'tele';
  onBack: () => void;
  onComplete: () => void;
}

export function AddCustomServiceWizard({
  vendorId,
  serviceStyle,
  onBack,
  onComplete
}: AddCustomServiceWizardProps) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  
  const [serviceData, setServiceData] = useState({
    name: '',
    description: '',
    category: '',
    icon: '🐾',
    duration: 30,
    price: 0,
    distance: serviceStyle === 'at_home' ? 5 : 0,
    requirements: '',
    cancellationPolicy: '24 hours notice required'
  });
  
  const handleSubmit = async () => {
    try {
      setLoading(true);
      
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/${vendorId}/services/custom`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`
          },
          body: JSON.stringify({
            ...serviceData,
            serviceStyle,
            status: 'pending_approval'
          })
        }
      );
      
      if (response.ok) {
        toast.success('Custom service submitted for admin approval!');
        onComplete();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to create custom service');
      }
    } catch (error) {
      console.error('Error creating custom service:', error);
      toast.error('Error creating custom service');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="min-h-screen bg-white w-full max-w-[430px] mx-auto">
      {/* Header */}
      <div className="p-4 bg-white border-b sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button onClick={step === 1 ? onBack : () => setStep(step - 1)}>
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <div className="flex-1">
            <h1 className="font-semibold text-gray-900">Add Custom Service</h1>
            <p className="text-xs text-gray-500">Step {step} of 3</p>
          </div>
        </div>
        
        {/* Progress Bar */}
        <div className="flex gap-2 mt-4">
          <div className={`flex-1 h-1 rounded ${step >= 1 ? 'bg-[#FF8C42]' : 'bg-gray-200'}`} />
          <div className={`flex-1 h-1 rounded ${step >= 2 ? 'bg-[#FF8C42]' : 'bg-gray-200'}`} />
          <div className={`flex-1 h-1 rounded ${step >= 3 ? 'bg-[#FF8C42]' : 'bg-gray-200'}`} />
        </div>
      </div>
      
      <div className="p-4">
        {/* Step 1: Basic Details */}
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="font-semibold text-gray-900">Service Details</h2>
            
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                Service Name *
              </label>
              <Input
                placeholder="e.g., Beach Walk, Sunset Grooming"
                value={serviceData.name}
                onChange={(e) => setServiceData({...serviceData, name: e.target.value})}
              />
            </div>
            
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                Description *
              </label>
              <Textarea
                placeholder="Describe what makes this service special..."
                value={serviceData.description}
                onChange={(e) => setServiceData({...serviceData, description: e.target.value})}
                rows={4}
              />
            </div>
            
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                Category *
              </label>
              <select
                className="w-full border rounded-lg p-2"
                value={serviceData.category}
                onChange={(e) => setServiceData({...serviceData, category: e.target.value})}
              >
                <option value="">Select category...</option>
                <option value="walking">Walking & Exercise</option>
                <option value="grooming">Grooming & Spa</option>
                <option value="training">Training</option>
                <option value="veterinary">Veterinary</option>
                <option value="boarding">Boarding & Sitting</option>
                <option value="other">Other</option>
              </select>
            </div>
            
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                Icon
              </label>
              <div className="flex gap-2">
                {['🐾', '🐕', '✂️', '🎓', '🏥', '🏠', '⭐'].map(emoji => (
                  <button
                    key={emoji}
                    onClick={() => setServiceData({...serviceData, icon: emoji})}
                    className={`w-12 h-12 text-2xl border-2 rounded-lg ${
                      serviceData.icon === emoji ? 'border-[#FF8C42] bg-orange-50' : 'border-gray-200'
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
            
            <Button
              onClick={() => setStep(2)}
              disabled={!serviceData.name || !serviceData.description || !serviceData.category}
              className="w-full bg-[#FF8C42] hover:bg-[#FF7A2E]"
            >
              Next: Pricing & Duration
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        )}
        
        {/* Step 2: Pricing & Duration */}
        {step === 2 && (
          <div className="space-y-4">
            <h2 className="font-semibold text-gray-900">Pricing & Duration</h2>
            
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                Duration (minutes) *
              </label>
              <Input
                type="number"
                value={serviceData.duration}
                onChange={(e) => setServiceData({...serviceData, duration: parseInt(e.target.value)})}
                min={15}
                step={15}
              />
            </div>
            
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                Price (₹) *
              </label>
              <Input
                type="number"
                value={serviceData.price}
                onChange={(e) => setServiceData({...serviceData, price: parseFloat(e.target.value)})}
                min={0}
              />
              <p className="text-xs text-gray-500 mt-1">
                Platform commission: 15% • You receive: ₹{(serviceData.price * 0.85).toFixed(2)}
              </p>
            </div>
            
            {serviceStyle === 'at_home' && (
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">
                  Maximum Distance (km) *
                </label>
                <Input
                  type="number"
                  value={serviceData.distance}
                  onChange={(e) => setServiceData({...serviceData, distance: parseInt(e.target.value)})}
                  min={1}
                  max={50}
                />
              </div>
            )}
            
            <Button
              onClick={() => setStep(3)}
              disabled={!serviceData.duration || !serviceData.price}
              className="w-full bg-[#FF8C42] hover:bg-[#FF7A2E]"
            >
              Next: Requirements
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        )}
        
        {/* Step 3: Requirements & Submit */}
        {step === 3 && (
          <div className="space-y-4">
            <h2 className="font-semibold text-gray-900">Requirements & Policies</h2>
            
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                Special Requirements
              </label>
              <Textarea
                placeholder="e.g., Pet must be vaccinated, suitable for specific breeds, etc."
                value={serviceData.requirements}
                onChange={(e) => setServiceData({...serviceData, requirements: e.target.value})}
                rows={3}
              />
            </div>
            
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                Cancellation Policy
              </label>
              <Textarea
                value={serviceData.cancellationPolicy}
                onChange={(e) => setServiceData({...serviceData, cancellationPolicy: e.target.value})}
                rows={2}
              />
            </div>
            
            {/* Summary Card */}
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
              <h3 className="font-semibold text-gray-900 mb-3">Service Summary</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Name:</span>
                  <span className="font-medium">{serviceData.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Duration:</span>
                  <span className="font-medium">{serviceData.duration} mins</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Price:</span>
                  <span className="font-medium">₹{serviceData.price}</span>
                </div>
                {serviceStyle === 'at_home' && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Max Distance:</span>
                    <span className="font-medium">{serviceData.distance} km</span>
                  </div>
                )}
              </div>
            </div>
            
            {/* Important Note */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <p className="text-sm text-blue-900">
                <strong>📝 Admin Approval Required</strong><br />
                This custom service will be reviewed by our admin team before it becomes available to customers. You'll be notified once it's approved.
              </p>
            </div>
            
            <Button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full bg-[#FF8C42] hover:bg-[#FF7A2E]"
            >
              {loading ? 'Submitting...' : 'Submit for Approval'}
              <Check className="w-4 h-4 ml-2" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
```

**2. Update VendorServiceConfigurationScreen to add "+ Custom Service" button**

**3. Create Admin Approval Component:**

```typescript
// /components/admin/CustomServiceApprovalTab.tsx
// Similar to vendor application approval
// Shows pending custom services
// Approve/reject with feedback
```

#### Backend Endpoints Required:

**4. Create custom service endpoints:**

```typescript
// In vendor-service-management.tsx

// Create custom service
app.post("/make-server-3dd53475/vendor/:vendorId/services/custom", async (c) => {
  try {
    const { vendorId } = c.req.param();
    const serviceData = await c.req.json();
    
    const serviceId = `custom_service_${Date.now()}`;
    const customService = {
      id: serviceId,
      vendorId,
      ...serviceData,
      status: 'pending_approval',
      createdAt: new Date().toISOString(),
      type: 'custom'
    };
    
    await kvStore.set(`custom_service:${serviceId}`, customService);
    
    // Create notification for admin
    // ...
    
    return c.json({ success: true, service: customService });
  } catch (error) {
    return c.json({ error: String(error) }, 500);
  }
});

// Get vendor's custom services
app.get("/make-server-3dd53475/vendor/:vendorId/services/custom", async (c) => {
  // Return all custom services for vendor
});

// Admin: Get all pending custom services
app.get("/make-server-3dd53475/admin/custom-services/pending", async (c) => {
  // Return all custom services with status='pending_approval'
});

// Admin: Approve custom service
app.post("/make-server-3dd53475/admin/custom-service/:serviceId/approve", async (c) => {
  // Approve and make available to customers
});

// Admin: Reject custom service
app.post("/make-server-3dd53475/admin/custom-service/:serviceId/reject", async (c) => {
  // Reject with reason
});
```

### Implementation Checklist:

- [ ] Create AddCustomServiceWizard component
- [ ] Add "+ Add Custom Service" button to VendorServiceConfigurationScreen
- [ ] Create CustomServiceApprovalTab for admin
- [ ] Create POST /vendor/:id/services/custom endpoint
- [ ] Create GET /vendor/:id/services/custom endpoint
- [ ] Create GET /admin/custom-services/pending endpoint
- [ ] Create POST /admin/custom-service/:id/approve endpoint
- [ ] Create POST /admin/custom-service/:id/reject endpoint
- [ ] Test custom service creation → approval → visibility flow

**Estimated Time:** 3-4 days

---

## 🔴 BLOCKER #4: CUSTOMER APP INTEGRATION

### Problem Statement:
Unknown if vendor-enabled services actually appear in customer app. No verification of filtering logic.

### Current State:
- Customer app code not reviewed
- Service visibility logic unclear
- Filtering by role/style/location NOT tested
- End-to-end booking flow unverified

### Required Verification:

1. **Service Visibility:**
   - Do enabled services show in customer search?
   - Is vendor availability considered?
   - Are inactive vendors filtered out?

2. **Filtering Logic:**
   - Location-based filtering works?
   - Service style filtering works?
   - Category filtering works?

3. **Booking Flow:**
   - Can customer book enabled service?
   - Does booking reach vendor?
   - Notifications work both ways?

### Implementation Checklist:

- [ ] Review CustomerApp service listing code
- [ ] Verify service query filters by vendor.isActive
- [ ] Verify service query filters by vendor.setupCompleted
- [ ] Test location-based search
- [ ] Test service style filtering
- [ ] Test end-to-end booking flow
- [ ] Verify vendor receives booking notification

**Estimated Time:** 2-3 days

---

## 📊 IMPLEMENTATION PRIORITY

### Sprint 1 (Critical - Week 1):
1. **Re-Onboarding Flow** (2-3 days) - BLOCKER
2. **Notification System** (1-2 days) - BLOCKER
3. **Runtime Testing** (1 day) - Verification

### Sprint 2 (High - Week 2):
4. **Custom Service Wizard** (3-4 days) - Feature Complete
5. **Customer App Integration** (2-3 days) - End-to-End

### Sprint 3 (Polish - Week 3):
6. Price control testing
7. Auto-approval logic
8. Performance optimization
9. Bug fixes

---

## 🎯 DEFINITION OF DONE

Each blocker is considered DONE when:

✅ **Re-Onboarding:**
- [ ] Vendor can click "Correct & Resubmit" after rejection
- [ ] Form pre-fills with previous data
- [ ] Documents can be re-uploaded
- [ ] Resubmission changes status to 'resubmitted'
- [ ] Admin sees resubmitted application
- [ ] Approve/reject works on resubmitted app

✅ **Notifications:**
- [ ] Notification banner shows on vendor login
- [ ] Unread count displays correctly
- [ ] Admin messages appear in notifications
- [ ] Mark as read functionality works
- [ ] Action buttons navigate correctly

✅ **Custom Services:**
- [ ] Vendor can create custom service
- [ ] Wizard validates all required fields
- [ ] Service submits for approval
- [ ] Admin sees pending custom service
- [ ] Admin can approve/reject
- [ ] Approved service visible to customers

✅ **Customer Integration:**
- [ ] Enabled services show in customer app
- [ ] Location filtering works
- [ ] Service style filtering works
- [ ] Booking flow completes
- [ ] Vendor receives booking notification

---

## 📞 SUPPORT CONTACTS

**Development Lead:** [Insert contact]  
**Product Owner:** [Insert contact]  
**QA Lead:** [Insert contact]  

---

**Document Status:** ACTIVE - Implementation Required  
**Next Review:** After Sprint 1 completion  
**Last Updated:** November 16, 2025
