# Backend Integration for Phases 24-29 & 12-13

This document outlines all backend endpoints needed for the components developed in Phases 24-29 (Admin) and Phases 12-13 (Vendor).

## Overview

**Total Endpoints Required:** ~80 endpoints
**Backend Module:** AWS Lambda with Hono framework
**Authentication:** Bearer token via Authorization header

---

## PHASE 24: ADMIN - CATALOG SELECTORS

### 1. VendorTypeSelector
```
GET /admin/catalog/vendor-types
Response: { vendorTypes: VendorType[] }

GET /admin/catalog/vendor-types/:id
Response: { vendorType: VendorType }

POST /admin/catalog/vendor-types
Body: { name, displayName, description, icon }
Response: { vendorType: VendorType }
```

### 2. ServiceStyleSelector
```
GET /admin/catalog/service-styles
Response: { serviceStyles: ServiceStyle[] }

POST /admin/catalog/service-styles
Body: { name, displayName, description }
Response: { serviceStyle: ServiceStyle }
```

### 3. RegionalAvailabilitySelector
```
GET /admin/catalog/services/:serviceId/regional-availability
Response: { availability: RegionalAvailability[] }

PUT /admin/catalog/services/:serviceId/regional-availability
Body: { regions: RegionAvailability[] }
Response: { success: boolean }
```

### 4. RegionalPricingEditor
```
GET /admin/catalog/services/:serviceId/regional-pricing
Response: { pricing: RegionalPricing[] }

PUT /admin/catalog/services/:serviceId/regional-pricing
Body: { pricing: RegionalPricing[] }
Response: { success: boolean }
```

### 5. RegionalPackageList
```
GET /admin/catalog/regional-packages
Query: ?regionId=xxx&status=active
Response: { packages: RegionalPackage[] }

POST /admin/catalog/regional-packages
Body: { name, regionId, services, pricing }
Response: { package: RegionalPackage }
```

### 6. CreateRegionalPackageModal
```
POST /admin/regions/:regionId/packages
Body: { name, description, price, originalPrice, services }
Response: { package: RegionalPackage }
```

---

## PHASE 25: ADMIN - PLATFORM & REGIONS

### 1. PlatformSettings
```
GET /admin/platform/settings
Response: { settings: PlatformSettings }

PUT /admin/platform/settings
Body: { settings: PlatformSettings }
Response: { success: boolean }
```

### 2. RegionManager
```
GET /admin/regions
Response: { regions: Region[] }

POST /admin/regions
Body: { name, code, currency, timezone }
Response: { region: Region }

PUT /admin/regions/:id/status
Body: { isActive: boolean }
Response: { success: boolean }
```

### 3. RegionalCatalogManager
```
GET /admin/regions/:regionId/catalog
Response: { catalog: RegionalCatalog }

PUT /admin/regions/:regionId/catalog
Body: { catalog: RegionalCatalog }
Response: { success: boolean }
```

### 4. IntegratedServicesManagement
```
GET /admin/integrated-services
Response: { services: IntegratedService[] }

POST /admin/integrated-services
Body: { name, type, endpoint, config }
Response: { service: IntegratedService }

PUT /admin/integrated-services/:id/status
Body: { status: string }
Response: { success: boolean }

DELETE /admin/integrated-services/:id
Response: { success: boolean }
```

### 5. ProblemCategoryMapper
```
GET /admin/problem-category-mappings
Response: { mappings: CategoryMapping[] }

POST /admin/problem-category-mappings
Body: { problemCategory, serviceCategory, serviceSubCategory, priority }
Response: { mapping: CategoryMapping }

PUT /admin/problem-category-mappings/:id
Body: { ...mapping updates }
Response: { mapping: CategoryMapping }

DELETE /admin/problem-category-mappings/:id
Response: { success: boolean }
```

### 6. ReschedulingPolicyManager
```
GET /admin/rescheduling-policies
Response: { policies: ReschedulingPolicy[] }

POST /admin/rescheduling-policies
Body: { name, advanceNoticeHours, cancellationFee, reschedulingFee, maxReschedules }
Response: { policy: ReschedulingPolicy }

PUT /admin/rescheduling-policies/:id
Body: { ...policy updates }
Response: { policy: ReschedulingPolicy }

DELETE /admin/rescheduling-policies/:id
Response: { success: boolean }
```

---

## PHASE 26: ADMIN - RBAC & ROLES

### 1. RBACDashboard
```
GET /admin/rbac/stats
Response: { stats: RBACStats }
```

