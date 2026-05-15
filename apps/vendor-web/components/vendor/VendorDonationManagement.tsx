'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { Settings, Plus, Search, Filter, Edit, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { VendorHeader } from '@/components/vendor/VendorHeader';

interface VendorDonationManagementProps {
  vendorId: string;
  onBack?: () => void;
}

export function VendorDonationManagement({ vendorId, onBack }: VendorDonationManagementProps) {
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
      <div className="flex items-center justify-center h-screen bg-gray-50 vendor-app-column">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42]"></div>
      </div>
    );
  }

  return (
    <div className="vendor-page-shell bg-gray-50">
      <div className="vendor-app-column min-h-screen bg-white">
        <VendorHeader
          tone="brand"
          title="Donation Management"
          subtitle="Manage your settings"
          showBack={Boolean(onBack)}
          onBack={onBack}
        />
      <div className="p-4">
        <div className="bg-white rounded-xl p-8 text-center border border-gray-200">
          <Settings className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Donation Management</h3>
          <p className="text-gray-500 mb-4">This feature is being configured for your account.</p>
          <button className="bg-[#FF8C42] text-white px-6 py-2 rounded-lg font-medium">
            <Plus className="w-4 h-4 inline mr-2" />
            Get Started
          </button>
        </div>
      </div>
      </div>
    </div>
  );
}

export default VendorDonationManagement;
