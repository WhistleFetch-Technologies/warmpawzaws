# Debug Overlay Integration Guide

## 📍 Current Status

✅ **Component Created:** `/components/admin/DebugOverlay.tsx`  
❌ **Not Integrated:** Needs to be added to VendorDashboard/VendorApp

---

## 🚀 Quick Integration (5 Minutes)

### **Step 1: Add to Vendor Dashboard**

**File:** Your vendor dashboard component (e.g., `src/components/vendor/VendorDashboard.tsx`)

```tsx
import { DebugOverlay } from '../admin/DebugOverlay';

function VendorDashboard() {
  // Your existing code...
  const { vendorData } = useVendorData();
  const { roleConfiguration } = useVendorCapabilities();
  const { currentUser } = useAuth();
  
  return (
    <div>
      {/* Your existing dashboard UI */}
      
      {/* ✅ ADD THIS AT THE END */}
      <DebugOverlay 
        vendorData={vendorData}
        roleConfiguration={roleConfiguration}
        currentUser={currentUser}
      />
    </div>
  );
}
```

---

### **Step 2: Verify Data Props**

Make sure your component has access to:

```tsx
// ✅ vendorData should include:
{
  id: string,
  businessName: string,
  fullName: string,
  roleId: string,
  centres: Array<{
    id: string,
    name: string,
    address: string,
    maxConcurrentBookings: number,
    location: { latitude: number, longitude: number }
  }>,
  staff: Array<{
    id: string,
    fullName: string,
    email: string,
    role: string,
    specializations: string[]
  }>,
  publishedServices: Array<{
    id: string,
    name: string,
    serviceStyle: string,
    category: string,
    basePrice: number,
    publishLevel: string,
    gpsRequired: boolean
  }>
}

// ✅ roleConfiguration should include:
{
  roleId: string,
  roleName: string,
  vendorTypes: string[],
  serviceStyles: string[],
  centreManagementEnabled: boolean,
  staffManagementEnabled: boolean,
  customPackagesEnabled: boolean
}

// ✅ currentUser should include:
{
  id: string,
  email: string,
  role: string  // 'admin' | 'vendor' | 'customer'
}
```

---

### **Step 3: Test Access Methods**

#### **Method 1: Keyboard Shortcut**
1. Open your vendor dashboard in the browser
2. Press `Ctrl + Shift + D` (or `Cmd + Shift + D` on Mac)
3. Overlay should appear from the right side

#### **Method 2: Bug Button**
1. Look for the purple floating button (🐛) in the bottom-right corner
2. Click it to toggle the overlay

---

## 🔧 Troubleshooting

### **Issue 1: Component Not Showing**

**Check visibility logic:**
```tsx
// Component only shows if:
const isDev = import.meta.env.DEV || currentUser?.role === 'admin';

// Solutions:
// 1. Run in development mode (npm run dev)
// 2. Set currentUser.role = 'admin'
// 3. Force visibility for testing:
const isDev = true; // Temporarily
```

---

### **Issue 2: Data Not Loading**

**Check props:**
```tsx
// Add console logs to verify data:
console.log('vendorData:', vendorData);
console.log('roleConfiguration:', roleConfiguration);
console.log('currentUser:', currentUser);

// If data is undefined, make sure:
// 1. useVendorData() hook is called
// 2. useVendorCapabilities() hook is called
// 3. useAuth() hook provides currentUser
```

---

### **Issue 3: Import Errors**

**Check import paths:**
```tsx
// Adjust relative path based on your file structure:
import { DebugOverlay } from '../admin/DebugOverlay';
// or
import { DebugOverlay } from '../../components/admin/DebugOverlay';
// or
import { DebugOverlay } from '@/components/admin/DebugOverlay';
```

---

### **Issue 4: Missing UI Components**

**Check if you have shadcn/ui components:**
```bash
# Install missing components if needed:
npx shadcn-ui@latest add button
npx shadcn-ui@latest add card
npx shadcn-ui@latest add badge
```

