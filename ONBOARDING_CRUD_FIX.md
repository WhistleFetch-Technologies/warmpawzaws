# Onboarding Form CRUD Fix - Complete

## Issue Summary
User reported that when deleting a field in the admin designer form, the field would reappear after saving draft or publishing. The CRUD operations were not properly implemented.

## Root Causes Identified

1. **No Delete Function**: The designer only had `toggleFieldActive` which set `isActive: false`, but no actual delete function to remove fields from the sections array.

2. **Save Endpoint Merging**: The save endpoint was merging with existing fields instead of replacing them, causing deleted fields to persist in the database.

3. **Fallback to Existing Sections**: The save endpoint was falling back to `existingOnboardingFields.sections` if `formConfig.sections` was empty, which could reintroduce deleted fields.

## Fixes Applied

### 1. Added Delete Field Function (Frontend)
**File**: `src/components/admin/onboarding/OnboardingDesigner.tsx`

**Changes**:
- Added `deleteField(sectionId: string, fieldId: string)` function that removes the field from the sections array
- Added delete button (Trash icon) next to each field in the designer
- Added confirmation dialog before deleting

**Key Code**:
```typescript
const deleteField = (sectionId: string, fieldId: string) => {
  if (!formConfig) return;
  
  const newSections = formConfig.sections.map(section => {
      if (section.id !== sectionId) return section;
      
      return {
          ...section,
          fields: section.fields.filter(field => field.id !== fieldId)
      };
  });
  
  setFormConfig({ ...formConfig, sections: newSections });
  setUnsavedChanges(true);
};
```

### 2. Fixed Save Endpoint to Replace Fields (Backend)
**File**: `supabase/functions/make-server-3dd53475/vendor-role-config.tsx`

**Changes**:
- Modified `POST /admin/role-config/save` to **replace** the entire fields array instead of merging
- Removed fallback to `existingOnboardingFields.sections` - now uses only `formConfig.sections`
- Ensures deleted fields (not in sections) are not saved to the database

**Key Code**:
```typescript
// ✅ FIX: Replace entire fields array (don't merge with existing)
// This ensures deleted fields are actually removed from the database
const updatedConfig = {
  ...existingConfig, // Preserve other config properties (vendorTypes, serviceStyles, etc.)
  onboardingFields: {
    ...existingOnboardingFields, // Preserve other onboardingFields properties
    fields: fieldsToSave, // ✅ REPLACE entire array - deleted fields won't be here
    sections: formConfig.sections || [], // ✅ Use only sections from formConfig (don't fallback to existing)
    documentSections: formConfig.documentSections || [], // ✅ Use only documentSections from formConfig
    version: formConfig.version || existingVersion + 1
  },
  updatedAt: new Date().toISOString()
};
```

### 3. Fetch Endpoint Already Correct
**File**: `supabase/functions/make-server-3dd53475/vendor-role-config.tsx`

**Status**:
- The fetch endpoint already rebuilds sections from `onboardingFields.fields` (source of truth)
- It filters out inactive fields (`if (field.isActive === false) return;`)
- Since deleted fields are not in the database, they won't appear when fetching

## How It Works Now

1. **Delete Field**:
   - User clicks delete button on a field
   - Confirmation dialog appears
   - Field is removed from `formConfig.sections` array
   - `unsavedChanges` flag is set to `true`

2. **Save Form**:
   - User clicks "Save Changes"
   - Frontend sends `formConfig` with sections (deleted fields are not in sections)
   - Backend extracts fields from sections
   - Backend **replaces** entire `onboardingFields.fields` array in database
   - Deleted fields are not saved (they're not in the sections)

3. **Fetch Form**:
   - Frontend fetches form from `/vendor/onboarding-form/:roleId`
   - Backend reads `onboardingFields.fields` from database
   - Backend rebuilds sections from fields
   - Deleted fields don't appear (they're not in the database)

## Testing

1. **Delete Field Test**:
   - Open admin designer
   - Select a role
   - Delete a field
   - Verify field disappears from UI
   - Save the form
   - Refresh the page
   - Verify deleted field does not reappear

2. **Toggle Active Test**:
   - Toggle a field to inactive (hidden)
   - Save the form
   - Verify field is saved with `isActive: false`
   - Fetch form - field should not appear (filtered out)
   - Toggle back to active
   - Save and verify field reappears

3. **Multiple Operations Test**:
   - Delete some fields
   - Toggle some fields to inactive
   - Edit some fields
   - Save the form
   - Verify all changes persist correctly

## Deployment

✅ **Deployed**: `make-server-3dd53475` function successfully deployed with fixes.

## Related Files

- `src/components/admin/onboarding/OnboardingDesigner.tsx` - Added delete function and button
- `supabase/functions/make-server-3dd53475/vendor-role-config.tsx` - Fixed save endpoint to replace fields

## Status

✅ **COMPLETE**: CRUD operations are now properly implemented. Deleted fields will not reappear after saving.

