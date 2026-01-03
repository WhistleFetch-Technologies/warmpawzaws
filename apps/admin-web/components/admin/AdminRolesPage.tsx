'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';

interface Role {
  id: string;
  name: string;
  display_name: string;
  description: string;
  category: string;
  is_active: boolean;
  capabilities: string[];
  form_config?: any;
}

interface Capability {
  id: string;
  name: string;
  description: string;
  category: string;
}

export function AdminRolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [capabilities, setCapabilities] = useState<Capability[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [rolesRes, capsRes] = await Promise.all([
        apiClient.get<any>('/roles'),
        apiClient.get<any>('/admin/capabilities'),
      ]);
      if (rolesRes.success) setRoles(rolesRes.roles || []);
      if (capsRes.success) setCapabilities(capsRes.capabilities || []);
    } catch (err) {
      console.error('Error loading roles:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleRole = async (roleId: string, isActive: boolean) => {
    try {
      await apiClient.put(`/admin/roles/${roleId}`, { is_active: !isActive });
      loadData();
    } catch (err) {
      console.error('Error toggling role:', err);
    }
  };

  const groupCapabilities = () => {
    const groups: Record<string, Capability[]> = {};
    capabilities.forEach(cap => {
      const category = cap.category || 'General';
      if (!groups[category]) groups[category] = [];
      groups[category].push(cap);
    });
    return groups;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Roles & Capabilities</h1>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
        >
          + Add Role
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <p className="text-sm text-gray-500">Total Roles</p>
          <p className="text-2xl font-bold text-gray-900">{roles.length}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <p className="text-sm text-gray-500">Active Roles</p>
          <p className="text-2xl font-bold text-green-600">{roles.filter(r => r.is_active).length}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <p className="text-sm text-gray-500">Total Capabilities</p>
          <p className="text-2xl font-bold text-blue-600">{capabilities.length}</p>
        </div>
      </div>

      {/* Roles Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {roles.map((role) => (
          <div
            key={role.id}
            className="bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition cursor-pointer"
            onClick={() => setSelectedRole(role)}
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">{role.display_name}</h3>
                <p className="text-sm text-gray-500">{role.name}</p>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full ${
                role.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
              }`}>
                {role.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
            <p className="text-sm text-gray-600 mt-2 line-clamp-2">{role.description}</p>
            <div className="flex items-center justify-between mt-4 pt-3 border-t">
              <span className="text-xs text-gray-400">{role.category}</span>
              <span className="text-xs text-blue-600">{role.capabilities?.length || 0} capabilities</span>
            </div>
          </div>
        ))}
      </div>

      {/* Role Detail Modal */}
      {selectedRole && (
        <RoleDetailModal
          role={selectedRole}
          allCapabilities={capabilities}
          groupedCapabilities={groupCapabilities()}
          onClose={() => setSelectedRole(null)}
          onSave={async (updatedRole) => {
            try {
              await apiClient.put(`/admin/roles/${selectedRole.id}`, updatedRole);
              loadData();
              setSelectedRole(null);
            } catch (err) {
              alert('Failed to save role');
            }
          }}
          onToggle={() => handleToggleRole(selectedRole.id, selectedRole.is_active)}
        />
      )}

      {/* Add Role Modal */}
      {showAddModal && (
        <AddRoleModal
          groupedCapabilities={groupCapabilities()}
          onClose={() => setShowAddModal(false)}
          onSave={async (newRole) => {
            try {
              await apiClient.post('/admin/roles', newRole);
              loadData();
              setShowAddModal(false);
            } catch (err) {
              alert('Failed to create role');
            }
          }}
        />
      )}
    </div>
  );
}

