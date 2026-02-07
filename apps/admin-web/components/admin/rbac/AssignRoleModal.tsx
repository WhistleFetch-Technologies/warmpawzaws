'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { X, Save, Loader2, Users } from 'lucide-react';

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface Role {
  id: string;
  name: string;
  description: string;
}

interface AssignRoleModalProps {
  user: AdminUser;
  onClose: () => void;
  onSuccess: () => void;
}

export function AssignRoleModal({ user, onClose, onSuccess }: AssignRoleModalProps) {
  const [loading, setLoading] = useState(false);
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedRole, setSelectedRole] = useState(user.role);

  useEffect(() => {
    loadRoles();
  }, []);

  const loadRoles = async () => {
    try {
      const response = await apiClient.get<any>('/admin/rbac/roles');
      if (response.success && response.roles) {
        setRoles(response.roles);
      }
    } catch (error) {
      console.error('Error loading roles:', error);
    }
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      const response = await apiClient.put<any>(`/admin/rbac/users/${user.id}/role`, {
        role: selectedRole,
      });

      if (response.success) {
        onSuccess();
      } else {
        alert('Failed to assign role');
      }
    } catch (error) {
      console.error('Error assigning role:', error);
      alert('Error assigning role');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-md">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-0 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-3">
            <Users className="w-5 h-5 text-orange-600" />
            Assign Role
          </h2>
          <button onClick={onClose} className="p-0 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <p className="text-sm text-gray-600 mb-0">User</p>
            <p className="font-medium text-gray-900">{user.name}</p>
            <p className="text-sm text-gray-500">{user.email}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-0">
              Select Role
            </label>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {roles.map((role) => (
                <label
                  key={role.id}
                  className={`flex items-start gap-3 p-0 border-2 rounded-lg cursor-pointer transition-colors ${
                    selectedRole === role.name
                      ? 'border-orange-500 bg-orange-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="role"
                    checked={selectedRole === role.name}
                    onChange={() => setSelectedRole(role.name)}
                    className="mt-0 w-4 h-4 text-orange-600"
                  />
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{role.name}</div>
                    <p className="text-xs text-gray-500">{role.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t">
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1 py-0.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-medium flex items-center justify-center gap-3 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Assign Role
                </>
              )}
            </button>
            <button
              onClick={onClose}
              className="px-4 py-0.5 border-2 border-gray-200 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

