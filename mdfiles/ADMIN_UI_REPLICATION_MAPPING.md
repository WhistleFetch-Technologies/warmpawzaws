# Admin UI Replication Mapping Document

## PART 1: DISCOVER & MAP ADMIN UI SCREENS

### Source: `/Admin UI/` (Reference)
### Target: `/apps/admin-web/` (Main Application)

---

## SCREEN MAPPING

### 1. ANALYTICS (`/analytics`)
- **Source**: `Admin UI/analytics/page.tsx`
- **PNG References**: 
  - `overview.png`
  - `revenue.png`
  - `vendor-performance.png`
  - `customer-report.png`
  - `behavioral-patterns.png`
  - `sales-by-category.png`
  - `saved-reports.png`
- **Target**: `apps/admin-web/app/analytics/page.tsx`
- **Status**: ⚠️ NEEDS REPLICATION
- **Components Required**:
  - `RevenueChart` from `Admin UI/analytics/analytics/revenueCharts/RevenueChart.tsx`
  - `VendorPerformanceTable` from `Admin UI/analytics/analytics/vendorPerformanceTable/VendorPerformanceTable.tsx`
- **Tabs**: Overview, Revenue, Vendor Performance, Customer Reports, Behavioral Patterns, Sales by Category/Role, Saved Reports

### 2. ECOMMERCE (`/ecommerce`)
- **Source**: `Admin UI/ecommerce/page.tsx`
- **PNG References**:
  - `dashboard.png`
  - `categories.png`
  - `add-category.png`
  - `edit-category.png`
  - `orders.png`
  - `sellers.png`
  - `product-approval.png`
  - `service-approval.png`
  - `commission-1.png`
  - `commission-2.png`
  - `analytics.png`
- **Target**: `apps/admin-web/app/sellers/page.tsx` (partial - needs full ecommerce section)
- **Status**: ⚠️ NEEDS REPLICATION
- **Components Required**:
  - `ECommerceDashboard`
  - `CategoryManagement`
  - `OrderManagementAdmin`
  - `SellerManagement`
  - `ProductApproval`
  - `CustomServiceApproval`
  - `CommissionSettings`
  - `ECommerceAnalytics`

### 3. FINANCE (`/finance`)
- **Source**: `Admin UI/finance/page.tsx`
- **PNG References**:
  - `dashboard.png`
  - `settlements.png`
  - `settlement-rules.png`
  - `payout-mgmt.png`
  - `tier-system.png`
  - `tier-system-create-new-tier.png`
  - `gst-config-ovewrview.png`
  - `gst-config-HSN.png`
  - `gst-config-createHSN.png`
  - `payment-policies.png`
  - `create-rule.png`
  - `refund-policies.png`
  - `cancellation-policy.png`
  - `create-canceellation-policy.png`
  - `schedule-settings.png`
  - `payment-gateway.png`
- **Target**: `apps/admin-web/app/settlements/page.tsx` (partial)
- **Status**: ⚠️ NEEDS REPLICATION
- **Components Required**:
  - `SettlementDashboard`
  - `DynamicSettlementRulesManager`
  - `PayoutManagement`
  - `TierManagement`
  - `GSTConfigurationManagement`
  - `GSTRuleManagement`
  - `PaymentRulesSection`
  - `RefundPoliciesSection`
  - `CancellationPolicyManagement`
  - `SettlementScheduleSettings`
  - `PaymentGatewaySettings`
  - `AdminPaymentSettings`

### 4. MARKETING (`/marketing`)
- **Source**: `Admin UI/marketing/page.tsx`
- **PNG References**:
  - `dashboard-ui.png`
  - `promotions.png`
  - `create-new-promotion.png`
  - `edit-promotion.png`
  - `coupons.png`
  - `banners.png`
  - `spotlight.png`
  - `add-spotlight.png`
  - `advanced.png`
