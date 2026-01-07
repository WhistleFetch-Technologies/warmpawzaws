'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { Plus, Edit, Trash2, Shield, Loader2 } from 'lucide-react';
import { AddRoleModal } from './AddRoleModal';

interface Role {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  isSystem: boolean;
  userCount: number;
}

export function RolesTab() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);

  useEffect(() => {
    loadRoles();
  }, []);

  const loadRoles = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<any>('/admin/rbac/roles');
      if (response.success && response.roles) {
        setRoles(response.roles);
      }
    } catch (error) {
      console.error('Error loading roles:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (roleId: string) => {
    if (!confirm('Are you sure you want to delete this role?')) return;
    try {
      await apiClient.delete(`/admin/rbac/roles/${roleId}`);
      loadRoles();
    } catch (error) {
      console.error('Error deleting role:', error);
      alert('Failed to delete role');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Roles</h2>
        <button
          onClick={() => {
            setEditingRole(null);
            setShowAddModal(true);
          }}
          className="px-4 py-0 bg-orange-600 text-white rounded-lg hover:bg-orange-700 flex items-center gap-0 text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Add Role
        </button>
      </div>

      <div className="space-y-3">
        {roles.map((role) => (
          <div
            key={role.id}
            className="bg-white rounded-lg border-2 border-gray-200 p-4 hover:border-gray-300 transition-colors"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-0 mb-0">
                  <Shield className="w-5 h-5 text-orange-600" />
                  <h3 className="font-semibold text-gray-900">{role.name}</h3>
                  {role.isSystem && (
                    <span className="text-xs px-0 py-0.5 bg-blue-100 text-blue-700 rounded">
                      System
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-600 mb-0">{role.description}</p>
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <span>{role.permissions.length} permissions</span>
                  <span>{role.userCount || 0} users</span>
                </div>
              </div>
              {!role.isSystem && (
                <div className="flex items-center gap-0">
                  <button
                    onClick={() => {
                      setEditingRole(role);
                      setShowAddModal(true);
                    }}
                    className="p-0 text-gray-600 hover:bg-gray-100 rounded-lg"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(role.id)}
                    className="p-0 text-red-600 hover:bg-red-50 rounded-lg"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {showAddModal && (
        <AddRoleModal
          role={editingRole}
          onClose={() => {
            setShowAddModal(false);
            setEditingRole(null);
          }}
          onSuccess={loadRoles}
        />
      )}
    </div>
  );
}

