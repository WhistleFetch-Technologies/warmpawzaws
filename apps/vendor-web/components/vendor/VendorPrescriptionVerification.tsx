'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { ArrowLeft, Settings, Plus, Search, Filter, Edit, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface VendorPrescriptionVerificationProps {
  vendorId: string;
  onBack?: () => void;
}

export function VendorPrescriptionVerification({ vendorId, onBack }: VendorPrescriptionVerificationProps) {
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
      <div className="flex items-center justify-center h-screen bg-gray-50 w-full max-w-[430px] mx-auto">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 w-full max-w-[430px] mx-auto">
      <div className="bg-[#FF8C42] text-white p-4 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          {onBack && (
            <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-full">
              <ArrowLeft className="w-6 h-6" />
            </button>
          )}
          <div>
            <h1 className="text-xl font-bold">Prescription Verification</h1>
            <p className="text-sm text-white/80">Manage your settings</p>
          </div>
        </div>
      </div>

      <div className="p-4">
        <div className="bg-white rounded-xl p-8 text-center border border-gray-200">
          <Settings className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Prescription Verification</h3>
          <p className="text-gray-500 mb-4">This feature is being configured for your account.</p>
          <button className="bg-[#FF8C42] text-white px-6 py-2 rounded-lg font-medium">
            <Plus className="w-4 h-4 inline mr-2" />
            Get Started
          </button>
        </div>
      </div>
    </div>
  );
}

export default VendorPrescriptionVerification;
