# WarmPawz Development Guide

## Quick Start

### Testing the System
1. Open the application
2. Use the **App Switcher** (top-right corner) to switch between:
   - Customer App
   - Vendor App  
   - Admin Portal
3. Follow the complete testing guide: See `TESTING_GUIDE.md`

### First Time Setup Flow
1. **Create Admin Account** (Admin Portal)
   - Master Key: `warmpawz2025`
   
2. **Register Vendors** (Vendor Portal)
   - Complete 4-step registration
   
3. **Approve Vendors** (Admin Portal)
   - Review and approve/reject
   
4. **Register Customers** (Customer App)
   - Simple sign-up form

---

## Key Information to Remember

### Brand Colors
- **Primary:** `#FF8C42` (Orange) - Use for all CTAs and primary actions
- Keep this consistent across all three apps

### Master Key
- Default: `warmpawz2025`
- Required for admin account creation
- Stored in: `system:master_key` (KV store)

### User Roles
- `customer` - Pet owners
- `vendor` - Service providers
- `admin` - Platform administrators

### Vendor Status Flow
```
Registration → "pending" → Admin Review → "approved" or "rejected"
```

---

## How to Add New Features

### Adding a New Service Type

#### 1. Update Vendor Registration Form
File: `/components/vendor/VendorAuth.tsx`

```typescript
const serviceOptions = [
  'Pet Walking',
  'Grooming at Home',
  // ... existing services
  'YOUR NEW SERVICE', // Add here
];
```

#### 2. Update Customer Dashboard Icons
File: `/components/customer/CustomerDashboard.tsx`

```typescript
const services = [
  { icon: Dog, label: 'Pet Walker', color: '#FF8C42' },
  // ... existing services
  { icon: YourIcon, label: 'Your Service', color: '#COLOR' }, // Add here
];
```

---

### Adding Backend Endpoints

File: `/supabase/functions/server/index.tsx`

```typescript
// Example: Add new endpoint
app.post("/make-server-3dd53475/your-endpoint", async (c) => {
  try {
    // 1. Get auth token
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    
    // 2. Verify user
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
    if (!user || authError) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    
    // 3. Get request data
    const requestData = await c.req.json();
    
    // 4. Process logic
    // ... your logic here
    
    // 5. Return response
    return c.json({ success: true, data: result });
  } catch (error) {
    console.log('Error in your-endpoint:', error);
    return c.json({ error: String(error) }, 500);
  }
});
```

---

### Adding a New Page/Screen

#### 1. Create Component File
```typescript
// Example: /components/customer/Bookings.tsx
import { useState, useEffect } from 'react';
import { projectId } from '../../utils/supabase/info';

export function Bookings({ session }: { session: any }) {
  const [bookings, setBookings] = useState<any[]>([]);
  
  useEffect(() => {
    loadBookings();
  }, []);
  
  const loadBookings = async () => {
    const response = await fetch(
      `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/customer/bookings`,
      {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      }
    );
    
    if (response.ok) {
      const data = await response.json();
      setBookings(data.bookings);
    }
  };
  
  return (
    <div>
      {/* Your UI here */}
    </div>
  );
}
```

#### 2. Add Navigation
Update the parent component to include navigation to your new page.

---

### Working with KV Store

#### Save Data
```typescript
await kv.set('key', { 
  field1: 'value1',
  field2: 'value2'
});
```

#### Get Single Item
```typescript
const data = await kv.get('key');
```

#### Get Multiple Items
```typescript
const items = await kv.getByPrefix('prefix:');
// Returns array of all items with keys starting with 'prefix:'
```

#### Update Item
```typescript
const existing = await kv.get('key');
const updated = { ...existing, newField: 'value' };
await kv.set('key', updated);
```

#### Delete Item
```typescript
await kv.del('key');
```

---

## Common Patterns

### 1. Protected API Call
```typescript
const response = await fetch(
  `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/endpoint`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(data),
  }
);

if (!response.ok) {
  const error = await response.json();
  throw new Error(error.error);
}

const result = await response.json();
```

### 2. Form Submission with Loading State
```typescript
const [loading, setLoading] = useState(false);
const [error, setError] = useState('');

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setLoading(true);
  setError('');
  
  try {
    // API call here
    // ...
  } catch (err: any) {
    setError(err.message);
  } finally {
    setLoading(false);
  }
};
```

### 3. Toast Notifications
```typescript
import { toast } from 'sonner@2.0.3';

// Success
toast.success('Operation completed successfully');

// Error
toast.error('Something went wrong');

// Info
toast.info('Information message');
```

---

## Data Key Patterns

Use these consistent key patterns in KV store:

```
customer:{userId}                    - Customer profile
vendor:{userId}                      - Vendor profile
admin:{userId}                       - Admin profile
pet:{petId}                          - Pet details
booking:customer:{userId}:{bookingId} - Customer booking
booking:vendor:{vendorId}:{bookingId} - Vendor booking
admin:pending_vendors                - Array of pending vendor IDs
system:active_deals                  - Array of deals
system:master_key                    - Admin master key
```

---

## Styling Guidelines

### Use Orange Theme
```tsx
// Primary buttons
className="bg-[#FF8C42] hover:bg-[#FF7A2E]"

// Text highlights
className="text-[#FF8C42]"

// Backgrounds
className="bg-orange-50"
```

