# Vendor Onboarding - Next Steps Implementation Guide

## 🎯 Immediate Actions Required

### Step 1: Run Database Migrations ✅

```bash
# Navigate to db directory
cd db

# Install dependencies (if not already done)
npm install

# Set database URL (use your dev database)
export DATABASE_URL="postgresql://user:password@host:port/database"
# OR use the manual migration script
./scripts/manual-migrate.sh dev

# Run migrations
npm run migrate:up

# Verify migration
npm run migrate:status
```

**Expected Output:**
- ✅ `vendor_identity` table created
- ✅ `vendor_onboarding_applications` table created
- ✅ `vendor_onboarding_transitions` table created
- ✅ `vendor_setup_completion` table created
- ✅ State machine functions created

**Verify:**
```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_name IN (
  'vendor_identity',
  'vendor_onboarding_applications',
  'vendor_onboarding_transitions',
  'vendor_setup_completion'
);

-- Check functions exist
SELECT routine_name FROM information_schema.routines
WHERE routine_name IN (
  'validate_onboarding_transition',
  'transition_onboarding_status',
  'get_onboarding_form_schema',
  'is_vendor_go_live_ready'
);
```

---

### Step 2: Seed Role Configurations ✅

```bash
# Run role config seed migration
cd db
npm run migrate:up  # This will run migration 050

# OR manually run
psql $DATABASE_URL -f db/migrations/050_seed_onboarding_role_configs.sql
```

**Verify:**
```sql
-- Check role configs have onboardingFormSchema
SELECT 
  name,
  display_name,
  config->'onboardingFormSchema'->'solo' IS NOT NULL as has_solo_form,
  config->'onboardingFormSchema'->'business' IS NOT NULL as has_business_form
FROM roles
WHERE is_active = true;
```

---

### Step 3: Test API Endpoints 🧪

```bash
# Test onboarding status endpoint
curl -X GET "https://dev.api.warmpawz.com/vendor/onboarding/status?phone=+919876543210" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Test get roles
curl -X GET "https://dev.api.warmpawz.com/vendor/onboarding/roles" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Test select role
curl -X POST "https://dev.api.warmpawz.com/vendor/onboarding/select-role" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "phone": "+919876543210",
    "role_id": "ROLE_UUID_HERE"
  }'
```

---

### Step 4: Create Frontend Route Components 🎨

Create the following files in `apps/vendor-web/app/onboarding/`:

#### 4.1 Role Selection Page

**File:** `apps/vendor-web/app/onboarding/role-selection/page.tsx`

```typescript
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';

interface Role {
  id: string;
  name: string;
  display_name: string;
  description: string;
  vendor_types_supported: string[];
  capabilities: string[];
}

export default function RoleSelectionPage() {
  const router = useRouter();
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadRoles();
  }, []);

  const loadRoles = async () => {
    try {
      const response = await apiClient.get('/vendor/onboarding/roles');
      if (response.success) {
        setRoles(response.roles || []);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load roles');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectRole = async (roleId: string) => {
    try {
      const phone = localStorage.getItem('vendorPhone'); // Get from auth context
      const response = await apiClient.post('/vendor/onboarding/select-role', {
        phone,
        role_id: roleId,
      });

      if (response.success) {
        router.push(response.nextStep || '/onboarding/vendor-type');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to select role');
    }
  };

  if (loading) return <div>Loading roles...</div>;
  if (error) return <div className="text-red-500">{error}</div>;

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Choose Your Role</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {roles.map((role) => (
          <div
            key={role.id}
            className="border rounded-lg p-6 cursor-pointer hover:shadow-lg transition"
            onClick={() => handleSelectRole(role.id)}
          >
            <h2 className="text-xl font-semibold mb-2">{role.display_name}</h2>
            <p className="text-gray-600 mb-4">{role.description}</p>
            <div className="text-sm text-gray-500">
              Supports: {role.vendor_types_supported.join(', ')}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

#### 4.2 Vendor Type Selection Page

**File:** `apps/vendor-web/app/onboarding/vendor-type/page.tsx`

```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';

