'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';

interface Staff {
  id: string;
  name: string;
  phone: string;
  email?: string;
  role: string;
  experience_years?: number;
  is_active: boolean;
  services?: any[];
}

interface VendorStaffPageProps {
  vendorId: string;
}

export function VendorStaffPage({ vendorId }: VendorStaffPageProps) {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);

  useEffect(() => {
    loadStaff();
  }, [vendorId]);

  const loadStaff = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<any>(`/vendor/${vendorId}/staff`);
      if (response.success) {
        setStaff(response.staff || []);
      }
    } catch (err) {
      console.error('Error loading staff:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStaff = async (staffId: string, isActive: boolean) => {
    try {
      await apiClient.put(`/vendor/${vendorId}/staff/${staffId}`, {
        isActive: !isActive,
      });
      loadStaff();
    } catch (err) {
      console.error('Error toggling staff:', err);
    }
  };

  const handleDeleteStaff = async (staffId: string) => {
    if (!confirm('Are you sure you want to remove this staff member?')) return;
    try {
      await apiClient.delete(`/vendor/${vendorId}/staff/${staffId}`);
      loadStaff();
    } catch (err) {
      console.error('Error deleting staff:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Staff Management</h1>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition flex items-center gap-2"
        >
          <span>➕</span> Add Staff
        </button>
      </div>

      {staff.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl">
          <span className="text-6xl">👥</span>
          <h2 className="mt-4 text-xl font-semibold text-gray-900">No staff members yet</h2>
          <p className="text-gray-500 mt-2">Add your team members to manage bookings</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="mt-4 px-6 py-2 bg-orange-500 text-white rounded-full"
          >
            Add Staff Member
          </button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {staff.map((member) => (
            <div
              key={member.id}
              className="bg-white rounded-xl p-4 shadow-sm"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold text-lg">
                    {member.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{member.name}</h3>
                    <p className="text-sm text-gray-500">{member.role}</p>
                  </div>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full ${
                  member.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                }`}>
                  {member.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
              
              <div className="mt-4 space-y-2 text-sm">
                <div className="flex items-center gap-2 text-gray-500">
                  <span>📱</span>
                  <span>{member.phone}</span>
                </div>
                {member.email && (
                  <div className="flex items-center gap-2 text-gray-500">
                    <span>✉️</span>
                    <span>{member.email}</span>
                  </div>
                )}
                {member.experience_years && (
                  <div className="flex items-center gap-2 text-gray-500">
                    <span>⭐</span>
                    <span>{member.experience_years} years experience</span>
                  </div>
                )}
              </div>

              {member.services && member.services.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs text-gray-400 mb-1">Services:</p>
                  <div className="flex flex-wrap gap-1">
                    {member.services.slice(0, 3).map((s: any) => (
                      <span key={s.id} className="text-xs px-2 py-1 bg-orange-50 text-orange-600 rounded">
                        {s.service_name || s.name}
                      </span>
                    ))}
                    {member.services.length > 3 && (
                      <span className="text-xs px-2 py-1 bg-gray-100 text-gray-500 rounded">
                        +{member.services.length - 3} more
                      </span>
                    )}
                  </div>
                </div>
              )}

              <div className="flex gap-2 mt-4 pt-4 border-t">
                <button
                  onClick={() => handleToggleStaff(member.id, member.is_active)}
                  className={`flex-1 py-2 text-sm rounded-lg ${
                    member.is_active 
                      ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' 
                      : 'bg-green-100 text-green-600 hover:bg-green-200'
                  }`}
                >
                  {member.is_active ? 'Deactivate' : 'Activate'}
                </button>
                <button
                  onClick={() => setEditingStaff(member)}
                  className="flex-1 py-2 text-sm bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDeleteStaff(member.id)}
                  className="py-2 px-3 text-sm bg-red-100 text-red-600 rounded-lg hover:bg-red-200"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {(showAddModal || editingStaff) && (
        <StaffModal
          vendorId={vendorId}
          staff={editingStaff}
          onClose={() => {
            setShowAddModal(false);
            setEditingStaff(null);
          }}
          onSave={() => {
            setShowAddModal(false);
            setEditingStaff(null);
            loadStaff();
          }}
        />
      )}
    </div>
  );
}

function StaffModal({
  vendorId,
  staff,
  onClose,
  onSave,
}: {
  vendorId: string;
  staff: Staff | null;
  onClose: () => void;
  onSave: () => void;
}) {
  const [formData, setFormData] = useState({
    name: staff?.name || '',
    phone: staff?.phone || '',
    email: staff?.email || '',
    role: staff?.role || 'Staff',
    experience_years: staff?.experience_years || 0,
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (staff) {
        await apiClient.put(`/vendor/${vendorId}/staff/${staff.id}`, formData);
      } else {
        await apiClient.post(`/vendor/${vendorId}/staff`, formData);
      }
      onSave();
    } catch (err) {
      console.error('Error saving staff:', err);
      alert('Failed to save staff member');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">
          {staff ? 'Edit Staff' : 'Add Staff Member'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
            <select
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
            >
              <option value="Staff">Staff</option>
              <option value="Veterinarian">Veterinarian</option>
              <option value="Groomer">Groomer</option>
              <option value="Trainer">Trainer</option>
              <option value="Walker">Walker</option>
              <option value="Receptionist">Receptionist</option>
              <option value="Manager">Manager</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Experience (years)</label>
            <input
              type="number"
              value={formData.experience_years}
              onChange={(e) => setFormData({ ...formData, experience_years: Number(e.target.value) })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
              min="0"
            />
          </div>
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

