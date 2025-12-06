import { useState, useEffect } from 'react';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Input } from '../../ui/input';
import {
  Plus,
  Edit2,
  Trash2,
  Search,
  Upload,
  Package as PackageIcon,
  Save,
  X,
  Copy,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';
import { toast } from 'sonner@2.0.3';

interface ServiceCatalogItem {
  catalogId?: string;
  categoryId: string;
  categoryName: string;
  subCategoryId?: string;
  subCategoryName?: string;
  serviceGroupId?: string;
  serviceGroupName?: string;
  serviceName: string;
  serviceStyle: 'at_home' | 'at_center' | 'tele';
  applicableRoles: string[];
  basePrice: number;
  isPackage: boolean;
  packageDetails?: {
    sessionsPerDay: number;
    sessionDuration: number;
    packageDuration: number;
    totalSessions: number;
    pricingBySize: {
      small: number;
      medium: number;
      large: number;
      extraLarge: number;
    };
  };
  description: string;
  duration?: number;
}

interface RoleConfig {
  id: string;
  name: string;
  serviceStyles: string[];
}

interface CategoryGroup {
  categoryName: string;
  categoryId: string;
  subcategories: {
    subCategoryName: string;
    subCategoryId: string;
    services: ServiceCatalogItem[];
  }[];
}

export function ServiceCatalogTabNew() {
  const [services, setServices] = useState<ServiceCatalogItem[]>([]);
  const [groupedServices, setGroupedServices] = useState<CategoryGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [expandedSubcategories, setExpandedSubcategories] = useState<Set<string>>(new Set());
  const [isCreating, setIsCreating] = useState(false);
  const [editingService, setEditingService] = useState<ServiceCatalogItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [roleConfigs, setRoleConfigs] = useState<RoleConfig[]>([]);
  const [roles, setRoles] = useState<any[]>([]);

  const [categories, setCategories] = useState<any[]>([
    { id: 'grooming', name: 'Grooming' },
    { id: 'veterinary', name: 'Veterinary Care' },
    { id: 'training', name: 'Training' },
    { id: 'walking', name: 'Dog Walking' },
    { id: 'boarding', name: 'Pet Boarding' },
    { id: 'sitting', name: 'Pet Sitting' },
    { id: 'transport', name: 'Pet Transport' },
    { id: 'photography', name: 'Pet Photography' },
    { id: 'daycare', name: 'Pet Daycare' },
    { id: 'nutrition', name: 'Pet Nutrition' }
  ]);

  const [formData, setFormData] = useState<ServiceCatalogItem>({
    categoryId: '',
    categoryName: '',
    serviceName: '',
    serviceStyle: 'at_home',
    applicableRoles: [],
    basePrice: 0,
    isPackage: false,
    description: '',
    duration: 30
  });

  useEffect(() => {
    loadRoleConfigs();
    loadServices();
    loadRoles();
  }, []);

  useEffect(() => {
    groupServicesByCategory();
  }, [services, searchQuery]);

  const loadRoleConfigs = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/config/roles`,
        {
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setRoleConfigs(data.roles || []);
      }
    } catch (error) {
      console.error('Error loading role configs:', error);
    }
  };

  const loadServices = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/service-catalog`,
        {
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setServices(data.services || []);
      }
    } catch (error) {
      console.error('Error loading service catalog:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadRoles = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/config/roles`,
        {
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setRoles(data.roles || []);
      }
    } catch (error) {
      console.error('Error loading roles:', error);
    }
  };

  const groupServicesByCategory = () => {
    let filteredServices = [...services];

    // Apply search filter
    if (searchQuery) {
      filteredServices = filteredServices.filter(service =>
        service.serviceName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        service.categoryName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (service.subCategoryName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        service.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Group by category and subcategory
    const grouped: { [key: string]: CategoryGroup } = {};

    filteredServices.forEach(service => {
      const categoryKey = service.categoryId || service.categoryName;
      
      if (!grouped[categoryKey]) {
        grouped[categoryKey] = {
          categoryName: service.categoryName,
          categoryId: service.categoryId,
          subcategories: []
        };
      }

      const subCategoryName = service.subCategoryName || 'Other Services';
      const subCategoryId = service.subCategoryId || 'other';
      
      let subcategory = grouped[categoryKey].subcategories.find(
        sub => sub.subCategoryId === subCategoryId
      );

      if (!subcategory) {
        subcategory = {
          subCategoryName,
          subCategoryId,
          services: []
        };
        grouped[categoryKey].subcategories.push(subcategory);
      }

      subcategory.services.push(service);
    });

    // Convert to array and sort
    const groupedArray = Object.values(grouped).sort((a, b) => 
      a.categoryName.localeCompare(b.categoryName)
    );

    // Sort subcategories within each category
    groupedArray.forEach(category => {
      category.subcategories.sort((a, b) => 
        a.subCategoryName.localeCompare(b.subCategoryName)
      );
    });

    setGroupedServices(groupedArray);
  };

  const toggleCategory = (categoryId: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
    }
    setExpandedCategories(newExpanded);
  };

  const toggleSubcategory = (key: string) => {
    const newExpanded = new Set(expandedSubcategories);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedSubcategories(newExpanded);
  };

  const expandAll = () => {
    const allCategories = new Set(groupedServices.map(g => g.categoryId));
    const allSubcategories = new Set<string>();
    groupedServices.forEach(cat => {
      cat.subcategories.forEach(sub => {
        allSubcategories.add(`${cat.categoryId}-${sub.subCategoryId}`);
      });
    });
    setExpandedCategories(allCategories);
    setExpandedSubcategories(allSubcategories);
  };

  const collapseAll = () => {
    setExpandedCategories(new Set());
    setExpandedSubcategories(new Set());
  };

  const getServiceStyleLabel = (style: string) => {
    const labels: Record<string, string> = {
      at_home: '🏠 At Home',
      at_center: '🏥 At Center',
      tele: '📞 Tele'
    };
    return labels[style] || style;
  };

  const getAllowedStylesForRole = (roleId: string): string[] => {
    const roleConfig = roleConfigs.find(r => r.id === roleId);
    return roleConfig?.serviceStyles || [];
  };

  const validateServiceStyle = () => {
    const invalidRoles = formData.applicableRoles.filter(roleId => {
      const allowed = getAllowedStylesForRole(roleId);
      return allowed.length > 0 && !allowed.includes(formData.serviceStyle);
    });

    if (invalidRoles.length > 0) {
      const roleNames = invalidRoles.map(id => roles.find(r => r.id === id)?.label || id).join(', ');
      toast.error(`Service style "${getServiceStyleLabel(formData.serviceStyle)}" is not allowed for: ${roleNames}`);
      return false;
    }
    return true;
  };

  const handleSeedCatalog = async () => {
    try {
      setSaving(true);
      toast.info('Seeding catalog with 150+ comprehensive services...', { duration: 2000 });
      
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/catalog/seed-all-services`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${publicAnonKey}`,
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        
        const breakdown = data.stats?.breakdown?.map((b: any) => 
          `${b.category}: ${b.services}`
        ).join(' | ') || '';
        
        toast.success(`🎉 Successfully seeded ${data.stats?.totalServices || '150+'} services!`, {
          description: breakdown,
          duration: 5000
        });
        
        await loadServices();
        // Auto-expand all after seeding
        setTimeout(expandAll, 500);
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        toast.error(`Failed to seed catalog: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error seeding catalog:', error);
      toast.error('Failed to seed catalog. Check console for details.');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdatePrices = async () => {
    try {
      setSaving(true);
      toast.info('Updating prices with realistic Indian market rates...', { duration: 2000 });
      
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/catalog/update-realistic-prices`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${publicAnonKey}`,
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        toast.success(`💰 Successfully updated ${data.stats.updated} service prices!`, {
          description: `${data.stats.updated} updated, ${data.stats.skipped} skipped`,
          duration: 5000
        });
        
        await loadServices();
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        toast.error(`Failed to update prices: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error updating prices:', error);
      toast.error('Failed to update prices. Check console for details.');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateOrUpdate = async () => {
    if (!formData.serviceName || !formData.categoryName || !formData.description) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (formData.applicableRoles.length === 0) {
      toast.error('Please select at least one applicable role');
      return;
    }

    if (!validateServiceStyle()) {
      return;
    }

    try {
      setSaving(true);
      
      const endpoint = editingService
        ? `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/service-catalog/${editingService.catalogId}`
        : `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/service-catalog`;

      const response = await fetch(endpoint, {
        method: editingService ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${publicAnonKey}`,
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        toast.success(editingService ? 'Service updated!' : 'Service created!');
        resetForm();
        await loadServices();
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Failed to save service');
      }
    } catch (error) {
      console.error('Error saving service:', error);
      toast.error('Failed to save service');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (catalogId: string) => {
    if (!confirm('Delete this service? This cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/service-catalog/${catalogId}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
          }
        }
      );

      if (response.ok) {
        toast.success('Service deleted!');
        await loadServices();
      } else {
        toast.error('Failed to delete service');
      }
    } catch (error) {
      console.error('Error deleting service:', error);
      toast.error('Failed to delete service');
    }
  };

  const handleEdit = (service: ServiceCatalogItem) => {
    setEditingService(service);
    setFormData({ ...service });
    setIsCreating(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCopy = (service: ServiceCatalogItem) => {
    const copiedService = {
      ...service,
      catalogId: undefined,
      serviceName: `${service.serviceName} (Copy)`
    };
    setEditingService(null);
    setFormData(copiedService);
    setIsCreating(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    toast.info('Service copied! Modify and save as new.');
  };

  const resetForm = () => {
    setIsCreating(false);
    setEditingService(null);
    setFormData({
      categoryId: '',
      categoryName: '',
      serviceName: '',
      serviceStyle: 'at_home',
      applicableRoles: [],
      basePrice: 0,
      isPackage: false,
      description: '',
      duration: 30
    });
  };

  const toggleRole = (roleId: string) => {
    const newRoles = formData.applicableRoles.includes(roleId)
      ? formData.applicableRoles.filter(r => r !== roleId)
      : [...formData.applicableRoles, roleId];
    setFormData({ ...formData, applicableRoles: newRoles });
  };

  const stats = {
    total: services.length,
    categories: groupedServices.length,
    atHome: services.filter(s => s.serviceStyle === 'at_home').length,
    atCenter: services.filter(s => s.serviceStyle === 'at_center').length,
    tele: services.filter(s => s.serviceStyle === 'tele').length,
    packages: services.filter(s => s.isPackage).length
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="w-12 h-12 border-4 border-[#FF8C42] border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
        <p className="text-gray-600">Loading service catalog...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header Actions */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">🗂️ Service Catalog Management</h2>
          <p className="text-sm text-gray-500">Organized by categories and specializations</p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handleSeedCatalog}
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-700 flex items-center gap-2"
          >
            <Upload className="w-4 h-4" />
            {services.length === 0 ? '✨ Seed All Services (150+)' : '🔄 Re-Seed All (150+)'}
          </Button>
          <Button
            onClick={handleUpdatePrices}
            disabled={saving}
            className="bg-green-600 hover:bg-green-700 flex items-center gap-2"
          >
            💰 Update Market Prices
          </Button>
          <Button
            onClick={() => setIsCreating(true)}
            className="bg-[#FF8C42] hover:bg-[#ff7a28] flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Service
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-6 gap-4 mb-6">
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="text-sm text-gray-500">Total Services</div>
          <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
        </div>
        <div className="bg-purple-50 p-4 rounded-lg">
          <div className="text-sm text-purple-600">Categories</div>
          <div className="text-2xl font-bold text-purple-700">{stats.categories}</div>
        </div>
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="text-sm text-blue-600">At Home</div>
          <div className="text-2xl font-bold text-blue-700">{stats.atHome}</div>
        </div>
        <div className="bg-green-50 p-4 rounded-lg">
          <div className="text-sm text-green-600">At Center</div>
          <div className="text-2xl font-bold text-green-700">{stats.atCenter}</div>
        </div>
        <div className="bg-indigo-50 p-4 rounded-lg">
          <div className="text-sm text-indigo-600">Tele</div>
          <div className="text-2xl font-bold text-indigo-700">{stats.tele}</div>
        </div>
        <div className="bg-orange-50 p-4 rounded-lg">
          <div className="text-sm text-orange-600">Packages</div>
          <div className="text-2xl font-bold text-orange-700">{stats.packages}</div>
        </div>
      </div>

      {/* Search and Expand/Collapse */}
      <div className="flex gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search services, categories, subcategories..."
            className="pl-10"
          />
        </div>
        <Button variant="outline" onClick={expandAll}>
          Expand All
        </Button>
        <Button variant="outline" onClick={collapseAll}>
          Collapse All
        </Button>
      </div>

      {/* Create/Edit Form */}
      {isCreating && (
        <div className="bg-gray-50 rounded-lg p-6 mb-6 border-2 border-[#FF8C42]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">{editingService ? '✏️ Edit Service' : '➕ Create New Service'}</h3>
            <button onClick={resetForm}>
              <X className="w-5 h-5 text-gray-400 hover:text-gray-600" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-1">Service Name *</label>
              <Input
                value={formData.serviceName}
                onChange={(e) => setFormData({ ...formData, serviceName: e.target.value })}
                placeholder="e.g., General Veterinary Consultation"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium mb-1">Category *</label>
              <select
                value={formData.categoryId}
                onChange={(e) => {
                  const cat = categories.find(c => c.id === e.target.value);
                  setFormData({
                    ...formData,
                    categoryId: cat?.id || '',
                    categoryName: cat?.name || ''
                  });
                }}
                className="w-full h-10 px-3 border border-gray-200 rounded-md text-sm"
              >
                <option value="">-- Select Category --</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium mb-1">Description *</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm"
                placeholder="Service description"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium mb-2">Service Style *</label>
              <div className="grid grid-cols-3 gap-3">
                {['at_home', 'at_center', 'tele'].map((style) => (
                  <label
                    key={style}
                    className={`flex items-center gap-2 p-3 border-2 rounded-lg cursor-pointer transition-all ${
                      formData.serviceStyle === style
                        ? 'border-[#FF8C42] bg-orange-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      value={style}
                      checked={formData.serviceStyle === style}
                      onChange={() => setFormData({ ...formData, serviceStyle: style as any })}
                      className="text-[#FF8C42]"
                    />
                    <span className="text-sm font-medium">{getServiceStyleLabel(style)}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Duration (minutes)</label>
              <Input
                type="number"
                value={formData.duration || 30}
                onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) || 30 })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Base Price (₹)</label>
              <Input
                type="number"
                value={formData.basePrice}
                onChange={(e) => setFormData({ ...formData, basePrice: parseFloat(e.target.value) || 0 })}
              />
            </div>

            <div className="col-span-2">
              <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isPackage}
                  onChange={(e) => {
                    const isPackage = e.target.checked;
                    setFormData({
                      ...formData,
                      isPackage,
                      packageDetails: isPackage ? {
                        sessionsPerDay: 1,
                        sessionDuration: 30,
                        packageDuration: 7,
                        totalSessions: 7,
                        pricingBySize: { small: 500, medium: 700, large: 900, extraLarge: 1200 }
                      } : undefined
                    });
                  }}
                  className="w-4 h-4 text-[#FF8C42]"
                />
                <span>This is a Package/Subscription Service</span>
              </label>
            </div>

            {formData.isPackage && formData.packageDetails && (
              <>
                <div className="col-span-2 border-t pt-4 mt-2">
                  <h4 className="font-medium text-gray-900 mb-3">📦 Package Configuration</h4>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Sessions Per Day *</label>
                  <Input
                    type="number"
                    min="1"
                    value={formData.packageDetails.sessionsPerDay}
                    onChange={(e) => {
                      const sessionsPerDay = parseInt(e.target.value) || 1;
                      const totalSessions = sessionsPerDay * formData.packageDetails!.packageDuration;
                      setFormData({
                        ...formData,
                        packageDetails: { ...formData.packageDetails!, sessionsPerDay, totalSessions }
                      });
                    }}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Session Duration (min) *</label>
                  <Input
                    type="number"
                    min="5"
                    step="5"
                    value={formData.packageDetails.sessionDuration}
                    onChange={(e) => {
                      const sessionDuration = parseInt(e.target.value) || 30;
                      setFormData({
                        ...formData,
                        packageDetails: { ...formData.packageDetails!, sessionDuration }
                      });
                    }}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Package Duration (days) *</label>
                  <Input
                    type="number"
                    min="1"
                    value={formData.packageDetails.packageDuration}
                    onChange={(e) => {
                      const packageDuration = parseInt(e.target.value) || 7;
                      const totalSessions = formData.packageDetails!.sessionsPerDay * packageDuration;
                      setFormData({
                        ...formData,
                        packageDetails: { ...formData.packageDetails!, packageDuration, totalSessions }
                      });
                    }}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Total Sessions</label>
                  <Input
                    type="number"
                    value={formData.packageDetails.totalSessions}
                    disabled
                    className="bg-gray-100"
                  />
                </div>

                <div className="col-span-2">
                  <h5 className="text-sm font-medium mb-2">Pricing by Pet Size *</h5>
                  <div className="grid grid-cols-4 gap-3">
                    {(['small', 'medium', 'large', 'extraLarge'] as const).map((size) => (
                      <div key={size}>
                        <label className="block text-xs text-gray-600 mb-1 capitalize">{size} (₹)</label>
                        <Input
                          type="number"
                          value={formData.packageDetails!.pricingBySize[size]}
                          onChange={(e) => {
                            setFormData({
                              ...formData,
                              packageDetails: {
                                ...formData.packageDetails!,
                                pricingBySize: {
                                  ...formData.packageDetails!.pricingBySize,
                                  [size]: parseFloat(e.target.value) || 0
                                }
                              }
                            });
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            <div className="col-span-2">
              <label className="block text-sm font-medium mb-2">Applicable Roles *</label>
              <div className="grid grid-cols-4 gap-2">
                {roles.map(role => {
                  const allowedStyles = getAllowedStylesForRole(role.id);
                  const isStyleAllowed = allowedStyles.length === 0 || allowedStyles.includes(formData.serviceStyle);
                  return (
                    <label
                      key={role.id}
                      className={`flex items-center gap-2 text-sm ${
                        !isStyleAllowed ? 'opacity-50' : ''
                      }`}
                      title={!isStyleAllowed ? `${role.name} doesn't allow ${getServiceStyleLabel(formData.serviceStyle)}` : ''}
                    >
                      <input
                        type="checkbox"
                        checked={formData.applicableRoles.includes(role.id)}
                        onChange={() => toggleRole(role.id)}
                        disabled={!isStyleAllowed}
                      />
                      {role.name}
                      {!isStyleAllowed && <span className="text-red-500">🚫</span>}
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={resetForm}>Cancel</Button>
            <Button
              onClick={handleCreateOrUpdate}
              disabled={saving}
              className="bg-[#FF8C42] hover:bg-[#ff7a28]"
            >
              <Save className="w-4 h-4 mr-2" />
              {saving ? 'Saving...' : editingService ? 'Update' : 'Create'}
            </Button>
          </div>
        </div>
      )}

      {/* Hierarchical Services List */}
      {groupedServices.length === 0 ? (
        <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-lg">
          <PackageIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="font-medium">No services found</p>
          <p className="text-sm text-gray-400 mt-1">
            {services.length === 0 ? 'Click "Seed All Services" to populate with 150+ services' : 'Try adjusting your search'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {groupedServices.map((category) => {
            const isExpanded = expandedCategories.has(category.categoryId);
            const totalServices = category.subcategories.reduce((sum, sub) => sum + sub.services.length, 0);

            return (
              <div key={category.categoryId} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                {/* Category Header */}
                <button
                  onClick={() => toggleCategory(category.categoryId)}
                  className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {isExpanded ? (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    )}
                    <h3 className="font-semibold text-gray-900">{category.categoryName}</h3>
                    <Badge className="bg-gray-100 text-gray-700">
                      {totalServices} services
                    </Badge>
                  </div>
                </button>

                {/* Subcategories */}
                {isExpanded && (
                  <div className="border-t border-gray-200">
                    {category.subcategories.map((subcategory) => {
                      const subKey = `${category.categoryId}-${subcategory.subCategoryId}`;
                      const isSubExpanded = expandedSubcategories.has(subKey);

                      return (
                        <div key={subKey} className="border-b border-gray-100 last:border-0">
                          {/* Subcategory Header */}
                          <button
                            onClick={() => toggleSubcategory(subKey)}
                            className="w-full flex items-center justify-between p-3 pl-12 hover:bg-gray-50 transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              {isSubExpanded ? (
                                <ChevronDown className="w-4 h-4 text-gray-400" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-gray-400" />
                              )}
                              <span className="font-medium text-gray-700">{subcategory.subCategoryName}</span>
                              <Badge className="bg-blue-50 text-blue-700 text-xs">
                                {subcategory.services.length}
                              </Badge>
                            </div>
                          </button>

                          {/* Services */}
                          {isSubExpanded && (
                            <div className="bg-gray-50 px-4 py-2">
                              {subcategory.services.map((service, idx) => (
                                <div
                                  key={service.catalogId || idx}
                                  className="bg-white p-3 mb-2 rounded-lg border border-gray-200 hover:border-[#FF8C42] transition-colors"
                                >
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2 mb-1">
                                        <h4 className="font-medium text-gray-900">{service.serviceName}</h4>
                                        <Badge className={
                                          service.serviceStyle === 'at_home' ? 'bg-blue-100 text-blue-700 text-xs' :
                                          service.serviceStyle === 'at_center' ? 'bg-green-100 text-green-700 text-xs' :
                                          'bg-purple-100 text-purple-700 text-xs'
                                        }>
                                          {getServiceStyleLabel(service.serviceStyle)}
                                        </Badge>
                                        {service.isPackage && (
                                          <Badge className="bg-orange-100 text-orange-700 text-xs">📦 Package</Badge>
                                        )}
                                      </div>

                                      <p className="text-sm text-gray-600 mb-2">{service.description}</p>

                                      <div className="flex flex-wrap gap-2 mb-2">
                                        {!service.isPackage && (
                                          <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                                            ₹{service.basePrice}
                                          </span>
                                        )}
                                        <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                                          {service.duration || 30} min
                                        </span>
                                      </div>

                                      <div className="flex flex-wrap gap-1">
                                        {service.applicableRoles.map(roleId => {
                                          const role = roles.find(r => r.id === roleId);
                                          return (
                                            <span key={roleId} className="text-xs bg-orange-50 text-orange-700 px-2 py-0.5 rounded">
                                              {role?.name || roleId}
                                            </span>
                                          );
                                        })}
                                      </div>
                                    </div>

                                    <div className="flex gap-1 ml-4">
                                      <button
                                        onClick={() => handleCopy(service)}
                                        className="p-2 text-green-600 hover:bg-green-50 rounded"
                                        title="Copy service"
                                      >
                                        <Copy className="w-4 h-4" />
                                      </button>
                                      <button
                                        onClick={() => handleEdit(service)}
                                        className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                                        title="Edit service"
                                      >
                                        <Edit2 className="w-4 h-4" />
                                      </button>
                                      <button
                                        onClick={() => service.catalogId && handleDelete(service.catalogId)}
                                        className="p-2 text-red-600 hover:bg-red-50 rounded"
                                        title="Delete service"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}