### 2. RBACManagement
```
GET /admin/rbac/roles
Response: { roles: Role[] }

GET /admin/rbac/users
Response: { users: User[] }

GET /admin/rbac/permissions
Response: { permissions: Permission[] }
```

### 3. RoleManagement
```
GET /admin/roles
Response: { roles: Role[] }

POST /admin/roles
Body: { name, description, permissions }
Response: { role: Role }

PUT /admin/roles/:id
Body: { ...role updates }
Response: { role: Role }

DELETE /admin/roles/:id
Response: { success: boolean }
```

### 4. RoleMigrationPanel
```
GET /admin/role-migrations
Response: { migrations: RoleMigration[] }

POST /admin/role-migrations
Body: { fromRole, toRole }
Response: { migration: RoleMigration }
```

### 5. VendorSettingsTab
```
GET /admin/vendor-settings
Response: { settings: VendorSettings }

PUT /admin/vendor-settings
Body: { settings: VendorSettings }
Response: { success: boolean }
```

### 6. EnterpriseLogicTab
```
GET /admin/enterprise-settings
Response: { settings: EnterpriseSettings }

PUT /admin/enterprise-settings
Body: { settings: EnterpriseSettings }
Response: { success: boolean }
```

---

## PHASE 27: ADMIN - SUPPORT & OPERATIONS

### 1. SupportCRM
```
GET /admin/support/tickets
Response: { tickets: Ticket[] }

GET /admin/support/chat
Response: { chats: Chat[] }
```

### 2. SupportVendorTab
```
GET /admin/support/vendor-requests
Response: { requests: VendorSupportRequest[] }

PUT /admin/support/vendor-requests/:id/status
Body: { status: string }
Response: { success: boolean }
```

### 3. TicketingSystem
```
GET /admin/support/tickets
Query: ?status=open&priority=high
Response: { tickets: Ticket[] }

POST /admin/support/tickets
Body: { subject, requester, priority, category }
Response: { ticket: Ticket }

PUT /admin/support/tickets/:id
Body: { ...ticket updates }
Response: { ticket: Ticket }
```

### 4. AdminOperationsDashboard
```
GET /admin/operations/stats
Response: { stats: OperationsStats }
```

### 5. ContentManagement
```
GET /admin/content
Query: ?type=page&status=published
Response: { contents: ContentItem[] }

POST /admin/content
Body: { title, type, content, language, status }
Response: { content: ContentItem }

PUT /admin/content/:id
Body: { ...content updates }
Response: { content: ContentItem }

DELETE /admin/content/:id
Response: { success: boolean }
```

### 6. NotificationTemplateManager
```
GET /admin/notification-templates
Query: ?type=email&category=transactional
Response: { templates: NotificationTemplate[] }

POST /admin/notification-templates
Body: { name, type, category, subject, content, variables }
Response: { template: NotificationTemplate }

PUT /admin/notification-templates/:id
Body: { ...template updates }
Response: { template: NotificationTemplate }

DELETE /admin/notification-templates/:id
Response: { success: boolean }
```

---

## PHASE 28: ADMIN - FINANCE & PAYMENTS

### 1. PaymentDisputesTab
```
GET /admin/payment-disputes
Query: ?status=pending&priority=high
Response: { disputes: PaymentDispute[] }

PUT /admin/payment-disputes/:id/resolve
Body: { resolution: string }
Response: { success: boolean }
```

### 2. RateChangesTab
```
GET /admin/rate-changes
Query: ?status=pending
Response: { rateChanges: RateChange[] }

PUT /admin/rate-changes/:id/approve
Response: { success: boolean }

PUT /admin/rate-changes/:id/reject
Body: { reason: string }
Response: { success: boolean }
```

### 3. TransactionMonitoring
```
GET /admin/transactions/monitoring
Query: ?status=pending&type=payment
Response: { transactions: Transaction[] }
```

### 4. ExportApplicationsModal
```
POST /admin/applications/export
Body: { format, dateRange, filters }
Response: { downloadUrl: string }
```

---

## PHASE 29: ADMIN - SETTINGS & MISC

### 1. BookingRulesManagement
```
GET /admin/settings/booking-rules
Response: { rules: BookingRule[] }

POST /admin/settings/booking-rules
Body: { name, description, advanceBookingHours, cancellationHours, reschedulingHours, maxBookingsPerDay }
Response: { rule: BookingRule }

PUT /admin/settings/booking-rules/:id
Body: { ...rule updates }
Response: { rule: BookingRule }

DELETE /admin/settings/booking-rules/:id
Response: { success: boolean }
```

