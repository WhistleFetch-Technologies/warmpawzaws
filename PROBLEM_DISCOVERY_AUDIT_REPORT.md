# Problem-Driven Discovery Flow Audit Report

## Executive Summary
This audit validates the complete problem-driven discovery flow to ensure customers always see the right provider.

**Audit Date**: 2025-01-22  
**Status**: ⚠️ Issues Found - Fixes Required

---

## 1. Problem Grid → Service Discovery

### ✅ Working Components
- Problem grid catalog exists (`problem-grid-catalog.tsx`)
- Problem grid maps to subcategories via `mappedSubCategories`
- Subcategory mapping supports multiple name variations (`problem-subcategory-mapping.tsx`)
- Service matching logic exists (`serviceMatchesSubcategories`)

### ⚠️ Gaps Identified

#### Gap 1.1: Missing Problem Grid Validation
- **Issue**: No validation that all problem grids have mapped subcategories
- **Impact**: Some problems may return empty results
- **Location**: `universal-problem-discovery.tsx:114-123`
- **Severity**: HIGH

#### Gap 1.2: Incomplete Service Matching
- **Issue**: Service matching only checks `subCategoryName`, may miss services with category-only mapping
- **Impact**: Valid services may be excluded from results
- **Location**: `problem-subcategory-mapping.tsx:246-311`
- **Severity**: MEDIUM

#### Gap 1.3: No Problem Grid Index
- **Issue**: No search index for problem grid → service mappings
- **Impact**: Discovery queries are slower, no analytics on problem grid usage
- **Location**: `search-index-updater.tsx` (missing)
- **Severity**: MEDIUM

---

## 2. Service → Vendor Mapping

### ✅ Working Components
- Vendor service management exists (`vendor-service-management.tsx`)
- Service publishing logic exists with `publishStatus` and `isEnabled` flags
- Vendor status checking exists (approved, active)

### ⚠️ Gaps Identified

#### Gap 2.1: Inconsistent Vendor Status Validation
- **Issue**: Different endpoints check different status fields (`status`, `applicationStatus`, `isActive`)
- **Impact**: Some approved vendors may be excluded, or unapproved vendors may be included
- **Location**: Multiple files
  - `universal-problem-discovery.tsx:147-176` (checks `status === 'approved'` and `isActive`)
  - `enhanced-problem-discovery.tsx:169-170` (uses `filterVendorsByRole`)
  - `customer-services.tsx:28-31` (checks `applicationStatus === 'approved'`)
- **Severity**: CRITICAL

#### Gap 2.2: Missing Service Publication Validation
- **Issue**: Not all endpoints check both `publishStatus === 'published'` AND `isEnabled === true`
- **Impact**: Draft or disabled services may appear in discovery results
- **Location**: 
  - `universal-problem-discovery.tsx:211-224` (only checks `isActive`, not `publishStatus`)
  - `enhanced-problem-discovery.tsx:491-492` (checks both ✅)
- **Severity**: HIGH

#### Gap 2.3: No Vendor Service Index
- **Issue**: No search index for vendor → service mappings
- **Impact**: Service discovery queries require full vendor scan
- **Location**: `search-index-updater.tsx` (missing vendor-service index)
- **Severity**: MEDIUM

---

## 3. Staff Filtering (Capability + Availability + Distance)

### ✅ Working Components
- Staff capability checking via `staff.services` array
- Staff availability checking via `isActive` flag
- Distance calculation using Haversine formula
- Staff specialization matching exists

### ⚠️ Gaps Identified

#### Gap 3.1: Incomplete Capability Validation
- **Issue**: Staff filtering checks `isActive` on services but may not validate service publication status
- **Impact**: Staff with draft/disabled services may appear
- **Location**: 
  - `universal-problem-discovery.tsx:211-224` (only checks `s.isActive`, not publication status)
  - `universal-staff-problem-search.tsx:139` (only checks `s.isActive === true`)
- **Severity**: HIGH

#### Gap 3.2: Missing Schedule Availability Check
- **Issue**: Staff filtering checks `isActive` but doesn't check actual schedule availability
- **Impact**: Staff may appear as available even when they have no available slots
- **Location**: All staff discovery endpoints
- **Severity**: MEDIUM

#### Gap 3.3: Inconsistent Distance Filtering
- **Issue**: Distance filtering applied inconsistently across endpoints
- **Impact**: Some endpoints may show staff outside service radius
- **Location**: 
  - `staff-discovery-endpoints.tsx:153-184` (checks distance for `at_home` only ✅)
  - `enhanced-problem-discovery.tsx:215-225` (checks distance but may skip if `lat === 0`)
  - `universal-staff-problem-search.tsx:165-178` (checks distance ✅)
- **Severity**: MEDIUM

#### Gap 3.4: Missing Staff Availability Index
- **Issue**: No search index for staff availability (schedule + capability + distance)
- **Impact**: Real-time availability checks require full staff scan
- **Location**: `search-index-updater.tsx` (missing availability index)
- **Severity**: LOW

---

## 4. Search Index Structure

