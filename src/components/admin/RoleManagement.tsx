import { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Switch } from '../ui/switch';
import { Checkbox } from '../ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '../ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Plus, Edit, Trash2, Check, X, Settings, FileText, Shield, Zap, Users, RotateCcw, RefreshCw } from 'lucide-react';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

interface Role {
  id: string;
  name: string;
  description: string;
  icon: string;
  features: string[];
  vendorTypes: string[];
  serviceStyles: string[];
  pricingControl: {
    canControlPrice: boolean;
    canControlDuration: boolean;
    priceRangeMin?: number;
    priceRangeMax?: number;
    platformControlled?: boolean;
    styleBasedControl?: any;
  };
  onboardingFields: {
    required: string[];
    optional: string[];
    custom: any[];
  };
  documentRequirements: any[];
  staffManagement: {
    enabled: boolean;
    roles: string[];
    requiresStaffDocuments: boolean;
  };
  multiService: {
    enabled: boolean;
    allowedServices: string[];
    requiresSeparateApproval: boolean;
  };
  approvalWorkflow: {
    requiresManualApproval: boolean;
    autoApproveAfterDays?: number;
    requiresBackgroundCheck: boolean;
    requiresLicenseVerification: boolean;
  };
  capabilities: string[];
  order: number;
  isActive: boolean;
}

