import { useState, useEffect } from 'react';
import { ModeSwitcherCompact, VendorMode } from './ModeSwitcher';
import { CenterModeContent } from './CenterModeContent';
import { StaffModeContent } from './StaffModeContent';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';

interface SoloProviderDashboardProps {
  session: {
    vendorId: string;
    centerId: string;
    staffId: string;
    isSoloProvider: boolean;
    ownerName: string;
    businessName?: string;
    roleName: string;
    defaultMode?: VendorMode;
  };
  vendorData: any;
}

export function SoloProviderDashboard({ session, vendorData }: SoloProviderDashboardProps) {
  const [currentMode, setCurrentMode] = useState<VendorMode>(session.defaultMode || 'CENTER');
  const [vendor, setVendor] = useState<any>(null);
  const [center, setCenter] = useState<any>(null);
  const [staff, setStaff] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;

  // Fetch solo provider data
  useEffect(() => {
    fetchSoloProviderData();
  }, [session.vendorId]);

  const fetchSoloProviderData = async () => {
    try {
      setLoading(true);
      console.log('🔍 Fetching solo provider data:', session.vendorId);

      const response = await fetch(
        `${API_BASE}/vendor/${session.vendorId}/solo-info`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Solo provider data:', data);
        
        if (data.success) {
          setVendor(data.vendor);
          setCenter(data.center);
          setStaff(data.staff);
        }
      } else {
        console.error('❌ Failed to fetch solo provider data');
      }
    } catch (error) {
      console.error('❌ Error fetching solo provider data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleModeSwitch = (mode: VendorMode) => {
    console.log(`🔄 Switching mode: ${currentMode} → ${mode}`);
    setCurrentMode(mode);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with Mode Switcher */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl">Dashboard</h1>
              <p className="text-sm text-gray-600">
                Welcome back, {session.ownerName}
              </p>
            </div>
            <ModeSwitcherCompact
              currentMode={currentMode}
              isSoloProvider={session.isSoloProvider}
              onSwitch={handleModeSwitch}
            />
          </div>
        </div>
      </div>

      {/* Content based on current mode */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {currentMode === 'CENTER' ? (
          <CenterModeContent
            session={session}
            vendor={vendor}
            center={center}
            isSoloProvider={true}
            onRefresh={fetchSoloProviderData}
          />
        ) : (
          <StaffModeContent
            session={session}
            staff={staff}
            center={center}
            isSoloProvider={true}
            onRefresh={fetchSoloProviderData}
          />
        )}
      </div>
    </div>
  );
}
