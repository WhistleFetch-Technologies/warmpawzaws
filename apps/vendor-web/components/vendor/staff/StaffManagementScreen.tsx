'use client';

import React, { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import { Plus, X, UserPlus, Save, Loader2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface StaffManagementScreenProps {
  vendorId: string;
  onBack?: () => void;
}

interface StaffMember {
  id: string;
  name: string;
  role: string;
  phone?: string;
  email?: string;
  isActive?: boolean;
  services?: Array<{
    id: string;
    name: string;
    service_style?: string[];
  }>;
  specializations?: string[];
}

/**
 * Enhanced staff management screen for web
 */
export function StaffManagementScreen({ vendorId, onBack }: StaffManagementScreenProps) {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedStaffForServices, setSelectedStaffForServices] = useState<StaffMember | null>(null);
  const [newStaff, setNewStaff] = useState({
    name: '',
    role: '',
    phone: '',
    email: ''
  });

  useEffect(() => {
    loadStaff();
  }, [vendorId]);

  const loadStaff = async () => {
    try {
      setLoading(true);
      // ✅ FIX: Include vendorId in staff endpoint
      const response = await apiClient.get<{
        success?: boolean;
        staff?: StaffMember[];
      }>(`/vendor/${vendorId}/staff`);
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

  const handleCreateStaff = async () => {
    if (!newStaff.name.trim()) {
      toast.error('Staff name is required');
      return;
    }
    if (!newStaff.phone.trim()) {
      toast.error('Phone number is required');
      return;
    }
    if (!newStaff.role.trim()) {
      toast.error('Role is required');
      return;
    }

    try {
      setSaving(true);
      console.log('Creating staff member:', newStaff);
      
      // ✅ FIX: Include vendorId in staff creation endpoint
      const response = await apiClient.post<{
        success?: boolean;
        staff?: StaffMember;
        message?: string;
      }>(`/vendor/${vendorId}/staff`, {
        name: newStaff.name.trim(),
        phone: newStaff.phone.trim(),
        email: newStaff.email.trim() || undefined,
        role: newStaff.role.trim()
      });

      if (response.success) {
        toast.success(response.message || 'Staff member created successfully!');
        setNewStaff({ name: '', role: '', phone: '', email: '' });
        setShowCreateForm(false);
        await loadStaff();
      } else {
        throw new Error((response as any).error || 'Failed to create staff member');
      }
    } catch (error: any) {
      console.error('[StaffManagementScreen] Failed to create staff', error);
      toast.error(error.message || 'Failed to create staff member. Please check if the phone number is already registered.');
    } finally {
      setSaving(false);
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
        <div className="bg-white border-b border-gray-200 px-4 py-4 sticky top-0 z-10">
          <div className="flex items-center gap-3 mb-4">
            {onBack && (
              <button
                onClick={onBack}
                className="w-10 h-10 flex items-center justify-center bg-white rounded-xl border-2 border-[#FF8C42] hover:bg-orange-50 transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-[#FF8C42]" />
              </button>
            )}
            <h1 className="text-xl font-bold text-gray-900 flex-1">Staff Management</h1>
            <Button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="bg-[#FF8C42] hover:bg-[#FF7A2E] text-white"
              size="sm"
            >
              {showCreateForm ? (
                <>
                  <X className="w-4 h-4 mr-1" />
                  Cancel
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4 mr-1" />
                  Add Staff
                </>
              )}
            </Button>
          </div>
        </div>

        {/* ✅ NEW: Create Staff Form */}
        {showCreateForm && (
          <div className="px-4 py-4 bg-orange-50 border-b border-orange-100">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Add New Staff Member</h2>
            <div className="space-y-4">
              <div>
                <Label htmlFor="staff-name" className="text-sm font-medium text-gray-700">
                  Name *
                </Label>
                <Input
                  id="staff-name"
                  value={newStaff.name}
                  onChange={(e) => setNewStaff({ ...newStaff, name: e.target.value })}
                  placeholder="Enter staff name"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="staff-role" className="text-sm font-medium text-gray-700">
                  Role *
                </Label>
                <Input
                  id="staff-role"
                  value={newStaff.role}
                  onChange={(e) => setNewStaff({ ...newStaff, role: e.target.value })}
                  placeholder="e.g., Groomer, Vet Assistant, Walker"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="staff-phone" className="text-sm font-medium text-gray-700">
                  Phone Number *
                </Label>
                <Input
                  id="staff-phone"
                  type="tel"
                  value={newStaff.phone}
                  onChange={(e) => setNewStaff({ ...newStaff, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                  placeholder="Enter 10-digit phone number"
                  className="mt-1"
                  maxLength={10}
                />
              </div>
              <div>
                <Label htmlFor="staff-email" className="text-sm font-medium text-gray-700">
                  Email (Optional)
                </Label>
                <Input
                  id="staff-email"
                  type="email"
                  value={newStaff.email}
                  onChange={(e) => setNewStaff({ ...newStaff, email: e.target.value })}
                  placeholder="Enter email address"
                  className="mt-1"
                />
              </div>
              <Button
                onClick={handleCreateStaff}
                disabled={saving || !newStaff.name.trim() || !newStaff.phone.trim() || !newStaff.role.trim()}
                className="w-full bg-[#FF8C42] hover:bg-[#FF7A2E] text-white"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Create Staff Member
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        <div className="px-4 py-6 space-y-3">
          {staff.length > 0 ? (
            staff.map((member) => (
              <div
                key={member.id}
                className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-gray-900 font-semibold">{member.name}</p>
                    <p className="text-sm text-gray-600 mt-1">
                      <span className="font-medium">Role:</span> {member.role}
                    </p>
                    {member.phone && (
                      <p className="text-xs text-gray-500 mt-1">
                        <span className="font-medium">Phone:</span> {member.phone}
                      </p>
                    )}
                    {member.email && (
                      <p className="text-xs text-gray-500 mt-1">
                        <span className="font-medium">Email:</span> {member.email}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-12">
              <UserPlus className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 font-semibold mb-2">No staff members yet</p>
              <p className="text-sm text-gray-500 mb-4">Add your first staff member to get started</p>
              <Button
                onClick={() => setShowCreateForm(true)}
                className="bg-[#FF8C42] hover:bg-[#FF7A2E] text-white"
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Add Staff Member
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
