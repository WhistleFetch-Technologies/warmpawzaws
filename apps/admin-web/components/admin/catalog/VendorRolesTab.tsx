'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { apiClient } from '@/lib/api-client';
import { Button, Card } from '@warmpawz/ui';
import { Plus, Edit, Trash2, Search, CheckCircle, XCircle, Eye, Pause, Play } from 'lucide-react';
import { toast } from 'sonner';
import { VendorRoleWizard } from './VendorRoleWizard';

// Helper to check if role is system role
const isSystemRole = (role: VendorRole): boolean => {
  return role.config?.is_system_role === true || false;
};

interface VendorRole {
  id: string;
  name: string;
  display_name: string;
  description: string;
  customer_service: string | null;
  vendorConfiguration: 'solo' | 'business' | null;
  vendorTypes?: string[];
  serviceStyles?: string[];
  capabilities: string[];
  isActive: boolean;
  config?: any; // Full config object from backend
}

export function VendorRolesTab() {
  const [roles, setRoles] = useState<VendorRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('active');
  const [filterService, setFilterService] = useState<string>('all');
  const [showWizard, setShowWizard] = useState(false);
  const [editingRole, setEditingRole] = useState<VendorRole | null>(null);

  useEffect(() => {
    loadRoles();
  }, [filterStatus]);

  const loadRoles = async () => {
    try {
      setLoading(true);
      // Default: only active roles (inactive roles are removed from catalog)
      const includeInactive = filterStatus !== 'active';
      const response = await apiClient.get<any>(
        includeInactive ? '/admin/roles?active=false&role_type=vendor' : '/admin/roles?role_type=vendor'
      );
      
      if (response && response.success && response.roles) {
        let list = (response.roles || []).map((r: any) => ({
          id: r.id || r.roleId,
          name: r.name || r.roleCode,
          display_name: r.display_name || r.roleName,
          description: r.description || '',
          customer_service: r.customer_service || null,
          vendorConfiguration: r.vendorConfiguration || (r.config?.vendorConfiguration || null),
          vendorTypes: r.vendorTypes || [],
          serviceStyles: r.serviceStyles || r.selectedServiceStyles || [],
          capabilities: r.capabilities || [],
          isActive: r.isActive !== false && r.is_active !== false,
          config: r.config || {}, // Preserve full config object for editing
        }));
        if (filterStatus === 'inactive') list = list.filter((r: VendorRole) => !r.isActive);
        setRoles(list);
      } else {
        console.warn('🔍 [VendorRolesTab] No roles in response:', response);
        setRoles([]);
      }
    } catch (error) {
      console.error('❌ [VendorRolesTab] Error loading vendor roles:', error);
      toast.error('Failed to load vendor roles');
      setRoles([]);
    } finally {
      setLoading(false);
    }
  };

  // Toggle role active/inactive
  const handleToggleActive = async (role: VendorRole) => {
    if (isSystemRole(role)) {
      toast.error('System roles cannot be modified');
      return;
    }

    const newStatus = !role.isActive;
    const action = newStatus ? 'activate' : 'deactivate';
    
    if (!confirm(`Are you sure you want to ${action} "${role.display_name}"?`)) {
      return;
    }

    try {
      const response = await apiClient.put<any>(`/admin/roles/${role.id}`, { 
        is_active: newStatus 
      });
      
      if (response.success) {
        toast.success(`Role ${newStatus ? 'activated' : 'deactivated'} successfully`);
        loadRoles();
      } else {
        toast.error(response.error || `Failed to ${action} role`);
      }
    } catch (error: any) {
      console.error(`Error ${action}ing role:`, error);
      toast.error(error.message || `Failed to ${action} role`);
    }
  };

  // Delete role (soft or permanent)
  const handleDeleteRole = async (role: VendorRole, permanent: boolean = false) => {
    if (isSystemRole(role)) {
      toast.error('System roles cannot be deleted');
      return;
    }

    if (permanent) {
      // Double confirmation for permanent delete
      const firstConfirm = window.confirm(
        `⚠️ PERMANENT DELETE\n\nAre you sure you want to PERMANENTLY delete role "${role.display_name}"?\n\nThis will:\n• Remove the role from the database\n• Delete all associated permissions\n• This action CANNOT be undone!`
      );
      if (!firstConfirm) return;
      
      const secondConfirm = window.prompt(`To confirm permanent deletion, type the role name: "${role.display_name}"`);
      if (secondConfirm !== role.display_name) {
        toast.error('Role name did not match. Deletion cancelled.');
        return;
      }
    } else {
      if (!confirm(`Are you sure you want to deactivate role "${role.display_name}"?\n\nThe role will be hidden from new vendors but existing vendors will keep their role.`)) {
        return;
      }
    }

    try {
      const endpoint = permanent 
        ? `/admin/roles/${role.id}?permanent=true`
        : `/admin/roles/${role.id}`;
      const response = await apiClient.delete<any>(endpoint);
      
      if (response.success) {
        toast.success(response.message || (permanent ? 'Role permanently deleted' : 'Role deactivated'));
        loadRoles();
      } else {
        toast.error(response.error || 'Failed to delete role');
      }
    } catch (error: any) {
      console.error('Error deleting role:', error);
      toast.error(error.message || 'Failed to delete role');
    }
  };

  // Group roles by customer_service
  const rolesByService = useMemo(() => {
    const grouped: Record<string, VendorRole[]> = {};
    roles.forEach(role => {
      const service = role.customer_service || 'other';
      if (!grouped[service]) {
        grouped[service] = [];
      }
      grouped[service].push(role);
    });
    return grouped;
  }, [roles]);

  const filteredRoles = useMemo(() => {
    return roles.filter(role => {
      // Status filter
      if (filterStatus === 'active' && !role.isActive) return false;
      if (filterStatus === 'inactive' && role.isActive) return false;

      // Service filter
      if (filterService !== 'all' && role.customer_service !== filterService) return false;

      // Search filter
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        return (
          role.name.toLowerCase().includes(search) ||
          role.display_name.toLowerCase().includes(search) ||
          role.description.toLowerCase().includes(search) ||
          (role.customer_service || '').toLowerCase().includes(search)
        );
      }

      return true;
    });
  }, [roles, filterStatus, filterService, searchTerm]);

  const uniqueServices = useMemo(() => {
    const services = new Set(roles.map(r => r.customer_service).filter(Boolean));
    return ['all', ...Array.from(services)].sort();
  }, [roles]);

  if (loading) {
    return (
      <div className="p-6 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto"></div>
        <p className="mt-4 text-gray-600">Loading vendor roles...</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Vendor Roles & Configuration</h2>
          <p className="text-sm text-gray-500 mt-1">
            Manage vendor roles, capabilities, and configuration. All data is stored in the database.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditingRole(null);
            setShowWizard(true);
          }}
          className="bg-[#FF8C42] hover:bg-[#FF7A2E] text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Role
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="p-4">
          <div className="text-2xl font-bold text-gray-900">{roles.length}</div>
          <div className="text-sm text-gray-500">Total Roles</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold text-green-600">{roles.filter(r => r.isActive).length}</div>
          <div className="text-sm text-gray-500">Active Roles</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold text-gray-600">{roles.filter(r => !r.isActive).length}</div>
          <div className="text-sm text-gray-500">Inactive Roles</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold text-blue-600">
            {Array.from(new Set(roles.flatMap(r => r.capabilities))).length}
          </div>
          <div className="text-sm text-gray-500">Total Capabilities</div>
        </Card>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search roles..."
                value={searchTerm}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:border-orange-500 focus:ring-2 focus:ring-orange-100 outline-none"
              />
            </div>
          </div>
          <select
            value={filterStatus}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFilterStatus(e.target.value as any)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:border-orange-500 outline-none"
          >
            <option value="all">All Status</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </select>
          <select
            value={filterService}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFilterService(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:border-orange-500 outline-none"
          >
            <option value="all">All Services</option>
            {uniqueServices.filter(s => s !== 'all' && s !== null && s !== undefined).map(service => (
              <option key={service} value={service || 'other'}>{service || 'Other'}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Roles List - Serial Display */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {roles.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-gray-500 mb-2">No roles found</p>
            <p className="text-xs text-gray-400">
              {loading ? 'Loading...' : 'Try creating a role or check the API connection.'}
            </p>
          </div>
        ) : filteredRoles.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-gray-500">No roles match the current filters</p>
            <button
              onClick={() => {
                setFilterStatus('all');
                setFilterService('all');
                setSearchTerm('');
              }}
              className="mt-2 text-sm text-orange-600 hover:underline"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">#</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role Code</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Service</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Config</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Capabilities</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredRoles.map((role, index) => (
                  <tr key={role.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {index + 1}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{role.display_name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">{role.name}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-600 max-w-xs truncate">{role.description || '-'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {role.customer_service ? (
                        <span className="px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded">
                          {role.customer_service}
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {role.vendorConfiguration ? (
                        <span className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded capitalize">
                          {role.vendorConfiguration}
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-600">{role.capabilities.length}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {role.isActive ? (
                        <span className="inline-flex items-center px-2 py-1 text-xs font-medium text-green-800 bg-green-100 rounded">
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 text-xs font-medium text-gray-800 bg-gray-100 rounded">
                          <XCircle className="w-4 h-4 mr-1" />
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingRole(role);
                            setShowWizard(true);
                          }}
                          title="Edit role"
                        >
                          <Edit className="w-3 h-3 mr-1" />
                          Edit
                        </Button>
                        
                        {!isSystemRole(role) && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleToggleActive(role)}
                              title={role.isActive ? 'Deactivate role' : 'Activate role'}
                              className={role.isActive 
                                ? 'text-orange-600 border-orange-300 hover:bg-orange-50' 
                                : 'text-green-600 border-green-300 hover:bg-green-50'
                              }
                            >
                              {role.isActive ? (
                                <Pause className="w-3 h-3" />
                              ) : (
                                <Play className="w-3 h-3" />
                              )}
                            </Button>
                            
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDeleteRole(role, true)}
                              title="Permanently delete role"
                              className="text-red-600 border-red-300 hover:bg-red-50"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Vendor Role Wizard Modal */}
      <VendorRoleWizard
        isOpen={showWizard}
        onClose={() => {
          setShowWizard(false);
          setEditingRole(null);
        }}
        onSuccess={() => {
          loadRoles();
          setShowWizard(false);
          setEditingRole(null);
        }}
        editingRole={editingRole}
      />
    </div>
  );
}