**Or create simple versions:**
```tsx
// In DebugOverlay.tsx, replace imports:
// import { Button } from '../ui/button';
// import { Card } from '../ui/card';
// import { Badge } from '../ui/badge';

// With simple HTML elements:
const Button = ({ children, ...props }: any) => (
  <button {...props} className={`px-4 py-2 bg-blue-600 text-white rounded ${props.className}`}>
    {children}
  </button>
);

const Card = ({ children, ...props }: any) => (
  <div {...props} className={`border rounded-lg ${props.className}`}>
    {children}
  </div>
);

const Badge = ({ children, ...props }: any) => (
  <span {...props} className={`px-2 py-1 text-xs rounded ${props.className}`}>
    {children}
  </span>
);
```

---

## 📋 Field Mapping

If your data structure uses different field names, map them:

```tsx
// In your vendor dashboard:
const debugVendorData = {
  id: vendorData.id,
  businessName: vendorData.businessName || vendorData.name,
  fullName: vendorData.fullName || vendorData.name,
  roleId: vendorData.roleId,
  centres: vendorData.facilities?.map(f => ({
    id: f.id,
    name: f.name,
    address: f.address,
    maxConcurrentBookings: f.maxConcurrent || f.maxConcurrentBookings,
    location: {
      latitude: f.coordinates?.lat || f.latitude,
      longitude: f.coordinates?.lng || f.longitude
    }
  })),
  staff: vendorData.staffMembers?.map(s => ({
    id: s.id,
    fullName: s.name || s.fullName,
    email: s.email,
    role: s.role || s.position,
    specializations: s.specializations || s.skills || []
  })),
  publishedServices: vendorData.services?.map(svc => ({
    id: svc.id,
    name: svc.serviceName || svc.name,
    serviceStyle: svc.style || svc.serviceStyle,
    category: svc.category || svc.categoryName,
    basePrice: svc.price || svc.basePrice,
    publishLevel: svc.publishStatus === 'centre' ? 'centre' : 'vendor',
    gpsRequired: svc.gpsTracking?.enabled || false
  }))
};

<DebugOverlay 
  vendorData={debugVendorData}
  roleConfiguration={roleConfiguration}
  currentUser={currentUser}
/>
```

---

## ✅ Verification Checklist

After integration, verify:

### **Access**
- [ ] Press Ctrl+Shift+D → Overlay appears
- [ ] Purple bug button (🐛) visible in bottom-right
- [ ] Click bug button → Overlay toggles
- [ ] Press Ctrl+Shift+D again → Overlay disappears
- [ ] Click X button → Overlay closes

### **Visibility**
- [ ] Overlay shows in development mode
- [ ] Overlay shows for admin users in production
- [ ] Overlay hidden for regular users in production

### **Quick Info Section**
- [ ] Vendor ID displayed
- [ ] Business Name displayed
- [ ] Role ID displayed
- [ ] Copy buttons work (toast notification appears)

### **Role Configuration Section**
- [ ] Role Name displayed
- [ ] Vendor Types shown as badges
- [ ] Service Styles shown as badges
- [ ] Centre Management status shown
- [ ] Staff Management status shown
- [ ] Copy Full JSON button works

### **Resolved Capabilities Section**
- [ ] All 6 capabilities listed
- [ ] Green checkmark for enabled capabilities
- [ ] Red X for disabled capabilities
- [ ] Capability rules shown in info box

### **Published Services Section**
- [ ] Services listed (or "No published services" message)
- [ ] Service style badges shown correctly
- [ ] GPS Required badge shows for at_home services
- [ ] Base price displayed
- [ ] Publish level shown
- [ ] Copy Services JSON button works

### **Centres Section**
- [ ] Centres listed (or "No centres" message)
- [ ] Centre name and address shown
- [ ] Max concurrent bookings displayed
- [ ] Coordinates shown
- [ ] Copy Centres JSON button works

### **Staff Section**
- [ ] Staff listed (or "No staff members" message)
- [ ] Staff name, role, email shown
- [ ] Specializations shown as badges
- [ ] Copy Staff JSON button works

### **How to Use Section**
- [ ] Instructions visible at bottom
- [ ] Keyboard shortcut documented
- [ ] Copy functionality explained
- [ ] Validation use case explained

