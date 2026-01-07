'use client';

import React, { useState } from 'react';
import { User, X, Save, Loader2 } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface SuperAdminProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SuperAdminProfileModal({ isOpen, onClose }: SuperAdminProfileModalProps) {
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: 'Super Admin',
    email: 'admin@warmpawz.com',
    phone: '+91-XXXXXXXXXX',
  });

  const handleSave = async () => {
    try {
      setSaving(true);
      const data = await apiClient.put<any>('/admin/profile', formData);
      if (data.success) {
        alert('Profile updated successfully');
        onClose();
      } else {
        alert(data.error || 'Failed to update profile');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('An error occurred');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-md">
        <div className="border-b border-gray-200 px-0 py-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Admin Profile</h3>
          <button onClick={onClose} className="p-0 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-0 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-0">Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="w-full px-0 py-0 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-0">Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              className="w-full px-0 py-0 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-0">Phone</label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
              className="w-full px-0 py-0 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
            />
          </div>
        </div>

        <div className="border-t border-gray-200 px-0 py-4 flex gap-0">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-0 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 px-4 py-0 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-medium flex items-center justify-center gap-0 disabled:opacity-50"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
