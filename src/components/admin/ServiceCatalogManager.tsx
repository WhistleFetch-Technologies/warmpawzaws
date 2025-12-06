import { useState, useEffect } from 'react';
import { catalogApi } from '../../utils/api/client';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Plus, Edit, Trash2, Search, Package, TrendingUp, Users, DollarSign, Eye } from 'lucide-react';
import { toast } from 'sonner@2.0.3';

interface Service {
  id: string;
  name: string;
  category: string;
  subCategory?: string;
  serviceStyle: 'at_home' | 'at_center' | 'tele_consultation';
  description: string;
  basePrice: number;
  duration: number;
  petTypes: string[];
  imageUrl?: string;
  tags: string[];
  isActive: boolean;
  regions: string[];
  vendorCount?: number;
  bookingsCount?: number;
  revenue?: number;
  createdAt: string;
}

interface ServiceCategory {
  id: string;
  name: string;
  icon: string;
  description: string;
  subCategories: string[];
  serviceCount: number;
  displayOrder: number;
}

const SERVICE_STYLES = [
  { value: 'at_home', label: 'At Home Service', icon: '🏠' },
  { value: 'at_center', label: 'At Center/Facility', icon: '🏢' },
  { value: 'tele_consultation', label: 'Tele Consultation', icon: '📱' }
];

const PET_TYPES = ['Dog', 'Cat', 'Bird', 'Fish', 'Rabbit', 'Hamster', 'Guinea Pig', 'Other'];

