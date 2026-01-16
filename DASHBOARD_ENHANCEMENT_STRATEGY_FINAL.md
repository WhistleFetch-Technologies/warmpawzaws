# Dashboard Enhancement Strategy - Final Plan

## Scope Analysis

After detailed analysis of `VendorCapabilityDashboard.tsx`:

### Current State:
- **17 sections** listed as "implemented" (but 11 use `SpecializedPlaceholder`)
- **~29 capabilities** show default "Coming soon..." placeholder
- **8 capabilities** have full pages but are NOT in dashboard list

### Total Placeholders: ~39

**Breakdown:**
1. **11 specialized placeholders** (using `SpecializedPlaceholder` component)
2. **1 schedule placeholder** (custom placeholder, not SpecializedPlaceholder)
3. **8 capabilities with pages** but missing from dashboard (prescriptions, medical_records, vaccination, pricing, reviews, analytics, reports)
4. **~19 other capabilities** showing default placeholder

## Implementation Strategy

Given the large scope, I'll implement in phases:

### Phase 1: Add Sections for Capabilities with Full Pages (8 sections) ✅ HIGH PRIORITY
These already have full pages, just need dashboard sections:
- `prescriptions` → Link to `/medical/prescriptions` with summary
- `medical_records` → Link to `/medical/records` with summary
- `vaccination` → Link to `/medical/vaccination` with summary
- `diagnostics` → Replace placeholder, link to `/services/tests` with summary
- `pricing` → Link to `/services/pricing` with summary
- `reviews` → Link to `/operations/reviews` with summary
- `analytics` → Link to `/operations/analytics` with summary
- `reports` → Link to `/operations/reports` with summary

### Phase 2: Replace Specialized Placeholders (11 sections)
Replace `SpecializedPlaceholder` with functional components:
- Load data summaries from APIs
- Display key metrics
- Link to management pages
- Show "View All" or "Manage" buttons

### Phase 3: Enhance Existing Placeholder
- Improve `ScheduleSection` to be fully functional

### Phase 4: Add Default Sections (Remaining capabilities)
Create functional sections for capabilities not in the list.

## Recommendation

**Start with Phase 1** since:
1. Full pages already exist
2. APIs are available
3. High user value
4. Quick to implement (link to existing pages)

Then proceed with Phase 2 for specialized placeholders.
