'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { Users, Edit, Trash2, Loader2, Search } from 'lucide-react';
import { AssignRoleModal } from './AssignRoleModal';

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
  status: 'active' | 'inactive';
  lastLogin?: string;
  rbacRoleId?: string | null;
  rbacRoleIds?: string[];
  rbacRoles?: { id: string; display_name?: string; name?: string }[];
}

export function UsersTab() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<any>('/admin/rbac/users');
      if (Array.isArray(response?.users)) {
        setUsers(response.users);
      }
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (user: AdminUser) => {
    const currentAdminId =
      typeof window !== 'undefined' ? localStorage.getItem('adminId') : null;
    if (currentAdminId && user.id === currentAdminId) {
      alert('You cannot delete your own account.');
      return;
    }
    const label = user.name || user.email;
    if (
      !confirm(
        `Delete admin user "${label}"?\n\nThis removes their account and role assignments. This cannot be undone.`
      )
    ) {
      return;
    }
    try {
      setDeletingId(user.id);
      const response = await apiClient.delete<any>(`/admin/rbac/users/${user.id}`);
      if (response?.success === false) {
        alert(response.error || 'Failed to delete admin user');
        return;
      }
      await loadUsers();
    } catch (error: unknown) {
      console.error('Error deleting admin user:', error);
      alert('Failed to delete admin user');
    } finally {
      setDeletingId(null);
    }
  };

  const q = searchQuery.toLowerCase();
  const filteredUsers = users.filter((user) =>
    (user.name || '').toLowerCase().includes(q) ||
    (user.email || '').toLowerCase().includes(q) ||
    (user.role || '').toLowerCase().includes(q)
  );

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
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-3">
          <Users className="w-5 h-5 text-orange-600" />
          Admin Users
        </h2>
        <span className="text-sm text-gray-500">{users.length} users</span>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
          placeholder="Search users..."
          className="w-full pl-10 pr-4 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
        />
      </div>

      {/* Users List */}
      <div className="space-y-3">
        {filteredUsers.map((user) => (
          <div
            key={user.id}
            className="bg-white rounded-lg border-2 border-gray-200 p-4 hover:border-gray-300 transition-colors"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900">{user.name}</h3>
                <p className="text-sm text-gray-600 mb-0">{user.email}</p>
                <div className="flex items-center gap-2 flex-wrap">
                  {(user.rbacRoles?.length
                    ? user.rbacRoles.map((r) => r.display_name || r.name || 'Role')
                    : user.role
                      ? user.role.split(',').map((s) => s.trim()).filter(Boolean)
                      : ['admin']
                  ).map((label) => (
                    <span
                      key={`${user.id}-${label}`}
                      className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded"
                    >
                      {label}
                    </span>
                  ))}
                  <span
                    className={`text-xs px-2 py-0.5 rounded ${
                      user.status === 'active'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {user.status}
                  </span>
                </div>
                {user.lastLogin && (
                  <p className="text-xs text-gray-500 mt-0">
                    Last login: {new Date(user.lastLogin).toLocaleDateString()}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setSelectedUser(user)}
                  className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                  title="Assign roles"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(user)}
                  disabled={deletingId === user.id}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50"
                  title="Delete admin user"
                >
                  {deletingId === user.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {selectedUser && (
        <AssignRoleModal
          user={selectedUser}
          onClose={() => setSelectedUser(null)}
          onSuccess={loadUsers}
        />
      )}
    </div>
  );
}

