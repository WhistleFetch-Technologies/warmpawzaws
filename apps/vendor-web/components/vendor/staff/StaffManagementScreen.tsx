'use client';

import React, { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

interface StaffManagementScreenProps {
  vendorId: string;
  onBack?: () => void;
}

interface StaffMember {
  id: string;
  name: string;
  role: string;
  phone?: string;
}

/**
 * Simplified staff management screen for web
 */
export function StaffManagementScreen({ vendorId, onBack }: StaffManagementScreenProps) {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStaff();
  }, [vendorId]);

  const loadStaff = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<{
        success?: boolean;
        staff?: StaffMember[];
      }>(`/vendor/staff`);
      if (response.success && response.staff) {
        setStaff(response.staff);
      } else {
        setStaff([]);
      }
    } catch (error) {
      console.error('[StaffManagementScreen] Failed to load staff', error);
      toast.error('Failed to load staff');
      setStaff([]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading staff...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-md mx-auto bg-white min-h-screen">
        <div className="bg-white border-b border-gray-200 px-4 py-4">
          {onBack && (
            <button
              onClick={onBack}
              className="text-orange-500 text-sm font-medium mb-2"
            >
              ← Back
            </button>
          )}
          <h1 className="text-xl font-bold text-gray-900">Staff</h1>
          <p className="text-xs text-gray-400">Vendor ID: {vendorId}</p>
        </div>

        <div className="px-4 py-6 space-y-3">
          {staff.length > 0 ? (
            staff.map((member) => (
              <div
                key={member.id}
                className="bg-white border border-gray-200 rounded-xl p-4 flex items-center justify-between"
              >
                <div>
                  <p className="text-gray-900 font-semibold">{member.name}</p>
                  <p className="text-sm text-gray-500">{member.role}</p>
                  {member.phone && <p className="text-xs text-gray-400">{member.phone}</p>}
                </div>
                <span className="text-gray-400">•</span>
              </div>
            ))
          ) : (
            <div className="text-center py-12">
              <div className="text-4xl mb-2">👥</div>
              <p className="text-gray-500">No staff members found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