export default function VendorTypePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSelectType = async (vendorType: 'solo' | 'business') => {
    try {
      setLoading(true);
      const phone = localStorage.getItem('vendorPhone');
      const response = await apiClient.post('/vendor/onboarding/select-vendor-type', {
        phone,
        vendor_type: vendorType,
      });

      if (response.success) {
        router.push(response.nextStep || '/onboarding/form');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to select vendor type');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Choose Your Business Type</h1>
      {error && <div className="text-red-500 mb-4">{error}</div>}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <button
          onClick={() => handleSelectType('solo')}
          disabled={loading}
          className="border-2 border-orange-500 rounded-lg p-8 hover:bg-orange-50 transition disabled:opacity-50"
        >
          <h2 className="text-xl font-semibold mb-2">Solo Practitioner</h2>
          <p className="text-gray-600">
            Individual service provider working independently
          </p>
        </button>

        <button
          onClick={() => handleSelectType('business')}
          disabled={loading}
          className="border-2 border-orange-500 rounded-lg p-8 hover:bg-orange-50 transition disabled:opacity-50"
        >
          <h2 className="text-xl font-semibold mb-2">Business/Company</h2>
          <p className="text-gray-600">
            Registered business with multiple staff members
          </p>
        </button>
      </div>
    </div>
  );
}
```

#### 4.3 Dynamic Form Page (Simplified - Full implementation needed)

**File:** `apps/vendor-web/app/onboarding/form/page.tsx`

```typescript
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { DynamicFormRenderer } from '@/components/onboarding/DynamicFormRenderer';

interface FormField {
  name: string;
  label: string;
  type: string;
  required: boolean;
  validation?: any;
  options?: string[];
}

export default function OnboardingFormPage() {
  const router = useRouter();
  const [schema, setSchema] = useState<any>(null);
  const [formData, setFormData] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadFormSchema();
  }, []);

  const loadFormSchema = async () => {
    try {
      const phone = localStorage.getItem('vendorPhone');
      const response = await apiClient.get(`/vendor/onboarding/form-schema?phone=${phone}`);
      
      if (response.success) {
        setSchema(response.schema);
        // Load existing application data if available
        if (response.existingApplication) {
          setFormData(response.existingApplication.application_payload || {});
        }
      }
    } catch (err: any) {
      console.error('Failed to load form schema:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (data: any) => {
    try {
      setSubmitting(true);
      const phone = localStorage.getItem('vendorPhone');
      const response = await apiClient.post('/vendor/onboarding/submit-application', {
        phone,
        application_payload: data,
        uploaded_documents: [], // Handle file uploads separately
      });

      if (response.success) {
        router.push(response.nextStep || '/onboarding/pending-review');
      }
    } catch (err: any) {
      console.error('Failed to submit application:', err);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div>Loading form...</div>;
  if (!schema) return <div>Form schema not found</div>;

  return (
    <div className="container mx-auto p-6 max-w-3xl">
      <h1 className="text-2xl font-bold mb-6">Complete Your Application</h1>
      <DynamicFormRenderer
        schema={schema}
        initialData={formData}
        onSubmit={handleSubmit}
        submitting={submitting}
      />
    </div>
  );
}
```

---

### Step 5: Create Dynamic Form Renderer Component 🧩

**File:** `apps/vendor-web/components/onboarding/DynamicFormRenderer.tsx`

```typescript
'use client';

import { useState, useEffect } from 'react';

interface FormField {
  name: string;
  label: string;
  type: 'text' | 'email' | 'tel' | 'number' | 'select' | 'multiselect' | 'file';
  required: boolean;
  validation?: {
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    min?: number;
    max?: number;
  };
  options?: string[];
  accept?: string[];
  maxSize?: number;
  conditional?: {
    showIf: Record<string, any>;
  };
}

interface DynamicFormRendererProps {
  schema: {
    version: string;
    fields: FormField[];
  };
  initialData?: any;
  onSubmit: (data: any) => void;
  submitting?: boolean;
}

export function DynamicFormRenderer({
  schema,
  initialData = {},
  onSubmit,
  submitting = false,
}: DynamicFormRendererProps) {
  const [formData, setFormData] = useState<any>(initialData);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (name: string, value: any) => {
    setFormData((prev: any) => ({
      ...prev,
      [name]: value,
    }));
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const validateField = (field: FormField, value: any): string | null => {
    if (field.required && (!value || value === '')) {
      return `${field.label} is required`;
    }

    if (!value && !field.required) return null;

    if (field.validation) {
      if (field.validation.minLength && value.length < field.validation.minLength) {
        return `${field.label} must be at least ${field.validation.minLength} characters`;
      }
      if (field.validation.maxLength && value.length > field.validation.maxLength) {
        return `${field.label} must be at most ${field.validation.maxLength} characters`;
      }
      if (field.validation.pattern) {
        const regex = new RegExp(field.validation.pattern);
        if (!regex.test(value)) {
          return `${field.label} format is invalid`;
        }
      }
      if (field.validation.min !== undefined && Number(value) < field.validation.min) {
        return `${field.label} must be at least ${field.validation.min}`;
      }
      if (field.validation.max !== undefined && Number(value) > field.validation.max) {
        return `${field.label} must be at most ${field.validation.max}`;
      }
    }

    return null;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    schema.fields.forEach((field) => {
      // Check conditional visibility
      if (field.conditional) {
        const shouldShow = Object.entries(field.conditional.showIf).every(
          ([key, val]) => formData[key] === val
        );
        if (!shouldShow) return;
      }

      const error = validateField(field, formData[field.name]);
      if (error) {
        newErrors[field.name] = error;
      }
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onSubmit(formData);
  };

  const renderField = (field: FormField) => {
    // Check conditional visibility
    if (field.conditional) {
      const shouldShow = Object.entries(field.conditional.showIf).every(
        ([key, val]) => formData[key] === val
      );
      if (!shouldShow) return null;
    }

    const value = formData[field.name] || '';
    const error = errors[field.name];

    switch (field.type) {
      case 'text':
      case 'email':
      case 'tel':
        return (
          <div key={field.name} className="mb-4">
            <label className="block text-sm font-medium mb-1">
              {field.label} {field.required && <span className="text-red-500">*</span>}
            </label>
            <input
              type={field.type}
              value={value}
              onChange={(e) => handleChange(field.name, e.target.value)}
              className={`w-full px-3 py-2 border rounded ${
                error ? 'border-red-500' : 'border-gray-300'
              }`}
              required={field.required}
            />
            {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
          </div>
        );

      case 'number':
        return (
          <div key={field.name} className="mb-4">
            <label className="block text-sm font-medium mb-1">
              {field.label} {field.required && <span className="text-red-500">*</span>}
            </label>
            <input
              type="number"
              value={value}
              onChange={(e) => handleChange(field.name, Number(e.target.value))}
              min={field.validation?.min}
              max={field.validation?.max}
              className={`w-full px-3 py-2 border rounded ${
                error ? 'border-red-500' : 'border-gray-300'
              }`}
              required={field.required}
            />
            {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
          </div>
        );

      case 'select':
        return (
          <div key={field.name} className="mb-4">
            <label className="block text-sm font-medium mb-1">
              {field.label} {field.required && <span className="text-red-500">*</span>}
            </label>
            <select
              value={value}
              onChange={(e) => handleChange(field.name, e.target.value)}
              className={`w-full px-3 py-2 border rounded ${
                error ? 'border-red-500' : 'border-gray-300'
              }`}
              required={field.required}
            >
              <option value="">Select...</option>
              {field.options?.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
            {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
          </div>
        );

      case 'multiselect':
        return (
          <div key={field.name} className="mb-4">
            <label className="block text-sm font-medium mb-1">
              {field.label} {field.required && <span className="text-red-500">*</span>}
            </label>
            <select
              multiple
              value={Array.isArray(value) ? value : []}
              onChange={(e) => {
                const selected = Array.from(e.target.selectedOptions, (opt) => opt.value);
                handleChange(field.name, selected);
              }}
              className={`w-full px-3 py-2 border rounded ${
                error ? 'border-red-500' : 'border-gray-300'
              }`}
              required={field.required}
            >
              {field.options?.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
            {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
          </div>
        );

      case 'file':
        return (
          <div key={field.name} className="mb-4">
            <label className="block text-sm font-medium mb-1">
              {field.label} {field.required && <span className="text-red-500">*</span>}
            </label>
            <input
              type="file"
              accept={field.accept?.join(',')}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  if (field.maxSize && file.size > field.maxSize) {
                    setErrors((prev) => ({
                      ...prev,
                      [field.name]: `File size must be less than ${field.maxSize / 1024 / 1024}MB`,
                    }));
                    return;
                  }
                  // TODO: Upload file to S3 and get URL
                  handleChange(field.name, file.name); // Placeholder
                }
              }}
              className={`w-full px-3 py-2 border rounded ${
                error ? 'border-red-500' : 'border-gray-300'
              }`}
              required={field.required}
            />
            {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {schema.fields.map(renderField)}
      <button
        type="submit"
        disabled={submitting}
        className="w-full bg-orange-500 text-white py-2 px-4 rounded hover:bg-orange-600 disabled:opacity-50"
      >
        {submitting ? 'Submitting...' : 'Submit Application'}
      </button>
    </form>
  );
}
```

---

### Step 6: Implement State Recovery on Refresh 🔄

**File:** `apps/vendor-web/app/onboarding/layout.tsx`

```typescript
'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { getRouteForStatus, isRouteAllowed } from '../route-map';

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Recover state on page load
    const recoverState = async () => {
      try {
        const phone = localStorage.getItem('vendorPhone');
        if (!phone) {
          router.push('/auth/otp');
          return;
        }

        const response = await apiClient.get(`/vendor/onboarding/status?phone=${phone}`);
        
        if (response.success && response.identity) {
          const status = response.identity.onboarding_status;
          
          // Check if current route is allowed for this status
          if (!isRouteAllowed(pathname, status)) {
            // Redirect to correct route
            const correctRoute = getRouteForStatus(status);
            router.push(correctRoute);
          }
        }
      } catch (error) {
        console.error('Failed to recover state:', error);
      }
    };

    recoverState();
  }, [pathname, router]);

  return <>{children}</>;
}
```

---

### Step 7: Create Admin Review Interface 👨‍💼

**File:** `apps/admin-web/app/vendors/onboarding/page.tsx`

```typescript
'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';

interface Application {
  id: string;
  vendor_identity_id: string;
  role_id: string;
  vendor_type: string;
  application_payload: any;
  status: string;
  admin_comments?: string;
  rejection_reason?: string;
  created_at: string;
}

export default function VendorOnboardingReviewPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);

  useEffect(() => {
    loadPendingApplications();
  }, []);

  const loadPendingApplications = async () => {
    // TODO: Create endpoint to list pending applications
    // For now, this is a placeholder
    setLoading(false);
  };

  const handleReview = async (
    applicationId: string,
    action: 'APPROVE' | 'REQUEST_CLARIFICATION' | 'REJECT',
    comments?: string,
    rejectionReason?: string
  ) => {
    try {
      const adminId = localStorage.getItem('adminId'); // Get from auth
      const response = await apiClient.post(
        `/admin/vendor/onboarding/${applicationId}/review`,
        {
          action,
          admin_id: adminId,
          comments,
          rejection_reason: rejectionReason,
        }
      );

      if (response.success) {
        // Reload applications
        loadPendingApplications();
        setSelectedApp(null);
      }
    } catch (error) {
      console.error('Failed to review application:', error);
    }
  };

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Vendor Onboarding Review</h1>
      
      {/* List of pending applications */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {applications.map((app) => (
          <div
            key={app.id}
            className="border rounded-lg p-4 cursor-pointer hover:shadow-lg"
            onClick={() => setSelectedApp(app)}
          >
            <h3 className="font-semibold">Application #{app.id.slice(0, 8)}</h3>
            <p className="text-sm text-gray-600">Status: {app.status}</p>
            <p className="text-sm text-gray-600">Type: {app.vendor_type}</p>
          </div>
        ))}
      </div>

      {/* Review Modal */}
      {selectedApp && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Review Application</h2>
            
            {/* Display form data */}
            <div className="mb-4">
              <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
                {JSON.stringify(selectedApp.application_payload, null, 2)}
              </pre>
            </div>

            {/* Action buttons */}
            <div className="flex gap-4">
              <button
                onClick={() => handleReview(selectedApp.id, 'APPROVE', 'Looks good!')}
                className="bg-green-500 text-white px-4 py-2 rounded"
              >
                Approve
              </button>
              <button
                onClick={() => {
                  const comments = prompt('Enter clarification request:');
                  if (comments) {
                    handleReview(selectedApp.id, 'REQUEST_CLARIFICATION', comments);
                  }
                }}
                className="bg-yellow-500 text-white px-4 py-2 rounded"
              >
                Request Clarification
              </button>
              <button
                onClick={() => {
                  const reason = prompt('Enter rejection reason:');
                  if (reason) {
                    handleReview(selectedApp.id, 'REJECT', undefined, reason);
                  }
                }}
                className="bg-red-500 text-white px-4 py-2 rounded"
              >
                Reject
              </button>
              <button
                onClick={() => setSelectedApp(null)}
                className="bg-gray-500 text-white px-4 py-2 rounded"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

---

## 📋 Testing Checklist

- [ ] Run migrations successfully
- [ ] Verify tables created
- [ ] Verify functions created
- [ ] Test API endpoints with Postman/curl
- [ ] Test role selection flow
- [ ] Test vendor type selection
- [ ] Test form submission
- [ ] Test admin review actions
- [ ] Test state recovery on refresh
- [ ] Test rejection → restart flow
- [ ] Test clarification → resubmit flow

---

## 🚀 Deployment Order

1. **Database:** Run migrations first
2. **Backend:** API endpoints already registered
3. **Frontend:** Deploy route components
4. **Admin:** Deploy review interface

---

## 📞 Need Help?

- **Database Issues:** Check `vendor_onboarding_transitions` for audit trail
- **API Issues:** Check Lambda logs in CloudWatch
- **Frontend Issues:** Check browser console and network tab
- **State Issues:** Call `GET /vendor/onboarding/status` to debug

---

**Status:** Ready for implementation! 🎉

