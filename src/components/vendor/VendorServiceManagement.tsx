import { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Plus, 
  Edit2, 
  Trash2, 
  Save,
  X,
  Phone,
  Home,
  Building2,
  Clock,
  DollarSign,
  ToggleLeft,
  ToggleRight,
  Check
} from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

interface VendorServiceManagementProps {
  vendorId: string;
  vendorData: any;
  onBack: () => void;
}

interface VendorService {
  id: string;
  name: string;
  description: string;
  serviceType: 'tele_consulting' | 'home_visit' | 'clinic_visit' | 'both_visit';
  category: string; // veterinary, grooming, training, etc.
  pricing: {
    basePrice: number;
    currency: string;
    priceType: 'fixed' | 'starting_from' | 'per_hour';
  };
  duration: number; // in minutes
  availability: {
    enabled: boolean;
    days: string[]; // ['monday', 'tuesday', ...]
    timeSlots: { start: string; end: string }[];
  };
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export function VendorServiceManagement({ vendorId, vendorData, onBack }: VendorServiceManagementProps) {
  const [services, setServices] = useState<VendorService[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingService, setEditingService] = useState<VendorService | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    serviceType: 'clinic_visit' as VendorService['serviceType'],
    category: vendorData?.vendorType || 'veterinary',
    basePrice: '',
    priceType: 'fixed' as 'fixed' | 'starting_from' | 'per_hour',
    duration: '30',
    isActive: true,
    availableDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
    timeSlotStart: '09:00',
    timeSlotEnd: '18:00'
  });

  useEffect(() => {
    loadServices();
  }, [vendorId]);

  const loadServices = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/services?vendorId=${vendorId}`,
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
      console.error('Error loading services:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveService = async () => {
    if (!formData.name || !formData.basePrice) {
      alert('Please fill in service name and price');
      return;
    }

    setSaving(true);
    try {
      const serviceData: Partial<VendorService> = {
        id: editingService?.id || `service_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        name: formData.name,
        description: formData.description,
        serviceType: formData.serviceType,
        category: formData.category,
        pricing: {
          basePrice: parseFloat(formData.basePrice),
          currency: 'INR',
          priceType: formData.priceType
        },
        duration: parseInt(formData.duration),
        availability: {
          enabled: true,
          days: formData.availableDays,
          timeSlots: [{ start: formData.timeSlotStart, end: formData.timeSlotEnd }]
        },
        isActive: formData.isActive,
        updatedAt: new Date().toISOString()
      };

      if (!editingService) {
        serviceData.createdAt = new Date().toISOString();
      }

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/services`,
        {
          method: editingService ? 'PUT' : 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({
            vendorId,
            service: serviceData
          })
        }
      );

      if (response.ok) {
        await loadServices();
        resetForm();
        alert(editingService ? 'Service updated successfully!' : 'Service created successfully!');
      }
    } catch (error) {
      console.error('Error saving service:', error);
      alert('Failed to save service. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleEditService = (service: VendorService) => {
    setEditingService(service);
    setIsCreatingNew(true);
    setFormData({
      name: service.name,
      description: service.description,
      serviceType: service.serviceType,
      category: service.category,
      basePrice: service.pricing.basePrice.toString(),
      priceType: service.pricing.priceType,
      duration: service.duration.toString(),
      isActive: service.isActive,
      availableDays: service.availability.days,
      timeSlotStart: service.availability.timeSlots[0]?.start || '09:00',
      timeSlotEnd: service.availability.timeSlots[0]?.end || '18:00'
    });
  };

  const handleDeleteService = async (serviceId: string) => {
    if (!confirm('Are you sure you want to delete this service?')) return;

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/services/${serviceId}?vendorId=${vendorId}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (response.ok) {
        await loadServices();
        alert('Service deleted successfully!');
      }
    } catch (error) {
      console.error('Error deleting service:', error);
      alert('Failed to delete service. Please try again.');
    }
  };

  const toggleServiceStatus = async (service: VendorService) => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/services`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({
            vendorId,
            service: { ...service, isActive: !service.isActive }
          })
        }
      );

      if (response.ok) {
        await loadServices();
      }
    } catch (error) {
      console.error('Error toggling service:', error);
    }
  };

  const resetForm = () => {
    setIsCreatingNew(false);
    setEditingService(null);
    setFormData({
      name: '',
      description: '',
      serviceType: 'clinic_visit',
      category: vendorData?.vendorType || 'veterinary',
      basePrice: '',
      priceType: 'fixed',
      duration: '30',
      isActive: true,
      availableDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
      timeSlotStart: '09:00',
      timeSlotEnd: '18:00'
    });
  };

  const getServiceTypeIcon = (type: string) => {
    switch (type) {
      case 'tele_consulting': return <Phone className="w-5 h-5" />;
      case 'home_visit': return <Home className="w-5 h-5" />;
      case 'clinic_visit': return <Building2 className="w-5 h-5" />;
      case 'both_visit': return <Home className="w-5 h-5" />;
      default: return <Building2 className="w-5 h-5" />;
    }
  };

  const getServiceTypeLabel = (type: string) => {
    switch (type) {
      case 'tele_consulting': return 'Tele Consulting';
      case 'home_visit': return 'Home Visit';
      case 'clinic_visit': return 'Clinic Visit';
      case 'both_visit': return 'Home & Clinic';
      default: return type;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#FF8C42] border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-gray-600">Loading services...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="w-full max-w-[430px] mx-auto bg-white min-h-screen pb-20">
        {/* Header */}
        <div className="p-4 bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="flex items-center gap-3 mb-3">
            <button onClick={onBack} className="w-8 h-8 flex items-center justify-center">
              <ArrowLeft className="w-5 h-5 text-gray-700" />
            </button>
            <div className="flex-1">
              <h1 className="font-semibold text-gray-900">Service Management</h1>
              <p className="text-xs text-gray-500">{vendorData?.businessName || vendorData?.fullName}</p>
            </div>
          </div>

          {!isCreatingNew && (
            <Button
              onClick={() => setIsCreatingNew(true)}
              className="w-full bg-[#FF8C42] hover:bg-[#ff7a28] text-white rounded-xl h-11 flex items-center justify-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Add New Service
            </Button>
          )}
        </div>

        {/* Create/Edit Form */}
        {isCreatingNew && (
          <div className="p-4 border-b-8 border-gray-100 bg-orange-50">
            <div className="bg-white rounded-xl border border-orange-200 p-4 space-y-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-gray-900">
                  {editingService ? 'Edit Service' : 'New Service'}
                </h2>
                <button onClick={resetForm} className="text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Service Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Service Name<span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., General Checkup, Vaccination, Grooming"
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#FF8C42]"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Brief description of the service..."
                  rows={2}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#FF8C42]"
                />
              </div>

              {/* Service Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Service Type<span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: 'tele_consulting', label: 'Tele Consulting', icon: '📞' },
                    { value: 'home_visit', label: 'Home Visit', icon: '🏠' },
                    { value: 'clinic_visit', label: 'Clinic Visit', icon: '🏥' },
                    { value: 'both_visit', label: 'Home & Clinic', icon: '🏠🏥' }
                  ].map(type => (
                    <button
                      key={type.value}
                      onClick={() => setFormData({ ...formData, serviceType: type.value as any })}
                      className={`p-3 rounded-xl border-2 transition-all ${
                        formData.serviceType === type.value
                          ? 'border-[#FF8C42] bg-orange-50'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    >
                      <div className="text-2xl mb-1">{type.icon}</div>
                      <div className="text-xs font-medium text-gray-700">{type.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Pricing */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Price (₹)<span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={formData.basePrice}
                    onChange={(e) => setFormData({ ...formData, basePrice: e.target.value })}
                    placeholder="500"
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#FF8C42]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Price Type
                  </label>
                  <select
                    value={formData.priceType}
                    onChange={(e) => setFormData({ ...formData, priceType: e.target.value as any })}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#FF8C42]"
                  >
                    <option value="fixed">Fixed</option>
                    <option value="starting_from">Starting from</option>
                    <option value="per_hour">Per hour</option>
                  </select>
                </div>
              </div>

              {/* Duration */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Duration (minutes)
                </label>
                <select
                  value={formData.duration}
                  onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#FF8C42]"
                >
                  <option value="15">15 minutes</option>
                  <option value="30">30 minutes</option>
                  <option value="45">45 minutes</option>
                  <option value="60">1 hour</option>
                  <option value="90">1.5 hours</option>
                  <option value="120">2 hours</option>
                </select>
              </div>

              {/* Available Days */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Available Days
                </label>
                <div className="flex flex-wrap gap-2">
                  {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map(day => (
                    <button
                      key={day}
                      onClick={() => {
                        const days = formData.availableDays.includes(day)
                          ? formData.availableDays.filter(d => d !== day)
                          : [...formData.availableDays, day];
                        setFormData({ ...formData, availableDays: days });
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                        formData.availableDays.includes(day)
                          ? 'bg-[#FF8C42] text-white border-[#FF8C42]'
                          : 'bg-white text-gray-600 border-gray-300'
                      }`}
                    >
                      {day.substring(0, 3).toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Time Slots */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Start Time
                  </label>
                  <input
                    type="time"
                    value={formData.timeSlotStart}
                    onChange={(e) => setFormData({ ...formData, timeSlotStart: e.target.value })}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#FF8C42]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    End Time
                  </label>
                  <input
                    type="time"
                    value={formData.timeSlotEnd}
                    onChange={(e) => setFormData({ ...formData, timeSlotEnd: e.target.value })}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#FF8C42]"
                  />
                </div>
              </div>

              {/* Active Status */}
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                <div>
                  <div className="font-medium text-gray-900 text-sm">Active Service</div>
                  <div className="text-xs text-gray-500">Customers can book this service</div>
                </div>
                <button
                  onClick={() => setFormData({ ...formData, isActive: !formData.isActive })}
                  className={`w-12 h-7 rounded-full transition-colors ${
                    formData.isActive ? 'bg-green-500' : 'bg-gray-300'
                  }`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full transition-transform ${
                    formData.isActive ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-2">
                <Button
                  onClick={handleSaveService}
                  disabled={saving}
                  className="flex-1 bg-[#FF8C42] hover:bg-[#ff7a28] text-white rounded-xl h-11 flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  {saving ? 'Saving...' : (editingService ? 'Update Service' : 'Create Service')}
                </Button>
                <Button
                  onClick={resetForm}
                  variant="outline"
                  className="px-6 rounded-xl h-11"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Services List */}
        <div className="p-4">
          {services.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Plus className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="font-medium text-gray-900 mb-1">No Services Yet</h3>
              <p className="text-sm text-gray-500 mb-4">Add your first service to start accepting bookings</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-gray-900">Your Services ({services.length})</h2>
              </div>

              {services.map(service => (
                <div
                  key={service.id}
                  className={`bg-white rounded-xl border-2 p-4 transition-all ${
                    service.isActive ? 'border-gray-200' : 'border-gray-100 opacity-60'
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-gray-900">{service.name}</h3>
                        {service.isActive ? (
                          <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">
                            Active
                          </Badge>
                        ) : (
                          <Badge className="bg-gray-100 text-gray-700 border-gray-200 text-xs">
                            Inactive
                          </Badge>
                        )}
                      </div>
                      {service.description && (
                        <p className="text-xs text-gray-600 mb-2">{service.description}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-4 mb-3 text-sm">
                    <div className="flex items-center gap-1.5 text-[#FF8C42]">
                      {getServiceTypeIcon(service.serviceType)}
                      <span className="text-xs font-medium">{getServiceTypeLabel(service.serviceType)}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-gray-600">
                      <Clock className="w-4 h-4" />
                      <span className="text-xs">{service.duration} min</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-green-600">
                      <DollarSign className="w-4 h-4" />
                      <span className="text-xs font-semibold">₹{service.pricing.basePrice}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleServiceStatus(service)}
                      className="flex-1 flex items-center justify-center gap-2 h-9 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      {service.isActive ? (
                        <ToggleRight className="w-4 h-4 text-green-600" />
                      ) : (
                        <ToggleLeft className="w-4 h-4 text-gray-400" />
                      )}
                      <span className="text-xs font-medium text-gray-700">
                        {service.isActive ? 'Disable' : 'Enable'}
                      </span>
                    </button>
                    <button
                      onClick={() => handleEditService(service)}
                      className="flex-1 flex items-center justify-center gap-2 h-9 border border-[#FF8C42] bg-orange-50 rounded-lg hover:bg-orange-100 transition-colors"
                    >
                      <Edit2 className="w-4 h-4 text-[#FF8C42]" />
                      <span className="text-xs font-medium text-[#FF8C42]">Edit</span>
                    </button>
                    <button
                      onClick={() => handleDeleteService(service.id)}
                      className="flex items-center justify-center w-9 h-9 border border-red-300 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                    >
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
