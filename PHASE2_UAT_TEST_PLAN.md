# Phase 2 UAT Test Plan - 100% Coverage

## Test Coverage Summary

### ✅ Components Created
1. **GSTConfigurationManagement.tsx** - Full CRUD for HSN codes, tax categories, regional settings
2. **CancellationPolicyManagement.tsx** - Full CRUD for cancellation policies
3. **AdminAnalyticsDashboard.tsx** - Enhanced with Customer Reports, Behavioral Patterns, Sales by Category/Role, Saved Reports

### ✅ Backend Endpoints Created
1. **gst-configuration-endpoints.tsx** - All CRUD endpoints for GST configuration
2. **cancellation-policy-endpoints.tsx** - All CRUD endpoints for cancellation policies

### ⚠️ Backend Endpoints Registration Required
The new endpoints need to be registered in the main server file (`index.tsx` or similar).

---

## Test Cases

### 1. GST Configuration Management

#### 1.1 HSN Codes CRUD
- [ ] **CREATE**: Create new HSN code with all required fields
  - Endpoint: `POST /admin/finance/gst/hsn-codes`
  - Test: Create HSN code with code, description, category, gstRate
  - Expected: Success response with created HSN code
  
- [ ] **READ**: Load all HSN codes
  - Endpoint: `GET /admin/finance/gst/hsn-codes`
  - Test: Fetch HSN codes list
  - Expected: Array of HSN codes returned
  
- [ ] **UPDATE**: Update existing HSN code
  - Endpoint: `PUT /admin/finance/gst/hsn-codes/:hsnId`
  - Test: Update HSN code description and GST rate
  - Expected: Updated HSN code returned
  
- [ ] **DELETE**: Delete HSN code
  - Endpoint: `DELETE /admin/finance/gst/hsn-codes/:hsnId`
  - Test: Delete HSN code by ID
  - Expected: Success response, code removed from list

#### 1.2 Tax Categories CRUD
- [ ] **CREATE**: Create new tax category
  - Endpoint: `POST /admin/finance/gst/tax-categories`
  - Test: Create category with name, description, defaultGSTRate
  - Expected: Success response with created category
  
- [ ] **READ**: Load all tax categories
  - Endpoint: `GET /admin/finance/gst/tax-categories`
  - Test: Fetch tax categories list
  - Expected: Array of categories returned
  
- [ ] **UPDATE**: Update existing tax category
  - Endpoint: `PUT /admin/finance/gst/tax-categories/:categoryId`
  - Test: Update category defaultGSTRate
  - Expected: Updated category returned
  
- [ ] **DELETE**: Delete tax category
  - Endpoint: `DELETE /admin/finance/gst/tax-categories/:categoryId`
  - Test: Delete category by ID
  - Expected: Success response, category removed

#### 1.3 Regional GST Settings CRUD
- [ ] **CREATE**: Create new regional GST config
  - Endpoint: `POST /admin/finance/gst-config`
  - Test: Create config with region, gstInclusion, defaultGSTRate
  - Expected: Success response with created config
  
- [ ] **READ**: Load all GST configs
  - Endpoint: `GET /admin/finance/gst-config`
  - Test: Fetch GST configs list
  - Expected: Array of configs returned
  
- [ ] **UPDATE**: Update existing GST config
  - Endpoint: `PUT /admin/finance/gst-config/:configId`
  - Test: Update config defaultGSTRate
  - Expected: Updated config returned
  
- [ ] **DELETE**: Delete GST config
  - Endpoint: `DELETE /admin/finance/gst-config/:configId`
  - Test: Delete config by ID
  - Expected: Success response, config removed

### 2. Cancellation Policy Management

#### 2.1 Cancellation Policies CRUD
- [ ] **CREATE**: Create new cancellation policy
  - Endpoint: `POST /admin/finance/cancellation-policies`
  - Test: Create policy with name, gracePeriodHours, cancellationWindows
  - Expected: Success response with created policy
  - Validation: Must have at least one cancellation window
  
- [ ] **READ**: Load all cancellation policies
  - Endpoint: `GET /admin/finance/cancellation-policies`
  - Test: Fetch policies list (sorted by priority)
  - Expected: Array of policies returned
  
- [ ] **READ SINGLE**: Get single policy
  - Endpoint: `GET /admin/finance/cancellation-policies/:policyId`
  - Test: Fetch policy by ID
  - Expected: Single policy object returned
  
- [ ] **UPDATE**: Update existing policy
  - Endpoint: `PUT /admin/finance/cancellation-policies/:policyId`
  - Test: Update policy gracePeriodHours and windows
  - Expected: Updated policy returned
  - Validation: Must maintain at least one window
  
- [ ] **DELETE**: Delete cancellation policy
  - Endpoint: `DELETE /admin/finance/cancellation-policies/:policyId`
  - Test: Delete policy by ID
  - Expected: Success response, policy removed

#### 2.2 Cancellation Policy Features
- [ ] **Filter by Type**: Filter policies by standard/vendor_specific/service_specific
- [ ] **Search**: Search policies by name/description
- [ ] **Multiple Windows**: Add/remove cancellation windows
- [ ] **Vendor Types**: Select applicable vendor types
- [ ] **Service Types**: Select applicable service types
- [ ] **Vendor Penalty**: Configure vendor cancellation penalties
- [ ] **No-Show Policy**: Configure no-show policies

### 3. Analytics & Insights

#### 3.1 Customer Reports Tab
- [ ] **Load Customer Metrics**: Display active customers, retention, LTV
- [ ] **Customer Acquisition Chart**: Display new/returning/loyal breakdown
- [ ] **Data Export**: Export customer reports to CSV

