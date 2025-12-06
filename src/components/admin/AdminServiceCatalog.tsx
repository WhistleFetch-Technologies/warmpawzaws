import { useState, useEffect } from 'react';
import { 
  Plus, 
  Trash2, 
  Edit2, 
  Save, 
  X, 
  Search, 
  Upload, 
  ArrowLeft,
  PackageIcon,
  Settings,
  Tag,
  DollarSign,
  Clock
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { toast } from 'sonner';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { EnhancedOnboardingFormBuilder } from './EnhancedOnboardingFormBuilder';

interface AdminServiceCatalogProps {
  session: any;
  onBack: () => void;
}

interface ServiceCatalogItem {
  catalogId?: string;
  categoryId: string;
  categoryName: string;
  subCategoryId?: string;
  subCategoryName?: string;
  serviceName: string;
  serviceStyle: 'home' | 'tele';
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

export function AdminServiceCatalog({ session, onBack }: AdminServiceCatalogProps) {
  // CACHE BUSTER - Forces browser to recognize this as new code
  const FORM_VERSION = 'v2.0.0-DYNAMIC-BUILD-' + Date.now();
  
  const [activeTab, setActiveTab] = useState<'catalog' | 'onboarding'>('catalog');
  const [services, setServices] = useState<ServiceCatalogItem[]>([]);
  const [filteredServices, setFilteredServices] = useState<ServiceCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [styleFilter, setStyleFilter] = useState<'all' | 'home' | 'tele'>('all');
  const [isCreating, setIsCreating] = useState(false);
  const [editingService, setEditingService] = useState<ServiceCatalogItem | null>(null);
  const [saving, setSaving] = useState(false);

  // NEW: Categories state
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
  ]); // Initialize with defaults immediately!
  const [subCategories, setSubCategories] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]); // Make roles dynamic

  // NEW: Load roles dynamically from backend
  const loadRoles = async () => {
    try {
      console.log('🔄 Loading roles from backend...');
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/roles`,
        {
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Roles API response:', data);
        if (data.roles && data.roles.length > 0) {
          setRoles(data.roles);
          console.log(`✅ Loaded ${data.roles.length} roles dynamically:`, data.roles.map((r: any) => r.name).join(', '));
          toast.success(`Loaded ${data.roles.length} roles dynamically`);
        } else {
          console.warn('⚠️ Backend returned 0 roles');
          toast.error('No roles found in system. Please create roles first.');
          setRoles([]);
        }
      } else {
        console.error('❌ Roles API failed:', response.status);
        const errorData = await response.text();
        console.error('Error details:', errorData);
        toast.error('Failed to load roles from backend');
        setRoles([]);
      }
    } catch (error) {
      console.error('❌ Error loading roles:', error);
      toast.error('Error connecting to backend for roles');
      setRoles([]);
    }
  };

  // NEW: Handle category selection
  const handleCategoryChange = (categoryId: string) => {
    const category = categories.find(c => c.id === categoryId);
    if (category) {
      setFormData({
        ...formData,
        categoryId: category.id,
        categoryName: category.name,
        subCategoryId: '', // Reset subcategory
        subCategoryName: ''
      });
    }
  };

  // Form state
  const [formData, setFormData] = useState<ServiceCatalogItem>({
    categoryId: '',
    categoryName: '',
    subCategoryId: '',
    subCategoryName: '',
    serviceName: '',
    serviceStyle: 'home',
    applicableRoles: [],
    basePrice: 0,
    isPackage: false,
    description: '',
    duration: 30
  });

  useEffect(() => {
    loadServices();
    loadRoles(); // NEW: Load roles on mount
  }, []);

  useEffect(() => {
    console.log('🔍 [DEBUG] Categories state:', categories);
    console.log('🔍 [DEBUG] Roles state:', roles);
  }, [categories, roles]);

  useEffect(() => {
    filterServices();
  }, [services, searchQuery, roleFilter, styleFilter]);

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
        console.log('✅ Loaded service catalog:', data.services?.length);
      } else {
        toast.error('Failed to load service catalog');
      }
    } catch (error) {
      console.error('Error loading service catalog:', error);
      toast.error('Failed to load service catalog');
    } finally {
      setLoading(false);
    }
  };

  const filterServices = () => {
    let filtered = [...services];

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(service =>
        service.serviceName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        service.categoryName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        service.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Role filter
    if (roleFilter !== 'all') {
      filtered = filtered.filter(service =>
        service.applicableRoles.includes(roleFilter)
      );
    }

    // Style filter
    if (styleFilter !== 'all') {
      filtered = filtered.filter(service => service.serviceStyle === styleFilter);
    }

    setFilteredServices(filtered);
  };

  const handleSeedCatalog = async () => {
    if (!confirm('This will seed the catalog with pre-configured services. Continue?')) {
      return;
    }

    try {
      setSaving(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/service-catalog/seed`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${publicAnonKey}`,
          }
        }
      );

      if (response.ok) {
        toast.success('Service catalog seeded successfully!');
        await loadServices();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to seed catalog');
      }
    } catch (error) {
      console.error('Error seeding catalog:', error);
      toast.error('Failed to seed catalog');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateOrUpdate = async () => {
    // Validation
    if (!formData.serviceName || !formData.categoryName || !formData.description) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (formData.applicableRoles.length === 0) {
      toast.error('Please select at least one applicable role');
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
        toast.success(editingService ? 'Service updated successfully!' : 'Service created successfully!');
        resetForm();
        await loadServices();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to save service');
      }
    } catch (error) {
      console.error('Error saving service:', error);
      toast.error('Failed to save service');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (catalogId: string) => {
    if (!confirm('Are you sure you want to delete this service? This cannot be undone.')) {
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
        toast.success('Service deleted successfully!');
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
    setFormData(service);
    setIsCreating(true);
  };

  const resetForm = () => {
    setIsCreating(false);
    setEditingService(null);
    setFormData({
      categoryId: '',
      categoryName: '',
      subCategoryId: '',
      subCategoryName: '',
      serviceName: '',
      serviceStyle: 'home',
      applicableRoles: [],
      basePrice: 0,
      isPackage: false,
      description: '',
      duration: 30
    });
  };

  const toggleRole = (roleId: string) => {
    const roles = formData.applicableRoles.includes(roleId)
      ? formData.applicableRoles.filter(r => r !== roleId)
      : [...formData.applicableRoles, roleId];
    setFormData({ ...formData, applicableRoles: roles });
  };

  const stats = {
    total: services.length,
    home: services.filter(s => s.serviceStyle === 'home').length,
    tele: services.filter(s => s.serviceStyle === 'tele').length,
    packages: services.filter(s => s.isPackage).length
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#FF8C42] border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-gray-600">Loading service catalog...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header - BRIGHT RED TO TEST CACHE */}
        <div className="mb-6 p-4 bg-red-500 rounded-lg">
          <div className="flex items-center gap-4 mb-4">
            <button
              onClick={onBack}
              className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-red-600 bg-white"
            >
              <ArrowLeft className="w-5 h-5 text-gray-700" />
            </button>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-white">🔴 NEW VERSION - Service & Onboarding Configuration</h1>
              <p className="text-sm text-white">Manage service catalog and onboarding fields</p>
            </div>
            <div className="flex gap-2">
              {activeTab === 'catalog' && (
                <>
                  <Button
                    onClick={handleSeedCatalog}
                    variant="outline"
                    disabled={saving}
                    className="flex items-center gap-2 bg-white"
                  >
                    <Upload className="w-4 h-4" />
                    Seed Catalog
                  </Button>
                  <Button
                    onClick={() => setIsCreating(true)}
                    className="bg-yellow-400 hover:bg-yellow-500 text-black flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Add Service
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex gap-2 bg-white/10 rounded-lg p-1">
            <button
              onClick={() => setActiveTab('catalog')}
              className={`flex-1 px-4 py-2 rounded-md transition-all ${
                activeTab === 'catalog'
                  ? 'bg-white text-gray-900 shadow'
                  : 'text-white hover:bg-white/20'
              }`}
            >
              <PackageIcon className="w-4 h-4 inline-block mr-2" />
              Service Catalog
            </button>
            <button
              onClick={() => setActiveTab('onboarding')}
              className={`flex-1 px-4 py-2 rounded-md transition-all ${
                activeTab === 'onboarding'
                  ? 'bg-white text-gray-900 shadow'
                  : 'text-white hover:bg-white/20'
              }`}
            >
              <Settings className="w-4 h-4 inline-block mr-2" />
              Onboarding Fields
            </button>
          </div>

          {/* Stats - Only for Catalog Tab */}
          {activeTab === 'catalog' && (
            <div className="grid grid-cols-4 gap-4 mt-4">
              <div className="bg-white p-4 rounded-lg border">
                <div className="text-sm text-gray-500 mb-1">Total Services</div>
                <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
              </div>
              <div className="bg-white p-4 rounded-lg border">
                <div className="text-sm text-gray-500 mb-1">Home Services</div>
                <div className="text-2xl font-bold text-blue-600">{stats.home}</div>
              </div>
              <div className="bg-white p-4 rounded-lg border">
                <div className="text-sm text-gray-500 mb-1">Tele Services</div>
                <div className="text-2xl font-bold text-purple-600">{stats.tele}</div>
              </div>
              <div className="bg-white p-4 rounded-lg border">
                <div className="text-sm text-gray-500 mb-1">Package Services</div>
                <div className="text-2xl font-bold text-orange-600">{stats.packages}</div>
              </div>
            </div>
          )}
        </div>

        {/* Tab Content */}
        {activeTab === 'onboarding' ? (
          <EnhancedOnboardingFormBuilder />
        ) : (
          <>
        {/* Filters */}
        <div className="bg-white rounded-lg border p-4 mb-6">
          <div className="grid grid-cols-4 gap-4">
            <div className="col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search services..."
                  className="pl-10"
                />
              </div>
            </div>
            <div>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="w-full h-10 px-3 border border-gray-200 rounded-md text-sm"
              >
                <option value="all">All Roles</option>
                {roles.map(role => (
                  <option key={role.id} value={role.id}>{role.label}</option>
                ))}
              </select>
            </div>
            <div>
              <select
                value={styleFilter}
                onChange={(e) => setStyleFilter(e.target.value as any)}
                className="w-full h-10 px-3 border border-gray-200 rounded-md text-sm"
              >
                <option value="all">All Styles</option>
                <option value="home">Home Services</option>
                <option value="tele">Tele Services</option>
              </select>
            </div>
          </div>
        </div>

        {/* Create/Edit Form */}
        {isCreating && (
          <div className="bg-white rounded-lg border p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">
                {editingService ? 'Edit Service' : 'Create New Service'}
              </h2>
              <div className="flex items-center gap-2">
                <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">{FORM_VERSION}</span>
                <button onClick={resetForm}>
                  <X className="w-5 h-5 text-gray-400 hover:text-gray-600" />
                </button>
              </div>
            </div>

            {/* DEBUG PANEL */}
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded text-xs">
              <div className="font-semibold mb-1">🔍 Debug Info:</div>
              <div>Categories loaded: {categories.length} (Should be 10)</div>
              <div>Roles loaded: {roles.length} (Check if all 9 roles appear)</div>
              {roles.length > 0 && (
                <div className="mt-1">
                  Roles: {roles.map(r => r.label || r.name).join(', ')}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Service Name */}
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Service Name <span className="text-red-500">*</span>
                </label>
                <Input
                  value={formData.serviceName}
                  onChange={(e) => setFormData({ ...formData, serviceName: e.target.value })}
                  placeholder="e.g., Complete Home Grooming Session"
                />
              </div>

              {/* Category - DROPDOWN SELECT */}
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.categoryId}
                  onChange={(e) => handleCategoryChange(e.target.value)}
                  className="w-full h-10 px-3 border border-gray-200 rounded-md text-sm"
                >
                  <option value="">-- Select Category --</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name} ({cat.id})
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Selected: <span className="font-medium">{formData.categoryName || 'None'}</span> 
                  {formData.categoryId && <span className="text-gray-400"> (ID: {formData.categoryId})</span>}
                </p>
              </div>

              {/* Sub-Category - TEXT INPUT (Optional) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Sub-Category ID
                </label>
                <Input
                  value={formData.subCategoryId || ''}
                  onChange={(e) => setFormData({ ...formData, subCategoryId: e.target.value })}
                  placeholder="e.g., full_grooming"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Sub-Category Name
                </label>
                <Input
                  value={formData.subCategoryName || ''}
                  onChange={(e) => setFormData({ ...formData, subCategoryName: e.target.value })}
                  placeholder="e.g., Full Grooming"
                />
              </div>

              {/* Description */}
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Full grooming service at your home including bath, haircut, nail trim, ear cleaning"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm"
                />
              </div>

              {/* Service Style */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Service Style <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      value="home"
                      checked={formData.serviceStyle === 'home'}
                      onChange={(e) => setFormData({ ...formData, serviceStyle: 'home' })}
                      className="text-[#FF8C42]"
                    />
                    <span className="text-sm">Home Service</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      value="tele"
                      checked={formData.serviceStyle === 'tele'}
                      onChange={(e) => setFormData({ ...formData, serviceStyle: 'tele' })}
                      className="text-[#FF8C42]"
                    />
                    <span className="text-sm">Tele Service</span>
                  </label>
                </div>
              </div>

              {/* Is Package */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Service Type
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.isPackage}
                    onChange={(e) => setFormData({ ...formData, isPackage: e.target.checked })}
                    className="text-[#FF8C42]"
                  />
                  <span className="text-sm">Package/Subscription Service</span>
                </label>
              </div>

              {/* Pricing - Only if not a package */}
              {!formData.isPackage && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Base Price (₹) <span className="text-red-500">*</span>
                    </label>
                    <Input
                      type="number"
                      value={formData.basePrice}
                      onChange={(e) => setFormData({ ...formData, basePrice: parseFloat(e.target.value) || 0 })}
                      placeholder="1500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Duration (minutes)
                    </label>
                    <Input
                      type="number"
                      value={formData.duration || 30}
                      onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) || 30 })}
                      placeholder="30"
                    />
                  </div>
                </>
              )}

              {/* Applicable Roles */}
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Applicable Roles <span className="text-red-500">*</span>
                </label>
                {formData.applicableRoles.length === 0 && (
                  <div className="mb-2 p-2 bg-yellow-50 border border-yellow-200 rounded-md">
                    <p className="text-xs text-yellow-700">
                      ⚠️ Please select at least one role for this service
                    </p>
                  </div>
                )}
                <div className="grid grid-cols-4 gap-2">
                  {roles.map(role => (
                    <label key={role.id} className="flex items-center gap-2 p-2 border rounded hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.applicableRoles.includes(role.id)}
                        onChange={() => toggleRole(role.id)}
                        className="text-[#FF8C42]"
                      />
                      <span className="text-sm">{role.label || role.name}</span>
                    </label>
                  ))}
                </div>
                {formData.applicableRoles.length > 0 && (
                  <p className="text-xs text-green-600 mt-2">
                    ✓ {formData.applicableRoles.length} role{formData.applicableRoles.length > 1 ? 's' : ''} selected
                  </p>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={resetForm}>
                Cancel
              </Button>
              <Button
                onClick={handleCreateOrUpdate}
                disabled={saving}
                className="bg-[#FF8C42] hover:bg-[#ff7a28]"
              >
                <Save className="w-4 h-4 mr-2" />
                {saving ? 'Saving...' : editingService ? 'Update Service' : 'Create Service'}
              </Button>
            </div>
          </div>
        )}

        {/* Services List */}
        <div className="bg-white rounded-lg border">
          <div className="p-4 border-b">
            <h2 className="font-semibold text-gray-900">
              Services ({filteredServices.length})
            </h2>
          </div>

          {filteredServices.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <PackageIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p>No services found</p>
              <p className="text-sm text-gray-400 mt-1">
                {services.length === 0 ? 'Click "Seed Catalog" to populate with default services' : 'Try adjusting your filters'}
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {filteredServices.map((service, index) => (
                <div key={index} className="p-4 hover:bg-gray-50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold text-gray-900">{service.serviceName}</h3>
                        <Badge className={service.serviceStyle === 'home' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}>
                          {service.serviceStyle === 'home' ? '🏠 Home' : '📞 Tele'}
                        </Badge>
                        {service.isPackage && (
                          <Badge className="bg-orange-100 text-orange-700">
                            📦 Package
                          </Badge>
                        )}
                      </div>

                      <p className="text-sm text-gray-600 mb-2">{service.description}</p>

                      <div className="flex flex-wrap gap-2 mb-2">
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <Tag className="w-3 h-3" />
                          {service.categoryName}
                          {service.subCategoryName && ` → ${service.subCategoryName}`}
                        </div>
                        {!service.isPackage && (
                          <>
                            <div className="flex items-center gap-1 text-xs text-gray-500">
                              <DollarSign className="w-3 h-3" />
                              ₹{service.basePrice}
                            </div>
                            {service.duration && (
                              <div className="flex items-center gap-1 text-xs text-gray-500">
                                <Clock className="w-3 h-3" />
                                {service.duration} min
                              </div>
                            )}
                          </>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-1">
                        {service.applicableRoles.map(roleId => {
                          const role = roles.find(r => r.id === roleId);
                          return (
                            <span key={roleId} className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs">
                              {role?.label || roleId}
                            </span>
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => handleEdit(service)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => service.catalogId && handleDelete(service.catalogId)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded"
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
          </>
        )}
      </div>
    </div>
  );
}