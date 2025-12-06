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
  Clock,
  DollarSign,
  Tag,
  Save,
  X
} from 'lucide-react';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';
import { toast } from 'sonner@2.0.3';

interface ServiceCatalogItem {
  catalogId?: string;
  categoryId: string;
  categoryName: string;
  subCategoryId?: string;
  subCategoryName?: string;
  serviceName: string;
  serviceStyle: 'at_home' | 'at_center' | 'tele';
  applicableRoles: string[];
  basePrice: number;
  isPackage: boolean;
  packageDetails?: {
    sessionsPerDay: number;
    sessionDuration: number; // minutes
    packageDuration: number; // days
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

export function ServiceCatalogTab() {
  const [services, setServices] = useState<ServiceCatalogItem[]>([]);
  const [filteredServices, setFilteredServices] = useState<ServiceCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [styleFilter, setStyleFilter] = useState<'all' | 'home' | 'tele'>('all');
  const [isCreating, setIsCreating] = useState(false);
  const [editingService, setEditingService] = useState<ServiceCatalogItem | null>(null);
  const [saving, setSaving] = useState(false);

  const roles = [
    { id: 'groomer', label: 'Groomer' },
    { id: 'vet', label: 'Veterinarian' },
    { id: 'veterinary_clinic', label: 'Veterinary Clinic' },
    { id: 'trainer', label: 'Trainer' },
    { id: 'walker', label: 'Dog Walker' },
    { id: 'sitter', label: 'Pet Sitter' },
    { id: 'pet_hotel', label: 'Pet Hotel' },
    { id: 'boarding', label: 'Pet Boarding' }
  ];

  const [formData, setFormData] = useState<ServiceCatalogItem>({
    categoryId: '',
    categoryName: '',
    subCategoryId: '',
    subCategoryName: '',
    serviceName: '',
    serviceStyle: 'at_home',
    applicableRoles: [],
    basePrice: 0,
    isPackage: false,
    description: '',
    duration: 30
  });

  useEffect(() => {
    loadServices();
  }, []);

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
      }
    } catch (error) {
      console.error('Error loading service catalog:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterServices = () => {
    let filtered = [...services];

    if (searchQuery) {
      filtered = filtered.filter(service =>
        service.serviceName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        service.categoryName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        service.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (roleFilter !== 'all') {
      filtered = filtered.filter(service =>
        service.applicableRoles.includes(roleFilter)
      );
    }

    if (styleFilter !== 'all') {
      filtered = filtered.filter(service => service.serviceStyle === styleFilter);
    }

    setFilteredServices(filtered);
  };

  const handleSeedCatalog = async () => {
    if (!confirm('This will seed the catalog with 90+ pre-configured services. Continue?')) {
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
        toast.error('Failed to seed catalog');
      }
    } catch (error) {
      console.error('Error seeding catalog:', error);
      toast.error('Failed to seed catalog');
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
        toast.error('Failed to save service');
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
          <h2 className="text-lg font-semibold text-gray-900">Service Catalog for Vendors</h2>
          <p className="text-sm text-gray-500">Manage services available to all vendors across roles</p>
        </div>
        <div className="flex gap-2">
          {services.length === 0 && (
            <Button
              onClick={handleSeedCatalog}
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700 flex items-center gap-2"
            >
              <Upload className="w-4 h-4" />
              Seed Catalog
            </Button>
          )}
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
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="text-sm text-gray-500">Total Services</div>
          <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
        </div>
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="text-sm text-blue-600">Home Services</div>
          <div className="text-2xl font-bold text-blue-700">{stats.home}</div>
        </div>
        <div className="bg-purple-50 p-4 rounded-lg">
          <div className="text-sm text-purple-600">Tele Services</div>
          <div className="text-2xl font-bold text-purple-700">{stats.tele}</div>
        </div>
        <div className="bg-orange-50 p-4 rounded-lg">
          <div className="text-sm text-orange-600">Package Services</div>
          <div className="text-2xl font-bold text-orange-700">{stats.packages}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="col-span-2 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search services..."
            className="pl-10"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-md text-sm"
        >
          <option value="all">All Roles</option>
          {roles.map(role => (
            <option key={role.id} value={role.id}>{role.label}</option>
          ))}
        </select>
        <select
          value={styleFilter}
          onChange={(e) => setStyleFilter(e.target.value as any)}
          className="px-3 py-2 border border-gray-200 rounded-md text-sm"
        >
          <option value="all">All Styles</option>
          <option value="home">Home Services</option>
          <option value="tele">Tele Services</option>
        </select>
      </div>

      {/* Create/Edit Form */}
      {isCreating && (
        <div className="bg-gray-50 rounded-lg p-6 mb-6 border-2 border-[#FF8C42]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">{editingService ? 'Edit Service' : 'Create New Service'}</h3>
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
                placeholder="e.g., Complete Home Grooming Session"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Category ID *</label>
              <Input
                value={formData.categoryId}
                onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                placeholder="e.g., grooming"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Category Name *</label>
              <Input
                value={formData.categoryName}
                onChange={(e) => setFormData({ ...formData, categoryName: e.target.value })}
                placeholder="e.g., Grooming"
              />
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

            <div>
              <label className="block text-sm font-medium mb-2">Service Style *</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    value="home"
                    checked={formData.serviceStyle === 'home'}
                    onChange={() => setFormData({ ...formData, serviceStyle: 'home' })}
                  />
                  <span className="text-sm">Home Service</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    value="tele"
                    checked={formData.serviceStyle === 'tele'}
                    onChange={() => setFormData({ ...formData, serviceStyle: 'tele' })}
                  />
                  <span className="text-sm">Tele Service</span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Base Price (₹)</label>
              <Input
                type="number"
                value={formData.basePrice}
                onChange={(e) => setFormData({ ...formData, basePrice: parseFloat(e.target.value) || 0 })}
              />
            </div>

            {/* Package Checkbox */}
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
                        pricingBySize: {
                          small: 0,
                          medium: 0,
                          large: 0,
                          extraLarge: 0
                        }
                      } : undefined
                    });
                  }}
                  className="w-4 h-4 text-[#FF8C42]"
                />
                <span>This is a Package/Subscription Service</span>
              </label>
            </div>

            {/* Package Configuration Fields */}
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
                        packageDetails: {
                          ...formData.packageDetails!,
                          sessionsPerDay,
                          totalSessions
                        }
                      });
                    }}
                    placeholder="1"
                  />
                  <p className="text-xs text-gray-500 mt-1">e.g., 2 walks per day</p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Session Duration (minutes) *</label>
                  <Input
                    type="number"
                    min="5"
                    step="5"
                    value={formData.packageDetails.sessionDuration}
                    onChange={(e) => {
                      const sessionDuration = parseInt(e.target.value) || 30;
                      setFormData({
                        ...formData,
                        packageDetails: {
                          ...formData.packageDetails!,
                          sessionDuration
                        }
                      });
                    }}
                    placeholder="30"
                  />
                  <p className="text-xs text-gray-500 mt-1">Duration of each session</p>
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
                        packageDetails: {
                          ...formData.packageDetails!,
                          packageDuration,
                          totalSessions
                        }
                      });
                    }}
                    placeholder="7"
                  />
                  <p className="text-xs text-gray-500 mt-1">e.g., 7 days, 15 days, 30 days</p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Total Sessions</label>
                  <Input
                    type="number"
                    value={formData.packageDetails.totalSessions}
                    disabled
                    className="bg-gray-100"
                  />
                  <p className="text-xs text-gray-500 mt-1">Auto-calculated</p>
                </div>

                <div className="col-span-2">
                  <h5 className="text-sm font-medium mb-2">Pricing by Pet Size *</h5>
                  <div className="grid grid-cols-4 gap-3">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Small (₹)</label>
                      <Input
                        type="number"
                        value={formData.packageDetails.pricingBySize.small}
                        onChange={(e) => {
                          setFormData({
                            ...formData,
                            packageDetails: {
                              ...formData.packageDetails!,
                              pricingBySize: {
                                ...formData.packageDetails!.pricingBySize,
                                small: parseFloat(e.target.value) || 0
                              }
                            }
                          });
                        }}
                        placeholder="500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Medium (₹)</label>
                      <Input
                        type="number"
                        value={formData.packageDetails.pricingBySize.medium}
                        onChange={(e) => {
                          setFormData({
                            ...formData,
                            packageDetails: {
                              ...formData.packageDetails!,
                              pricingBySize: {
                                ...formData.packageDetails!.pricingBySize,
                                medium: parseFloat(e.target.value) || 0
                              }
                            }
                          });
                        }}
                        placeholder="700"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Large (₹)</label>
                      <Input
                        type="number"
                        value={formData.packageDetails.pricingBySize.large}
                        onChange={(e) => {
                          setFormData({
                            ...formData,
                            packageDetails: {
                              ...formData.packageDetails!,
                              pricingBySize: {
                                ...formData.packageDetails!.pricingBySize,
                                large: parseFloat(e.target.value) || 0
                              }
                            }
                          });
                        }}
                        placeholder="900"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Extra Large (₹)</label>
                      <Input
                        type="number"
                        value={formData.packageDetails.pricingBySize.extraLarge}
                        onChange={(e) => {
                          setFormData({
                            ...formData,
                            packageDetails: {
                              ...formData.packageDetails!,
                              pricingBySize: {
                                ...formData.packageDetails!.pricingBySize,
                                extraLarge: parseFloat(e.target.value) || 0
                              }
                            }
                          });
                        }}
                        placeholder="1200"
                      />
                    </div>
                  </div>
                </div>
              </>
            )}

            <div className="col-span-2">
              <label className="block text-sm font-medium mb-2">Applicable Roles *</label>
              <div className="grid grid-cols-4 gap-2">
                {roles.map(role => (
                  <label key={role.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={formData.applicableRoles.includes(role.id)}
                      onChange={() => toggleRole(role.id)}
                    />
                    {role.label}
                  </label>
                ))}
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

      {/* Services List */}
      {filteredServices.length === 0 ? (
        <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-lg">
          <PackageIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="font-medium">No services found</p>
          <p className="text-sm text-gray-400 mt-1">
            {services.length === 0 ? 'Click "Seed Catalog" to populate with 90+ services' : 'Try adjusting your filters'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredServices.map((service, index) => (
            <div key={index} className="bg-white p-4 rounded-lg border hover:border-[#FF8C42] transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="font-semibold text-gray-900">{service.serviceName}</h4>
                    <Badge className={service.serviceStyle === 'home' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}>
                      {service.serviceStyle === 'home' ? '🏠 Home' : '📞 Tele'}
                    </Badge>
                    {service.isPackage && (
                      <Badge className="bg-orange-100 text-orange-700">📦 Package</Badge>
                    )}
                  </div>

                  <p className="text-sm text-gray-600 mb-2">{service.description}</p>

                  {/* Package Details Display */}
                  {service.isPackage && service.packageDetails && (
                    <div className="bg-orange-50 border border-orange-200 rounded p-3 mb-2">
                      <div className="grid grid-cols-4 gap-3 text-xs">
                        <div>
                          <span className="text-gray-600">Sessions/Day:</span>
                          <span className="ml-1 font-semibold">{service.packageDetails.sessionsPerDay}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Duration:</span>
                          <span className="ml-1 font-semibold">{service.packageDetails.packageDuration} days</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Session:</span>
                          <span className="ml-1 font-semibold">{service.packageDetails.sessionDuration} min</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Total:</span>
                          <span className="ml-1 font-semibold">{service.packageDetails.totalSessions} sessions</span>
                        </div>
                      </div>
                      <div className="mt-2 pt-2 border-t border-orange-200">
                        <div className="text-xs text-gray-600 mb-1">Pricing:</div>
                        <div className="grid grid-cols-4 gap-2 text-xs">
                          <span className="bg-white px-2 py-1 rounded">S: ₹{service.packageDetails.pricingBySize.small}</span>
                          <span className="bg-white px-2 py-1 rounded">M: ₹{service.packageDetails.pricingBySize.medium}</span>
                          <span className="bg-white px-2 py-1 rounded">L: ₹{service.packageDetails.pricingBySize.large}</span>
                          <span className="bg-white px-2 py-1 rounded">XL: ₹{service.packageDetails.pricingBySize.extraLarge}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2 mb-2">
                    <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                      {service.categoryName}
                    </span>
                    {!service.isPackage && (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                        ₹{service.basePrice}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-1">
                    {service.applicableRoles.map(roleId => {
                      const role = roles.find(r => r.id === roleId);
                      return (
                        <span key={roleId} className="text-xs bg-orange-50 text-orange-700 px-2 py-0.5 rounded">
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
  );
}