export function RoleManagement() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [migrating, setMigrating] = useState(false);

  useEffect(() => {
    fetchRoles();
  }, []);

  const fetchRoles = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/config/roles?t=${Date.now()}`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        // Deduplicate roles by ID to prevent React key errors
        const uniqueRolesMap = new Map();
        (data.roles || []).forEach((role: Role) => {
          if (!uniqueRolesMap.has(role.id)) {
            uniqueRolesMap.set(role.id, role);
          }
        });
        setRoles(Array.from(uniqueRolesMap.values()));
      }
    } catch (error) {
      console.error('Error fetching roles:', error);
    } finally {
      setLoading(false);
    }
  };

  const seedInitialRoles = async () => {
    try {
      setSeeding(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/config/roles/seed`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        alert(`✅ Successfully seeded ${data.seeded} roles!`);
        fetchRoles();
      } else {
        const error = await response.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error seeding roles:', error);
      alert('Failed to seed roles');
    } finally {
      setSeeding(false);
    }
  };

  const migrateAllVendors = async () => {
    if (!confirm('This will migrate all existing vendors to the new role-based system. Continue?')) {
      return;
    }

    try {
      setMigrating(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/vendor/migrate-all`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        alert(`✅ Successfully migrated ${data.successCount} out of ${data.totalVendors} vendors!\n\nSuccesses: ${data.successCount}\nFailures: ${data.failureCount}`);
      } else {
        const error = await response.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error migrating vendors:', error);
      alert('Failed to migrate vendors');
    } finally {
      setMigrating(false);
    }
  };

  const getVendorTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'service_provider': 'Service Provider',
      'healthcare_provider': 'Healthcare Provider',
      'seller': 'Seller'
    };
    return labels[type] || type;
  };

  const getServiceStyleLabel = (style: string) => {
    const labels: Record<string, string> = {
      'at_home': 'At Home',
      'at_center': 'At Center',
      'tele': 'Tele Consultation'
    };
    return labels[style] || style;
  };

  const getCapabilityIcon = (capability: string) => {
    const icons: Record<string, string> = {
      'booking': '📅',
      'tele': '📞',
      'chat': '💬',
      'prescription': '📋',
      'catalog': '🛍️',
      'inventory': '📦',
      'medical_records': '🏥',
      'gps_tracking': '📍',
      'photo_updates': '📸',
      'gallery': '🖼️',
      'portfolio': '💼',
      'cctv_access': '📹',
      'progress_tracking': '📊',
      'orders': '🛒',
      'delivery': '🚚',
      'emergency': '🚨'
    };
    return icons[capability] || '✨';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42] mx-auto mb-4"></div>
          <p className="text-gray-600">Loading roles...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Role Management</h2>
          <p className="text-gray-600 mt-1">
            Configure vendor roles, types, and onboarding requirements
          </p>
        </div>
        <div className="flex gap-3">
          {roles.length > 0 && (
            <Button
              onClick={migrateAllVendors}
              disabled={migrating}
              variant="outline"
              className="border-blue-500 text-blue-600 hover:bg-blue-500 hover:text-white"
            >
              {migrating ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Migrating...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Migrate Vendors
                </>
              )}
            </Button>
          )}
          
           <Button
              onClick={async () => {
                if (!confirm('⚠️ This will DELETE ALL existing roles and RESTORE the original factory defaults. This fixes duplicates and missing forms. Continue?')) return;
                try {
                  // Use the new STRICT reset endpoint
                  const res = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/fix/reset-roles-strict`, {
                     method: 'POST',
                     headers: { 'Authorization': `Bearer ${publicAnonKey}` }
                  });
                  const data = await res.json();
                  if (res.ok) {
                     alert(data.message);
                     fetchRoles();
                  } else {
                     alert('Error: ' + data.error);
                  }
                } catch (e) {
                  alert('Failed: ' + e);
                }
              }}
              variant="outline"
              className="border-red-500 text-red-600 hover:bg-red-50"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Restore Defaults
            </Button>

          {roles.length === 0 && (
            <Button
              onClick={seedInitialRoles}
              disabled={seeding}
              variant="outline"
              className="border-[#FF8C42] text-[#FF8C42] hover:bg-[#FF8C42] hover:text-white"
            >
              {seeding ? 'Seeding...' : 'Seed Initial Roles'}
            </Button>
          )}
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                className="bg-[#FF8C42] hover:bg-[#ff7a2e]"
                onClick={() => setSelectedRole(null)}
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Role
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {selectedRole ? 'Edit Role' : 'Create New Role'}
                </DialogTitle>
                <DialogDescription>
                  {selectedRole ? 'Edit the details of this role.' : 'Create a new role with the required details.'}
                </DialogDescription>
              </DialogHeader>
              <RoleEditor
                role={selectedRole}
                onSave={() => {
                  setIsDialogOpen(false);
                  fetchRoles();
                }}
                onCancel={() => setIsDialogOpen(false)}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Roles Grid */}
      {roles.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="text-6xl mb-4">🎭</div>
          <h3 className="text-xl font-semibold mb-2">No Roles Configured</h3>
          <p className="text-gray-600 mb-6">
            Get started by seeding the initial vendor roles or create your own custom role
          </p>
          <Button
            onClick={seedInitialRoles}
            disabled={seeding}
            className="bg-[#FF8C42] hover:bg-[#ff7a2e]"
          >
            {seeding ? 'Seeding...' : 'Seed Initial Roles'}
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {roles.map((role) => (
            <Card key={role.id} className="p-6 hover:shadow-lg transition-shadow">
              {/* Role Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="text-4xl">{role.icon}</div>
                  <div>
                    <h3 className="font-semibold text-lg">{role.name}</h3>
                    <p className="text-sm text-gray-500">{role.id}</p>
                  </div>
                </div>
                <Badge variant={role.isActive ? "default" : "secondary"}>
                  {role.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </div>

              {/* Description */}
              <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                {role.description}
              </p>

              {/* Vendor Types */}
              <div className="mb-3">
                <p className="text-xs font-medium text-gray-500 mb-2">VENDOR TYPES</p>
                <div className="flex flex-wrap gap-1">
                  {(role.vendorTypes || []).map((type) => (
                    <Badge key={type} variant="outline" className="text-xs">
                      {getVendorTypeLabel(type)}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Service Styles */}
              <div className="mb-3">
                <p className="text-xs font-medium text-gray-500 mb-2">SERVICE STYLES</p>
                <div className="flex flex-wrap gap-1">
                  {(role.serviceStyles || []).map((style) => (
                    <Badge key={style} variant="outline" className="text-xs bg-blue-50">
                      {getServiceStyleLabel(style)}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Pricing Control */}
              <div className="mb-3">
                <p className="text-xs font-medium text-gray-500 mb-2">PRICING CONTROL</p>
                <div className="flex gap-2 text-xs">
                  <Badge variant={role.pricingControl?.canControlPrice ? "default" : "secondary"}>
                    {role.pricingControl?.canControlPrice ? '✓ Price' : '✗ Price'}
                  </Badge>
                  <Badge variant={role.pricingControl?.canControlDuration ? "default" : "secondary"}>
                    {role.pricingControl?.canControlDuration ? '✓ Duration' : '✗ Duration'}
                  </Badge>
                </div>
              </div>

              {/* Capabilities */}
              <div className="mb-4">
                <p className="text-xs font-medium text-gray-500 mb-2">CAPABILITIES</p>
                <div className="flex flex-wrap gap-1">
                  {(role.capabilities || []).slice(0, 5).map((cap) => (
                    <span key={cap} className="text-sm" title={cap}>
                      {getCapabilityIcon(cap)}
                    </span>
                  ))}
                  {(role.capabilities || []).length > 5 && (
                    <span className="text-xs text-gray-500">
                      +{(role.capabilities || []).length - 5} more
                    </span>
                  )}
                </div>
              </div>

              {/* Special Features */}
              <div className="flex gap-2 mb-4">
                {role.staffManagement?.enabled && (
                  <Badge variant="outline" className="text-xs">
                    <Users className="w-3 h-3 mr-1" />
                    Staff
                  </Badge>
                )}
                {role.multiService?.enabled && (
                  <Badge variant="outline" className="text-xs">
                    <Zap className="w-3 h-3 mr-1" />
                    Multi-Service
                  </Badge>
                )}
                {role.approvalWorkflow?.requiresLicenseVerification && (
                  <Badge variant="outline" className="text-xs">
                    <Shield className="w-3 h-3 mr-1" />
                    License
                  </Badge>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-4 border-t">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setSelectedRole(role);
                    setIsDialogOpen(true);
                  }}
                >
                  <Edit className="w-3 h-3 mr-1" />
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (confirm(`Delete role "${role.name}"?`)) {
                      // Delete role
                    }
                  }}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// Role Editor Component
function RoleEditor({ role, onSave, onCancel }: { 
  role: Role | null; 
  onSave: () => void; 
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState<any>(() => {
    if (role) {
       return {
          ...role,
          vendorTypes: role.vendorTypes || [],
          serviceStyles: role.serviceStyles || [],
          capabilities: role.capabilities || [],
          features: role.features || [],
          pricingControl: role.pricingControl || { canControlPrice: false, canControlDuration: false },
          onboardingFields: role.onboardingFields || { required: [], optional: [], custom: [] },
          documentRequirements: role.documentRequirements || [],
          staffManagement: role.staffManagement || { enabled: false, roles: [], requiresStaffDocuments: false },
          multiService: role.multiService || { enabled: false, allowedServices: [], requiresSeparateApproval: false },
          approvalWorkflow: role.approvalWorkflow || { requiresManualApproval: true, requiresBackgroundCheck: false, requiresLicenseVerification: false },
       };
    }
    return {
      name: '',
      description: '',
      icon: '🔧',
      features: [],
      vendorTypes: [],
      serviceStyles: [],
      pricingControl: {
        canControlPrice: false,
        canControlDuration: false
      },
      onboardingFields: {
        required: ['businessName', 'ownerName', 'phone', 'email', 'address'],
        optional: [],
        custom: []
      },
      documentRequirements: [],
      staffManagement: {
        enabled: false,
        roles: [],
        requiresStaffDocuments: false
      },
      multiService: {
        enabled: false,
        allowedServices: [],
        requiresSeparateApproval: false
      },
      approvalWorkflow: {
        requiresManualApproval: true,
        requiresBackgroundCheck: false,
        requiresLicenseVerification: false
      },
      capabilities: [],
      order: 0,
      isActive: true
    };
  });

  const vendorTypeOptions = [
    { value: 'service_provider', label: 'Service Provider' },
    { value: 'healthcare_provider', label: 'Healthcare Provider' },
    { value: 'seller', label: 'Seller' }
  ];

  const serviceStyleOptions = [
    { value: 'at_home', label: 'At Home' },
    { value: 'at_center', label: 'At Center' },
    { value: 'tele', label: 'Tele Consultation' }
  ];

  const capabilityOptions = [
    'booking', 'tele', 'chat', 'prescription', 'catalog', 'inventory',
    'medical_records', 'gps_tracking', 'photo_updates', 'gallery',
    'portfolio', 'cctv_access', 'progress_tracking', 'orders', 'delivery', 'emergency'
  ];

  const handleSave = async () => {
    try {
      const url = role
        ? `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/config/roles/${role.id}`
        : `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/config/roles`;

      // Strictly construct payload with only editable fields to prevent schema errors
      const payload = {
        name: formData.name,
        description: formData.description,
        icon: formData.icon,
        features: formData.features || [],
        vendorTypes: formData.vendorTypes || [],
        serviceStyles: formData.serviceStyles || [],
        pricingControl: formData.pricingControl,
        onboardingFields: formData.onboardingFields,
        documentRequirements: formData.documentRequirements || [],
        staffManagement: formData.staffManagement,
        multiService: formData.multiService,
        approvalWorkflow: formData.approvalWorkflow,
        capabilities: formData.capabilities || [],
        order: formData.order,
        isActive: formData.isActive
      };

      const response = await fetch(url, {
        method: role ? 'PUT' : 'POST',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        alert('✅ Role saved successfully!');
        onSave();
      } else {
        const error = await response.json();
        // Handle case where error might be an object
        const errorMessage = typeof error.error === 'string' ? error.error : JSON.stringify(error);
        alert(`Error: ${errorMessage || 'Unknown error occurred'}`);
      }
    } catch (error) {
      console.error('Error saving role:', error);
      alert('Failed to save role: ' + (error instanceof Error ? error.message : String(error)));
    }
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="basic" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="basic">Basic</TabsTrigger>
          <TabsTrigger value="types">Types & Styles</TabsTrigger>
          <TabsTrigger value="pricing">Pricing</TabsTrigger>
          <TabsTrigger value="onboarding">Onboarding</TabsTrigger>
          <TabsTrigger value="workflow">Workflow</TabsTrigger>
        </TabsList>

        {/* Basic Info Tab */}
        <TabsContent value="basic" className="space-y-4">
          <div>
            <Label>Role Name *</Label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Veterinarian"
            />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe this role..."
              rows={3}
            />
          </div>
          <div>
            <Label>Icon</Label>
            <Input
              value={formData.icon}
              onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
              placeholder="🔧"
              maxLength={2}
            />
          </div>
          <div>
            <Label>Order</Label>
            <Input
              type="number"
              value={formData.order || ''}
              onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) || 0 })}
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={formData.isActive}
              onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
            />
            <Label>Active</Label>
          </div>
        </TabsContent>

        {/* Types & Styles Tab */}
        <TabsContent value="types" className="space-y-4">
          <div>
            <Label>Vendor Types *</Label>
            <div className="space-y-2 mt-2">
              {vendorTypeOptions.map((option) => (
                <div key={option.value} className="flex items-center gap-2">
                  <Checkbox
                    id={`vt-${option.value}`}
                    checked={formData.vendorTypes.includes(option.value)}
                    onCheckedChange={(checked) => {
                      const types = checked
                        ? [...formData.vendorTypes, option.value]
                        : formData.vendorTypes.filter((t: string) => t !== option.value);
                      setFormData({ ...formData, vendorTypes: types });
                    }}
                  />
                  <Label htmlFor={`vt-${option.value}`} className="cursor-pointer">{option.label}</Label>
                </div>
              ))}
            </div>
          </div>
          <div>
            <Label>Service Styles *</Label>
            <div className="space-y-2 mt-2">
              {serviceStyleOptions.map((option) => (
                <div key={option.value} className="flex items-center gap-2">
                  <Checkbox
                    id={`ss-${option.value}`}
                    checked={formData.serviceStyles.includes(option.value)}
                    onCheckedChange={(checked) => {
                      const styles = checked
                        ? [...formData.serviceStyles, option.value]
                        : formData.serviceStyles.filter((s: string) => s !== option.value);
                      setFormData({ ...formData, serviceStyles: styles });
                    }}
                  />
                  <Label htmlFor={`ss-${option.value}`} className="cursor-pointer">{option.label}</Label>
                </div>
              ))}
            </div>
          </div>
          <div>
            <Label>Capabilities</Label>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {capabilityOptions.map((cap) => (
                <div key={cap} className="flex items-center gap-2">
                  <Checkbox
                    id={`cap-${cap}`}
                    checked={formData.capabilities.includes(cap)}
                    onCheckedChange={(checked) => {
                      const caps = checked
                        ? [...formData.capabilities, cap]
                        : formData.capabilities.filter((c: string) => c !== cap);
                      setFormData({ ...formData, capabilities: caps });
                    }}
                  />
                  <Label htmlFor={`cap-${cap}`} className="text-sm cursor-pointer">{cap}</Label>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* Pricing Tab */}
        <TabsContent value="pricing" className="space-y-4">
          <div className="flex items-center gap-2">
            <Switch
              checked={formData.pricingControl.canControlPrice}
              onCheckedChange={(checked) =>
                setFormData({
                  ...formData,
                  pricingControl: { ...formData.pricingControl, canControlPrice: checked }
                })
              }
            />
            <Label>Can Control Price</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={formData.pricingControl.canControlDuration}
              onCheckedChange={(checked) =>
                setFormData({
                  ...formData,
                  pricingControl: { ...formData.pricingControl, canControlDuration: checked }
                })
              }
            />
            <Label>Can Control Duration</Label>
          </div>
          {formData.pricingControl.canControlPrice && (
            <>
              <div>
                <Label>Min Price (₹)</Label>
                <Input
                  type="number"
                  value={formData.pricingControl.priceRangeMin || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      pricingControl: {
                        ...formData.pricingControl,
                        priceRangeMin: parseFloat(e.target.value) || 0
                      }
                    })
                  }
                />
              </div>
              <div>
                <Label>Max Price (₹)</Label>
                <Input
                  type="number"
                  value={formData.pricingControl.priceRangeMax || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      pricingControl: {
                        ...formData.pricingControl,
                        priceRangeMax: parseFloat(e.target.value) || 0
                      }
                    })
                  }
                />
              </div>
            </>
          )}
        </TabsContent>

        {/* Onboarding Tab */}
        <TabsContent value="onboarding" className="space-y-4">
          <div className="flex items-center gap-2">
            <Switch
              checked={formData.staffManagement.enabled}
              onCheckedChange={(checked) =>
                setFormData({
                  ...formData,
                  staffManagement: { ...formData.staffManagement, enabled: checked }
                })
              }
            />
            <Label>Enable Staff Management</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={formData.multiService.enabled}
              onCheckedChange={(checked) =>
                setFormData({
                  ...formData,
                  multiService: { ...formData.multiService, enabled: checked }
                })
              }
            />
            <Label>Enable Multi-Service</Label>
          </div>
          <p className="text-sm text-gray-500">
            Configure detailed onboarding fields and document requirements in the Vendor Settings section.
          </p>
        </TabsContent>

        {/* Workflow Tab */}
        <TabsContent value="workflow" className="space-y-4">
          <div className="flex items-center gap-2">
            <Switch
              checked={formData.approvalWorkflow.requiresManualApproval}
              onCheckedChange={(checked) =>
                setFormData({
                  ...formData,
                  approvalWorkflow: { ...formData.approvalWorkflow, requiresManualApproval: checked }
                })
              }
            />
            <Label>Requires Manual Approval</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={formData.approvalWorkflow.requiresBackgroundCheck}
              onCheckedChange={(checked) =>
                setFormData({
                  ...formData,
                  approvalWorkflow: { ...formData.approvalWorkflow, requiresBackgroundCheck: checked }
                })
              }
            />
            <Label>Requires Background Check</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={formData.approvalWorkflow.requiresLicenseVerification}
              onCheckedChange={(checked) =>
                setFormData({
                  ...formData,
                  approvalWorkflow: { ...formData.approvalWorkflow, requiresLicenseVerification: checked }
                })
              }
            />
            <Label>Requires License Verification</Label>
          </div>
        </TabsContent>
      </Tabs>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button 
          onClick={handleSave}
          className="bg-[#FF8C42] hover:bg-[#ff7a2e]"
        >
          {role ? 'Update Role' : 'Create Role'}
        </Button>
      </div>
    </div>
  );
}