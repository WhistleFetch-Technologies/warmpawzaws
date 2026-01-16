'use client';

import React, { useState, useEffect } from 'react';
import { Shield, Plus, Edit2, Trash2, Loader2, Save, X, Users, Key, Check } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface Permission {
  permissionId: string;
  permissionName: string;
  permissionCode: string;
  category: string;
  description: string;
}

interface Role {
  roleId: string;
  roleName: string;
  roleCode: string;
  description: string;
  permissions: string[];
  userCount: number;
  isActive: boolean;
  isSystem: boolean;
  createdAt: string;
}

const PERMISSION_CATEGORIES = [
  'Vendor Management',
  'User Management',
  'Booking Management',
  'Financial Operations',
  'Content Management',
  'System Settings',
  'Analytics & Reports',
  'Support & CRM',
];

export function RBACManagement() {
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const [formData, setFormData] = useState({
    roleName: '',
    roleCode: '',
    description: '',
    permissions: [] as string[],
    isActive: true,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [rolesData, permissionsData] = await Promise.all([
        apiClient.get<any>('/admin/rbac/roles'),
        apiClient.get<any>('/admin/rbac/permissions'),
      ]);

      if (rolesData.success) setRoles(rolesData.roles || []);
      if (permissionsData.success) setPermissions(permissionsData.permissions || []);
    } catch (error) {
      console.error('Error loading RBAC data:', error);
      alert('Failed to load RBAC data');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenRoleModal = (role?: Role) => {
    if (role) {
      setEditingRole(role);
      setFormData({
        roleName: role.roleName,
        roleCode: role.roleCode,
        description: role.description,
        permissions: role.permissions,
        isActive: role.isActive,
      });
    } else {
      setEditingRole(null);
      setFormData({
        roleName: '',
        roleCode: '',
        description: '',
        permissions: [],
        isActive: true,
      });
    }
    setShowRoleModal(true);
  };

  const handleSaveRole = async () => {
    if (!formData.roleName || !formData.roleCode) {
      alert('Role name and code are required');
      return;
    }

    try {
      setSaving(true);
      const payload = {
        roleName: formData.roleName,
        roleCode: formData.roleCode,
        description: formData.description,
        permissions: formData.permissions,
        isActive: formData.isActive,
      };

      if (editingRole) {
        const data = await apiClient.put<any>(`/admin/rbac/roles/${editingRole.roleId}`, payload);
        if (data.success) {
          alert('Role updated successfully');
          setShowRoleModal(false);
          loadData();
        } else {
          alert(data.error || 'Failed to update role');
        }
      } else {
        const data = await apiClient.post<any>('/admin/rbac/roles', payload);
        if (data.success) {
          alert('Role created successfully');
          setShowRoleModal(false);
          loadData();
        } else {
          alert(data.error || 'Failed to create role');
        }
      }
    } catch (error) {
      console.error('Error saving role:', error);
      alert('An error occurred while saving');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRole = async (roleId: string, isSystem: boolean) => {
    if (isSystem) {
      alert('System roles cannot be deleted');
      return;
    }
    if (!confirm('Are you sure you want to delete this role?')) return;

    try {
      const data = await apiClient.delete<any>(`/admin/rbac/roles/${roleId}`);
      if (data.success) {
        alert('Role deleted successfully');
        loadData();
      } else {
        alert(data.error || 'Failed to delete role');
      }
    } catch (error) {
      console.error('Error deleting role:', error);
      alert('An error occurred while deleting');
    }
  };

  const togglePermission = (permissionId: string) => {
    setFormData(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permissionId)
        ? prev.permissions.filter(p => p !== permissionId)
        : [...prev.permissions, permissionId],
    }));
  };

  const toggleCategoryPermissions = (category: string) => {
    const categoryPermissions = permissions
      .filter(p => p.category === category)
      .map(p => p.permissionId);
    
    const allSelected = categoryPermissions.every(p => formData.permissions.includes(p));
    
    if (allSelected) {
      setFormData(prev => ({
        ...prev,
        permissions: prev.permissions.filter(p => !categoryPermissions.includes(p)),
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        permissions: [...new Set([...prev.permissions, ...categoryPermissions])],
      }));
    }
  };

  const filteredPermissions = selectedCategory === 'all'
    ? permissions
    : permissions.filter(p => p.category === selectedCategory);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 text-orange-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-0 bg-indigo-100 rounded-xl">
            <Shield className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">RBAC Management</h1>
            <p className="text-sm text-gray-600">Manage roles and permissions</p>
          </div>
        </div>
        <button
          onClick={() => handleOpenRoleModal()}
          className="flex items-center gap-3 px-4 py-0 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
        >
          <Plus className="w-4 h-4" />
          Create Role
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {roles.map((role) => (
          <div key={role.roleId} className="bg-white rounded-xl border-2 border-gray-200 p-0">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-0 bg-indigo-100 rounded-lg">
                  <Shield className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{role.roleName}</h3>
                  <p className="text-sm text-gray-600">{role.roleCode}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {role.isSystem && (
                  <span className="px-0 py-0 bg-purple-100 text-purple-700 text-xs font-medium rounded">
                    System
                  </span>
                )}
                <span className={`px-0 py-0 text-xs font-medium rounded ${
                  role.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                }`}>
                  {role.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>

            <p className="text-sm text-gray-600 mb-4">{role.description}</p>

            <div className="flex items-center gap-4 mb-4 text-sm">
              <div className="flex items-center gap-3 text-gray-600">
                <Users className="w-4 h-4" />
                <span>{role.userCount} users</span>
              </div>
              <div className="flex items-center gap-3 text-gray-600">
                <Key className="w-4 h-4" />
                <span>{role.permissions.length} permissions</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => handleOpenRoleModal(role)}
                className="flex-1 flex items-center justify-center gap-3 px-0 py-0 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium"
              >
                <Edit2 className="w-4 h-4" />
                Edit
              </button>
              {!role.isSystem && (
                <button
                  onClick={() => handleDeleteRole(role.roleId, role.isSystem)}
                  className="flex-1 flex items-center justify-center gap-3 px-0 py-0 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 text-sm font-medium"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {showRoleModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-0 py-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingRole ? 'Edit Role' : 'Create Role'}
              </h2>
              <button
                onClick={() => setShowRoleModal(false)}
                className="p-0 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-0 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-0">Role Name *</label>
                  <input
                    type="text"
                    value={formData.roleName}
                    onChange={(e) => setFormData(prev => ({ ...prev, roleName: e.target.value }))}
                    className="w-full px-0 py-0 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
                    placeholder="e.g., Vendor Manager"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-0">Role Code *</label>
                  <input
                    type="text"
                    value={formData.roleCode}
                    onChange={(e) => setFormData(prev => ({ ...prev, roleCode: e.target.value.toUpperCase() }))}
                    className="w-full px-0 py-0 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
                    placeholder="e.g., VENDOR_MGR"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-0">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-0 py-0 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
                  rows={2}
                  placeholder="Describe this role..."
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-0">
                  <label className="text-sm font-medium text-gray-700">Permissions</label>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="px-0 py-0 border-2 border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="all">All Categories</option>
                    {PERMISSION_CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div className="border-2 border-gray-200 rounded-lg max-h-96 overflow-y-auto">
                  {PERMISSION_CATEGORIES.map(category => {
                    const categoryPerms = permissions.filter(p => p.category === category);
                    if (categoryPerms.length === 0) return null;

                    const allSelected = categoryPerms.every(p => formData.permissions.includes(p.permissionId));
                    const someSelected = categoryPerms.some(p => formData.permissions.includes(p.permissionId));

                    return (
                      <div key={category} className="border-b border-gray-200 last:border-b-0">
                        <div className="bg-gray-50 px-4 py-0 flex items-center justify-between">
                          <label className="flex items-center gap-3 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={allSelected}
                              onChange={() => toggleCategoryPermissions(category)}
                              className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
                            />
                            <span className="font-medium text-gray-900">{category}</span>
                            <span className="text-sm text-gray-500">
                              ({categoryPerms.filter(p => formData.permissions.includes(p.permissionId)).length}/{categoryPerms.length})
                            </span>
                          </label>
                        </div>
                        <div className="p-4 space-y-2">
                          {categoryPerms.map(permission => (
                            <label
                              key={permission.permissionId}
                              className="flex items-start gap-3 p-0 hover:bg-gray-50 rounded-lg cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={formData.permissions.includes(permission.permissionId)}
                                onChange={() => togglePermission(permission.permissionId)}
                                className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500 mt-0.5"
                              />
                              <div className="flex-1">
                                <p className="text-sm font-medium text-gray-900">{permission.permissionName}</p>
                                <p className="text-xs text-gray-600">{permission.description}</p>
                                <p className="text-xs text-gray-500 font-mono mt-0">{permission.permissionCode}</p>
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                    className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Active Role</span>
                </label>
              </div>
            </div>

            <div className="sticky bottom-0 bg-white border-t border-gray-200 px-0 py-4 flex gap-3">
              <button
                onClick={() => setShowRoleModal(false)}
                className="flex-1 px-4 py-0 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveRole}
                disabled={saving}
                className="flex-1 px-4 py-0 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-medium flex items-center justify-center gap-3 disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    {editingRole ? 'Update' : 'Create'} Role
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
