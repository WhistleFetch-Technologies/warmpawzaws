'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { X, Save, Loader2, Users } from 'lucide-react';

interface RbacRoleRef {
  id: string;
  display_name?: string;
  name?: string;
}

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
  rbacRoleId?: string | null;
  rbacRoleIds?: string[];
  rbacRoles?: RbacRoleRef[];
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

function initialSelectedRoleIds(user: AdminUser): string[] {
  if (user.rbacRoleIds?.length) return [...user.rbacRoleIds];
  if (user.rbacRoles?.length) return user.rbacRoles.map((r) => r.id).filter(Boolean);
  if (user.rbacRoleId) return [user.rbacRoleId];
  return [];
}

export function AssignRoleModal({ user, onClose, onSuccess }: AssignRoleModalProps) {
  const [loading, setLoading] = useState(false);
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>(() => initialSelectedRoleIds(user));
  const [passwordInput, setPasswordInput] = useState('');

  useEffect(() => {
    loadRoles();
  }, []);

  useEffect(() => {
    setSelectedRoleIds(initialSelectedRoleIds(user));
    setPasswordInput('');
  }, [user.id, user.rbacRoleId, user.rbacRoleIds, user.rbacRoles]);

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

  const toggleRole = (roleId: string) => {
    setSelectedRoleIds((prev) =>
      prev.includes(roleId) ? prev.filter((id) => id !== roleId) : [...prev, roleId]
    );
  };

  const handleSubmit = async () => {
    if (selectedRoleIds.length === 0) {
      alert('Select at least one role');
      return;
    }
    const pwd = passwordInput.trim();
    if (pwd.length > 0 && pwd.length < 8) {
      alert('Password must be at least 8 characters, or leave blank to keep the current password.');
      return;
    }
    try {
      setLoading(true);
      const payload: { roleIds: string[]; password?: string } = { roleIds: selectedRoleIds };
      if (pwd.length > 0) payload.password = pwd;

      const response = await apiClient.put<any>(`/admin/rbac/users/${user.id}/role`, payload);

      if (response.success) {
        onSuccess();
        onClose();
      } else {
        alert(response.error || 'Failed to assign roles');
      }
    } catch (error) {
      console.error('Error assigning roles:', error);
      alert('Error assigning roles');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shrink-0">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-3">
            <Users className="w-5 h-5 text-orange-600" />
            Assign Roles
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg" aria-label="Close">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          <div>
            <p className="text-sm text-gray-600 mb-0">User</p>
            <p className="font-medium text-gray-900">{user.name}</p>
            <p className="text-sm text-gray-500">{user.email}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Select roles ({selectedRoleIds.length} selected)
            </label>
            <p className="text-xs text-gray-500 mb-2">
              Permissions from all selected roles are combined for this user.
            </p>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {roles.map((role) => {
                const checked = selectedRoleIds.includes(role.id);
                return (
                  <label
                    key={role.id}
                    className={`flex items-start gap-3 p-3 border-2 rounded-lg cursor-pointer transition-colors ${
                      checked
                        ? 'border-orange-500 bg-orange-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleRole(role.id)}
                      className="mt-1 w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{role.name}</div>
                      <p className="text-xs text-gray-500">{role.description}</p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          <div>
            <label htmlFor="assign-role-password" className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <p className="text-xs text-gray-500 mb-1.5">
              Leave empty to keep the existing password, or enter a new password (min 8 characters).
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
        </div>

        <div className="flex gap-3 border-t border-gray-200 px-4 py-3 shrink-0">
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-medium flex items-center justify-center gap-3 disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save roles
              </>
            )}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 border-2 border-gray-200 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