### ✅ Working Components
- Search index updater exists (`search-index-updater.tsx`)
- Indexes for staff, vendors, and services exist
- Index structure includes searchable text and metadata

### ⚠️ Gaps Identified

#### Gap 4.1: KV Store Instead of SQL
- **Issue**: Search indexes stored in KV store, not SQL schema
- **Impact**: No SQL queries for complex search, no full-text search capabilities
- **Location**: `search-index-updater.tsx` (all indexes use KV)
- **Severity**: HIGH (per user requirement: "No KV Store, Use SQL schema")

#### Gap 4.2: Missing Problem Grid Index
- **Issue**: No index for problem grid → subcategory → service mappings
- **Impact**: Problem grid queries require full catalog scan
- **Location**: Missing entirely
- **Severity**: MEDIUM

#### Gap 4.3: Missing Vendor-Service Index
- **Issue**: No index for vendor → published services mapping
- **Impact**: Service discovery requires full vendor scan
- **Location**: Missing entirely
- **Severity**: MEDIUM

#### Gap 4.4: Index Sync Issues
- **Issue**: Indexes may not be updated when services are published/unpublished
- **Impact**: Stale data in search results
- **Location**: `search-index-updater.tsx` (no automatic sync on service updates)
- **Severity**: HIGH

#### Gap 4.5: Missing Availability Index
- **Issue**: No index for staff availability (schedule + capability)
- **Impact**: Real-time availability requires full staff scan
- **Location**: Missing entirely
- **Severity**: LOW

---

## Summary of Issues

### Critical Issues (Must Fix)
1. **Gap 2.1**: Inconsistent vendor status validation
2. **Gap 4.1**: Search indexes in KV store instead of SQL

### High Priority Issues
1. **Gap 1.1**: Missing problem grid validation
2. **Gap 2.2**: Missing service publication validation
3. **Gap 3.1**: Incomplete capability validation
4. **Gap 4.4**: Index sync issues

### Medium Priority Issues
1. **Gap 1.2**: Incomplete service matching
2. **Gap 1.3**: No problem grid index
3. **Gap 2.3**: No vendor-service index
4. **Gap 3.2**: Missing schedule availability check
5. **Gap 3.3**: Inconsistent distance filtering
6. **Gap 4.2**: Missing problem grid index
7. **Gap 4.3**: Missing vendor-service index

### Low Priority Issues
1. **Gap 3.4**: Missing staff availability index
2. **Gap 4.5**: Missing availability index

---

## Required Fixes

### Fix 1: Standardize Vendor Status Validation
- Create centralized vendor validation function
- Ensure all endpoints use same status checks: `status === 'approved'` AND `isActive === true`

### Fix 2: Standardize Service Publication Validation
- Create centralized service validation function
- Ensure all endpoints check: `publishStatus === 'published'` AND `isEnabled === true`

### Fix 3: Migrate Search Indexes to SQL
- Create SQL tables for search indexes (per schema.sql:855-900)
- Update index updater to use SQL instead of KV
- Add full-text search capabilities

### Fix 4: Add Problem Grid Validation
- Validate all problem grids have mapped subcategories
- Return clear error if problem grid is invalid

### Fix 5: Enhance Service Matching
- Check both `subCategoryName` and `categoryName` in service matching
- Add fuzzy matching for edge cases

### Fix 6: Add Schedule Availability Check
- Integrate scheduling service to check actual slot availability
- Filter out staff with no available slots

### Fix 7: Standardize Distance Filtering
- Create centralized distance filtering function
- Apply consistently across all endpoints

### Fix 8: Add Missing Indexes
- Create problem grid index
- Create vendor-service index
- Create staff availability index

### Fix 9: Implement Index Sync
- Auto-update indexes when services are published/unpublished
- Auto-update indexes when vendors change status
- Auto-update indexes when staff availability changes

---

## Test Plan

### Test 1: Problem Grid Validation
- Test with valid problem grid → should return results
- Test with invalid problem grid → should return clear error
- Test with problem grid with no mapped subcategories → should return empty results with message

### Test 2: Service Publication Validation
- Test with published + enabled service → should appear
- Test with published + disabled service → should NOT appear
- Test with draft service → should NOT appear

### Test 3: Vendor Status Validation
- Test with approved + active vendor → should appear
- Test with approved + inactive vendor → should NOT appear
- Test with pending vendor → should NOT appear

### Test 4: Staff Capability Validation
- Test with staff having active published services → should appear
- Test with staff having only draft services → should NOT appear
- Test with staff having no services → should NOT appear

### Test 5: Distance Filtering
- Test with staff within radius → should appear
- Test with staff outside radius → should NOT appear
- Test with no location provided → should appear (no distance filter)

### Test 6: Search Index Sync
- Publish service → index should update
- Unpublish service → index should update
- Change vendor status → index should update

---

## Expected Outcome

After fixes:
- ✅ All problem grids validated
- ✅ All services properly mapped to vendors
- ✅ All staff filtered by capability + availability + distance
- ✅ All search indexes in SQL with proper sync
- ✅ Customer always sees the right provider

