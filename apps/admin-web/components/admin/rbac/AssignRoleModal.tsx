'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { X, Save, Loader2, Users } from 'lucide-react';

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
  rbacRoleId?: string | null;
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
  const [selectedRoleId, setSelectedRoleId] = useState<string>(user.rbacRoleId || '');
  /** If non-empty on save, server replaces `admins.password_hash` (min 8 chars). Empty = keep current. */
  const [passwordInput, setPasswordInput] = useState('');

  useEffect(() => {
    loadRoles();
  }, []);

  useEffect(() => {
    setSelectedRoleId(user.rbacRoleId || '');
    setPasswordInput('');
  }, [user.id, user.rbacRoleId]);

  const loadRoles = async () => {
    try {
      const response = await apiClient.get<any>('/admin/roles?active=false&role_type=admin');
      const rows = Array.isArray(response?.roles) ? response.roles : [];
      setRoles(
        rows.map((r: any) => ({
          id: r.id || r.roleId,
          name: r.display_name || r.roleName || r.name || 'Role',
          description: r.description || r.roleCode || r.name || '',
        }))
      );
    } catch (error) {
      console.error('Error loading roles:', error);
    }
  };

  const handleSubmit = async () => {
    if (!selectedRoleId) {
      alert('Select a role');
      return;
    }
    const pwd = passwordInput.trim();
    if (pwd.length > 0 && pwd.length < 8) {
      alert('Password must be at least 8 characters, or leave blank to keep the current password.');
      return;
    }
    try {
      setLoading(true);
      const payload: { roleId: string; password?: string } = { roleId: selectedRoleId };
      if (pwd.length > 0) payload.password = pwd;

      const response = await apiClient.put<any>(`/admin/rbac/users/${user.id}/role`, payload);

      if (response.success) {
        onSuccess();
        onClose();
      } else {
        alert(response.error || 'Failed to assign role');
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
                  className={`flex items-start gap-3 p-3 border-2 rounded-lg cursor-pointer transition-colors ${
                    selectedRoleId === role.id
                      ? 'border-orange-500 bg-orange-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="role"
                    checked={selectedRoleId === role.id}
                    onChange={() => setSelectedRoleId(role.id)}
                    className="mt-1 w-4 h-4 text-orange-600"
                  />
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{role.name}</div>
                    <p className="text-xs text-gray-500">{role.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="assign-role-password" className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <p className="text-xs text-gray-500 mb-1.5">
              The current password cannot be shown (it is stored securely as a hash). The field below uses dots only as a
              hint that a password is on file—type a new value to replace it, or leave empty to keep the existing
              password.
            </p>
            <input
              id="assign-role-password"
              type="password"
              autoComplete="new-password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              placeholder={passwordInput.length === 0 ? '••••••••' : 'At least 8 characters'}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            />
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