- **Target**: `apps/admin-web/app/promotions/page.tsx` (partial)
- **Status**: ⚠️ NEEDS REPLICATION
- **Components Required**:
  - `AdvancedPromotionsEngine`
  - `CouponManagement`

### 5. PLATFORM SETTINGS (`/platform-settings`)
- **Source**: `Admin UI/platform-settings/page.tsx`
- **PNG References**:
  - `logistics-delhivery.png`
  - `logistics-cost-simulator.png`
  - `add-logistics-partner-details.png`
  - `add-logistics-partner-coverage.png`
  - `add-logistics-partner-pricing-rules.png`
  - `logistics-integration-partners-rules.png`
  - `payment-gateway.png`
  - `loyalty-rewards.png`
  - `cloud-maps-google-maps.png`
  - `cloud-maps-razorpay.png`
  - `cloud-maps=aws-services.png`
  - `to-enable-edit-mode.png`
- **Target**: `apps/admin-web/app/integrations/page.tsx` (partial)
- **Status**: ⚠️ NEEDS REPLICATION
- **Components Required**:
  - `LogisticsIntegration`
  - `PaymentGatewayIntegration`
  - `RewardsLoyaltyManagement`
  - `AWSIntegrationsSettings`
  - `DelhiveryConfig`
  - `ShiprocketConfig`
  - `LogisticsSettings`
  - `DeliveryRulesManager`

### 6. VENDOR ADMIN (`/vendor-admin`)
- **Source**: `Admin UI/vendor-admin/page.tsx`
- **PNG References**:
  - `home.png`
  - `vendor-application.png`
  - `add-new-vendor.png`
  - `add-new-vendor(1).png`
- **Target**: `apps/admin-web/app/vendors/page.tsx`
- **Status**: ⚠️ NEEDS REPLICATION
- **Components Required**:
  - `ActiveVendorsTab`
  - `EnhancedPendingApplicationsTab`
  - `ClarificationRequestedTab`
  - `ReverificationTab`
  - `ComplianceIssuesTab`
  - `DeactivationRequestsTab`
  - `PaymentDisputesTab`
  - `RateChangesTab`
  - `SupportVendorTab`
  - `VendorSettingsTab`
  - `AddVendorModal`
  - `ApplicationDetailModal`
  - `VendorDetailsModal`
  - `RejectVendorModal`
  - `RequestInfoModal`
  - `RenewalNoticesModal`
  - `ExportApplicationsModal`
  - `SuccessModal`
  - `SuperAdminProfileModal`

### 7. ENTERPRISE (`/enterprise`)
- **Source**: `Admin UI/enterprise/page.tsx`
- **PNG References**:
  - `overview.png`
  - `enterprise-customer.png`
  - `enterprise-logic-tab.png`
  - `revenue-analytics.png`
- **Target**: `apps/admin-web/app/` (MISSING - needs creation)
- **Status**: ❌ MISSING
- **Components Required**:
  - `PricingRulesEngine`
  - `InventoryManager`

### 8. PET INFO (`/pet-info`)
- **Source**: `Admin UI/pet-info/page.tsx`
- **PNG References**:
  - `overview.png`
  - `pet-db.png`
  - `breed-insights.png`
  - `health-trends.png`
- **Target**: `apps/admin-web/app/` (MISSING - needs creation)
- **Status**: ❌ MISSING

### 9. ROLES (`/roles`)
- **Source**: `Admin UI/roles/page.tsx`
- **PNG References**:
  - `roles.png`
  - `permissions.png`
  - `policies.png`
  - `create-role.png`
- **Target**: `apps/admin-web/app/roles/page.tsx`
- **Status**: ⚠️ NEEDS REPLICATION

### 10. SUPPORT (`/support`)
- **Source**: `Admin UI/support/page.tsx`
- **PNG References**:
  - `support.png`
- **Target**: `apps/admin-web/app/` (MISSING - needs creation)
- **Status**: ❌ MISSING