---

## 🎨 Styling Customization

To match your brand colors, update the component:

```tsx
// In DebugOverlay.tsx, change:

// Header background
className="sticky top-0 bg-purple-600 p-4"
// to
className="sticky top-0 bg-your-brand-color p-4"

// Bug button background
className="fixed bottom-4 right-4 z-50 p-3 bg-purple-600"
// to
className="fixed bottom-4 right-4 z-50 p-3 bg-your-brand-color"

// Badge colors
className="bg-blue-600 text-white"
// to
className="bg-your-color text-white"
```

---

## 📱 Mobile Responsiveness

The overlay is responsive by default:
- Desktop: 2xl max-width (672px)
- Tablet: Full width with scrolling
- Mobile: Full screen overlay

To adjust mobile behavior:
```tsx
// In DebugOverlay.tsx, change:
className="fixed inset-y-0 right-0 z-50 w-full max-w-2xl"

// For full-width on all devices:
className="fixed inset-y-0 right-0 z-50 w-full"

// For narrower on desktop:
className="fixed inset-y-0 right-0 z-50 w-full max-w-xl"
```

---

## 🔒 Security Considerations

The overlay includes built-in security:

```tsx
// Only shows in development or for admins
const isDev = import.meta.env.DEV || currentUser?.role === 'admin';

if (!isDev) return null;
```

**Important:**
- ⚠️ Never force `isDev = true` in production
- ⚠️ Ensure `currentUser.role` is verified server-side
- ✅ Debug overlay is client-side only (no sensitive data should be stored)

---

## 🚀 Production Deployment

Before deploying to production:

1. **Verify visibility logic:**
   ```tsx
   // Should be:
   const isDev = import.meta.env.DEV || currentUser?.role === 'admin';
   
   // NOT:
   const isDev = true; // This would show to everyone!
   ```

2. **Test role-based access:**
   ```bash
   # Build for production
   npm run build
   
   # Test as admin user
   # Overlay should appear
   
   # Test as regular user
   # Overlay should NOT appear
   ```

3. **Check bundle size:**
   ```bash
   # Overlay is ~50KB (minimal impact)
   # Tree-shaking will remove it if not used
   ```

---

## 📊 Usage Examples

### **Example 1: Debugging Service Publishing Issues**

1. Open debug overlay (Ctrl+Shift+D)
2. Go to "Published Services" section
3. Check if service appears
4. Verify `serviceStyle` matches expected
5. Check if `gpsRequired` is true for at_home services
6. Copy JSON and share with support

### **Example 2: Debugging Custom Package Issues**

1. Open debug overlay
2. Go to "Centres" section
3. Check centres.length > 0
4. Go to "Resolved Capabilities" section
5. Verify "Create Custom Packages" is Enabled
6. If disabled, check centres count

### **Example 3: Debugging Role Permissions**

1. Open debug overlay
2. Go to "Role Configuration" section
3. Check `serviceStyles` array
4. Verify it includes needed styles (at_home, tele, at_center)
5. Copy Full JSON and send to admin

---

## 🎯 Next Steps

1. ✅ Integrate component into vendor dashboard (5 min)
2. ✅ Test keyboard shortcut and bug button (2 min)
3. ✅ Verify all sections display data correctly (5 min)
4. ✅ Test copy to clipboard functionality (2 min)
5. ✅ Test on mobile devices (5 min)
6. ✅ Deploy to staging for team testing

**Total Time:** ~20 minutes

---

## 📞 Support

**If you encounter issues:**

1. Check console for errors
2. Verify props are passed correctly
3. Check import paths
4. Refer to troubleshooting section above

**Common fixes:**
- Props undefined? → Add hooks to fetch data
- Import errors? → Adjust relative paths
- UI components missing? → Install shadcn/ui or use fallback components
- Not visible? → Check `import.meta.env.DEV` or `currentUser.role`

---

**Integration Guide Created:** December 9, 2024  
**Component Location:** `/components/admin/DebugOverlay.tsx`  
**Status:** Ready to integrate (component already exists, just needs to be added to vendor app)

