/**
 * EXAMPLE: VendorDashboard with Debug Overlay Integration
 * 
 * This shows exactly how to add the Debug Overlay to your existing vendor dashboard.
 * Just copy the highlighted sections to your actual VendorDashboard.tsx file.
 */

import { useState, useEffect } from 'react';
// ... your existing imports

// ✅ ADD THIS IMPORT
import { DebugOverlay } from '../admin/DebugOverlay';

export function VendorDashboard() {
  // Your existing state and hooks
  const [selectedTab, setSelectedTab] = useState('services');
  
  // ✅ MAKE SURE YOU HAVE THESE HOOKS/DATA
  // (You probably already have them, just verify the names)
  const { vendorData, isLoading } = useVendorData();
  const { roleConfiguration } = useVendorCapabilities();
  const { currentUser } = useAuth();
  
  // Your existing component logic...
  
  return (
    <div className="vendor-dashboard">
      {/* Your existing dashboard UI */}
      <header>
        {/* Your header */}
      </header>
      
      <nav>
        {/* Your navigation tabs */}
      </nav>
      
      <main>
        {/* Your main content */}
        {selectedTab === 'services' && <ServicesTab />}
        {selectedTab === 'bookings' && <BookingsTab />}
        {selectedTab === 'centres' && <CentresTab />}
        {selectedTab === 'staff' && <StaffTab />}
      </main>
      
      {/* ✅ ADD THIS AT THE VERY END, BEFORE CLOSING </div> */}
      <DebugOverlay 
        vendorData={vendorData}
        roleConfiguration={roleConfiguration}
        currentUser={currentUser}
      />
    </div>
  );
}

/**
 * ALTERNATIVE: If your data hooks use different names
 */

export function VendorDashboardAlternative() {
  // If your hooks return differently structured data:
  const vendor = useVendor(); // Instead of useVendorData()
  const config = useRoleConfig(); // Instead of useVendorCapabilities()
  const auth = useAuthContext(); // Instead of useAuth()
  
  // Map the data to match Debug Overlay's expected structure:
  const debugVendorData = {
    id: vendor?.id,
    businessName: vendor?.businessName || vendor?.name,
    fullName: vendor?.fullName,
    roleId: vendor?.roleId,
    centres: vendor?.facilities || vendor?.centres || [],
    staff: vendor?.staffMembers || vendor?.staff || [],
    publishedServices: vendor?.services || []
  };
  
  const debugRoleConfig = {
    roleId: config?.id || vendor?.roleId,
    roleName: config?.name || config?.roleName,
    vendorTypes: config?.vendorTypes || [],
    serviceStyles: config?.serviceStyles || config?.allowedStyles || [],
    centreManagementEnabled: config?.centreManagement?.enabled || false,
    staffManagementEnabled: config?.staffManagement?.enabled || false,
    customPackagesEnabled: config?.customPackages?.enabled || false
  };
  
  const debugCurrentUser = {
    id: auth?.user?.id,
    email: auth?.user?.email,
    role: auth?.user?.role || auth?.userRole
  };
  
  return (
    <div className="vendor-dashboard">
      {/* Your existing UI */}
      
      {/* ✅ ADD THIS WITH MAPPED DATA */}
      <DebugOverlay 
        vendorData={debugVendorData}
        roleConfiguration={debugRoleConfig}
        currentUser={debugCurrentUser}
      />
    </div>
  );
}

/**
 * ALTERNATIVE: If you want conditional rendering
 */

export function VendorDashboardWithConditional() {
  const { vendorData } = useVendorData();
  const { roleConfiguration } = useVendorCapabilities();
  const { currentUser } = useAuth();
  
  // Show only in development or for specific vendor IDs
  const showDebugOverlay = 
    import.meta.env.DEV || 
    currentUser?.role === 'admin' ||
    vendorData?.id === 'test_vendor_123'; // For testing specific vendors
  
  return (
    <div className="vendor-dashboard">
      {/* Your existing UI */}
      
      {/* ✅ CONDITIONAL RENDERING */}
      {showDebugOverlay && (
        <DebugOverlay 
          vendorData={vendorData}
          roleConfiguration={roleConfiguration}
          currentUser={currentUser}
        />
      )}
    </div>
  );
}