### 11. REGION MANAGER (`/region-manager`)
- **Source**: `Admin UI/region-manager/page.tsx`
- **PNG References**: None found
- **Target**: `apps/admin-web/app/regions/page.tsx`
- **Status**: ⚠️ NEEDS REPLICATION
- **Components Required**:
  - `RegionActivePackagesTab`

### 12. CATALOG & SERVICES (`/catalog-and-service`)
- **Source**: `Admin UI/catalog-and-service/page.tsx`
- **Target**: `apps/admin-web/app/catalog/page.tsx`
- **Status**: ⚠️ NEEDS VERIFICATION

### 13. CONTENT (`/content`)
- **Source**: `Admin UI/content/page.tsx`
- **Target**: `apps/admin-web/app/` (MISSING - needs creation)
- **Status**: ❌ MISSING

### 14. DATABASE SEEDING (`/database-seeding`)
- **Source**: `Admin UI/database-seeding/page.tsx`
- **Target**: `apps/admin-web/app/` (MISSING - needs creation)
- **Status**: ❌ MISSING

### 15. EVENTS (`/events`)
- **Source**: `Admin UI/events/page.tsx`
- **Target**: `apps/admin-web/app/` (MISSING - needs creation)
- **Status**: ❌ MISSING

---

## LAYOUT STRUCTURE

### Source Layout
- **File**: `Admin UI/layout.tsx`
- **Component**: Uses `UnifiedAdminSidebar` from `Admin UI/layout/UnifiedAdminSidebar.tsx`
- **Structure**: Sidebar + Main Content Area

### Target Layout
- **File**: `apps/admin-web/app/layout.tsx` (Root layout)
- **File**: `apps/admin-web/components/AdminLayout.tsx` (Current admin layout)
- **File**: `apps/admin-web/components/admin/layout/UnifiedAdminSidebar.tsx` (Sidebar exists)
- **Note**: Layout structure differs - needs alignment

---

## SHARED COMPONENTS

### Source Components (`Admin UI/src/`)
- All UI components in `Admin UI/src/` should be checked against `packages/ui/src/`
- If components don't match PNG intent, create Admin-scoped overrides in `apps/admin-web/components/ui/`

### Target Components
- `apps/admin-web/components/ui/` - Admin-specific UI components
- `packages/ui/src/` - Shared UI components (DO NOT MODIFY unless explicitly required)

---

## REPLICATION PRIORITY

1. **HIGH PRIORITY** (Core Admin Functions):
   - Analytics (Complete with all tabs)
   - Vendor Admin (Complete with all tabs)
   - Ecommerce (Complete dashboard)
   - Finance (Complete dashboard)
   - Roles (Complete)

2. **MEDIUM PRIORITY** (Platform Management):
   - Marketing (Complete)
   - Platform Settings (Complete)
   - Region Manager

3. **LOW PRIORITY** (Additional Features):
   - Enterprise
   - Pet Info
   - Support
   - Content
   - Database Seeding
   - Events

---

## VALIDATION CHECKLIST

For each replicated screen:
- [ ] Code structure matches source
- [ ] Layout matches PNG reference
- [ ] Spacing & padding match PNG
- [ ] Typography matches PNG
- [ ] Colors match PNG
- [ ] Component dimensions match PNG
- [ ] Button sizes match PNG
- [ ] Icon placement matches PNG
- [ ] No changes outside Admin UI directories
- [ ] Shared components reused where appropriate
- [ ] Admin-scoped overrides created only when necessary

---

## NOTES

- **DO NOT** modify Customer UI, Vendor UI, Staff UI, Backend, APIs, or State Management
- **DO NOT** modify shared components in `packages/ui/src/` unless explicitly required
- **ONLY** modify files in `apps/admin-web/`
- Create Admin-scoped component overrides if shared components don't match PNG intent
- Preserve visual intent from PNG references
- No creative changes or "improvements"