### Card Layouts
```tsx
<Card className="p-6">
  {/* Content */}
</Card>
```

### Status Badges
```tsx
// Approved
<Badge className="bg-green-100 text-green-700">approved</Badge>

// Pending
<Badge className="bg-yellow-100 text-yellow-700">pending</Badge>

// Rejected
<Badge className="bg-red-100 text-red-700">rejected</Badge>
```

---

## Debugging Tips

### 1. Check Browser Console
- All errors logged to console
- Backend logs include context

### 2. Network Tab
- Check request/response
- Verify Authorization header
- Check response status codes

### 3. Common Issues

**"Unauthorized" Error**
- Check if user is logged in
- Verify token is being passed
- Check if role matches endpoint requirements

**"Vendor not found"**
- User might not have vendor profile
- Check if vendor registration completed
- Verify vendor ID in KV store

**Data Not Updating**
- Check if API call succeeded
- Verify response status
- Refresh component or reload page

---

## Testing Checklist

### Before Adding New Feature
- [ ] Existing tests still pass
- [ ] No console errors
- [ ] UI matches design theme
- [ ] Mobile responsive (if applicable)
- [ ] Error handling implemented
- [ ] Loading states added
- [ ] Success feedback provided

### After Adding Feature
- [ ] Test happy path
- [ ] Test error cases
- [ ] Test with different user roles
- [ ] Check data persistence
- [ ] Verify cross-app data sync
- [ ] Check browser console for errors

---

## Architecture Reminders

### Frontend → Backend → Database

1. **Frontend Component** calls API
2. **Backend Endpoint** validates auth
3. **Business Logic** processes request
4. **KV Store** persists data
5. **Response** sent back to frontend
6. **UI Updates** with new data

### Keep Separation of Concerns
- **Frontend:** UI, forms, validation, display
- **Backend:** Auth, logic, data processing
- **Database:** Data persistence

---

## Next Features to Build

### Priority 1: Complete Booking Flow
1. Customer selects service and vendor
2. Choose pet from profile
3. Select date and time
4. Confirm booking
5. Vendor receives notification
6. Vendor accepts/rejects
7. Status updates in real-time

### Priority 2: Pet Profile Management
1. Add pet form with details
2. Upload pet photos
3. Edit pet information
4. Delete pet
5. Multiple pets per customer

### Priority 3: Vendor Service Management
1. Add/edit services
2. Set pricing per service
3. Configure service radius
4. Set availability schedule
5. Manage promotions

---

## File Organization Tips

### When Creating New Components
```
/components
  /customer          # Customer app components
  /vendor            # Vendor app components  
  /admin             # Admin app components
  /shared            # Shared across apps
  /ui                # Shadcn components (don't modify)
```

### When Adding New Utilities
```
/utils
  /supabase          # Supabase helpers
  /helpers           # General utilities
  /constants         # Constants and configs
```

---

## Security Checklist

- [ ] Never expose SUPABASE_SERVICE_ROLE_KEY in frontend
- [ ] Always validate auth token in backend
- [ ] Check user role before processing requests
- [ ] Sanitize user inputs
- [ ] Use parameterized queries
- [ ] Implement rate limiting (future)
- [ ] Add CSRF protection (future)

---

## Performance Tips

1. **Lazy Load Components**
   - Use React.lazy() for large components
   - Implement Suspense boundaries

2. **Optimize Re-renders**
   - Use memo() for expensive components
   - Implement proper dependency arrays in useEffect

3. **Minimize API Calls**
   - Cache frequently accessed data
   - Batch multiple operations
   - Implement pagination for lists

4. **Optimize Images**
   - Use next-gen formats (WebP)
   - Implement lazy loading
   - Compress before upload

---

## Code Quality Standards

### TypeScript
- Define interfaces for all data structures
- Avoid `any` type when possible
- Use proper type annotations

### Error Handling
```typescript
try {
  // Operation
} catch (error: any) {
  console.error('Context:', error);
  toast.error('User-friendly message');
}
```

### Comments
```typescript
// What it does (not how it does it)
const result = processData(input);
```

---

## Getting Help

### Documentation References
- `TESTING_GUIDE.md` - Complete testing instructions
- `SYSTEM_ARCHITECTURE.md` - Full architecture details
- `DEVELOPMENT_GUIDE.md` - This file

### Common Resources
- Supabase Docs: https://supabase.com/docs
- Hono Docs: https://hono.dev
- Tailwind CSS: https://tailwindcss.com
- Shadcn/ui: https://ui.shadcn.com

---

## Quick Commands

### Test All Three Apps
1. Switch to Admin → Create account → ✓
2. Switch to Vendor → Register → ✓
3. Switch to Admin → Approve vendor → ✓
4. Switch to Vendor → Login → ✓
5. Switch to Customer → Register → ✓

### Reset System (Development)
To reset all data, you would need to:
1. Clear KV store (requires backend script)
2. Delete Supabase Auth users
3. Refresh browser to clear local session

---

**Remember:** 
- Keep design pixel-perfect ✅
- Maintain orange theme (#FF8C42) ✅
- Test across all three apps ✅
- Document new features ✅
- Follow existing patterns ✅

Happy Coding! 🚀🐾
