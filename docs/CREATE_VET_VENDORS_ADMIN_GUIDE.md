# Create Vet Solo and Vet Clinic Vendors from Admin Side

This guide shows you **3 different methods** to create veterinarian (solo) and vet clinic vendors from the admin side.

---

## Prerequisites

1. ✅ Database migrations 001, 002, 003 are run
2. ✅ Migration 047 (seed roles) is run - this creates the `veterinarian` and `vet_clinic` roles
3. ✅ You have access to your local PostgreSQL database

---

## Method 1: Using Admin Web UI (Easiest)

### Steps:

1. **Open Admin Dashboard**
   - Navigate to your admin web application
   - Go to Vendors section
   - Click "Add Vendor" button

2. **Fill the Form**
   
   **For Vet Solo (Veterinarian):**
   - **Role**: Select "Veterinarian" from dropdown
   - **Vendor Type**: Select "Solo" 
   - **Business Name**: e.g., "Dr. John Pet Clinic"
   - **Owner Name**: e.g., "Dr. John Doe"
   - **Phone**: Unique phone number
   - **Email**: Valid email
   - **Address**: Complete address with city, state, pincode
   - **Other fields**: Fill as required

   **For Vet Clinic:**
   - **Role**: Select "Veterinary Clinic" from dropdown
   - **Vendor Type**: Select "Business"
   - **Business Name**: e.g., "Paws & Claws Veterinary Clinic"
   - **Owner Name**: e.g., "Dr. Jane Smith"
   - **Phone**: Unique phone number
   - **Email**: Valid email
   - **Address**: Complete address
   - **Other fields**: Fill as required

3. **Submit**
   - Click "Create Vendor"
   - Vendor will be created with status "pending" (can be approved later)

---

## Method 2: Using SQL Script (Direct Database)

### File: `scripts/create-vet-vendors-admin.sql`

**Steps:**

1. **Get Role IDs first:**
```sql
SELECT id, name, display_name 
FROM roles 
WHERE name IN ('veterinarian', 'vet_clinic');
```

2. **Run the SQL script:**
```bash
psql -U postgres -d warmpawz -f scripts/create-vet-vendors-admin.sql
```

**Or run manually in psql:**
```sql
-- Create Vet Solo
INSERT INTO vendors (
    phone, email, business_name, owner_name, role_id,
    category, vendor_type, address, city, state, pincode,
    status, tier, commission_percentage, is_active,
    created_at, updated_at, approved_at
) VALUES (
    '9876543210',
    'vet.solo@example.com',
    'Dr. John Pet Clinic',
    'Dr. John Doe',
    (SELECT id FROM roles WHERE name = 'veterinarian' LIMIT 1),
    'healthcare',
    'solo',  -- ✅ Important: solo for individual vet
    '123 Main Street',
    'Mumbai',
    'Maharashtra',
    '400001',
    'approved',
    'Bronze',
    15.00,
    true,
    NOW(),
    NOW(),
    NOW()
);

-- Create Vet Clinic
INSERT INTO vendors (
    phone, email, business_name, owner_name, role_id,
    category, vendor_type, address, city, state, pincode,
    status, tier, commission_percentage, is_active,
    created_at, updated_at, approved_at
) VALUES (
    '9876543211',
    'vet.clinic@example.com',
    'Paws & Claws Veterinary Clinic',
    'Dr. Jane Smith',
    (SELECT id FROM roles WHERE name = 'vet_clinic' LIMIT 1),
    'healthcare',
    'business',  -- ✅ Important: business for clinic
    '456 Park Avenue',
    'Delhi',
    'Delhi',
    '110001',
    'approved',
    'Silver',
    15.00,
    true,
    NOW(),
    NOW(),
    NOW()
);

-- Create vendor_identity records (for authentication)
INSERT INTO vendor_identity (phone, user_type, onboarding_status, vendor_id, selected_role_id, vendor_type, full_name, business_name, email)
SELECT 
    v.phone, 'vendor', 'ACTIVATED', v.id, v.role_id, v.vendor_type, v.owner_name, v.business_name, v.email
FROM vendors v
WHERE v.business_name IN ('Dr. John Pet Clinic', 'Paws & Claws Veterinary Clinic')
ON CONFLICT (phone) DO UPDATE SET
    vendor_id = EXCLUDED.vendor_id,
    selected_role_id = EXCLUDED.selected_role_id,
    vendor_type = EXCLUDED.vendor_type,
    onboarding_status = 'ACTIVATED';
```

