import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Package, CheckCircle, Clock, XCircle, Power } from 'lucide-react';
import { Card } from '../../ui/card';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../ui/dialog';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Textarea } from '../../ui/textarea';
import { Switch } from '../../ui/switch';
import { toast } from 'sonner@2.0.3';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';

interface Service {
  id: string;
  service_id?: string;
  name: string;
  description: string;
  price: number;
  customPrice?: number;
  duration: number;
  customDuration?: number;
  category: string;
  isLive?: boolean;
  publishStatus?: 'draft' | 'pending_approval' | 'published' | 'rejected';
  requiresApproval?: boolean;
  isEnabled?: boolean;
}

interface ServiceCatalogManagerProps {
  centerId: string;
  center: any;
  isSoloProvider: boolean;
  onUpdate: () => void;
}

export function ServiceCatalogManager({ centerId, center, isSoloProvider, onUpdate }: ServiceCatalogManagerProps) {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [formData, setFormData] = useState({ name: '', description: '', price: 0, duration: 30, category: '' });
  const [submitting, setSubmitting] = useState(false);

  const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;
  const vendorId = center?.vendorId || center?.vendor_id;

  useEffect(() => {
    loadServices();
  }, [vendorId, centerId]);

  const loadServices = async () => {
    if (!vendorId) return;
    
    setLoading(true);
    try {
      const response = await fetch(
        `${API_BASE}/vendor/services/${vendorId}`,
        {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }
      );

      if (response.ok) {
        const data = await response.json();
        // Flatten services from all styles
        const allServices = data.allServices || [];
        setServices(allServices);
      }
    } catch (error) {
      console.error('Error loading services:', error);
      toast.error('Failed to load services');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (service?: Service) => {
    if (service) {
      setEditingService(service);
      setFormData(service);
    } else {
      setEditingService(null);
      setFormData({ name: '', description: '', price: 0, duration: 30, category: '' });
    }
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    if (!vendorId) {
      toast.error('Vendor ID not found');
      return;
    }

    setSubmitting(true);
    try {
      if (editingService) {
        // Update existing service
        const response = await fetch(
          `${API_BASE}/vendor/services/${editingService.service_id || editingService.id}`,
          {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${publicAnonKey}`
            },
            body: JSON.stringify({
              name: formData.name,
              description: formData.description,
              price: formData.price,
              duration: formData.duration
            })
          }
        );

        if (response.ok) {
          toast.success('Service updated successfully!');
          setModalOpen(false);
          await loadServices();
          onUpdate();
        } else {
          throw new Error('Failed to update service');
        }
      } else {
        // Publish new service using SQL endpoint
        const response = await fetch(
          `${API_BASE}/vendor/services/publish`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${publicAnonKey}`
            },
            body: JSON.stringify({
              vendorId,
              serviceName: formData.name,
              description: formData.description,
              category: formData.category || 'general',
              price: formData.price,
              duration: formData.duration,
              serviceStyle: 'at_center', // Default for center services
              publishLevel: centerId ? 'centre' : 'vendor',
              centreId: centerId || null,
              isCustomService: false, // Center catalog services are standard
              isPackage: false
            })
          }
        );

        if (response.ok) {
          const result = await response.json();
          if (result.isLive) {
            toast.success('Service published and is now live!');
          } else {
            toast.success('Service submitted for approval');
          }
          setModalOpen(false);
          await loadServices();
          onUpdate();
        } else {
          const error = await response.json();
          throw new Error(error.error || 'Failed to publish service');
        }
      }
    } catch (error) {
      toast.error(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleLive = async (service: Service) => {
    const serviceId = service.service_id || service.id;
    try {
      const response = await fetch(
        `${API_BASE}/vendor/services/${serviceId}/toggle-live`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`
          }
        }
      );

      if (response.ok) {
        const result = await response.json();
        toast.success(result.message);
        await loadServices();
        onUpdate();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to toggle live status');
      }
    } catch (error) {
      toast.error(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleDelete = async (serviceId: string) => {
    if (!confirm('Are you sure you want to delete this service?')) return;

    try {
      // Use SQL endpoint for deletion
      const response = await fetch(
        `${API_BASE}/vendor/services/${serviceId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`
          }
        }
      );

      if (response.ok) {
        toast.success('Service deleted successfully!');
        await loadServices();
        onUpdate();
      } else {
        throw new Error('Failed to delete service');
      }
    } catch (error) {
      toast.error(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const getStatusBadge = (service: Service) => {
    if (service.isLive) {
      return (
        <Badge className="bg-green-100 text-green-700 border-green-300">
          <CheckCircle className="w-3 h-3 mr-1" />
          Live
        </Badge>
      );
    }
    
    if (service.publishStatus === 'pending_approval') {
      return (
        <Badge className="bg-yellow-100 text-yellow-700 border-yellow-300">
          <Clock className="w-3 h-3 mr-1" />
          Pending Approval
        </Badge>
      );
    }
    
    if (service.publishStatus === 'rejected') {
      return (
        <Badge className="bg-red-100 text-red-700 border-red-300">
          <XCircle className="w-3 h-3 mr-1" />
          Rejected
        </Badge>
      );
    }
    
    return (
      <Badge variant="outline" className="text-gray-600">
        Draft
      </Badge>
    );
  };

  return (
    <>
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Service Catalog</h2>
          <Button onClick={() => handleOpenModal()} className="bg-orange-600">
            <Plus className="w-4 h-4 mr-2" />
            Add Service
          </Button>
        </div>

        {isSoloProvider && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
            <p className="text-sm text-blue-800">
              ℹ️ Services configured here will automatically sync to your staff profile
            </p>
          </div>
        )}

        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mx-auto"></div>
            <p className="text-gray-600 mt-2">Loading services...</p>
          </div>
        ) : services.length === 0 ? (
          <div className="text-center py-8 bg-gray-50 rounded-lg">
            <Package className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600 mb-4">No services added yet</p>
            <Button onClick={() => handleOpenModal()}>
              <Plus className="w-4 h-4 mr-2" />
              Add Your First Service
            </Button>
          </div>
        ) : (
          <div className="grid gap-4">
            {services.map(service => (
              <div key={service.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-lg">{service.name}</h3>
                      {getStatusBadge(service)}
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{service.description}</p>
                    <div className="flex items-center gap-4 mt-3">
                      <Badge variant="secondary">₹{service.customPrice || service.price}</Badge>
                      <Badge variant="secondary">{service.customDuration || service.duration} mins</Badge>
                      {service.category && <Badge variant="outline">{service.category}</Badge>}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <div className="flex gap-2">
                      {service.publishStatus === 'published' && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleToggleLive(service)}
                          className={service.isLive ? 'text-green-600 hover:text-green-700' : 'text-gray-600'}
                          title={service.isLive ? 'Service is live - click to take offline' : 'Service is offline - click to go live'}
                        >
                          <Power className={`w-4 h-4 ${service.isLive ? 'fill-current' : ''}`} />
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => handleOpenModal(service)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(service.service_id || service.id)}>
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingService ? 'Edit Service' : 'Add Service'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Service Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Basic Grooming"
              />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe what's included..."
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="price">Price (₹) *</Label>
                <Input
                  id="price"
                  type="number"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div>
                <Label htmlFor="duration">Duration (mins)</Label>
                <Input
                  id="duration"
                  type="number"
                  value={formData.duration}
                  onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) || 30 })}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="category">Category</Label>
              <Input
                id="category"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                placeholder="e.g., Grooming, Training"
              />
            </div>
            <div className="flex gap-3 pt-4">
              <Button variant="outline" onClick={() => setModalOpen(false)} className="flex-1" disabled={submitting}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} className="flex-1 bg-orange-600" disabled={submitting || !formData.name || !formData.price}>
                {submitting ? 'Saving...' : (editingService ? 'Update' : 'Add')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
