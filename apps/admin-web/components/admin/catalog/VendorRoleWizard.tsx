'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@warmpawz/ui';
import { Plus, X, Save, ChevronRight, ChevronLeft, Search } from 'lucide-react';
import { toast } from 'sonner';

// ============================================================================
// TYPES
// ============================================================================

interface RoleFormData {
  name: string;
  display_name: string;
  description: string;
  customer_service: string | null;
  vendorConfiguration: 'solo' | 'business' | null;
  vendorTypes: string[];
  serviceStyles: {
    solo: string[];
    business: string[];
    selected: string[];
  };
  capabilities: string[];
  allowCustomServicesForSolo: boolean;
  isActive: boolean;
}

interface Capability {
  id: string;
  name: string;
  description: string;
  category: string;
}

const VENDOR_TYPES = [
  { id: 'healthcare_provider', name: 'Healthcare Provider' },
  { id: 'service_provider', name: 'Service Provider' },
  { id: 'seller', name: 'Seller' },
  { id: 'organization', name: 'Organization' },
  { id: 'ngo', name: 'NGO' },
  { id: 'business', name: 'Business' },
];

const SERVICE_STYLES = [
  { id: 'at_center', name: 'At Center' },
  { id: 'at_home', name: 'At Home' },
  { id: 'tele', name: 'Tele Consultation' },
  { id: 'video_consultation', name: 'Video Consultation' },
  { id: 'delivery', name: 'Delivery' },
  { id: 'pickup', name: 'Pickup' },
  { id: 'outdoor', name: 'Outdoor' },
];

const CUSTOMER_SERVICES = [
  'vet', 'grooming', 'training', 'shop', 'walker', 'boarding',
  'adoption', 'cafes', 'photography', 'insurance', 'breeder',
  'ambulance', 'nutritionist', 'relocation', 'resort', 'holiday',
  'sunset', 'sitter'
];

const initialFormData: RoleFormData = {
  name: '',
  display_name: '',
  description: '',
  customer_service: null,
  vendorConfiguration: null,
  vendorTypes: [],
  serviceStyles: {
    solo: [],
    business: [],
    selected: [],
  },
  capabilities: [],
  allowCustomServicesForSolo: false,
  isActive: true,
};

// ============================================================================
// COMPONENT
// ============================================================================

interface VendorRoleWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editingRole?: any;
}

