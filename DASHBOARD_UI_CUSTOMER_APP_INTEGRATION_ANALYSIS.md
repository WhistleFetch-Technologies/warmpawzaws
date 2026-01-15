# Dashboard UI Configuration - Customer App Integration Analysis

## 🔍 Current State Analysis

### ✅ What's Working (Backend)

1. **Dashboard Config Storage**
   - ✅ Saves to `platform_settings` table
   - ✅ Stores: `enabled`, `launchPhase`, `rolloutPercentage`
   - ✅ Stores: `allowedServiceStyles`, `requiredRoleTypes`
   - ✅ API endpoints working (GET/PUT)

2. **Backend Validation**
   - ✅ `validateServiceAvailability()` checks all conditions
   - ✅ Blocks bookings for disabled services
   - ✅ Validates service styles (at_home, at_clinic, tele, etc.)
   - ✅ Validates role types

### ❌ What's NOT Working (Frontend)

1. **Customer App - No Dashboard Config Integration**
   ```typescript
   // apps/customer-web/components/customer/CustomerHomeComplete.tsx
   // Line 229-255: HARDCODED services array
   const quickServices = [
     { icon: Stethoscope, label: 'Vet Care', screen: 'vet' },
     { icon: Scissors, label: 'Grooming', screen: 'grooming' },
     // ... all services hardcoded
   ];
   ```
   - ❌ Does NOT fetch `/config/ui/dashboard`
   - ❌ Does NOT filter by `enabled` status
   - ❌ Does NOT respect `launchPhase`
   - ❌ Does NOT filter by `allowedServiceStyles`
   - ❌ Shows ALL services regardless of config

2. **Service Styles Not Filtered in UI**
   - Customer app shows service styles (at_home, at_clinic, tele) in UI
   - But doesn't check `allowedServiceStyles` from dashboard config
   - All styles shown even if restricted in config

## 📊 Architecture Gap

```
┌─────────────────────────────────────────────────────────────┐
│              Admin UI (Marketing > Dashboard UI)             │
│  ✅ Saves config with:                                      │
│     - enabled: false                                        │
│     - allowedServiceStyles: ["at_home", "at_clinic"]       │
│     - requiredRoleTypes: ["healthcare_provider"]            │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ Saved to DB
                       ▼
┌─────────────────────────────────────────────────────────────┐
│         Database (platform_settings)                        │
│  ✅ Config stored correctly                                 │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ GET /config/ui/dashboard?roleId=...
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              Customer App (Frontend)                         │
│  ❌ DOES NOT FETCH THIS ENDPOINT                            │
│  ❌ Uses hardcoded quickServices array                      │
│  ❌ Shows all services regardless of config                  │
└──────────────────────────────────────────────────────────────┘
                       │
                       │ User clicks service
                       │ Tries to book
                       ▼
┌─────────────────────────────────────────────────────────────┐
│          Booking API (Backend Validation)                   │
│  ✅ validateServiceAvailability() checks:                   │
│     - Button enabled?                                       │
│     - Launch phase?                                         │
│     - Service styles allowed?                               │
│     - Role types allowed?                                   │
│  ✅ Returns 403 if not available                           │
└──────────────────────────────────────────────────────────────┘
```

## 🎯 Use Cases & Current Behavior

### Use Case 1: Disable Entire Service

**Admin Action:**
- Set `enabled: false` for "Vet Care" button
- Save configuration

**Current Behavior:**
- ❌ Customer app: Still shows "Vet Care" button
- ✅ Backend: Blocks booking with 403 error
- ⚠️ **User Experience**: Button visible but booking fails (confusing)

**Expected Behavior:**
- ✅ Customer app: Should hide "Vet Care" button
- ✅ Backend: Blocks booking (already working)

### Use Case 2: Restrict Service Styles

**Admin Action:**
- Set `allowedServiceStyles: ["at_home"]` for "Vet Care"
- This means: Only "at home" vet services allowed, not "at clinic" or "tele"

**Current Behavior:**
- ❌ Customer app: Shows all service styles (at_home, at_clinic, tele)
- ✅ Backend: Blocks booking for restricted styles
- ⚠️ **User Experience**: User sees all options but some fail (confusing)

**Expected Behavior:**
- ✅ Customer app: Should only show "at_home" option
- ✅ Backend: Blocks other styles (already working)

### Use Case 3: Launch Phase Restriction

**Admin Action:**
- Set `launchPhase: "coming_soon"` for a service
- Save configuration

**Current Behavior:**
- ❌ Customer app: Shows service normally
- ✅ Backend: Blocks booking with "coming_soon" error
- ⚠️ **User Experience**: Service visible but can't book (confusing)

**Expected Behavior:**
- ✅ Customer app: Should show "Coming Soon" badge or hide service
- ✅ Backend: Blocks booking (already working)

## 🔧 What Needs to Be Implemented

### 1. Customer App Dashboard Config Integration

**File:** `apps/customer-web/components/customer/CustomerHomeComplete.tsx`

**Current Code:**
```typescript
// Line 229: Hardcoded services
const quickServices = [
  { icon: Stethoscope, label: 'Vet Care', screen: 'vet' },
  // ...
];
```

