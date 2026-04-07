'use client';

import { useState, useEffect } from 'react';
import { Settings, Plus } from 'lucide-react';
import { VendorHeader } from '@/components/vendor/VendorHeader';

interface VendorEventManagementProps {
  vendorId: string;
  onBack?: () => void;
}

export function VendorEventManagement({ vendorId, onBack }: VendorEventManagementProps) {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    loadData();
  }, [vendorId]);

  const loadData = async () => {
    try {
      setLoading(true);
      // API call would go here
      setItems([]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="vendor-app-column flex h-screen items-center justify-center bg-gray-50">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-[#FF8C42]"></div>
      </div>
    );
  }

  return (
    <div className="vendor-page-shell bg-gray-50">
      <div className="vendor-app-column min-h-screen bg-white">
        <VendorHeader
          tone="brand"
          title="Event Management"
          subtitle="Manage your settings"
          showBack={Boolean(onBack)}
          onBack={onBack}
        />
        <div className="p-4">
          <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
            <Settings className="mx-auto mb-4 h-16 w-16 text-gray-300" />
            <h3 className="mb-2 text-lg font-semibold text-gray-800">Event Management</h3>
            <p className="mb-4 text-gray-500">This feature is being configured for your account.</p>
            <button type="button" className="rounded-lg bg-[#FF8C42] px-6 py-2 font-medium text-white">
              <Plus className="mr-2 inline h-4 w-4" />
              Get Started
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default VendorEventManagement;