---

## Method 3: Using Node.js API Script

### File: `scripts/create-vet-vendors-api.js`

**Steps:**

1. **Set environment variables:**
```bash
# Windows PowerShell
$env:DATABASE_URL="postgresql://postgres:password@localhost:5432/warmpawz"
$env:API_BASE_URL="http://localhost:3000"

# Mac/Linux
export DATABASE_URL="postgresql://postgres:password@localhost:5432/warmpawz"
export API_BASE_URL="http://localhost:3000"
```

2. **Run the script:**
```bash
node scripts/create-vet-vendors-api.js
```

**What it does:**
- Fetches role IDs from database
- Creates vendor via `/admin/vendors/create` API endpoint
- Handles both vet solo and vet clinic

---

## Key Differences: Vet Solo vs Vet Clinic

| Field | Vet Solo (Veterinarian) | Vet Clinic |
|-------|------------------------|------------|
| **Role Name** | `veterinarian` | `vet_clinic` |
| **Vendor Type** | `solo` | `business` |
| **Service Styles** | `at_center`, `at_home`, `tele` | `at_center` (primarily) |
| **Staff** | Usually none (individual) | Can have multiple staff |
| **Capacity** | 1 (individual) | Multiple (clinic capacity) |

---

## Required Fields for Vendor Creation

### Minimum Required:
- `phone` - Unique phone number
- `email` - Valid email address
- `business_name` - Business/clinic name
- `owner_name` - Owner/manager name
- `role_id` - UUID from roles table
- `vendor_type` - `'solo'` or `'business'`
- `address` - Street address
- `city` - City name
- `state` - State name
- `pincode` - Postal code

### Optional but Recommended:
- `alternate_phone` - Alternate contact
- `category` - `'healthcare'` for vets
- `status` - `'pending'`, `'approved'`, `'active'`
- `tier` - `'Bronze'`, `'Silver'`, `'Gold'`, `'Platinum'`
- `commission_percentage` - Default: 15.00
- `experience_years` - Years of experience
- `specialization` - Specializations
- `registration_number` - License/registration number
- `gst_number` - GST number (for clinics)
- `pan_number` - PAN card number
- `operating_hours` - e.g., "09:00-18:00"
- `capacity` - Number of pets/clients

---

## Verify Vendors Were Created

```sql
-- Check vendors
SELECT 
    v.id,
    v.business_name,
    v.phone,
    v.email,
    v.vendor_type,
    v.status,
    r.name as role_name,
    r.display_name as role_display_name
FROM vendors v
LEFT JOIN roles r ON v.role_id = r.id
WHERE r.name IN ('veterinarian', 'vet_clinic')
ORDER BY v.created_at DESC;

-- Check vendor_identity (for authentication)
SELECT 
    vi.phone,
    vi.user_type,
    vi.onboarding_status,
    vi.vendor_type,
    v.business_name
FROM vendor_identity vi
LEFT JOIN vendors v ON vi.vendor_id = v.id
WHERE v.business_name IN ('Dr. John Pet Clinic', 'Paws & Claws Veterinary Clinic');
```

---

## Next Steps After Creating Vendors

1. **Approve Vendors** (if status is 'pending'):
   ```sql
   UPDATE vendors 
   SET status = 'approved', approved_at = NOW() 
   WHERE business_name IN ('Dr. John Pet Clinic', 'Paws & Claws Veterinary Clinic');
   ```

2. **Add Services** - Create services for each vendor
3. **Add Staff** (for clinic) - Add staff members
4. **Set Schedule** - Configure availability
5. **Add Documents** - Upload required documents

---

## Troubleshooting

**Error: Role not found**
- Run migration 047: `psql -d warmpawz -f db/migrations/047_seed_roles.sql`

**Error: Phone already exists**
- Use a different phone number
- Or update existing vendor instead of creating new

**Error: Foreign key constraint**
- Make sure role_id exists in roles table
- Check that roles migration has been run

**Vendor not showing in admin dashboard**
- Check `vendor_identity` table has corresponding record
- Verify `onboarding_status` is set correctly
- Check `is_active` is `true`

---

## Files Created

1. `scripts/create-vet-vendors-admin.sql` - SQL script for direct database insertion
2. `scripts/create-vet-vendors-api.js` - Node.js script using API endpoint
3. This guide document
