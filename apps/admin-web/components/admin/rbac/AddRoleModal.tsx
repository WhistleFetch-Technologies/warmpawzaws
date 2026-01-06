'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { X, Save, Loader2, Shield } from 'lucide-react';

interface Role {
  id: string;
  name: string;
  description: string;
  permissions: string[];
}

interface Permission {
  id: string;
  name: string;
  description: string;
  category: string;
}

interface AddRoleModalProps {
  role?: Role | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function AddRoleModal({ role, onClose, onSuccess }: AddRoleModalProps) {
  const [loading, setLoading] = useState(false);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [formData, setFormData] = useState({
    name: role?.name || '',
    description: role?.description || '',
    permissions: role?.permissions || [] as string[],
  });

  useEffect(() => {
    loadPermissions();
  }, []);

  const loadPermissions = async () => {
    try {
      const response = await apiClient.get<any>('/admin/rbac/permissions');
      if (response.success && response.permissions) {
        const normalized = response.permissions.map((p: any) => ({
          ...p,
          id: p.id || p.key,
        }));
        setPermissions(normalized);
      }
    } catch (error) {
      console.error('Error loading permissions:', error);
    }
  };

  const togglePermission = (permId: string) => {
    setFormData(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permId)
        ? prev.permissions.filter(p => p !== permId)
        : [...prev.permissions, permId],
    }));
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      alert('Role name is required');
      return;
    }
    if (formData.permissions.length === 0) {
      alert('Please select at least one permission');
      return;
    }

    try {
      setLoading(true);
      const endpoint = role
        ? `/admin/rbac/roles/${role.id}`
        : '/admin/rbac/roles';
      const method = role ? 'put' : 'post';
      
      const response = await apiClient[method]<any>(endpoint, {
        name: formData.name,
        description: formData.description,
        permissions: formData.permissions,
      });

      if (response.success) {
        onSuccess();
      } else {
        alert('Failed to save role');
      }
    } catch (error) {
      console.error('Error saving role:', error);
      alert('Error saving role');
    } finally {
      setLoading(false);
    }
  };

  const permissionsByCategory = permissions.reduce((acc, perm) => {
    if (!acc[perm.category]) acc[perm.category] = [];
    acc[perm.category].push(perm);
    return acc;
  }, {} as Record<string, Permission[]>);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Shield className="w-5 h-5 text-orange-600" />
            {role ? 'Edit Role' : 'Add Role'}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Role Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              placeholder="e.g., Operations Manager"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              placeholder="Describe the role's responsibilities..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Permissions ({formData.permissions.length} selected)
            </label>
            <div className="border-2 border-gray-200 rounded-lg p-3 max-h-64 overflow-y-auto">
              {Object.entries(permissionsByCategory).map(([category, perms]) => (
                <div key={category} className="mb-4">
                  <h4 className="font-medium text-sm text-gray-700 mb-2">{category}</h4>
                  <div className="space-y-2">
                    {perms.map(perm => (
                      <label key={perm.id} className="flex items-start gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.permissions.includes(perm.id)}
                          onChange={() => togglePermission(perm.id)}
                          className="mt-1 w-4 h-4 text-orange-600 rounded"
                        />
                        <div className="flex-1">
                          <span className="text-sm text-gray-900">{perm.name}</span>
                          <p className="text-xs text-gray-500">{perm.description}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t">
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1 py-2.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-medium flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  {role ? 'Update' : 'Create'} Role
                </>
              )}
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2.5 border-2 border-gray-200 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