**Needed Changes:**
```typescript
// 1. Add state for dashboard config
const [dashboardConfig, setDashboardConfig] = useState<any>(null);
const [filteredServices, setFilteredServices] = useState(quickServices);

// 2. Fetch dashboard config on mount
useEffect(() => {
  const loadDashboardConfig = async () => {
    try {
      // Get customer's role
      const profile = await apiClient.get(`/customer/profile?phone=${phone}`);
      const roleId = profile.role_id || profile.roleId || 'veterinarian';
      
      // Fetch dashboard config
      const config = await apiClient.get(`/config/ui/dashboard?roleId=${roleId}`);
      
      if (config.success && config.config?.buttons) {
        setDashboardConfig(config.config);
        
        // Filter services based on config
        const enabledButtons = config.config.buttons.filter(
          (btn: any) => btn.enabled && btn.launchPhase !== 'coming_soon'
        );
        
        // Map dashboard buttons to services
        const filtered = quickServices.filter(service => {
          const button = enabledButtons.find((btn: any) => 
            btn.id === service.screen || 
            btn.serviceId === service.screen ||
            btn.label?.toLowerCase().includes(service.label.toLowerCase())
          );
          return button !== undefined;
        });
        
        setFilteredServices(filtered);
      }
    } catch (error) {
      console.error('Error loading dashboard config:', error);
      // Fallback to default services
      setFilteredServices(quickServices);
    }
  };
  
  loadDashboardConfig();
}, [phone]);

// 3. Use filteredServices instead of quickServices
{filteredServices.map((service, index) => (
  // ... render service
))}
```

### 2. Service Style Filtering

**File:** `apps/customer-web/components/customer/VetServiceRouter.tsx` (or similar)

**Current Code:**
```typescript
// Shows all service styles
const vetServices = [
  { title: 'Vet at Home', type: 'visit' },
  { title: 'Tele Consulting', type: 'video' },
  { title: 'Clinic Appointment', type: 'clinic' },
];
```

**Needed Changes:**
```typescript
// Fetch dashboard config for service styles
useEffect(() => {
  const loadServiceStyles = async () => {
    const config = await apiClient.get(`/config/ui/dashboard?roleId=${roleId}`);
    const button = config.config?.buttons?.find(
      (btn: any) => btn.serviceId === 'vet' || btn.id === 'vet_consultation'
    );
    
    if (button?.allowedServiceStyles) {
      // Filter service styles
      const allowedStyles = button.allowedServiceStyles;
      const filteredServices = vetServices.filter(service => {
        const styleMap: Record<string, string[]> = {
          'visit': ['at_home', 'home_visit'],
          'video': ['tele', 'video_consultation'],
          'clinic': ['at_clinic', 'at_center'],
        };
        return styleMap[service.type]?.some(style => 
          allowedStyles.includes(style)
        );
      });
      setVetServices(filteredServices);
    }
  };
  loadServiceStyles();
}, []);
```

### 3. Launch Phase Indicators

**File:** `apps/customer-web/components/customer/CustomerHomeComplete.tsx`

**Needed Changes:**
```typescript
{filteredServices.map((service, index) => {
  const button = dashboardConfig?.buttons?.find(/* match service */);
  const isComingSoon = button?.launchPhase === 'coming_soon';
  const isBeta = button?.launchPhase === 'beta';
  
  return (
    <button
      key={index}
      onClick={() => onNavigate?.(service.screen)}
      disabled={isComingSoon}
      className={/* ... */}
    >
      {/* Service icon/label */}
      {isComingSoon && (
        <span className="badge">Coming Soon</span>
      )}
      {isBeta && (
        <span className="badge">Beta</span>
      )}
    </button>
  );
})}
```

## 📋 Implementation Checklist

### Phase 1: Basic Integration
- [ ] Fetch dashboard config in CustomerHomeComplete
- [ ] Filter services based on `enabled` status
- [ ] Hide services with `launchPhase: "coming_soon"`
- [ ] Show "Coming Soon" badge for beta services

### Phase 2: Service Style Filtering
- [ ] Fetch `allowedServiceStyles` from config
- [ ] Filter service style options (at_home, at_clinic, tele)
- [ ] Update VetServiceRouter, GroomingServiceRouter, etc.
- [ ] Show only allowed service styles in booking flow

### Phase 3: Role-Based Filtering
- [ ] Fetch `requiredRoleTypes` from config
- [ ] Filter vendors/services based on role types
- [ ] Show only matching vendors in search results

### Phase 4: Rollout Percentage
- [ ] Implement gradual rollout logic
- [ ] Hash customer ID to determine if in rollout group
- [ ] Show/hide services based on rollout percentage

## 🧪 Testing Scenarios

### Test 1: Disable Service
1. Admin: Set `enabled: false` for "Vet Care"
2. Customer App: Should NOT show "Vet Care" button
3. Backend: Should block booking (already working)

### Test 2: Restrict Service Styles
1. Admin: Set `allowedServiceStyles: ["at_home"]` for "Vet Care"
2. Customer App: Should only show "Vet at Home" option
3. Backend: Should block "at_clinic" and "tele" bookings

### Test 3: Coming Soon Phase
1. Admin: Set `launchPhase: "coming_soon"` for a service
2. Customer App: Should show "Coming Soon" badge or hide service
3. Backend: Should block booking (already working)

## 🎯 Summary

### Current State
- ✅ **Backend**: Fully functional, validates all conditions
- ❌ **Frontend**: No integration, shows all services
- ⚠️ **User Experience**: Confusing (services visible but bookings fail)

### Required Changes
1. **Customer App**: Fetch and use dashboard config
2. **Service Filtering**: Filter by `enabled`, `launchPhase`
3. **Style Filtering**: Filter service styles by `allowedServiceStyles`
4. **Visual Indicators**: Show badges for launch phases

### Impact
- **Before**: Backend blocks but UI doesn't reflect restrictions (confusing UX)
- **After**: UI hides/restricts services, backend validates (clear UX)

The dashboard UI configuration **saves correctly** but the **customer app frontend is NOT equipped** to handle these use cases yet. Backend validation works, but users will see services they can't actually book, which is confusing.
