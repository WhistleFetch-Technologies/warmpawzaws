# Vendor Onboarding Lifecycle - Issue Log

## Phase 0: Pre-flight Validation

### 0.1 Repository Structure Check
- [x] Admin UI directory exists: `/Admin UI/`
- [x] Customer + Vendor UI directory exists: `/Warmpawz Ecosystem Development/`
- [x] Backend Lambda handlers registered in `backend/lambda/src/handler/index.ts`
- [ ] **ISSUE**: Need to verify all required DB tables exist

### Database Schema Validation
- [x] `roles` table exists (found in schema.sql)
- [x] `role_permissions` table exists (capabilities stored here, not role_capabilities)
- [x] `vendor_onboarding_applications` table exists (found in migration 049)
- [x] `vendors` table exists (found in schema.sql)
- [x] `vendor_bank_details` table exists (found in schema.sql and migration 011)
- [x] `staff` table exists (found in schema.sql)
- [x] `services` table exists (found in schema.sql)
- [x] `service_catalog` table exists (found in migration 019)
- [x] `staff_services` table exists (found in schema.sql)
- [x] `staff_schedules` table exists (found in schema.sql)
- [x] `vendor_identity` table exists (found in migration 049)
- [x] `otp_tokens` table exists (found in migration 011)

## Phase 1: Configuration & Data Readiness

### 1.1 Roles & Capabilities
- [ ] **PENDING**: Validate roles exist in DB
- [ ] **PENDING**: Validate capabilities mapped per role
- [ ] **PENDING**: Seed roles if missing
- [ ] **PENDING**: Seed role_capabilities if missing

### 1.2 Service Catalog
- [ ] **PENDING**: Validate service catalog entries exist
- [ ] **PENDING**: Validate service styles configured
- [ ] **PENDING**: Seed catalog entries if missing

### 1.3 Vendor Onboarding Form Schemas
- [ ] **PENDING**: Validate dynamic designer forms exist per role
- [ ] **PENDING**: Seed form schemas if missing

## Phase 2: Vendor Onboarding Flow

### 2.1 OTP Authentication
- [ ] **PENDING**: Test OTP flow

### 2.2 Dynamic Role Selection
- [ ] **PENDING**: Test role fetching and UI rendering

### 2.3 Solo vs Business Selection
- [ ] **PENDING**: Test solo/business logic

### 2.4 Dynamic Form Load
- [ ] **PENDING**: Test form schema loading

### 2.5 Submit Application
- [ ] **PENDING**: Test application submission

## Phase 3: Admin Governance

### 3.1 Review Application
- [ ] **PENDING**: Test admin review flow

### 3.2 Admin Decisions
- [ ] **PENDING**: Test Request Clarification path
- [ ] **PENDING**: Test Reject path
- [ ] **PENDING**: Test Approve path

## Phase 4: Post-Approval Vendor Activation

### 4.1 Dashboard Load
- [ ] **PENDING**: Test dynamic capabilities loading

### 4.2 Profile Completion
- [ ] **PENDING**: Test profile update

### 4.3 Timing & Availability
- [ ] **PENDING**: Test schedule setup

### 4.4 Bank Account Setup
- [ ] **PENDING**: Test bank account creation

### 4.5 Staff Management
- [ ] **PENDING**: Test staff management if applicable

## Phase 5: Service Configuration

### 5.1 Service Management
- [ ] **PENDING**: Test service loading and configuration

### 5.2 Custom Services & Packages
- [ ] **PENDING**: Test custom service creation

### 5.3 Go-Live
- [ ] **PENDING**: Test go-live flow

## Phase 6: Customer Sync Validation

### 6.1 Service Visibility
- [ ] **PENDING**: Test services appear in customer app

## Phase 7: Issue Management

### Issues Found
- None yet

### Issues Fixed
- None yet