#### 3.2 Behavioral Patterns Tab
- [ ] **Peak Booking Times**: Display booking times chart
- [ ] **Service Preferences**: Display service preference pie chart
- [ ] **Customer Journey Funnel**: Display conversion funnel

#### 3.3 Sales by Category/Role Tab
- [ ] **Sales by Category**: Display category performance bar chart
- [ ] **Sales by Role**: Display role-based sales breakdown
- [ ] **Category Performance Table**: Display detailed category metrics

#### 3.4 Saved Reports Tab (Merged)
- [ ] **Load Saved Reports**: Fetch all saved reports
  - Endpoint: `GET /admin/reports`
  - Expected: Array of reports with metadata
  
- [ ] **Generate Report**: Generate report on demand
  - Endpoint: `POST /admin/reports/:reportId/generate`
  - Expected: Report generated successfully
  
- [ ] **Report Summary Cards**: Display total, scheduled, generations, shared counts
- [ ] **Report Actions**: View, Download, Share buttons functional

### 4. Navigation & Routing

#### 4.1 Finance & Logistics Navigation
- [ ] **GST Configuration Tab**: Navigate to GST config from Finance dashboard
- [ ] **Cancellation Policy Tab**: Navigate to cancellation policy from Finance dashboard
- [ ] **Tab Switching**: Switch between all Finance tabs without errors
- [ ] **Back Navigation**: Back button returns to admin dashboard

#### 4.2 Analytics & Insights Navigation
- [ ] **Analytics Route**: `/analytics` route loads AdminAnalyticsDashboard
- [ ] **Reports Route**: `/reports` route redirects to Analytics (merged)
- [ ] **Tab Navigation**: Switch between all Analytics tabs
- [ ] **Date Range Selection**: Change date range updates all data

#### 4.3 Platform Settings Navigation
- [ ] **Loyalty & Rewards Tab**: Navigate to Loyalty tab in Platform Settings
- [ ] **Tab Switching**: Switch between Cloud, Payments, Logistics, Loyalty tabs

### 5. Data Structure & Indexes

#### 5.1 KV Store Keys
- [ ] **GST Rules**: `platform:gst_rules` - Array of GSTRule objects
- [ ] **GST Configs**: `platform:gst_configs` - Array of GSTConfig objects
- [ ] **HSN Codes**: `platform:hsn_codes` - Array of HSNCode objects
- [ ] **Tax Categories**: `platform:tax_categories` - Array of TaxCategory objects
- [ ] **Cancellation Policies**: `platform:cancellation_policies` - Array of CancellationPolicy objects
- [ ] **Reports**: `platform:reports` or similar - Array of Report objects

#### 5.2 Data Validation
- [ ] **Required Fields**: All required fields validated on create/update
- [ ] **Type Validation**: Data types match TypeScript interfaces
- [ ] **Unique Constraints**: HSN codes should be unique
- [ ] **Priority Sorting**: Policies sorted by priority

### 6. Error Handling

#### 6.1 API Error Handling
- [ ] **404 Errors**: Handle not found errors gracefully
- [ ] **400 Errors**: Handle validation errors with user-friendly messages
- [ ] **500 Errors**: Handle server errors with retry options
- [ ] **Network Errors**: Handle network failures with user feedback

#### 6.2 Frontend Error Handling
- [ ] **Loading States**: Show loading indicators during API calls
- [ ] **Empty States**: Show appropriate messages when no data
- [ ] **Error Toasts**: Display error messages via toast notifications
- [ ] **Form Validation**: Validate forms before submission

### 7. Integration Tests

#### 7.1 End-to-End Flows
- [ ] **Create GST Config Flow**: Create HSN code → Create tax category → Create regional config
- [ ] **Create Policy Flow**: Create cancellation policy → Add windows → Configure penalties
- [ ] **Analytics Flow**: Select date range → View reports → Export data
- [ ] **Reports Flow**: Create report → Schedule report → Generate report → Download

#### 7.2 Cross-Component Integration
- [ ] **Finance → Analytics**: Financial data appears in Analytics dashboard
- [ ] **Platform Settings → Finance**: Loyalty settings don't conflict with finance
- [ ] **Support → Finance**: Refund actions use cancellation policies

---

## Missing Endpoints Registration

### ⚠️ Action Required
The following endpoints need to be registered in the main server file:

```typescript
// In src/supabase/functions/server/index.tsx (or main server file)
import { gstConfigurationEndpoints } from './gst-configuration-endpoints.tsx';
import { cancellationPolicyEndpoints } from './cancellation-policy-endpoints.tsx';

// Register endpoints
gstConfigurationEndpoints(app);
cancellationPolicyEndpoints(app);
```

---

## Test Execution Checklist

### Pre-Test Setup
- [ ] Backend endpoints registered in server file
- [ ] All dependencies installed
- [ ] Database/KV store accessible
- [ ] Test user authenticated

### Test Execution
- [ ] Run all CRUD tests for GST Configuration
- [ ] Run all CRUD tests for Cancellation Policies
- [ ] Test all Analytics tabs and features
- [ ] Test navigation flows
- [ ] Test error scenarios
- [ ] Test data validation
- [ ] Test integration flows

### Post-Test
- [ ] Document any bugs found
- [ ] Verify all endpoints return correct status codes
- [ ] Verify data persistence
- [ ] Verify UI updates correctly after operations

---

## Known Issues & Fixes

### Issue 1: Endpoints Not Registered
**Status**: ⚠️ Needs Fix
**Solution**: Register endpoints in main server file

### Issue 2: Reports Endpoint Path
**Status**: ✅ Verified
**Path**: `/admin/reports` exists in `report-builder-endpoints.tsx`

---

## Test Results Summary

### Pass Rate: TBD
### Critical Issues: 0
### Warnings: 1 (Endpoint Registration)
### Total Test Cases: 50+

