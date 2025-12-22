# Capability Integration Fixes Required

## Summary

After comprehensive testing, **most UI components exist (71%)** but there are **critical integration gaps**:

1. ❌ **Service catalog NOT filtered by capabilities**
2. ⚠️ **Specialized capabilities NOT integrated with booking**
3. ❌ **12 components still missing** (hospitality, some specialized)
4. ⚠️ **Capability checks not used in service catalog**

---

## Critical Fix #1: Service Catalog Capability Filtering

### Current Issue
`VendorServiceCatalogView.tsx` filters by `applicableRoles` but **NOT by capabilities**.

### Required Fix

```typescript
// In VendorServiceCatalogView.tsx
import { useVendorCapabilities } from './hooks/useVendorCapabilities';

export function VendorServiceCatalogView({ vendorId, vendorData, ... }) {
  // ✅ ADD: Load capabilities
  const { capabilities, loading: capsLoading } = useVendorCapabilities(vendorData?.roleId);
  
  const isServiceApplicable = (service: ServiceCatalogItem): boolean => {
    // Existing role check
    if (!service.applicableRoles || service.applicableRoles.length === 0) {
      return true;
    }
    
    const vendorRoleId = vendorData?.roleId;
    if (!vendorRoleId) return true;
    
    const roleMatch = service.applicableRoles.includes(vendorRoleId);
    if (!roleMatch) return false;
    
    // ✅ NEW: Check required capabilities
    if (service.requiredCapabilities && service.requiredCapabilities.length > 0) {
      const hasAllCapabilities = service.requiredCapabilities.every(
        cap => capabilities[cap] === true
      );
      if (!hasAllCapabilities) {
        console.log(`⚠️ Service ${service.serviceName} requires capabilities:`, 
          service.requiredCapabilities.filter(cap => !capabilities[cap]));
        return false; // Hide service if vendor doesn't have required capabilities
      }
    }
    
    return true;
  };
  
  // ✅ NEW: Show unavailable services with capability requirements
  const unavailableServices = allServices.filter(service => {
    if (service.requiredCapabilities) {
      return !service.requiredCapabilities.every(cap => capabilities[cap]);
    }
    return false;
  });
  
  // Display with upgrade prompt
  {unavailableServices.length > 0 && (
    <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
      <h3 className="font-semibold text-amber-900 mb-2">
        Unavailable Services (Missing Capabilities)
      </h3>
      {unavailableServices.map(service => (
        <div key={service.id} className="mb-2">
          <p className="font-medium">{service.serviceName}</p>
          <p className="text-sm text-amber-700">
            Requires: {service.requiredCapabilities
              .filter(cap => !capabilities[cap])
              .join(', ')}
          </p>
        </div>
      ))}
    </div>
  )}
}
```

---

## Critical Fix #2: Booking Integration with Capabilities

### Current Issue
Specialized capabilities (prescription, medical_records) exist but not accessible from booking management.

### Required Fix

```typescript
// In VendorBookingManagement.tsx
import { useVendorCapabilities } from './hooks/useVendorCapabilities';

export function VendorBookingManagement({ vendorId, vendorData, ... }) {
  const { capabilities } = useVendorCapabilities(vendorData?.roleId);
  
  // ✅ ADD: Capability-based actions in booking detail
  const renderBookingActions = (booking: Booking) => {
    return (
      <div className="flex gap-2">
        {capabilities.chat && (
          <Button onClick={() => openChat(booking)}>
            Chat
          </Button>
        )}
        
        {/* ✅ NEW: Prescription action */}
        {capabilities.prescription && booking.status === 'completed' && (
          <Button onClick={() => openPrescriptionBuilder(booking)}>
            Create Prescription
          </Button>
        )}
        
        {/* ✅ NEW: Medical records action */}
        {capabilities.medical_records && (
          <Button onClick={() => viewMedicalHistory(booking.petId)}>
            Medical Records
          </Button>
        )}
        
        {/* ✅ NEW: Emergency action */}
        {capabilities.emergency && (
          <Button onClick={() => initiateEmergency(booking)}>
            Emergency Protocol
          </Button>
        )}
      </div>
    );
  };
}
```

---

## Critical Fix #3: Service Configuration with Capabilities

### Current Issue
`VendorServiceConfigurationScreen.tsx` doesn't validate service creation against capabilities.

### Required Fix

