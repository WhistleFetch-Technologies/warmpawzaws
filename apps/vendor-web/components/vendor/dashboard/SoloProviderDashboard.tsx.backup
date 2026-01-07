'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { ModeSwitcher } from './ModeSwitcher';
import { CenterModeContent } from './CenterModeContent';
import { StaffModeContent } from './StaffModeContent';
import { Loader2 } from 'lucide-react';

interface SoloProviderDashboardProps {
  session: {
    vendorId: string;
    centerId: string;
    staffId: string;
    isSoloProvider: boolean;
    ownerName: string;
    businessName?: string;
    roleName: string;
    defaultMode?: 'CENTER' | 'STAFF';
  };
  vendorData: any;
}

export function SoloProviderDashboard({ session, vendorData }: SoloProviderDashboardProps) {
  const [currentMode, setCurrentMode] = useState<'CENTER' | 'STAFF'>(session.defaultMode || 'CENTER');
  const [vendor, setVendor] = useState<any>(null);
  const [center, setCenter] = useState<any>(null);
  const [staff, setStaff] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSoloProviderData();
  }, [session.vendorId]);

  const fetchSoloProviderData = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<any>(`/vendor/${session.vendorId}/solo-info`);
      
      if (response.success) {
        setVendor(response.vendor);
        setCenter(response.center);
        setStaff(response.staff);
      }
    } catch (error) {
      console.error('Error fetching solo provider data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleModeSwitch = (mode: 'CENTER' | 'STAFF') => {
    setCurrentMode(mode);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 w-full max-w-[430px] mx-auto flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-orange-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 w-full max-w-[430px] mx-auto">
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10 px-4 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-sm text-gray-600">
              Welcome back, {session.ownerName}
            </p>
          </div>
          <ModeSwitcher
            currentMode={currentMode}
            isSoloProvider={session.isSoloProvider}
            onSwitch={handleModeSwitch}
          />
        </div>
      </div>

      <div className="p-4">
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