### 2. ScheduleSettingsManagement
```
GET /admin/settings/schedule
Response: { settings: ScheduleSettings }

PUT /admin/settings/schedule
Body: { settings: ScheduleSettings }
Response: { success: boolean }
```

### 3. OnboardingDesigner
```
GET /admin/onboarding/steps
Response: { steps: OnboardingStep[] }

POST /admin/onboarding/steps
Body: { order, title, description, fields }
Response: { step: OnboardingStep }

PUT /admin/onboarding/steps/:id
Body: { ...step updates }
Response: { step: OnboardingStep }

DELETE /admin/onboarding/steps/:id
Response: { success: boolean }
```

### 4. EnhancedOnboardingFormBuilder
```
GET /admin/onboarding/forms
Response: { forms: OnboardingForm[] }

POST /admin/onboarding/forms
Body: { name, fields, validation }
Response: { form: OnboardingForm }
```

### 5. PetIntelligenceSystem
```
GET /admin/pets/intelligence
Query: ?search=xxx
Response: { pets: PetIntelligence[] }
```

### 6. SuccessModal
```
# No backend endpoint needed - UI component only
```

### 7. SuperAdminProfileModal
```
GET /admin/profile/:adminId
Response: { admin: AdminProfile }

PUT /admin/profile/:adminId
Body: { name, email, phone }
Response: { success: boolean }
```

### 8. RenewalNoticesModal
```
GET /admin/renewal-notices
Response: { notices: RenewalNotice[] }

POST /admin/renewal-notices/:id/send
Response: { success: boolean }
```

---

## PHASE 12: VENDOR - POST-APPROVAL SETUP

### 1. VendorApprovedSetup
```
GET /vendor/:vendorId/setup-status
Response: { setupStatus: SetupStatus }

POST /vendor/:vendorId/setup/complete
Response: { success: boolean }
```

### 2. VendorAvailabilitySetup
```
GET /vendor/:vendorId/availability
Response: { availability: Availability }

PUT /vendor/:vendorId/availability
Body: { availability: Availability }
Response: { success: boolean }
```

### 3. VendorSetupCompleted
```
GET /vendor/:vendorId/setup-completed
Response: { completed: boolean, nextSteps: string[] }
```

### 4. VendorServiceSelection
```
GET /vendor/:vendorId/services/available
Response: { services: Service[] }

POST /vendor/:vendorId/services/select
Body: { serviceIds: string[] }
Response: { success: boolean }
```

### 5. VendorServiceConfigurationScreen
```
GET /vendor/services/config
Query: ?serviceIds=xxx,yyy
Response: { services: ServiceConfig[] }

POST /vendor/services/configure
Body: { vendorId, configurations: ServiceConfig[] }
Response: { success: boolean }
```

---

## PHASE 13: VENDOR - DASHBOARD & LANDING

### 1. VendorLandingPage
```
GET /vendor/status/:vendorId
Response: { vendor: Vendor, status: string }

GET /vendor/profile/:vendorId
Response: { vendor: Vendor }
```

### 2. SoloProviderDashboard
```
GET /vendor/:vendorId/solo-info
Response: { vendor, center, staff }
```

### 3. ModeSwitcher
```
# No backend endpoint needed - UI component only
```

### 4. SoloProviderHelpers
```
# No backend endpoint needed - UI component only
```

### 5. CenterModeContent
```
GET /vendor/:vendorId/center/stats
Response: { stats: CenterStats }
```

### 6. StaffModeContent
```
GET /vendor/:vendorId/staff/:staffId/stats
Response: { stats: StaffStats }
```

### 7. CapabilityDebugOverlay
```
# No backend endpoint needed - UI component only
```

---

## Response Format Standards

All endpoints should follow this standard response format:

### Success Response
```json
{
  "success": true,
  "data": { ... },
  "message": "Operation completed successfully"
}
```

### Error Response
```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

### List Response
```json
{
  "success": true,
  "items": [ ... ],
  "total": 100,
  "page": 1,
  "limit": 20
}
```

---

## Implementation Priority

1. **P0 (Critical):** Phases 12-13 (Vendor onboarding flow)
2. **P1 (High):** Phases 24-26 (Admin core features)
3. **P2 (Medium):** Phases 27-29 (Admin advanced features)

---

## Testing Checklist

- [ ] All endpoints return proper status codes
- [ ] Authentication is enforced
- [ ] Error handling is consistent
- [ ] Response formats match specifications
- [ ] Data validation is implemented
- [ ] Database queries are optimized
- [ ] Logging is implemented
- [ ] Rate limiting is configured

