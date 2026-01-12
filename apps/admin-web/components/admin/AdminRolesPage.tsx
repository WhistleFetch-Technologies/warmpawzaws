'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { Button, Card, CardHeader, CardTitle, CardContent, Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, Input, Label, Badge, Textarea, Checkbox, Tabs, TabsList, TabsTrigger, TabsContent, Switch } from '@warmpawz/ui';

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
        apiClient.get<any>('/admin/roles'), // Using admin endpoint to get full role data
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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-0">
      <div className="flex items-center justify-between mb-0">
        <h1 className="text-2xl font-bold text-gray-900">Roles & Capabilities</h1>
        <Button
          onClick={() => setShowAddModal(true)}
          variant="default"
        >
          + Add Role
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-0">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Total Roles</p>
            <p className="text-2xl font-bold text-gray-900">{roles.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Active Roles</p>
            <p className="text-2xl font-bold text-green-600">{roles.filter(r => r.is_active).length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Total Capabilities</p>
            <p className="text-2xl font-bold text-primary">{capabilities.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Roles Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
        {roles.map((role) => (
          <Card
            key={role.id}
            className="cursor-pointer hover:shadow-md transition"
            onClick={() => setSelectedRole(role)}
          >
            <CardContent className="p-4">
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
              
              <div className="flex items-center justify-between pt-3 border-t">
                <span className="text-xs text-muted-foreground capitalize">{role.category}</span>
                <span className="text-xs text-primary font-medium">{role.capabilities?.length || 0} capabilities</span>
              </div>
            </CardContent>
          </Card>
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
                <h3 className="font-semibold mb-3">Capabilities ({formData.capabilities.length} selected)</h3>
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {Object.entries(groupedCapabilities).map(([category, caps]) => (
                    <Card key={category} className="bg-white border border-gray-300">
                      <CardContent className="p-4 bg-white text-gray-900">
                        <h4 className="font-medium text-gray-700 mb-3">{category}</h4>
                        <div className="grid grid-cols-2 gap-2">
                          {caps.map((cap) => (
                            <label
                              key={cap.id}
                              className={`flex items-center gap-2 p-2 rounded cursor-pointer transition ${
                                formData.capabilities.includes(cap.name) ? 'bg-primary/10 border border-primary text-gray-900' : 'bg-white hover:bg-gray-50 border border-gray-300 text-gray-900'
                              }`}
                            >
                              <Checkbox
                                checked={formData.capabilities.includes(cap.name)}
                                onCheckedChange={() => toggleCapability(cap.name)}
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
                            formData.capabilities.includes(cap.name) ? 'bg-primary/10 border border-primary' : 'hover:bg-gray-50 border border-transparent'
                          }`}
                        >
                          <Checkbox
                            checked={formData.capabilities.includes(cap.name)}
                            onCheckedChange={() => toggleCapability(cap.name)}
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