```typescript
// In VendorServiceConfigurationScreen.tsx
import { useVendorCapabilities } from './hooks/useVendorCapabilities';

export function VendorServiceConfigurationScreen({ ... }) {
  const { capabilities } = useVendorCapabilities(vendorData?.roleId);
  
  // ✅ ADD: Validate custom service creation
  const handleCreateCustomService = () => {
    // Check if vendor has custom_services capability
    if (!capabilities.custom_services) {
      toast.error('Custom services not available for your role. Contact admin to enable.');
      return;
    }
    
    // Validate service requirements
    if (customServiceForm.requiresPrescription && !capabilities.prescription) {
      toast.error('This service requires prescription capability');
      return;
    }
    
    // Create service...
  };
  
  // ✅ ADD: Validate package creation
  const handleCreatePackage = () => {
    if (!capabilities.package_management) {
      toast.error('Package management not available for your role');
      return;
    }
    
    // Create package...
  };
  
  // ✅ ADD: Filter services by capabilities
  const filteredServices = services.filter(service => {
    if (service.requiredCapabilities) {
      return service.requiredCapabilities.every(cap => capabilities[cap]);
    }
    return true;
  });
}
```

---

## Missing Components to Create

### High Priority (Backend exists)
1. **delivery** - VendorDeliveryManagement.tsx (navigation exists, verify component)
2. **patient_monitoring** - VendorPatientMonitoring.tsx (navigation exists, verify component)
3. **vet_summary** - VendorVetSummary.tsx

### Medium Priority (Role-specific)
4. **table_management** - VendorTableManagement.tsx (for cafe)
5. **pax_management** - VendorPaxManagement.tsx (for cafe)
6. **occupancy_tracking** - VendorOccupancyTracking.tsx (for boarding/resort)
7. **nightly_pricing** - VendorNightlyPricing.tsx (for boarding/resort)
8. **menu** - VendorCafeMenuManagement.tsx (navigation exists, verify component)
9. **multi_doctor_management** - VendorMultiDoctorManagement.tsx (navigation exists, verify component)
10. **counseling** - VendorCounseling.tsx (navigation exists, verify component)
11. **events** - VendorEventManagement.tsx (navigation exists, verify component)

---

## Integration Checklist

### Service Catalog
- [ ] Add `useVendorCapabilities` hook to VendorServiceCatalogView
- [ ] Filter services by `requiredCapabilities`
- [ ] Show unavailable services with capability requirements
- [ ] Add capability badges to service cards
- [ ] Disable service selection if capabilities missing

### Booking Management
- [ ] Add capability-based actions to booking detail view
- [ ] Integrate prescription builder with booking
- [ ] Link medical records to booking history
- [ ] Add emergency protocol to booking actions
- [ ] Show capability-specific booking features

### Service Configuration
- [ ] Validate custom service creation against capabilities
- [ ] Validate package creation against capabilities
- [ ] Filter available services by capabilities
- [ ] Show capability requirements for each service
- [ ] Disable incompatible service options

### Role Configuration
- [ ] Replace hardcoded role checks with capability checks
- [ ] Add capability upgrade prompts
- [ ] Show capability status in dashboard
- [ ] Add capability management UI (admin)

---

## Test Plan

### Unit Tests
- [ ] Test capability filtering in service catalog
- [ ] Test capability validation in service creation
- [ ] Test capability-based UI rendering

### Integration Tests
- [ ] Test booking integration with prescription capability
- [ ] Test booking integration with medical_records capability
- [ ] Test service catalog filtering for each role

### E2E Tests
- [ ] Test complete flow: Role → Capabilities → Service Catalog → Booking
- [ ] Test capability upgrade flow
- [ ] Test missing capability handling

---

## Priority Actions

### 🔴 Immediate (This Week)
1. Add capability filtering to VendorServiceCatalogView
2. Integrate prescription with booking management
3. Integrate medical_records with booking management
4. Add capability validation to service creation

### 🟡 Short-term (Next Week)
1. Create missing hospitality components
2. Create missing specialized components
3. Replace hardcoded role checks
4. Add capability upgrade prompts

### 🟢 Long-term (Following Weeks)
1. End-to-end testing
2. Performance optimization
3. UX improvements
4. Documentation

---

## Expected Outcome

After fixes:
- ✅ Service catalog filtered by capabilities
- ✅ Booking integrated with all specialized capabilities
- ✅ Service creation validated against capabilities
- ✅ All 45 capabilities have UI components
- ✅ Dynamic role-based service templates
- ✅ Complete end-to-end integration

**Target: 100% capability coverage with full integration**

