# Vendor App - Dynamic Role Integration

## Problem
The Vendor App was still showing hardcoded roles (Pet Service Provider, Veterinarian, Pet Product Seller) instead of dynamically fetching roles from the new Platform Admin role configuration system.

## Solution
Updated the `VendorRoleSelection` component to fetch roles dynamically from the backend API.

## Changes Made

### 1. Updated `/components/vendor/VendorRoleSelection.tsx`

#### API Integration
- **Endpoint**: `GET /config/roles`
- **Filters**: Only active roles (`isActive: true`) are displayed
- **Fallback**: Hardcoded roles as backup if API fails

#### Role Data Structure
```typescript
interface Role {
  id: string;
  name: string;
  description: string;
  icon: string;
  features: string[];
  vendorTypes: string[];  // ['service_provider', 'healthcare_provider', 'seller']
  serviceStyles: string[];
  pricingControl: {...};
  capabilities: string[];
  order: number;
  isActive: boolean;
}
```

#### Dynamic Display Logic
1. **Category Derivation**: Uses first `vendorType` from the role config
2. **Color Mapping**: Maps vendor types to colors
   - `service_provider` → green
   - `healthcare_provider` → blue
   - `seller` → purple
   - `boarding` → orange
   - `training` → indigo
   - `photography` → pink
   - `pharmacy` → teal

3. **Icon Generation**: Dynamic SVG icons based on category
4. **Feature Badges**: Displays up to 3 features/capabilities per role

## How It Works

### Platform Admin Workflow
1. Admin creates/edits roles in **Platform Admin → Catalog & Services → Roles**
2. Roles are saved to KV store with key pattern: `role:config:{roleId}`
3. Roles can be activated/deactivated via the `isActive` flag

### Vendor App Workflow
1. New vendor opens Vendor App
2. VendorRoleSelection fetches active roles from `/config/roles`
3. Roles are displayed dynamically with proper colors, icons, and badges
4. Vendor selects a role → proceeds to onboarding

## Example Roles (from seed data)

### Vet
- **vendorTypes**: `['healthcare_provider']`
- **Color**: Blue
- **Icon**: Medical cross
- **Features**: Consultations, Prescriptions, Surgery

### Groomer  
- **vendorTypes**: `['service_provider']`
- **Color**: Green
- **Icon**: Star
- **Features**: Bath & dry, Haircut & styling, Nail trimming

### Pharmacy
- **vendorTypes**: `['seller']`
- **Color**: Purple (teal for pharmacy category)
- **Icon**: Shopping bag
- **Features**: Pet medicines, Pet food, Pet care products

### Clinic
- **vendorTypes**: `['healthcare_provider', 'service_provider', 'seller']`
- **Color**: Blue
- **Icon**: Medical cross
- **Features**: Multi-service support

## Benefits

✅ **Dynamic Configuration**: Platform admin controls all vendor roles without code changes
✅ **Consistent Branding**: Automatic color/icon mapping based on role category
✅ **Flexible Features**: Display role-specific features as badges
✅ **Backward Compatible**: Fallback to hardcoded roles if API fails
✅ **Mobile Optimized**: Maintains 430px max-width constraint
✅ **Loading States**: Shows spinner while fetching, error messages on failure

## Testing

1. **Go to Platform Admin** → Catalog & Services → Roles
2. **Seed default roles** if not already done
3. **Activate/deactivate roles** to see them appear/disappear in Vendor App
4. **Create new role** and it will automatically show in Vendor App
5. **Open Vendor App** → Should see all active roles from Platform Admin

## Next Steps

The role ID selected here (e.g., `vet`, `groomer`, `walker`) should be used throughout the vendor onboarding and dashboard to:
- Fetch role-specific onboarding fields
- Apply role-specific pricing controls
- Enable role-specific capabilities
- Determine multi-service support options
