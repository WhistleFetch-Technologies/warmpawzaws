'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { apiClient } from '@/lib/api-client';
import { Button, Card, CardHeader, CardTitle, CardContent, Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, Input, Label, Badge, Textarea, Checkbox, Tabs, TabsList, TabsTrigger, TabsContent, Switch } from '@warmpawz/ui';
import { Search, Filter, RotateCcw, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';

interface Role {
  id: string;
  name: string; // roleCode
  display_name: string; // roleName
  description: string;
  category: string;
  icon?: string;
  is_active: boolean;
  capabilities: string[];
  vendorTypes?: string[];
  serviceStyles?: string[];
  pricingControl?: {
    canControlPrice: boolean;
    canControlDuration: boolean;
  };
  form_config?: any;
}

interface Capability {
  id: string;
  name: string;
  description: string;
  category: string;
}

type RoleFilter = 'all' | 'active' | 'inactive';

export function AdminRolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [capabilities, setCapabilities] = useState<Capability[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      // Fetch ALL roles including inactive ones
      const [rolesRes, capsRes] = await Promise.all([
        apiClient.get<any>('/admin/roles?active=false'), // Get all roles including inactive
        apiClient.get<any>('/admin/capabilities'),
      ]);
      if (rolesRes.success) {
        // Map backend response to frontend Role interface
        const mappedRoles = (rolesRes.roles || []).map((r: any) => ({
          id: r.id || r.roleId,
          name: r.name || r.roleCode,
          display_name: r.display_name || r.roleName,
          description: r.description || '',
          category: r.category || 'general',
          icon: r.icon || null,
          is_active: r.is_active !== false && r.isActive !== false,
          capabilities: r.capabilities || [],
          vendorTypes: r.vendorTypes || [],
          serviceStyles: r.serviceStyles || [],
          pricingControl: r.pricingControl || {
            canControlPrice: false,
            canControlDuration: false,
          },
        }));
        setRoles(mappedRoles);
      }
      if (capsRes.success) setCapabilities(capsRes.capabilities || []);
    } catch (err) {
      console.error('Error loading roles:', err);
      alert('Failed to load roles. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Get unique categories from roles
  const categories = useMemo(() => {
    const cats = new Set(roles.map(r => r.category));
    return ['all', ...Array.from(cats)];
  }, [roles]);

  // Filtered roles based on search, status, and category
  const filteredRoles = useMemo(() => {
    return roles.filter(role => {
      // Status filter
      if (roleFilter === 'active' && !role.is_active) return false;
      if (roleFilter === 'inactive' && role.is_active) return false;
      
      // Category filter
      if (categoryFilter !== 'all' && role.category !== categoryFilter) return false;
      
      // Search filter
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        return (
          role.display_name.toLowerCase().includes(search) ||
          role.name.toLowerCase().includes(search) ||
          role.description.toLowerCase().includes(search)
        );
      }
      
      return true;
    });
  }, [roles, roleFilter, categoryFilter, searchTerm]);

  const handleToggleRole = async (roleId: string, isActive: boolean) => {
    try {
      const action = isActive ? 'deactivate' : 'activate';
      const confirmed = window.confirm(
        `Are you sure you want to ${action} this role? ${
          isActive 
            ? 'Deactivated roles will not be available for new vendors but existing vendors will retain their role.' 
            : 'This will make the role available for vendor onboarding.'
        }`
      );
      
      if (!confirmed) return;
      
      await apiClient.put(`/admin/roles/${roleId}`, { is_active: !isActive });
      loadData();
    } catch (err) {
      console.error('Error toggling role:', err);
      alert('Failed to update role status');
    }
  };

  const handleRestoreRole = async (roleId: string) => {
    try {
      await apiClient.put(`/admin/roles/${roleId}`, { is_active: true });
      loadData();
    } catch (err) {
      console.error('Error restoring role:', err);
      alert('Failed to restore role');
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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Roles & Capabilities</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage vendor roles, capabilities, and configuration. All data is stored in the database.
          </p>
        </div>
        <Button
          onClick={() => setShowAddModal(true)}
          variant="default"
        >
          + Add Role
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="cursor-pointer hover:border-primary transition" onClick={() => setRoleFilter('all')}>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Total Roles</p>
            <p className="text-2xl font-bold text-gray-900">{roles.length}</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-green-500 transition" onClick={() => setRoleFilter('active')}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
              <p className="text-sm text-muted-foreground">Active Roles</p>
            </div>
            <p className="text-2xl font-bold text-green-600">{roles.filter(r => r.is_active).length}</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-gray-400 transition" onClick={() => setRoleFilter('inactive')}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <XCircle className="w-4 h-4 text-gray-500" />
              <p className="text-sm text-muted-foreground">Inactive Roles</p>
            </div>
            <p className="text-2xl font-bold text-gray-500">{roles.filter(r => !r.is_active).length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Total Capabilities</p>
            <p className="text-2xl font-bold text-primary">{capabilities.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 bg-white p-4 rounded-lg border">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            type="text"
            placeholder="Search roles..."
            value={searchTerm}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as RoleFilter)}
            className="h-9 px-3 py-1 text-sm border rounded-md bg-white"
          >
            <option value="all">All Status</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </select>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="h-9 px-3 py-1 text-sm border rounded-md bg-white capitalize"
          >
            {categories.map(cat => (
              <option key={cat} value={cat} className="capitalize">
                {cat === 'all' ? 'All Categories' : cat.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </div>
        {(searchTerm || roleFilter !== 'all' || categoryFilter !== 'all') && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearchTerm('');
              setRoleFilter('all');
              setCategoryFilter('all');
            }}
          >
            Clear Filters
          </Button>
        )}
      </div>

      {/* Filtered count */}
      <div className="text-sm text-gray-500">
        Showing {filteredRoles.length} of {roles.length} roles
        {roleFilter !== 'all' && ` (${roleFilter})`}
        {categoryFilter !== 'all' && ` in ${categoryFilter.replace(/_/g, ' ')}`}
      </div>

      {/* Roles Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredRoles.map((role) => (
          <Card
            key={role.id}
            className={`cursor-pointer hover:shadow-md transition relative ${
              !role.is_active ? 'opacity-75 border-dashed' : ''
            }`}
            onClick={() => setSelectedRole(role)}
          >
            {/* Inactive overlay banner */}
            {!role.is_active && (
              <div className="absolute top-0 left-0 right-0 bg-gray-100 px-3 py-1 rounded-t-lg flex items-center justify-between">
                <span className="text-xs text-gray-600 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Inactive Role
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs text-green-600 hover:text-green-700 hover:bg-green-50"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRestoreRole(role.id);
                  }}
                >
                  <RotateCcw className="w-3 h-3 mr-1" />
                  Restore
                </Button>
              </div>
            )}
            <CardContent className={`p-4 ${!role.is_active ? 'pt-10' : ''}`}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  {role.icon && (
                    <span className="text-2xl">{role.icon}</span>
                  )}
                  <div>
                    <h3 className="font-semibold text-gray-900">{role.display_name}</h3>
                    <p className="text-xs text-muted-foreground">{role.name}</p>
                  </div>
                </div>
                <Badge variant={role.is_active ? "default" : "secondary"}>
                  {role.is_active ? 'Active' : 'Inactive'}
                </Badge>
              </div>
              <p className="text-sm text-gray-600 mb-3 line-clamp-2">{role.description}</p>
              
              {/* Vendor Types */}
              {role.vendorTypes && role.vendorTypes.length > 0 && (
                <div className="mb-2">
                  <span className="text-xs text-gray-500">Vendor Types: </span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {role.vendorTypes.slice(0, 3).map((vt, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs">{vt}</Badge>
                    ))}
                    {role.vendorTypes.length > 3 && (
                      <Badge variant="outline" className="text-xs">+{role.vendorTypes.length - 3}</Badge>
                    )}
                  </div>
                </div>
              )}
              
              {/* Service Styles */}
              {role.serviceStyles && role.serviceStyles.length > 0 && (
                <div className="mb-2">
                  <span className="text-xs text-gray-500">Service Styles: </span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {role.serviceStyles.slice(0, 2).map((ss, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs bg-blue-50">{ss}</Badge>
                    ))}
                    {role.serviceStyles.length > 2 && (
                      <Badge variant="outline" className="text-xs">+{role.serviceStyles.length - 2}</Badge>
                    )}
                  </div>
                </div>
              )}
              
              {/* Pricing Control */}
              {role.pricingControl && (
                <div className="mb-3">
                  <div className="flex gap-2 text-xs">
                    {role.pricingControl.canControlPrice && (
                      <Badge variant="outline" className="text-xs bg-green-50">Can Control Price</Badge>
                    )}
                    {role.pricingControl.canControlDuration && (
                      <Badge variant="outline" className="text-xs bg-green-50">Can Control Duration</Badge>
                    )}
                  </div>
                </div>
              )}

              {/* Capabilities Summary */}
              <div className="mb-3 p-2 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-gray-700">Capabilities</span>
                  <span className="text-xs text-primary font-semibold">
                    {role.capabilities?.length || 0} / {capabilities.length}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-1.5">
                  <div 
                    className="bg-primary h-1.5 rounded-full transition-all"
                    style={{ width: `${((role.capabilities?.length || 0) / capabilities.length) * 100}%` }}
                  />
                </div>
                {role.capabilities && role.capabilities.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {role.capabilities.slice(0, 4).map((cap, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs bg-primary/5 text-primary border-primary/20">
                        {cap.replace(/_/g, ' ')}
                      </Badge>
                    ))}
                    {role.capabilities.length > 4 && (
                      <Badge variant="outline" className="text-xs">+{role.capabilities.length - 4} more</Badge>
                    )}
                  </div>
                )}
              </div>
              
              <div className="flex items-center justify-between pt-3 border-t">
                <span className="text-xs text-muted-foreground capitalize">{role.category.replace(/_/g, ' ')}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedRole(role);
                  }}
                >
                  Edit →
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Empty state */}
      {filteredRoles.length === 0 && (
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed">
          <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No roles found</h3>
          <p className="text-sm text-gray-500 mb-4">
            {searchTerm 
              ? 'Try adjusting your search or filters'
              : roleFilter === 'inactive' 
                ? 'No inactive roles. All roles are currently active.'
                : 'No roles match the current filters.'
            }
          </p>
          <Button
            variant="outline"
            onClick={() => {
              setSearchTerm('');
              setRoleFilter('all');
              setCategoryFilter('all');
            }}
          >
            Clear Filters
          </Button>
        </div>
      )}

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
  const [activeTab, setActiveTab] = useState('basic');
  const [formData, setFormData] = useState({
    display_name: role.display_name,
    description: role.description,
    category: role.category || 'general',
    icon: role.icon || '',
    is_active: role.is_active,
    capabilities: role.capabilities || [],
    vendorTypes: role.vendorTypes || [],
    serviceStyles: role.serviceStyles || [],
    pricingControl: role.pricingControl || {
      canControlPrice: false,
      canControlDuration: false,
    },
  });

  const availableVendorTypes = ['Service Provider', 'Healthcare Provider', 'organization', 'Seller', 'Business'];
  const availableServiceStyles = ['At Center', 'At Home', 'Tele Consultation'];

  const toggleCapability = (capName: string) => {
    if (formData.capabilities.includes(capName)) {
      setFormData({ ...formData, capabilities: formData.capabilities.filter(c => c !== capName) });
    } else {
      setFormData({ ...formData, capabilities: [...formData.capabilities, capName] });
    }
  };

  const toggleVendorType = (vt: string) => {
    if (formData.vendorTypes.includes(vt)) {
      setFormData({ ...formData, vendorTypes: formData.vendorTypes.filter(t => t !== vt) });
    } else {
      setFormData({ ...formData, vendorTypes: [...formData.vendorTypes, vt] });
    }
  };

  const toggleServiceStyle = (ss: string) => {
    if (formData.serviceStyles.includes(ss)) {
      setFormData({ ...formData, serviceStyles: formData.serviceStyles.filter(s => s !== ss) });
    } else {
      setFormData({ ...formData, serviceStyles: [...formData.serviceStyles, ss] });
    }
  };

  const handleSave = () => {
    // Normalize vendorTypes and serviceStyles back to backend format before saving
    const vendorTypeMapping: Record<string, string> = {
      'Service Provider': 'solo_provider',
      'Healthcare Provider': 'center',
      'organization': 'organization',
      'Seller': 'seller',
      'Business': 'business',
    };
    const serviceStyleMapping: Record<string, string> = {
      'At Center': 'at_center',
      'At Home': 'at_home',
      'Tele Consultation': 'tele',
    };

    const normalizedData = {
      ...formData,
      vendorTypes: formData.vendorTypes.map(vt => vendorTypeMapping[vt] || vt),
      serviceStyles: formData.serviceStyles.map(ss => serviceStyleMapping[ss] || ss),
    };
    onSave(normalizedData);
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col bg-white border border-gray-300 text-gray-900">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {role.icon && <span className="text-2xl">{role.icon}</span>}
            {role.display_name} ({role.name})
          </DialogTitle>
          <DialogDescription>Edit role configuration and capabilities</DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="basic">Basic</TabsTrigger>
            <TabsTrigger value="types">Types & Styles</TabsTrigger>
            <TabsTrigger value="pricing">Pricing</TabsTrigger>
            <TabsTrigger value="onboarding">Onboarding</TabsTrigger>
            <TabsTrigger value="workflow">Workflow</TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto mt-4">
            {/* Basic Tab */}
            <TabsContent value="basic" className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="display_name">Display Name *</Label>
                  <Input
                    id="display_name"
                    type="text"
                    value={formData.display_name}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, display_name: e.target.value })}
                    placeholder="e.g., Veterinarian"
                  />
                </div>
                <div>
                  <Label htmlFor="category">Category *</Label>
                  <select
                    id="category"
                    value={formData.category}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full h-9 px-3 py-2 text-sm border border-gray-300 rounded-md bg-white text-gray-900"
                  >
                    <option value="healthcare">Healthcare</option>
                    <option value="service_provider">Service Provider</option>
                    <option value="retail">Retail</option>
                    <option value="hospitality">Hospitality</option>
                    <option value="specialist">Specialist</option>
                    <option value="general">General</option>
                  </select>
                </div>
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  placeholder="Describe this role..."
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
                <Label>Active</Label>
              </div>

              <div className="mt-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold">Capabilities</h3>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="flex items-center gap-1">
                      <span className="w-3 h-3 rounded bg-primary"></span>
                      <span className="text-gray-600">Selected: {formData.capabilities.length}</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-3 h-3 rounded bg-gray-200"></span>
                      <span className="text-gray-600">Available: {allCapabilities.length - formData.capabilities.length}</span>
                    </span>
                  </div>
                </div>
                
                {/* Quick actions */}
                <div className="flex gap-2 mb-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setFormData({ ...formData, capabilities: allCapabilities.map(c => c.id) })}
                  >
                    Select All
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setFormData({ ...formData, capabilities: [] })}
                  >
                    Clear All
                  </Button>
                </div>

                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {Object.entries(groupedCapabilities).map(([category, caps]) => {
                    // FIX: Use cap.id instead of cap.name for comparison (backend stores IDs not display names)
                    const selectedInCategory = caps.filter(c => formData.capabilities.includes(c.id)).length;
                    return (
                      <Card key={category} className="bg-white border border-gray-300">
                        <CardContent className="p-4 bg-white text-gray-900">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="font-medium text-gray-700">{category}</h4>
                            <Badge variant={selectedInCategory === caps.length ? "default" : selectedInCategory > 0 ? "secondary" : "outline"}>
                              {selectedInCategory}/{caps.length} selected
                            </Badge>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            {caps.map((cap) => {
                              // FIX: Use cap.id instead of cap.name for comparison
                              const isSelected = formData.capabilities.includes(cap.id);
                              return (
                                <label
                                  key={cap.id}
                                  className={`flex items-center gap-2 p-2 rounded cursor-pointer transition ${
                                    isSelected 
                                      ? 'bg-primary/10 border-2 border-primary text-gray-900' 
                                      : 'bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-600'
                                  }`}
                                  title={cap.description}
                                >
                                  <Checkbox
                                    checked={isSelected}
                                    onCheckedChange={() => toggleCapability(cap.id)}
                                  />
                                  <div className="flex-1 min-w-0">
                                    <span className={`text-sm block truncate ${isSelected ? 'font-medium' : ''}`}>
                                      {cap.name}
                                    </span>
                                  </div>
                                  {isSelected && (
                                    <span className="text-xs text-primary">✓</span>
                                  )}
                                </label>
                              );
                            })}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            </TabsContent>

            {/* Types & Styles Tab */}
            <TabsContent value="types" className="space-y-4">
              <div>
                <Label className="mb-3 block">Vendor Types</Label>
                <div className="grid grid-cols-2 gap-3">
                  {availableVendorTypes.map((vt) => (
                    <label
                      key={vt}
                      className={`flex items-center gap-2 p-3 border rounded-lg cursor-pointer transition ${
                        formData.vendorTypes.includes(vt) ? 'bg-primary/10 border border-primary text-gray-900' : 'bg-white hover:bg-gray-50 border border-gray-300 text-gray-900'
                      }`}
                    >
                      <Checkbox
                        checked={formData.vendorTypes.includes(vt)}
                        onCheckedChange={() => toggleVendorType(vt)}
                      />
                      <span className="text-sm font-medium">{vt}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <Label className="mb-3 block">Service Styles</Label>
                <div className="grid grid-cols-3 gap-3">
                  {availableServiceStyles.map((ss) => (
                    <label
                      key={ss}
                      className={`flex items-center gap-2 p-3 border rounded-lg cursor-pointer transition ${
                        formData.serviceStyles.includes(ss) ? 'bg-blue-50 border border-blue-500 text-gray-900' : 'bg-white hover:bg-gray-50 border border-gray-300 text-gray-900'
                      }`}
                    >
                      <Checkbox
                        checked={formData.serviceStyles.includes(ss)}
                        onCheckedChange={() => toggleServiceStyle(ss)}
                      />
                      <span className="text-sm font-medium">{ss}</span>
                    </label>
                  ))}
                </div>
              </div>
            </TabsContent>

            {/* Pricing Tab */}
            <TabsContent value="pricing" className="space-y-4">
              <Card className="bg-white border border-gray-300">
                <CardContent className="p-6 space-y-4 bg-white text-gray-900">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-base font-medium">Can Control Price</Label>
                      <p className="text-sm text-gray-500 mt-1">Allow vendors with this role to set custom pricing</p>
                    </div>
                    <Switch
                      checked={formData.pricingControl.canControlPrice}
                      onCheckedChange={(checked) => setFormData({
                        ...formData,
                        pricingControl: { ...formData.pricingControl, canControlPrice: checked }
                      })}
                    />
                  </div>
                  <div className="border-t pt-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-base font-medium">Can Control Duration</Label>
                        <p className="text-sm text-gray-500 mt-1">Allow vendors with this role to set custom service duration</p>
                      </div>
                      <Switch
                        checked={formData.pricingControl.canControlDuration}
                        onCheckedChange={(checked) => setFormData({
                          ...formData,
                          pricingControl: { ...formData.pricingControl, canControlDuration: checked }
                        })}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Onboarding Tab */}
            <TabsContent value="onboarding" className="space-y-4">
              <Card>
                <CardContent className="p-6">
                  <p className="text-gray-600">Onboarding configuration for this role will be available soon.</p>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Workflow Tab */}
            <TabsContent value="workflow" className="space-y-4">
              <Card>
                <CardContent className="p-6">
                  <p className="text-gray-600">Workflow configuration for this role will be available soon.</p>
                </CardContent>
              </Card>
            </TabsContent>
          </div>
        </Tabs>

        <DialogFooter className="mt-4">
          <Button
            onClick={onToggle}
            variant={role.is_active ? "secondary" : "default"}
          >
            {role.is_active ? 'Deactivate Role' : 'Activate Role'}
          </Button>
          <div className="flex gap-2">
            <Button onClick={onClose} variant="outline">
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              variant="default"
            >
              Save Changes
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
    icon: '',
    is_active: true,
    capabilities: [] as string[],
    vendorTypes: [] as string[],
    serviceStyles: [] as string[],
    pricingControl: {
      canControlPrice: false,
      canControlDuration: false,
    },
  });

  const availableVendorTypes = ['Service Provider', 'Healthcare Provider', 'organization', 'Seller', 'Business'];
  const availableServiceStyles = ['At Center', 'At Home', 'Tele Consultation'];

  const toggleCapability = (capName: string) => {
    if (formData.capabilities.includes(capName)) {
      setFormData({ ...formData, capabilities: formData.capabilities.filter(c => c !== capName) });
    } else {
      setFormData({ ...formData, capabilities: [...formData.capabilities, capName] });
    }
  };

  const toggleVendorType = (vt: string) => {
    if (formData.vendorTypes.includes(vt)) {
      setFormData({ ...formData, vendorTypes: formData.vendorTypes.filter(t => t !== vt) });
    } else {
      setFormData({ ...formData, vendorTypes: [...formData.vendorTypes, vt] });
    }
  };

  const toggleServiceStyle = (ss: string) => {
    if (formData.serviceStyles.includes(ss)) {
      setFormData({ ...formData, serviceStyles: formData.serviceStyles.filter(s => s !== ss) });
    } else {
      setFormData({ ...formData, serviceStyles: [...formData.serviceStyles, ss] });
    }
  };

  const handleSave = () => {
    if (!formData.name || !formData.display_name) {
      alert('Please fill in all required fields');
      return;
    }

    // Normalize vendorTypes and serviceStyles back to backend format before saving
    const vendorTypeMapping: Record<string, string> = {
      'Service Provider': 'solo_provider',
      'Healthcare Provider': 'center',
      'organization': 'organization',
      'Seller': 'seller',
      'Business': 'business',
    };
    const serviceStyleMapping: Record<string, string> = {
      'At Center': 'at_center',
      'At Home': 'at_home',
      'Tele Consultation': 'tele',
    };

    const normalizedData = {
      ...formData,
      roleCode: formData.name.toLowerCase().replace(/\s+/g, '_'),
      roleName: formData.display_name,
      vendorTypes: formData.vendorTypes.map(vt => vendorTypeMapping[vt] || vt),
      serviceStyles: formData.serviceStyles.map(ss => serviceStyleMapping[ss] || ss),
    };
    onSave(normalizedData);
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto bg-white border border-gray-300 text-gray-900">
        <DialogHeader>
          <DialogTitle>Create New Role</DialogTitle>
          <DialogDescription>Define a new role with capabilities</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="role_name">Role Name (ID) *</Label>
              <Input
                id="role_name"
                type="text"
                value={formData.name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, name: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
                placeholder="e.g., pet_groomer"
              />
            </div>
            <div>
              <Label htmlFor="display_name_new">Display Name *</Label>
              <Input
                id="display_name_new"
                type="text"
                value={formData.display_name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, display_name: e.target.value })}
                placeholder="e.g., Pet Groomer"
              />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="description_new">Description</Label>
              <Textarea
                id="description_new"
                value={formData.description}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData({ ...formData, description: e.target.value })}
                rows={2}
                placeholder="Describe this role..."
              />
            </div>
            <div>
              <Label htmlFor="category">Category *</Label>
              <select
                id="category"
                value={formData.category}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormData({ ...formData, category: e.target.value })}
                className="w-full h-9 px-3 py-2 text-sm border rounded-md"
              >
                <option value="healthcare">Healthcare</option>
                <option value="service_provider">Service Provider</option>
                <option value="retail">Retail</option>
                <option value="hospitality">Hospitality</option>
                <option value="specialist">Specialist</option>
                <option value="general">General</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
              <Label>Active</Label>
            </div>
          </div>

          <div className="border-t pt-4">
            <Label className="mb-3 block">Vendor Types</Label>
            <div className="grid grid-cols-2 gap-3">
              {availableVendorTypes.map((vt) => (
                <label
                  key={vt}
                  className={`flex items-center gap-2 p-3 border rounded-lg cursor-pointer transition ${
                    formData.vendorTypes.includes(vt) ? 'bg-primary/10 border-primary' : 'hover:bg-gray-50'
                  }`}
                >
                  <Checkbox
                    checked={formData.vendorTypes.includes(vt)}
                    onCheckedChange={() => toggleVendorType(vt)}
                  />
                  <span className="text-sm font-medium">{vt}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="border-t pt-4">
            <Label className="mb-3 block">Service Styles</Label>
            <div className="grid grid-cols-3 gap-3">
              {availableServiceStyles.map((ss) => (
                <label
                  key={ss}
                  className={`flex items-center gap-2 p-3 border rounded-lg cursor-pointer transition ${
                    formData.serviceStyles.includes(ss) ? 'bg-blue-50 border-blue-500' : 'hover:bg-gray-50'
                  }`}
                >
                  <Checkbox
                    checked={formData.serviceStyles.includes(ss)}
                    onCheckedChange={() => toggleServiceStyle(ss)}
                  />
                  <span className="text-sm font-medium">{ss}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="border-t pt-4">
            <Label className="mb-3 block">Pricing Control</Label>
            <Card>
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium">Can Control Price</Label>
                    <p className="text-xs text-gray-500 mt-1">Allow vendors to set custom pricing</p>
                  </div>
                  <Switch
                    checked={formData.pricingControl.canControlPrice}
                    onCheckedChange={(checked) => setFormData({
                      ...formData,
                      pricingControl: { ...formData.pricingControl, canControlPrice: checked }
                    })}
                  />
                </div>
                <div className="border-t pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm font-medium">Can Control Duration</Label>
                      <p className="text-xs text-gray-500 mt-1">Allow vendors to set custom service duration</p>
                    </div>
                    <Switch
                      checked={formData.pricingControl.canControlDuration}
                      onCheckedChange={(checked) => setFormData({
                        ...formData,
                        pricingControl: { ...formData.pricingControl, canControlDuration: checked }
                      })}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="border-t pt-4">
            <h3 className="font-semibold mb-3">Select Capabilities ({formData.capabilities.length} selected)</h3>
            <div className="space-y-4 max-h-60 overflow-y-auto">
              {Object.entries(groupedCapabilities).map(([category, caps]) => (
                <Card key={category}>
                  <CardContent className="p-4">
                    <h4 className="font-medium text-gray-700 mb-3">{category}</h4>
                    <div className="grid grid-cols-2 gap-2">
                      {caps.map((cap) => (
                        <label
                          key={cap.id}
                          className={`flex items-center gap-2 p-2 rounded cursor-pointer transition ${
                            formData.capabilities.includes(cap.id) ? 'bg-primary/10 border border-primary' : 'hover:bg-gray-50 border border-transparent'
                          }`}
                        >
                          <Checkbox
                            checked={formData.capabilities.includes(cap.id)}
                            onCheckedChange={() => toggleCapability(cap.id)}
                          />
                          <span className="text-sm">{cap.name}</span>
                        </label>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={onClose} variant="outline">
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            variant="default"
          >
            Create Role
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