export function ServiceCatalogManager() {
  const [services, setServices] = useState<Service[]>([]);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [filteredServices, setFilteredServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [styleFilter, setStyleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [activeTab, setActiveTab] = useState('services');

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    subCategory: '',
    serviceStyle: 'at_home' as 'at_home' | 'at_center' | 'tele_consultation',
    description: '',
    basePrice: 0,
    duration: 60,
    petTypes: [] as string[],
    imageUrl: '',
    tags: [] as string[],
    isActive: true,
    regions: [] as string[]
  });
  const [tagInput, setTagInput] = useState('');

  useEffect(() => {
    loadServices();
    loadCategories();
  }, []);

  useEffect(() => {
    filterServices();
  }, [services, searchTerm, categoryFilter, styleFilter, statusFilter]);

  async function loadServices() {
    try {
      setLoading(true);
      const data = await catalogApi.getServices();
      setServices(data.services || []);
    } catch (error: any) {
      console.error('Error loading services:', error);
      toast.error(error.message || 'Failed to load services');
    } finally {
      setLoading(false);
    }
  }

  async function loadCategories() {
    try {
      const data = await catalogApi.getCategories();
      setCategories(data.categories || []);
    } catch (error: any) {
      console.error('Error loading categories:', error);
    }
  }

  function filterServices() {
    let filtered = services;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(service =>
        service.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        service.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        service.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    // Category filter
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(service => service.category === categoryFilter);
    }

    // Style filter
    if (styleFilter !== 'all') {
      filtered = filtered.filter(service => service.serviceStyle === styleFilter);
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(service => 
        statusFilter === 'active' ? service.isActive : !service.isActive
      );
    }

    setFilteredServices(filtered);
  }

  async function handleCreateService() {
    if (!formData.name || !formData.category || !formData.description || formData.basePrice <= 0) {
      toast.error('Please fill all required fields');
      return;
    }

    try {
      await catalogApi.createService(formData);
      toast.success('Service created successfully');
      setShowCreateModal(false);
      resetForm();
      loadServices();
    } catch (error: any) {
      console.error('Error creating service:', error);
      toast.error(error.message || 'Failed to create service');
    }
  }

  async function handleUpdateService() {
    if (!selectedService || !formData.name || !formData.category) {
      toast.error('Please fill all required fields');
      return;
    }

    try {
      await catalogApi.updateService(selectedService.id, formData);
      toast.success('Service updated successfully');
      setShowEditModal(false);
      setSelectedService(null);
      resetForm();
      loadServices();
    } catch (error: any) {
      console.error('Error updating service:', error);
      toast.error(error.message || 'Failed to update service');
    }
  }

  async function handleDeleteService(serviceId: string) {
    if (!confirm('Are you sure you want to delete this service? This action cannot be undone.')) {
      return;
    }

    try {
      await catalogApi.deleteService(serviceId);
      toast.success('Service deleted successfully');
      loadServices();
    } catch (error: any) {
      console.error('Error deleting service:', error);
      toast.error(error.message || 'Failed to delete service');
    }
  }

  async function toggleServiceStatus(service: Service) {
    try {
      await catalogApi.updateService(service.id, { isActive: !service.isActive });
      toast.success(`Service ${!service.isActive ? 'activated' : 'deactivated'} successfully`);
      loadServices();
    } catch (error: any) {
      console.error('Error toggling service status:', error);
      toast.error(error.message || 'Failed to update service status');
    }
  }

  function openEditModal(service: Service) {
    setSelectedService(service);
    setFormData({
      name: service.name,
      category: service.category,
      subCategory: service.subCategory || '',
      serviceStyle: service.serviceStyle,
      description: service.description,
      basePrice: service.basePrice,
      duration: service.duration,
      petTypes: service.petTypes,
      imageUrl: service.imageUrl || '',
      tags: service.tags,
      isActive: service.isActive,
      regions: service.regions
    });
    setShowEditModal(true);
  }

  function openDetailsModal(service: Service) {
    setSelectedService(service);
    setShowDetailsModal(true);
  }

  function resetForm() {
    setFormData({
      name: '',
      category: '',
      subCategory: '',
      serviceStyle: 'at_home',
      description: '',
      basePrice: 0,
      duration: 60,
      petTypes: [],
      imageUrl: '',
      tags: [],
      isActive: true,
      regions: []
    });
    setTagInput('');
  }

  function addTag() {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, tagInput.trim()]
      }));
      setTagInput('');
    }
  }

  function removeTag(tag: string) {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(t => t !== tag)
    }));
  }

  function togglePetType(petType: string) {
    setFormData(prev => ({
      ...prev,
      petTypes: prev.petTypes.includes(petType)
        ? prev.petTypes.filter(t => t !== petType)
        : [...prev.petTypes, petType]
    }));
  }

  // Calculate summary stats
  const totalServices = services.length;
  const activeServices = services.filter(s => s.isActive).length;
  const totalVendors = services.reduce((sum, s) => sum + (s.vendorCount || 0), 0);
  const totalBookings = services.reduce((sum, s) => sum + (s.bookingsCount || 0), 0);
  const totalRevenue = services.reduce((sum, s) => sum + (s.revenue || 0), 0);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl">Service Catalog Management</h1>
          <p className="text-sm text-gray-500">Manage the master service catalog for your platform</p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Create Service
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Total Services</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <p className="text-2xl">{totalServices}</p>
              <Package className="w-8 h-8 text-orange-500 opacity-20" />
            </div>
            <p className="text-xs text-gray-500 mt-1">{activeServices} active</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Categories</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <p className="text-2xl">{categories.length}</p>
              <Package className="w-8 h-8 text-orange-500 opacity-20" />
            </div>
            <p className="text-xs text-gray-500 mt-1">Service categories</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Total Vendors</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <p className="text-2xl">{totalVendors}</p>
              <Users className="w-8 h-8 text-orange-500 opacity-20" />
            </div>
            <p className="text-xs text-gray-500 mt-1">Offering services</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Total Bookings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <p className="text-2xl">{totalBookings.toLocaleString()}</p>
              <TrendingUp className="w-8 h-8 text-orange-500 opacity-20" />
            </div>
            <p className="text-xs text-gray-500 mt-1">All time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Total Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <p className="text-2xl">₹{(totalRevenue / 1000).toFixed(0)}K</p>
              <DollarSign className="w-8 h-8 text-orange-500 opacity-20" />
            </div>
            <p className="text-xs text-gray-500 mt-1">From services</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="services">Services</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
        </TabsList>

        <TabsContent value="services" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Search services..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>

                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map(cat => (
                      <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={styleFilter} onValueChange={setStyleFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Styles" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Styles</SelectItem>
                    {SERVICE_STYLES.map(style => (
                      <SelectItem key={style.value} value={style.value}>
                        {style.icon} {style.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Services Table */}
          <Card>
            <CardHeader>
              <CardTitle>Services</CardTitle>
              <CardDescription>
                {filteredServices.length} service{filteredServices.length !== 1 ? 's' : ''} found
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8 text-gray-500">Loading services...</div>
              ) : filteredServices.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No services found. Create your first service to get started.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Service Name</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Style</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Vendors</TableHead>
                      <TableHead>Bookings</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredServices.map((service) => (
                      <TableRow key={service.id}>
                        <TableCell>
                          <div>
                            <p>{service.name}</p>
                            {service.tags.length > 0 && (
                              <div className="flex gap-1 mt-1">
                                {service.tags.slice(0, 2).map((tag, idx) => (
                                  <Badge key={idx} variant="outline" className="text-xs">
                                    {tag}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{service.category}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {SERVICE_STYLES.find(s => s.value === service.serviceStyle)?.icon}
                            {' '}
                            {service.serviceStyle === 'at_home' ? 'Home' : 
                             service.serviceStyle === 'at_center' ? 'Center' : 'Tele'}
                          </Badge>
                        </TableCell>
                        <TableCell>₹{service.basePrice}</TableCell>
                        <TableCell>{service.duration} min</TableCell>
                        <TableCell>{service.vendorCount || 0}</TableCell>
                        <TableCell>{service.bookingsCount || 0}</TableCell>
                        <TableCell>
                          <Badge variant={service.isActive ? 'default' : 'secondary'}>
                            {service.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openDetailsModal(service)}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditModal(service)}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteService(service.id)}
                            >
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="categories">
          <Card>
            <CardHeader>
              <CardTitle>Service Categories</CardTitle>
              <CardDescription>Manage service categories and subcategories</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {categories.map(category => (
                  <Card key={category.id}>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <span className="text-2xl">{category.icon}</span>
                        {category.name}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-gray-600 mb-3">{category.description}</p>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">{category.serviceCount} services</span>
                        <span className="text-gray-500">Order: {category.displayOrder}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Service Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Service</DialogTitle>
            <DialogDescription>
              Add a new service to the master catalog
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Service Name *</Label>
                <Input
                  id="name"
                  placeholder="e.g., Basic Grooming"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="category">Category *</Label>
                <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map(cat => (
                      <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                placeholder="Detailed service description..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="serviceStyle">Service Style *</Label>
                <Select value={formData.serviceStyle} onValueChange={(value: any) => setFormData({ ...formData, serviceStyle: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SERVICE_STYLES.map(style => (
                      <SelectItem key={style.value} value={style.value}>
                        {style.icon} {style.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="basePrice">Base Price (₹) *</Label>
                <Input
                  id="basePrice"
                  type="number"
                  placeholder="500"
                  value={formData.basePrice || ''}
                  onChange={(e) => setFormData({ ...formData, basePrice: parseInt(e.target.value) || 0 })}
                />
              </div>

              <div>
                <Label htmlFor="duration">Duration (minutes) *</Label>
                <Input
                  id="duration"
                  type="number"
                  placeholder="60"
                  value={formData.duration || ''}
                  onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>

            <div>
              <Label>Pet Types *</Label>
              <div className="grid grid-cols-4 gap-2 mt-2">
                {PET_TYPES.map(petType => (
                  <label key={petType} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.petTypes.includes(petType)}
                      onChange={() => togglePetType(petType)}
                      className="rounded"
                    />
                    <span className="text-sm">{petType}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <Label htmlFor="tags">Tags/Keywords</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  id="tags"
                  placeholder="Enter tag"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                />
                <Button type="button" onClick={addTag}>Add</Button>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.tags.map((tag, idx) => (
                  <Badge key={idx} variant="secondary">
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="ml-1 text-xs hover:text-red-500"
                    >
                      ×
                    </button>
                  </Badge>
                ))}
              </div>
            </div>

            <div>
              <Label htmlFor="imageUrl">Image URL</Label>
              <Input
                id="imageUrl"
                placeholder="https://..."
                value={formData.imageUrl}
                onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreateModal(false); resetForm(); }}>
              Cancel
            </Button>
            <Button onClick={handleCreateService}>
              Create Service
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Service Modal - Similar structure */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Service</DialogTitle>
            <DialogDescription>Update service information</DialogDescription>
          </DialogHeader>
          
          {/* Same form fields as create modal */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-name">Service Name *</Label>
                <Input
                  id="edit-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="edit-category">Category *</Label>
                <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map(cat => (
                      <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="edit-description">Description *</Label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="edit-serviceStyle">Service Style *</Label>
                <Select value={formData.serviceStyle} onValueChange={(value: any) => setFormData({ ...formData, serviceStyle: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SERVICE_STYLES.map(style => (
                      <SelectItem key={style.value} value={style.value}>
                        {style.icon} {style.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="edit-basePrice">Base Price (₹) *</Label>
                <Input
                  id="edit-basePrice"
                  type="number"
                  value={formData.basePrice || ''}
                  onChange={(e) => setFormData({ ...formData, basePrice: parseInt(e.target.value) || 0 })}
                />
              </div>

              <div>
                <Label htmlFor="edit-duration">Duration (minutes) *</Label>
                <Input
                  id="edit-duration"
                  type="number"
                  value={formData.duration || ''}
                  onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="edit-active"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="rounded"
              />
              <Label htmlFor="edit-active">Service is active</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowEditModal(false); setSelectedService(null); resetForm(); }}>
              Cancel
            </Button>
            <Button onClick={handleUpdateService}>
              Update Service
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Service Details Modal */}
      <Dialog open={showDetailsModal} onOpenChange={setShowDetailsModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Service Details</DialogTitle>
          </DialogHeader>
          
          {selectedService && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg">{selectedService.name}</h3>
                <p className="text-sm text-gray-600 mt-1">{selectedService.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm text-gray-500">Category</Label>
                  <p>{selectedService.category}</p>
                </div>
                <div>
                  <Label className="text-sm text-gray-500">Service Style</Label>
                  <p>{SERVICE_STYLES.find(s => s.value === selectedService.serviceStyle)?.label}</p>
                </div>
                <div>
                  <Label className="text-sm text-gray-500">Base Price</Label>
                  <p>₹{selectedService.basePrice}</p>
                </div>
                <div>
                  <Label className="text-sm text-gray-500">Duration</Label>
                  <p>{selectedService.duration} minutes</p>
                </div>
                <div>
                  <Label className="text-sm text-gray-500">Vendors Offering</Label>
                  <p>{selectedService.vendorCount || 0}</p>
                </div>
                <div>
                  <Label className="text-sm text-gray-500">Total Bookings</Label>
                  <p>{selectedService.bookingsCount || 0}</p>
                </div>
              </div>

              <div>
                <Label className="text-sm text-gray-500">Pet Types</Label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {selectedService.petTypes.map((type, idx) => (
                    <Badge key={idx} variant="outline">{type}</Badge>
                  ))}
                </div>
              </div>

              {selectedService.tags.length > 0 && (
                <div>
                  <Label className="text-sm text-gray-500">Tags</Label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {selectedService.tags.map((tag, idx) => (
                      <Badge key={idx} variant="secondary">{tag}</Badge>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <Label className="text-sm text-gray-500">Status</Label>
                <div className="mt-1">
                  <Badge variant={selectedService.isActive ? 'default' : 'secondary'}>
                    {selectedService.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetailsModal(false)}>
              Close
            </Button>
            {selectedService && (
              <Button onClick={() => {
                setShowDetailsModal(false);
                openEditModal(selectedService);
              }}>
                Edit Service
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
