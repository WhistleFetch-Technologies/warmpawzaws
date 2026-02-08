'use client';

import React, { useState, useEffect } from 'react';
import { Users, Search, Filter, UserPlus, Loader2, X } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface User {
  userId: string;
  name: string;
  email: string;
  roles: string[];
  status: 'active' | 'inactive';
  lastLogin?: string;
}

interface Role {
  roleId: string;
  roleName: string;
  roleCode: string;
}

export function RoleManagement() {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [usersData, rolesData] = await Promise.all([
        apiClient.get<any>('/admin/users'),
        apiClient.get<any>('/admin/rbac/roles'),
      ]);

      if (usersData.success) setUsers(usersData.users || []);
      if (rolesData.success) setRoles(rolesData.roles || []);
    } catch (error) {
      console.error('Error loading data:', error);
      alert('Failed to load user data');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAssignModal = (user: User) => {
    setSelectedUser(user);
    setSelectedRoles(user.roles);
    setShowAssignModal(true);
  };

  const handleSaveRoles = async () => {
    if (!selectedUser) return;

    try {
      setSaving(true);
      const data = await apiClient.put<any>(`/admin/users/${selectedUser.userId}/roles`, {
        roles: selectedRoles,
      });

      if (data.success) {
        alert('Roles updated successfully');
        setShowAssignModal(false);
        loadData();
      } else {
        alert(data.error || 'Failed to update roles');
      }
    } catch (error) {
      console.error('Error updating roles:', error);
      alert('An error occurred while updating roles');
    } finally {
      setSaving(false);
    }
  };

  const toggleRole = (roleId: string) => {
    setSelectedRoles(prev =>
      prev.includes(roleId)
        ? prev.filter(r => r !== roleId)
        : [...prev, roleId]
    );
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = filterRole === 'all' || user.roles.includes(filterRole);
    return matchesSearch && matchesRole;
  });

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
          <div className="p-0 bg-blue-100 rounded-xl">
            <Users className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Role Management</h1>
            <p className="text-sm text-gray-600">Assign roles to users</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border-2 border-gray-200 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-0/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
              placeholder="Search users by name or email..."
              className="w-full pl-0 pr-4 py-0 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
            />
          </div>
          <div className="flex items-center gap-3">
            <Filter className="w-5 h-5 text-gray-400" />
            <select
              value={filterRole}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFilterRole(e.target.value)}
              className="px-4 py-0 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
            >
              <option value="all">All Roles</option>
              {roles.map(role => (
                <option key={role.roleId} value={role.roleId}>{role.roleName}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border-2 border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-0 py-0 text-left text-xs font-medium text-gray-500 uppercase">User</th>
              <th className="px-0 py-0 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
              <th className="px-0 py-0 text-left text-xs font-medium text-gray-500 uppercase">Roles</th>
              <th className="px-0 py-0 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-0 py-0 text-left text-xs font-medium text-gray-500 uppercase">Last Login</th>
              <th className="px-0 py-0 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredUsers.map((user) => (
              <tr key={user.userId} className="hover:bg-gray-50">
                <td className="px-0 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-pink-400 rounded-full flex items-center justify-center text-white font-semibold">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="font-medium text-gray-900">{user.name}</span>
                  </div>
                </td>
                <td className="px-0 py-4 text-sm text-gray-600">{user.email}</td>
                <td className="px-0 py-4">
                  <div className="flex flex-wrap gap-3">
                    {user.roles.map(roleId => {
                      const role = roles.find(r => r.roleId === roleId);
                      return role ? (
                        <span key={roleId} className="px-0 py-0 bg-indigo-100 text-indigo-700 text-xs font-medium rounded">
                          {role.roleName}
                        </span>
                      ) : null;
                    })}
                    {user.roles.length === 0 && (
                      <span className="text-sm text-gray-500">No roles assigned</span>
                    )}
                  </div>
                </td>
                <td className="px-0 py-4">
                  <span className={`px-0 py-0 text-xs font-medium rounded ${
                    user.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                  }`}>
                    {user.status}
                  </span>
                </td>
                <td className="px-0 py-4 text-sm text-gray-600">
                  {user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : 'Never'}
                </td>
                <td className="px-0 py-4 text-right">
                  <button
                    onClick={() => handleOpenAssignModal(user)}
                    className="inline-flex items-center gap-3 px-0 py-0 bg-orange-50 text-orange-600 rounded-lg hover:bg-orange-100 text-sm font-medium"
                  >
                    <UserPlus className="w-4 h-4" />
                    Manage Roles
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredUsers.length === 0 && (
          <div className="text-center py-12">
            <Users className="w-12 h-12 text-gray-300 mx-auto mb-0" />
            <p className="text-gray-500">No users found</p>
          </div>
        )}
      </div>

      {showAssignModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-0 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Manage Roles</h2>
                <p className="text-sm text-gray-600">{selectedUser.name}</p>
              </div>
              <button
                onClick={() => setShowAssignModal(false)}
                className="p-0 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-0 space-y-3">
              {roles.map(role => (
                <label
                  key={role.roleId}
                  className="flex items-center justify-between p-4 border-2 border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                >
                  <div>
                    <p className="font-medium text-gray-900">{role.roleName}</p>
                    <p className="text-sm text-gray-600">{role.roleCode}</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={selectedRoles.includes(role.roleId)}
                    onChange={() => toggleRole(role.roleId)}
                    className="w-5 h-5 text-orange-600 rounded focus:ring-orange-500"
                  />
                </label>
              ))}
            </div>

            <div className="sticky bottom-0 bg-white border-t border-gray-200 px-0 py-4 flex gap-3">
              <button
                onClick={() => setShowAssignModal(false)}
                className="flex-1 px-4 py-0 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveRoles}
                disabled={saving}
                className="flex-1 px-4 py-0 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-medium flex items-center justify-center gap-3 disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