/**
 * QUICK START: Minimal Example
 * 
 * If you just want to test it quickly without worrying about real data:
 */

export function VendorDashboardMinimal() {
  // Mock data for testing
  const mockVendorData = {
    id: 'vendor_test_001',
    businessName: 'Test Vet Clinic',
    fullName: 'Dr. Test Vendor',
    roleId: 'role_veterinarian',
    centres: [
      {
        id: 'centre_001',
        name: 'Downtown Clinic',
        address: '123 Main St',
        maxConcurrentBookings: 5,
        location: { latitude: 40.7580, longitude: -73.9855 }
      }
    ],
    staff: [
      {
        id: 'staff_001',
        fullName: 'Dr. Sarah Johnson',
        email: 'sarah@example.com',
        role: 'Veterinarian',
        specializations: ['Dermatology', 'Surgery']
      }
    ],
    publishedServices: [
      {
        id: 'svc_001',
        name: 'Veterinary Consultation',
        serviceStyle: 'at_center',
        category: 'veterinary',
        basePrice: 800,
        publishLevel: 'vendor',
        gpsRequired: false
      }
    ]
  };
  
  const mockRoleConfig = {
    roleId: 'role_veterinarian',
    roleName: 'Veterinarian',
    vendorTypes: ['veterinary'],
    serviceStyles: ['at_center', 'at_home', 'tele'],
    centreManagementEnabled: true,
    staffManagementEnabled: true,
    customPackagesEnabled: true
  };
  
  const mockCurrentUser = {
    id: 'user_001',
    email: 'vendor@example.com',
    role: 'admin' // Set to 'admin' to force visibility
  };
  
  return (
    <div className="vendor-dashboard">
      <h1>Vendor Dashboard (Testing Debug Overlay)</h1>
      <p>Press Ctrl+Shift+D to open debug overlay</p>
      
      {/* ✅ TEST WITH MOCK DATA */}
      <DebugOverlay 
        vendorData={mockVendorData}
        roleConfiguration={mockRoleConfig}
        currentUser={mockCurrentUser}
      />
    </div>
  );
}

/**
 * TROUBLESHOOTING: Component not showing?
 * 
 * 1. Open browser console
 * 2. Check for errors
 * 3. Add debug logs:
 */

export function VendorDashboardWithDebugLogs() {
  const { vendorData } = useVendorData();
  const { roleConfiguration } = useVendorCapabilities();
  const { currentUser } = useAuth();
  
  // ✅ ADD CONSOLE LOGS TO DEBUG
  useEffect(() => {
    console.log('🐛 Debug Overlay Props:', {
      vendorData,
      roleConfiguration,
      currentUser,
      isDev: import.meta.env.DEV
    });
  }, [vendorData, roleConfiguration, currentUser]);
  
  return (
    <div className="vendor-dashboard">
      {/* Your UI */}
      
      <DebugOverlay 
        vendorData={vendorData}
        roleConfiguration={roleConfiguration}
        currentUser={currentUser}
      />
    </div>
  );
}

/**
 * TESTING CHECKLIST
 * 
 * After adding the component, verify:
 * 
 * ✅ Component renders without errors
 * ✅ Press Ctrl+Shift+D → Overlay appears
 * ✅ Purple bug button (🐛) visible in bottom-right corner
 * ✅ Click bug button → Overlay toggles
 * ✅ Click X button → Overlay closes
 * ✅ All 6 sections render (Quick Info, Role Config, Capabilities, Services, Centres, Staff)
 * ✅ Copy buttons show toast notifications
 * ✅ Data displays correctly in each section
 * ✅ Sections collapse/expand when clicked
 * ✅ Overlay is scrollable
 * ✅ Works on mobile (full-width overlay)
 * 
 * IF NOT WORKING:
 * - Check console for errors
 * - Verify import path: '../admin/DebugOverlay' or '../../components/admin/DebugOverlay'
 * - Verify props are not undefined (add console.log)
 * - Check if import.meta.env.DEV is true or currentUser.role is 'admin'
 * - Try with mock data first (use VendorDashboardMinimal example above)
 */