export function VendorRoleWizard({ isOpen, onClose, onSuccess, editingRole }: VendorRoleWizardProps) {
  const [wizardStep, setWizardStep] = useState(1);
  const [formData, setFormData] = useState<RoleFormData>(initialFormData);
  const [capabilities, setCapabilities] = useState<Capability[]>([]);
  const [capabilitySearch, setCapabilitySearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadCapabilities();
      if (editingRole) {
        loadEditingRole();
      } else {
        resetForm();
      }
    }
  }, [isOpen, editingRole]);

  const loadCapabilities = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<any>('/admin/capabilities');
      if (response.success && response.capabilities) {
        setCapabilities(response.capabilities);
      }
    } catch (error) {
      console.error('Error loading capabilities:', error);
      toast.error('Failed to load capabilities');
    } finally {
      setLoading(false);
    }
  };

  const loadEditingRole = () => {
    if (!editingRole) return;
    
    const config = editingRole.config || {};
    const serviceStylesConfig = config.serviceStyles || {};
    const capabilityRules = config.capabilityRules || {};
    const soloRules = capabilityRules.solo || {};
    const deniedCapabilities = soloRules.deniedCapabilities || [];
    
    // Check if custom_services is NOT in denied list (means it's allowed)
    const allowCustomServices = config.vendorConfiguration === 'solo'
      ? !deniedCapabilities.includes('custom_services') && !deniedCapabilities.includes('custom_packages')
      : false;

    setFormData({
      name: editingRole.name || '',
      display_name: editingRole.display_name || '',
      description: editingRole.description || '',
      customer_service: editingRole.customer_service || config.customer_service || null,
      vendorConfiguration: config.vendorConfiguration || editingRole.vendorConfiguration || null,
      vendorTypes: editingRole.vendorTypes || config.vendorTypes || [],
      serviceStyles: {
        solo: serviceStylesConfig.solo || [],
        business: serviceStylesConfig.business || [],
        selected: serviceStylesConfig.selected || (Array.isArray(serviceStylesConfig) ? serviceStylesConfig : []),
      },
      capabilities: editingRole.capabilities || [],
      allowCustomServicesForSolo: allowCustomServices,
      isActive: editingRole.isActive !== false,
    });
  };

  const resetForm = () => {
    setFormData(initialFormData);
    setWizardStep(1);
    setCapabilitySearch('');
  };

  // Get allowed service styles based on vendorConfiguration
  const getAllowedServiceStyles = (): string[] => {
    if (!formData.vendorConfiguration) return [];
    if (formData.vendorConfiguration === 'solo') {
      return ['at_home', 'tele', 'video_consultation'];
    }
    return ['at_center', 'at_home', 'tele', 'video_consultation', 'delivery', 'pickup', 'outdoor'];
  };

  // Get denied capabilities for solo (respects allowCustomServicesForSolo toggle)
  const getDeniedCapabilitiesForSolo = (): string[] => {
    const denied = [
      'staff_management', 'staff_create', 'staff_schedule',
      'inventory_manage', 'inventory',
      'center_profile'
    ];
    
    // Only deny custom_services if toggle is OFF (opt-in)
    if (!formData.allowCustomServicesForSolo) {
      denied.push('custom_services', 'custom_packages');
    }
    
    return denied;
  };

  // Check if capability should be disabled
  const isCapabilityDisabled = (capId: string): boolean => {
    if (formData.vendorConfiguration === 'solo') {
      // Allow custom_services if toggle is ON
      if ((capId === 'custom_services' || capId === 'custom_packages') && formData.allowCustomServicesForSolo) {
        return false;
      }
      if (getDeniedCapabilitiesForSolo().includes(capId)) {
        return true;
      }
    }
    return false;
  };

  // Get filtered capabilities for display
  const getFilteredCapabilities = () => {
    const filtered = capabilities.filter(cap => {
      if (capabilitySearch) {
        const search = capabilitySearch.toLowerCase();
        return (
          cap.name.toLowerCase().includes(search) ||
          cap.description.toLowerCase().includes(search) ||
          cap.category.toLowerCase().includes(search)
        );
      }
      return true;
    });

    // Group by category
    const grouped: Record<string, Capability[]> = {};
    filtered.forEach(cap => {
      if (!grouped[cap.category]) {
        grouped[cap.category] = [];
      }
      grouped[cap.category].push(cap);
    });

    return grouped;
  };

  const toggleCapability = (capId: string) => {
    if (isCapabilityDisabled(capId)) return;
    
    setFormData(prev => ({
      ...prev,
      capabilities: prev.capabilities.includes(capId)
        ? prev.capabilities.filter(c => c !== capId)
        : [...prev.capabilities, capId]
    }));
  };

  const toggleVendorType = (vtId: string) => {
    setFormData(prev => ({
      ...prev,
      vendorTypes: prev.vendorTypes.includes(vtId)
        ? prev.vendorTypes.filter(t => t !== vtId)
        : [...prev.vendorTypes, vtId]
    }));
  };

  const toggleServiceStyle = (ssId: string) => {
    const allowedStyles = getAllowedServiceStyles();
    if (!allowedStyles.includes(ssId)) return;

    setFormData(prev => ({
      ...prev,
      serviceStyles: {
        ...prev.serviceStyles,
        selected: prev.serviceStyles.selected.includes(ssId)
          ? prev.serviceStyles.selected.filter(s => s !== ssId)
          : [...prev.serviceStyles.selected, ssId]
      }
    }));
  };

  const handleNext = () => {
    if (wizardStep === 1 && !formData.vendorConfiguration) {
      toast.error('Please select Solo or Business configuration');
      return;
    }
    if (wizardStep === 3 && formData.serviceStyles.selected.length === 0) {
      toast.error('Please select at least one service style');
      return;
    }
    if (wizardStep < 4) {
      setWizardStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    if (wizardStep > 1) {
      setWizardStep(prev => prev - 1);
    }
  };

  const handleSave = async () => {
    if (!formData.name || !formData.display_name) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (!formData.vendorConfiguration) {
      toast.error('Please select Solo or Business configuration');
      return;
    }

    if (formData.serviceStyles.selected.length === 0) {
      toast.error('Please select at least one service style');
      return;
    }

    try {
      setSaving(true);

      const payload: any = {
        name: formData.name,
        display_name: formData.display_name,
        description: formData.description,
        customer_service: formData.customer_service,
        vendorConfiguration: formData.vendorConfiguration,
        capabilities: formData.capabilities,
        vendorTypes: formData.vendorTypes,
        serviceStyles: {
          solo: formData.vendorConfiguration === 'solo' ? ['at_home', 'tele', 'video_consultation'] : [],
          business: formData.vendorConfiguration === 'business' ? ['at_center', 'at_home', 'tele', 'video_consultation', 'delivery'] : [],
          selected: formData.serviceStyles.selected,
        },
        isActive: formData.isActive,
      };

      // Only include capabilityRules for solo configuration
      if (formData.vendorConfiguration === 'solo') {
        payload.capabilityRules = {
          solo: {
            deniedStyles: ['at_center'],
            deniedCapabilities: getDeniedCapabilitiesForSolo(),
            allowCustomServicesForSolo: formData.allowCustomServicesForSolo,
          },
        };
      } else {
        // Clear capabilityRules when switching to business
        payload.capabilityRules = {};
      }

      if (editingRole) {
        await apiClient.put(`/admin/roles/${editingRole.id}`, payload);
        toast.success('Role updated successfully');
      } else {
        await apiClient.post('/admin/roles', payload);
        toast.success('Role created successfully');
      }

      onSuccess();
      onClose();
      resetForm();
    } catch (error: any) {
      console.error('Error saving role:', error);
      toast.error(error.message || 'Failed to save role');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col bg-white">
        <DialogHeader>
          <DialogTitle>{editingRole ? 'Edit Vendor Role' : 'Create Vendor Role'}</DialogTitle>
          <DialogDescription>
            Configure vendor role with Solo/Business options and capabilities
          </DialogDescription>
        </DialogHeader>

        {/* Wizard Steps Indicator */}
        <div className="flex items-center justify-between mb-6 px-4">
          {[1, 2, 3, 4].map((step) => (
            <React.Fragment key={step}>
              <div className="flex flex-col items-center flex-1">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-colors ${
                    wizardStep === step
                      ? 'bg-[#FF8C42] text-white'
                      : wizardStep > step
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {step}
                </div>
                <div className="text-xs mt-2 text-center">
                  {step === 1 && 'Solo/Business'}
                  {step === 2 && 'Vendor Types'}
                  {step === 3 && 'Service Styles'}
                  {step === 4 && 'Capabilities'}
                </div>
              </div>
              {step < 4 && (
                <div
                  className={`h-1 flex-1 mx-2 transition-colors ${
                    wizardStep > step ? 'bg-green-500' : 'bg-gray-200'
                  }`}
                />
              )}
            </React.Fragment>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto space-y-6 py-4">
          {/* Step 1: Basic Info + Solo/Business Selection */}
          {wizardStep === 1 && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium block mb-1">Display Name *</label>
                  <Input
                    placeholder="e.g., Pet Cafe"
                    value={formData.display_name}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setFormData({ ...formData, display_name: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1">Role Code *</label>
                  <Input
                    placeholder="e.g., pet_cafe"
                    value={formData.name}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setFormData({ ...formData, name: e.target.value.toLowerCase().replace(/\s+/g, '_') })
                    }
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium block mb-1">Description</label>
                <Input
                  placeholder="Describe this role..."
                  value={formData.description}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                />
              </div>

              <div>
                <label className="text-sm font-medium block mb-1">Customer Service</label>
                <select
                  value={formData.customer_service || ''}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormData({ ...formData, customer_service: e.target.value || null })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">Select Service (Optional)</option>
                  {CUSTOMER_SERVICES.map(service => (
                    <option key={service} value={service}>{service}</option>
                  ))}
                </select>
              </div>

              {/* Solo/Business Selection */}
              <div>
                <label className="text-sm font-medium block mb-2">Vendor Configuration *</label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => {
                      setFormData(prev => ({
                        ...prev,
                        vendorConfiguration: 'solo',
                        serviceStyles: {
                          solo: ['at_home', 'tele', 'video_consultation'],
                          business: [],
                          selected: ['at_home'],
                        },
                        allowCustomServicesForSolo: prev.allowCustomServicesForSolo,
                      }));
                    }}
                    className={`p-4 rounded-lg border-2 transition-colors ${
                      formData.vendorConfiguration === 'solo'
                        ? 'border-[#FF8C42] bg-orange-50'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    <div className="font-semibold mb-1">Solo Provider</div>
                    <div className="text-sm text-gray-600">
                      Individual service provider. No staff management or inventory. Custom services can be enabled below.
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFormData(prev => ({
                        ...prev,
                        vendorConfiguration: 'business',
                        serviceStyles: {
                          solo: [],
                          business: ['at_center', 'at_home', 'tele', 'video_consultation', 'delivery'],
                          selected: ['at_center'],
                        },
                        allowCustomServicesForSolo: false,
                      }));
                    }}
                    className={`p-4 rounded-lg border-2 transition-colors ${
                      formData.vendorConfiguration === 'business'
                        ? 'border-[#FF8C42] bg-orange-50'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    <div className="font-semibold mb-1">Business</div>
                    <div className="text-sm text-gray-600">
                      Business with staff, inventory, and full service management capabilities.
                    </div>
                  </button>
                </div>

                {/* Custom Services Toggle for Solo Providers */}
                {formData.vendorConfiguration === 'solo' && (
                  <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <label className="text-sm font-medium text-gray-900 block mb-1">
                          Enable Custom Services & Packages
                        </label>
                        <p className="text-xs text-gray-600">
                          Allow solo providers to create custom services and packages (in addition to platform catalog).
                          Useful for home/tele service providers who need specialized offerings.
                        </p>
                      </div>
                      <div className="ml-4">
                        <input
                          type="checkbox"
                          checked={formData.allowCustomServicesForSolo}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData(prev => ({
                            ...prev,
                            allowCustomServicesForSolo: e.target.checked
                          }))}
                          className="w-5 h-5 text-[#FF8C42] rounded border-gray-300 focus:ring-[#FF8C42]"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Step 2: Vendor Types */}
          {wizardStep === 2 && (
            <div>
              <label className="text-sm font-medium block mb-2">Vendor Types</label>
              <div className="flex flex-wrap gap-2">
                {VENDOR_TYPES.map(vt => (
                  <button
                    key={vt.id}
                    type="button"
                    onClick={() => toggleVendorType(vt.id)}
                    className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                      formData.vendorTypes.includes(vt.id)
                        ? 'bg-[#FF8C42] text-white border-[#FF8C42]'
                        : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    {vt.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Service Styles */}
          {wizardStep === 3 && (
            <div>
              <label className="text-sm font-medium block mb-2">Service Styles *</label>
              {!formData.vendorConfiguration && (
                <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
                  Please go back to Step 1 and select Solo or Business first.
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                {SERVICE_STYLES.map(ss => {
                  const allowedStyles = getAllowedServiceStyles();
                  const isDisabled = !allowedStyles.includes(ss.id);
                  const isSelected = formData.serviceStyles.selected.includes(ss.id);

                  return (
                    <button
                      key={ss.id}
                      type="button"
                      onClick={() => !isDisabled && toggleServiceStyle(ss.id)}
                      disabled={isDisabled}
                      className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                        isDisabled
                          ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                          : isSelected
                          ? 'bg-[#FF8C42] text-white border-[#FF8C42]'
                          : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                      }`}
                      title={isDisabled ? `${ss.name} is not available for ${formData.vendorConfiguration} vendors` : ''}
                    >
                      {ss.name}
                    </button>
                  );
                })}
              </div>
              {formData.vendorConfiguration === 'solo' && (
                <div className="mt-2 text-sm text-gray-600">
                  ℹ️ Solo providers can only select "At Home" and "Tele Consultation" service styles.
                </div>
              )}
            </div>
          )}

          {/* Step 4: Capabilities Selection */}
          {wizardStep === 4 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium">
                  Capabilities ({formData.capabilities.length} selected)
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const allCapIds = capabilities.map(c => c.id).filter(capId => !isCapabilityDisabled(capId));
                      setFormData(prev => ({ ...prev, capabilities: allCapIds }));
                    }}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Select All
                  </button>
                  <span className="text-gray-300">|</span>
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, capabilities: [] }))}
                    className="text-xs text-gray-600 hover:underline"
                  >
                    Clear All
                  </button>
                </div>
              </div>

              {/* Search */}
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search capabilities..."
                  value={capabilitySearch}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCapabilitySearch(e.target.value)}
                  className="pl-10"
                />
                {capabilitySearch && (
                  <button
                    type="button"
                    onClick={() => setCapabilitySearch('')}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2"
                  >
                    <X className="w-4 h-4 text-gray-400 hover:text-gray-600" />
                  </button>
                )}
              </div>

              {/* Capabilities List */}
              <div className="border rounded-lg max-h-[300px] overflow-y-auto">
                {Object.entries(getFilteredCapabilities()).map(([category, caps]) => (
                  <div key={category} className="border-b last:border-b-0">
                    <div className="bg-gray-50 px-4 py-2 font-medium text-sm text-gray-700 sticky top-0">
                      {category} ({caps.filter(c => formData.capabilities.includes(c.id) && !isCapabilityDisabled(c.id)).length}/{caps.filter(c => !isCapabilityDisabled(c.id)).length} selected)
                    </div>
                    <div className="p-3 space-y-2">
                      {caps.map(cap => {
                        const isSelected = formData.capabilities.includes(cap.id);
                        const isDisabled = isCapabilityDisabled(cap.id);

                        return (
                          <label
                            key={cap.id}
                            className={`flex items-start gap-3 p-2 rounded-lg cursor-pointer transition ${
                              isDisabled
                                ? 'bg-gray-100 opacity-50 cursor-not-allowed'
                                : isSelected
                                ? 'bg-[#FF8C42]/10 border-2 border-[#FF8C42]'
                                : 'bg-white hover:bg-gray-50 border border-gray-200'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              disabled={isDisabled}
                              onChange={() => toggleCapability(cap.id)}
                              className="w-4 h-4 text-[#FF8C42] rounded mt-0.5"
                            />
                            <div className="flex-1">
                              <div className="font-medium text-sm">{cap.name}</div>
                              <div className="text-xs text-gray-600">{cap.description}</div>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={saving}>
            Cancel
          </Button>
          {wizardStep > 1 && (
            <Button variant="outline" onClick={handleBack} disabled={saving}>
              <ChevronLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          )}
          {wizardStep < 4 ? (
            <Button onClick={handleNext} disabled={saving}>
              Next
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <Button onClick={handleSave} disabled={saving} className="bg-[#FF8C42] hover:bg-[#FF7A2E] text-white">
              {saving ? (
                <>
                  <Save className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  {editingRole ? 'Update Role' : 'Create Role'}
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
