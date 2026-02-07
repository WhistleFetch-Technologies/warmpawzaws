/**
 * RBAC (Role-Based Access Control) Management
 * Enterprise-grade permission and role management system
 */

import { useState, useEffect } from 'react';
import { Card } from '../../ui/card';
import { Button } from '../../ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs';
import { 
  Shield, Users, Key, Plus, Edit, Trash2, Save, X, 
  Check, AlertCircle, ArrowLeft, Search
} from 'lucide-react';
import { getApiBaseUrl, getAuthHeaders } from '../../../utils/api-config';

const API_BASE = getApiBaseUrl();

interface Role {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  isSystem: boolean;
  userCount: number;
  createdAt: string;
}

interface Permission {
  id: string;
  key?: string;
  name: string;
  description: string;
  category: string;
}

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
  status: 'active' | 'inactive';
  lastLogin?: string;
}

interface RBACManagementProps {
  onBack: () => void;
}

export function RBACManagement({ onBack }: RBACManagementProps) {
  const [activeTab, setActiveTab] = useState('roles');
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [isCreatingRole, setIsCreatingRole] = useState(false);

  // Form state
  const [roleName, setRoleName] = useState('');
  const [roleDescription, setRoleDescription] = useState('');
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);

  useEffect(() => {
    loadRBACData();
  }, []);

  const loadRBACData = async () => {
    setLoading(true);
    try {
      // Load roles
      const rolesRes = await fetch(`${API_BASE}/admin/rbac/roles`, {
        headers: getAuthHeaders()
      });
      if (rolesRes.ok) {
        const rolesData = await rolesRes.json();
        console.log('✅ Loaded roles:', rolesData.roles);
        setRoles(rolesData.roles || []);
      }

      // Load permissions
      const permsRes = await fetch(`${API_BASE}/admin/rbac/permissions`, {
        headers: getAuthHeaders()
      });
      if (permsRes.ok) {
        const permsData = await permsRes.json();
        // Normalize permissions: use 'key' as 'id' if 'id' doesn't exist
        const normalizedPermissions = (permsData.permissions || []).map((p: any) => ({
          ...p,
          id: p.id || p.key // Use key as id for compatibility
        }));
        console.log('✅ Loaded permissions:', normalizedPermissions);
        setPermissions(normalizedPermissions);
      }

      // Load admin users
      const usersRes = await fetch(`${API_BASE}/admin/rbac/users`, {
        headers: getAuthHeaders()
      });
      if (usersRes.ok) {
        const usersData = await usersRes.json();
        console.log('✅ Loaded users:', usersData.users);
        setUsers(usersData.users || []);
      }
    } catch (err) {
      console.error('Error loading RBAC data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRole = async () => {
    if (!roleName.trim()) {
      alert('Role name is required');
      return;
    }

    if (selectedPermissions.length === 0) {
      alert('Please select at least one permission for this role');
      return;
    }

    try {
      console.log('📤 Creating role:', {
        name: roleName,
        description: roleDescription,
        permissions: selectedPermissions
      });

      const response = await fetch(`${API_BASE}/admin/rbac/roles`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          name: roleName,
          description: roleDescription,
          permissions: selectedPermissions
        })
      });

      const result = await response.json();
      console.log('📥 Create role response:', result);

      if (response.ok && result.success) {
        alert(`✅ Role "${roleName}" created successfully with ${selectedPermissions.length} permissions!`);
        setIsCreatingRole(false);
        resetForm();
        loadRBACData();
      } else {
        alert(`❌ Failed to create role: ${result.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Error creating role:', err);
      alert('Failed to create role: Network error');
    }
  };

  const handleUpdateRole = async () => {
    if (!editingRole) return;

    if (!roleName.trim()) {
      alert('Role name is required');
      return;
    }

    if (selectedPermissions.length === 0) {
      alert('Please select at least one permission for this role');
      return;
    }

    try {
      console.log('📤 Updating role:', editingRole.id, {
        name: roleName,
        description: roleDescription,
        permissions: selectedPermissions
      });

      const response = await fetch(`${API_BASE}/admin/rbac/roles/${editingRole.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          name: roleName,
          description: roleDescription,
          permissions: selectedPermissions
        })
      });

      const result = await response.json();
      console.log('📥 Update role response:', result);

      if (response.ok && result.success) {
        alert(`✅ Role "${roleName}" updated successfully!`);
        setEditingRole(null);
        resetForm();
        loadRBACData();
      } else {
        alert(`❌ Failed to update role: ${result.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Error updating role:', err);
      alert('Failed to update role: Network error');
    }
  };

  const handleDeleteRole = async (roleId: string) => {
    if (!confirm('Are you sure you want to delete this role?')) return;

    try {
      const response = await fetch(`${API_BASE}/admin/rbac/roles/${roleId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });

      if (response.ok) {
        loadRBACData();
      }
    } catch (err) {
      console.error('Error deleting role:', err);
      alert('Failed to delete role');
    }
  };

  const handleEditRole = (role: Role) => {
    setEditingRole(role);
    setRoleName(role.name);
    setRoleDescription(role.description);
    setSelectedPermissions(role.permissions);
    setIsCreatingRole(true);
  };

  const resetForm = () => {
    setRoleName('');
    setRoleDescription('');
    setSelectedPermissions([]);
    setEditingRole(null);
  };

  const togglePermission = (permId: string) => {
    setSelectedPermissions(prev =>
      prev.includes(permId)
        ? prev.filter(p => p !== permId)
        : [...prev, permId]
    );
  };

  const permissionsByCategory = permissions.reduce((acc, perm) => {
    if (!acc[perm.category]) acc[perm.category] = [];
    acc[perm.category].push(perm);
    return acc;
  }, {} as Record<string, Permission[]>);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading RBAC system...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={onBack}>
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div>
                <h1 className="text-xl font-semibold">RBAC Management</h1>
                <p className="text-sm text-gray-500">Role-Based Access Control</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Shield className="w-5 h-5 text-green-600" />
              <span className="text-sm text-gray-600">{users.length} Admin Users</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="roles">
              <Shield className="w-4 h-4 mr-2" />
              Roles
            </TabsTrigger>
            <TabsTrigger value="permissions">
              <Key className="w-4 h-4 mr-2" />
              Permissions
            </TabsTrigger>
            <TabsTrigger value="users">
              <Users className="w-4 h-4 mr-2" />
              Admin Users
            </TabsTrigger>
          </TabsList>

          {/* Roles Tab */}
          <TabsContent value="roles" className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">Manage Roles</h2>
              <Button
                onClick={() => {
                  resetForm();
                  setIsCreatingRole(true);
                }}
                className="bg-[#FF8C42] hover:bg-[#ff7a28]"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Role
              </Button>
            </div>

            {/* Role Creation/Edit Form */}
            {isCreatingRole && (
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">
                  {editingRole ? 'Edit Role' : 'Create New Role'}
                </h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Role Name</label>
                    <input
                      type="text"
                      value={roleName}
                      onChange={(e) => setRoleName(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      placeholder="e.g., Operations Manager"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Description</label>
                    <textarea
                      value={roleDescription}
                      onChange={(e) => setRoleDescription(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      rows={3}
                      placeholder="Describe the role's responsibilities..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Permissions 
                      {selectedPermissions.length > 0 && (
                        <span className="ml-2 text-xs bg-[#FF8C42] text-white px-2 py-0.5 rounded">
                          {selectedPermissions.length} selected
                        </span>
                      )}
                    </label>
                    <div className="border border-gray-300 rounded-lg p-4 max-h-96 overflow-y-auto">
                      {Object.entries(permissionsByCategory).map(([category, perms]) => (
                        <div key={category} className="mb-4">
                          <h4 className="font-medium text-sm text-gray-700 mb-2">{category}</h4>
                          <div className="space-y-2">
                            {perms.map(perm => (
                              <label key={perm.id} className="flex items-center space-x-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={selectedPermissions.includes(perm.id)}
                                  onChange={() => togglePermission(perm.id)}
                                  className="w-4 h-4 text-[#FF8C42] rounded"
                                />
                                <span className="text-sm">{perm.name}</span>
                                <span className="text-xs text-gray-500">- {perm.description}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Button
                      onClick={editingRole ? handleUpdateRole : handleCreateRole}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <Save className="w-4 h-4 mr-2" />
                      {editingRole ? 'Update' : 'Create'} Role
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsCreatingRole(false);
                        resetForm();
                      }}
                    >
                      <X className="w-4 h-4 mr-2" />
                      Cancel
                    </Button>
                  </div>
                </div>
              </Card>
            )}

            {/* Roles List */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {roles.map(role => (
                <Card key={role.id} className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-semibold">{role.name}</h3>
                      <p className="text-sm text-gray-600 mt-1">{role.description}</p>
                    </div>
                    {!role.isSystem && (
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditRole(role)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteRole(role.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Permissions:</span>
                      <span className="font-medium">{role.permissions.length}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Users:</span>
                      <span className="font-medium">{role.userCount || 0}</span>
                    </div>
                    {role.isSystem && (
                      <div className="flex items-center text-xs text-blue-600">
                        <AlertCircle className="w-3 h-3 mr-1" />
                        System Role (Cannot be deleted)
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Permissions Tab */}
          <TabsContent value="permissions" className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">All Permissions</h2>
              <span className="text-sm text-gray-600">{permissions.length} permissions</span>
            </div>

            {Object.entries(permissionsByCategory).map(([category, perms]) => (
              <Card key={category} className="p-6">
                <h3 className="font-semibold mb-4">{category}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {perms.map(perm => (
                    <div key={perm.id} className="flex items-start space-x-3">
                      <Check className="w-5 h-5 text-green-600 mt-0.5" />
                      <div>
                        <p className="font-medium text-sm">{perm.name}</p>
                        <p className="text-xs text-gray-600">{perm.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users" className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">Admin Users</h2>
              <Button className="bg-[#FF8C42] hover:bg-[#ff7a28]">
                <Plus className="w-4 h-4 mr-2" />
                Add Admin User
              </Button>
            </div>

            <Card className="p-6">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b">
                    <tr>
                      <th className="text-left py-3 px-4 font-semibold">Name</th>
                      <th className="text-left py-3 px-4 font-semibold">Email</th>
                      <th className="text-left py-3 px-4 font-semibold">Role</th>
                      <th className="text-left py-3 px-4 font-semibold">Status</th>
                      <th className="text-left py-3 px-4 font-semibold">Last Login</th>
                      <th className="text-right py-3 px-4 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(user => (
                      <tr key={user.id} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-4">{user.name}</td>
                        <td className="py-3 px-4 text-sm text-gray-600">{user.email}</td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
                            {user.role}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-1 text-xs rounded ${
                            user.status === 'active' 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {user.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600">
                          {user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : 'Never'}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Button variant="ghost" size="sm">
                            <Edit className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}