function RoleDetailModal({
  role,
  allCapabilities,
  groupedCapabilities,
  onClose,
  onSave,
  onToggle,
}: {
  role: Role;
  allCapabilities: Capability[];
  groupedCapabilities: Record<string, Capability[]>;
  onClose: () => void;
  onSave: (role: Partial<Role>) => void;
  onToggle: () => void;
}) {
  const [formData, setFormData] = useState({
    display_name: role.display_name,
    description: role.description,
    capabilities: role.capabilities || [],
  });

  const toggleCapability = (capName: string) => {
    if (formData.capabilities.includes(capName)) {
      setFormData({ ...formData, capabilities: formData.capabilities.filter(c => c !== capName) });
    } else {
      setFormData({ ...formData, capabilities: [...formData.capabilities, capName] });
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-6 w-full max-w-3xl max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">{role.display_name}</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">✕</button>
        </div>

        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Display Name</label>
            <input
              type="text"
              value={formData.display_name}
              onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
        </div>

        <h3 className="font-semibold mb-3">Capabilities ({formData.capabilities.length} selected)</h3>
        <div className="space-y-4 max-h-80 overflow-y-auto">
          {Object.entries(groupedCapabilities).map(([category, caps]) => (
            <div key={category} className="border rounded-lg p-3">
              <h4 className="font-medium text-gray-700 mb-2">{category}</h4>
              <div className="grid grid-cols-2 gap-2">
                {caps.map((cap) => (
                  <label
                    key={cap.id}
                    className={`flex items-center gap-2 p-2 rounded cursor-pointer ${
                      formData.capabilities.includes(cap.name) ? 'bg-blue-50' : 'hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={formData.capabilities.includes(cap.name)}
                      onChange={() => toggleCapability(cap.name)}
                      className="w-4 h-4 accent-blue-500"
                    />
                    <span className="text-sm">{cap.name}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-between items-center mt-6 pt-4 border-t">
          <button
            onClick={onToggle}
            className={`px-4 py-2 rounded-lg ${
              role.is_active ? 'bg-gray-100 text-gray-600' : 'bg-green-100 text-green-600'
            }`}
          >
            {role.is_active ? 'Deactivate Role' : 'Activate Role'}
          </button>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-4 py-2 border rounded-lg hover:bg-gray-50">
              Cancel
            </button>
            <button
              onClick={() => onSave(formData)}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AddRoleModal({
  groupedCapabilities,
  onClose,
  onSave,
}: {
  groupedCapabilities: Record<string, Capability[]>;
  onClose: () => void;
  onSave: (role: any) => void;
}) {
  const [formData, setFormData] = useState({
    name: '',
    display_name: '',
    description: '',
    category: 'service_provider',
    capabilities: [] as string[],
  });

  const toggleCapability = (capName: string) => {
    if (formData.capabilities.includes(capName)) {
      setFormData({ ...formData, capabilities: formData.capabilities.filter(c => c !== capName) });
    } else {
      setFormData({ ...formData, capabilities: [...formData.capabilities, capName] });
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-6 w-full max-w-3xl max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Create New Role</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">✕</button>
        </div>

        <div className="grid md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role Name (ID)</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
              placeholder="e.g., pet_groomer"
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Display Name</label>
            <input
              type="text"
              value={formData.display_name}
              onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
              placeholder="e.g., Pet Groomer"
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="healthcare">Healthcare</option>
              <option value="service_provider">Service Provider</option>
              <option value="retail">Retail</option>
              <option value="hospitality">Hospitality</option>
              <option value="specialist">Specialist</option>
            </select>
          </div>
        </div>

        <h3 className="font-semibold mb-3">Select Capabilities</h3>
        <div className="space-y-4 max-h-60 overflow-y-auto">
          {Object.entries(groupedCapabilities).map(([category, caps]) => (
            <div key={category} className="border rounded-lg p-3">
              <h4 className="font-medium text-gray-700 mb-2">{category}</h4>
              <div className="grid grid-cols-2 gap-2">
                {caps.map((cap) => (
                  <label
                    key={cap.id}
                    className={`flex items-center gap-2 p-2 rounded cursor-pointer ${
                      formData.capabilities.includes(cap.name) ? 'bg-blue-50' : 'hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={formData.capabilities.includes(cap.name)}
                      onChange={() => toggleCapability(cap.name)}
                      className="w-4 h-4 accent-blue-500"
                    />
                    <span className="text-sm">{cap.name}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
          <button onClick={onClose} className="px-4 py-2 border rounded-lg hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={() => {
              if (!formData.name || !formData.display_name) {
                alert('Please fill in all required fields');
                return;
              }
              onSave(formData);
            }}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            Create Role
          </button>
        </div>
      </div>
    </div>
  );
}

