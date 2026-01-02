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
import { toast } from 'sonner';
import { ServiceCatalogConfirmationModal } from './ServiceCatalogConfirmationModal';

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

export function ServiceCatalogTab() {
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
      // Ensure we have a valid categoryId - use categoryName as fallback to ensure uniqueness
      const categoryId = service.categoryId || service.categoryName.toLowerCase().replace(/\s+/g, '_');
      const categoryKey = categoryId;
      
      if (!grouped[categoryKey]) {
        grouped[categoryKey] = {
          categoryName: service.categoryName,
          categoryId: categoryId, // Use the normalized categoryId
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

  const [showSeedModal, setShowSeedModal] = useState(false);
  const [showPriceModal, setShowPriceModal] = useState(false);
  const [seedPreview, setSeedPreview] = useState<any>(null);
  const [pricePreview, setPricePreview] = useState<any>(null);

  const handleSeedCatalog = async () => {
    try {
      setSaving(true);
      
      // First, get preview
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/catalog/seed-all-services`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({ confirm: false })
        }
      );

      if (response.ok) {
        const data = await response.json();
        setSeedPreview(data);
        setShowSeedModal(true);
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        toast.error(`Failed to fetch seed preview: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error fetching seed preview:', error);
      toast.error('Failed to fetch seed preview. Check console for details.');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmSeed = async () => {
    try {
      setSaving(true);
      
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/catalog/seed-all-services`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({ confirm: true })
        }
      );

      if (response.ok) {
        const data = await response.json();
        
        const breakdown = data.stats?.breakdown?.map((b: any) => 
          `${b.category}: ${b.services}`
        ).join(' | ') || '';
        
        toast.success(`🎉 Successfully seeded ${data.stats?.inserted || data.stats?.totalServices || '150+'} services!`, {
          description: breakdown,
          duration: 5000
        });
        
        setShowSeedModal(false);
        await loadServices();
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
      
      // Get selected services (all if none selected)
      const selectedServiceIds = services
        .filter(s => s.selected)
        .map(s => s.catalogId || s.id)
        .filter(Boolean);

      // First, get AI-researched price preview
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/catalog/update-realistic-prices`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({
            confirm: false,
            selectedServices: selectedServiceIds.length > 0 ? selectedServiceIds : undefined
          })
        }
      );

      if (response.ok) {
        const data = await response.json();
        setPricePreview(data);
        setShowPriceModal(true);
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        toast.error(`Failed to research prices: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error researching prices:', error);
      toast.error('Failed to research prices. Check console for details.');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmPriceUpdate = async () => {
    try {
      setSaving(true);
      
      // Get selected services from preview
      const selectedServices = pricePreview.services
        ?.filter((s: any) => s.selected !== false)
        .map((s: any) => ({
          serviceId: s.serviceId,
          serviceName: s.serviceName,
          currentPrice: s.currentPrice,
          newPrice: s.suggestedPrice
        })) || [];

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/catalog/update-realistic-prices`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({
            confirm: true,
            priceUpdates: selectedServices
          })
        }
      );

      if (response.ok) {
        const data = await response.json();
        toast.success(`💰 Successfully updated ${data.stats?.updated || 0} service prices!`, {
          description: `${data.stats?.updated || 0} updated, ${data.stats?.skipped || 0} skipped`,
          duration: 5000
        });
        
        setShowPriceModal(false);
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
                  <label className="block text-sm font-medium mb-2">Pricing by Pet Size (₹) *</label>
                  <div className="grid grid-cols-4 gap-4">
                    <div>
                      <span className="text-xs text-gray-500 mb-1 block">Small</span>
                      <Input
                        type="number"
                        value={formData.packageDetails.pricingBySize.small}
                        onChange={(e) => setFormData({
                          ...formData,
                          packageDetails: {
                            ...formData.packageDetails!,
                            pricingBySize: { ...formData.packageDetails!.pricingBySize, small: parseInt(e.target.value) || 0 }
                          }
                        })}
                      />
                    </div>
                    <div>
                      <span className="text-xs text-gray-500 mb-1 block">Medium</span>
                      <Input
                        type="number"
                        value={formData.packageDetails.pricingBySize.medium}
                        onChange={(e) => setFormData({
                          ...formData,
                          packageDetails: {
                            ...formData.packageDetails!,
                            pricingBySize: { ...formData.packageDetails!.pricingBySize, medium: parseInt(e.target.value) || 0 }
                          }
                        })}
                      />
                    </div>
                    <div>
                      <span className="text-xs text-gray-500 mb-1 block">Large</span>
                      <Input
                        type="number"
                        value={formData.packageDetails.pricingBySize.large}
                        onChange={(e) => setFormData({
                          ...formData,
                          packageDetails: {
                            ...formData.packageDetails!,
                            pricingBySize: { ...formData.packageDetails!.pricingBySize, large: parseInt(e.target.value) || 0 }
                          }
                        })}
                      />
                    </div>
                    <div>
                      <span className="text-xs text-gray-500 mb-1 block">Extra Large</span>
                      <Input
                        type="number"
                        value={formData.packageDetails.pricingBySize.extraLarge}
                        onChange={(e) => setFormData({
                          ...formData,
                          packageDetails: {
                            ...formData.packageDetails!,
                            pricingBySize: { ...formData.packageDetails!.pricingBySize, extraLarge: parseInt(e.target.value) || 0 }
                          }
                        })}
                      />
                    </div>
                  </div>
                </div>
              </>
            )}

            <div className="col-span-2">
              <label className="block text-sm font-medium mb-2">Applicable Roles *</label>
              <div className="flex flex-wrap gap-2">
                {roles.map((role) => {
                  const isSelected = formData.applicableRoles.includes(role.id);
                  const allowedStyles = getAllowedStylesForRole(role.id);
                  const isAllowed = allowedStyles.length === 0 || allowedStyles.includes(formData.serviceStyle);
                  
                  return (
                    <div
                      key={role.id}
                      onClick={() => isAllowed && toggleRole(role.id)}
                      className={`px-3 py-1 rounded-full text-sm border cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-[#FF8C42] text-white border-[#FF8C42]'
                          : isAllowed 
                            ? 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
                            : 'bg-gray-100 text-gray-400 border-gray-100 cursor-not-allowed'
                      }`}
                    >
                      {role.label || role.name}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={resetForm}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateOrUpdate}
              disabled={saving}
              className="bg-[#FF8C42] hover:bg-[#ff7a28]"
            >
              {saving ? 'Saving...' : editingService ? 'Update Service' : 'Create Service'}
            </Button>
          </div>
        </div>
      )}

      {/* Categories List */}
      <div className="space-y-4">
        {groupedServices.map((group) => {
          const isExpanded = expandedCategories.has(group.categoryId);
          
          return (
            <div key={group.categoryId} className="border border-gray-200 rounded-lg bg-white overflow-hidden">
              <div
                className="flex items-center p-4 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={() => toggleCategory(group.categoryId)}
              >
                {isExpanded ? (
                  <ChevronDown className="w-5 h-5 text-gray-500 mr-2" />
                ) : (
                  <ChevronRight className="w-5 h-5 text-gray-500 mr-2" />
                )}
                
                <h3 className="text-lg font-medium text-gray-900 flex-1">
                  {group.categoryName}
                </h3>
                
                <Badge variant="secondary" className="bg-white">
                  {group.subcategories.reduce((acc, sub) => acc + sub.services.length, 0)} Services
                </Badge>
              </div>

              {isExpanded && (
                <div className="p-4 space-y-4">
                  {group.subcategories.map((sub) => {
                    const subKey = `${group.categoryId}-${sub.subCategoryId}`;
                    const isSubExpanded = expandedSubcategories.has(subKey);
                    
                    return (
                      <div key={subKey} className="border border-gray-100 rounded-lg">
                        <div
                          className="flex items-center p-3 cursor-pointer hover:bg-gray-50"
                          onClick={() => toggleSubcategory(subKey)}
                        >
                          {isSubExpanded ? (
                            <ChevronDown className="w-4 h-4 text-gray-400 mr-2" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-gray-400 mr-2" />
                          )}
                          <h4 className="text-md font-medium text-gray-700 flex-1">
                            {sub.subCategoryName}
                          </h4>
                          <span className="text-xs text-gray-500">
                            {sub.services.length} items
                          </span>
                        </div>

                        {isSubExpanded && (
                          <div className="p-3 grid gap-3">
                            {sub.services.map((service) => (
                              <div
                                key={service.catalogId}
                                className="flex items-start justify-between p-3 bg-white border border-gray-100 rounded-md hover:border-orange-200 transition-all shadow-sm"
                              >
                                <div>
                                  <div className="flex items-center gap-2">
                                    <h5 className="font-medium text-gray-900">{service.serviceName}</h5>
                                    {service.isPackage && (
                                      <Badge variant="outline" className="text-orange-600 border-orange-200 bg-orange-50 text-[10px]">
                                        <PackageIcon className="w-3 h-3 mr-1" />
                                        Package
                                      </Badge>
                                    )}
                                    <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50 text-[10px]">
                                      {getServiceStyleLabel(service.serviceStyle)}
                                    </Badge>
                                  </div>
                                  <p className="text-sm text-gray-500 mt-1">{service.description}</p>
                                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                                    <span>⏱️ {service.duration} mins</span>
                                    <span className="font-medium text-gray-900">₹{service.basePrice}</span>
                                    <span>
                                      👥 {service.applicableRoles.length} Roles Allowed
                                    </span>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleCopy(service);
                                    }}
                                    title="Copy Service"
                                  >
                                    <Copy className="w-4 h-4 text-gray-500" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleEdit(service);
                                    }}
                                  >
                                    <Edit2 className="w-4 h-4 text-blue-600" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDelete(service.catalogId!);
                                    }}
                                  >
                                    <Trash2 className="w-4 h-4 text-red-600" />
                                  </Button>
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

      {/* Confirmation Modals */}
      {showSeedModal && seedPreview && (
        <ServiceCatalogConfirmationModal
          isOpen={showSeedModal}
          onClose={() => setShowSeedModal(false)}
          onConfirm={handleConfirmSeed}
          mode="seed"
          data={seedPreview}
          isLoading={saving}
        />
      )}

      {showPriceModal && pricePreview && (
        <ServiceCatalogConfirmationModal
          isOpen={showPriceModal}
          onClose={() => setShowPriceModal(false)}
          onConfirm={handleConfirmPriceUpdate}
          mode="price_update"
          data={pricePreview}
          isLoading={saving}
        />
      )}
    </div>
  );
}