import { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Plus,
  Edit,
  Trash2,
  Clock,
  DollarSign,
  MapPin,
  Check,
  X,
  Briefcase,
  Search
} from 'lucide-react';
import { getApiBaseUrl, getAuthHeaders } from '../../utils/api-config';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog';
import { Input } from '../ui/input';
import { Button } from '../ui/button';

interface StaffServiceManagementProps {
  staff: any;
  onBack: () => void;
}

interface Service {
  id: string;
  serviceId: string;
  serviceName: string;
  category: string;
  price: number;
  duration: number;
  description?: string;
  isCustom: boolean; // true if staff created it, false if from clinic
  clinicName?: string; // If from clinic
}

interface Location {
  id: string;
  clinicId?: string;
  clinicName: string;
  address: string;
  workingHours: string;
}

export function StaffServiceManagement({ staff, onBack }: StaffServiceManagementProps) {
  const [services, setServices] = useState<Service[]>([]);
  const [availableClinicServices, setAvailableClinicServices] = useState<any[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddService, setShowAddService] = useState(false);
  const [showAddLocation, setShowAddLocation] = useState(false);
  const [showAddFromClinicDialog, setShowAddFromClinicDialog] = useState(false);
  const [selectedServiceStyle, setSelectedServiceStyle] = useState<'at_home' | 'at_center' | 'tele'>('at_center');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClinicServices, setSelectedClinicServices] = useState<any[]>([]);

  useEffect(() => {
    loadData();
  }, [staff.id]);

  const loadData = async () => {
    try {
      setLoading(true);

      // ✅ STEP 1: Check if sync is needed
      const syncCheckRes = await fetch(
        `${getApiBaseUrl()}/staff/${staff.id}/check-sync-needed`,
        {
          headers: getAuthHeaders()
        }
      );

      if (syncCheckRes.ok) {
        const syncCheck = await syncCheckRes.json();
        
        // ✅ STEP 2: Auto-sync if needed
        if (syncCheck.syncNeeded) {
          console.log('🔄 Services need sync, auto-syncing...');
          toast.info('Syncing services from clinic...');
          
          const syncRes = await fetch(
            `${getApiBaseUrl()}/staff/${staff.id}/sync-services`,
            {
              method: 'POST',
              headers: getAuthHeaders()
            }
          );
          
          if (syncRes.ok) {
            const syncData = await syncRes.json();
            console.log('✅ Services synced:', syncData);
            toast.success(`${syncData.servicesCreated} services synced from clinic!`);
          }
        }
      }

      // ✅ STEP 3: Load staff's services
      const servicesRes = await fetch(
        `${getApiBaseUrl()}/staff/${staff.id}/services`,
        {
          headers: getAuthHeaders()
        }
      );

      if (servicesRes.ok) {
        const data = await servicesRes.json();
        setServices(data.services || []);
        console.log('✅ Loaded services:', data.services.length);
      }

      // Load available clinic services if staff is associated with a clinic
      if (staff.vendorId) {
        const clinicServicesRes = await fetch(
          `${getApiBaseUrl()}/vendor/${staff.vendorId}/services`,
          {
            headers: getAuthHeaders()
          }
        );

        if (clinicServicesRes.ok) {
          const data = await clinicServicesRes.json();
          
          // ✅ FIXED: Parse new response format from updated endpoint
          let servicesList: any[] = [];
          
          // New format: data.allServices (flat array of all enabled services)
          if (data.allServices && Array.isArray(data.allServices)) {
            servicesList = data.allServices.filter((s: any) => s.isEnabled);
          }
          // Alternative: data.services (grouped by style)
          else if (data.success && data.services && typeof data.services === 'object') {
            ['at_home', 'at_center', 'tele'].forEach(style => {
              if (data.services[style] && data.services[style].services) {
                const styleServices = data.services[style].services
                  .filter((s: any) => s.isEnabled)
                  .map((s: any) => ({ ...s, serviceStyle: style })); // Add serviceStyle to each service
                servicesList.push(...styleServices);
              }
            });
          }
          // Legacy fallback
          else if (data.legacyServices && Array.isArray(data.legacyServices)) {
            servicesList = data.legacyServices.filter((s: any) => s.isActive !== false);
          }
          else if (Array.isArray(data.services)) {
            servicesList = data.services.filter((s: any) => s.isActive !== false);
          }
          
          console.log('✅ [STAFF-SERVICE-MGMT] Parsed clinic services:', servicesList.length, servicesList);
          setAvailableClinicServices(servicesList);
        }
      }

      // Load staff locations/clinics
      const locationsRes = await fetch(
        `${getApiBaseUrl()}/staff/${staff.id}/locations`,
        {
          headers: getAuthHeaders()
        }
      );

      if (locationsRes.ok) {
        const data = await locationsRes.json();
        setLocations(data.locations || []);
      }

    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white w-full max-w-[430px] mx-auto flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42] mx-auto mb-4"></div>
          <p className="text-gray-600">Loading services...</p>
        </div>
      </div>
    );
  }

  // Filter services based on selected tab and search query
  const filteredClinicServices = availableClinicServices
    .filter(service => service.serviceStyle === selectedServiceStyle)
    .filter(service => {
      // ✅ Filter out services already added to staff
      const isAlreadyAdded = services.some(s => s.serviceId === service.serviceId || s.serviceId === service.id);
      return !isAlreadyAdded;
    })
    .filter(service => {
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return (
        service.serviceName?.toLowerCase().includes(query) ||
        service.categoryName?.toLowerCase().includes(query) ||
        service.description?.toLowerCase().includes(query)
      );
    });

  return (
    <div className="min-h-screen bg-white w-full max-w-[430px] mx-auto pb-20">
      {/* Header */}
      <div className="bg-[#FF8C42] text-white p-4 sticky top-0 z-10">
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={onBack}
            className="p-2 hover:bg-white/10 rounded-full transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-xl text-white">My Services</h1>
            <p className="text-sm text-white/90">Manage your offerings</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setShowAddService(true)}
            className="w-full bg-white text-[#FF8C42] rounded-lg py-2 flex items-center justify-center gap-2 hover:bg-gray-100 transition-colors text-sm"
          >
            <Plus className="w-4 h-4" />
            Create Service
          </button>
          <button
            onClick={() => setShowAddFromClinicDialog(true)}
            className="w-full bg-white/20 text-white border border-white rounded-lg py-2 flex items-center justify-center gap-2 hover:bg-white/30 transition-colors text-sm"
          >
            <Plus className="w-4 h-4" />
            Add from Clinic
          </button>
        </div>
      </div>

      {/* Services List */}
      <div className="p-4 space-y-3">
        <h2 className="text-gray-900 mb-2">My Services ({services.length})</h2>
        
        {services.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center border border-gray-200">
            <Briefcase className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <h3 className="text-gray-900 mb-2">No Services Yet</h3>
            <p className="text-gray-500 mb-4">
              Create your own services or add from clinic
            </p>
          </div>
        ) : (
          services.map((service) => (
            <div key={service.id} className="bg-white rounded-xl p-4 border border-gray-200">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <h3 className="text-gray-900 mb-1">{service.serviceName}</h3>
                  <p className="text-sm text-gray-600">{service.category}</p>
                  {service.description && (
                    <p className="text-sm text-gray-500 mt-1">{service.description}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {/* TODO: Edit service */}}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <Edit className="w-4 h-4 text-gray-600" />
                  </button>
                  <button
                    onClick={() => {/* TODO: Delete service */}}
                    className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-4 mt-3">
                <div className="flex items-center gap-1 text-sm text-gray-600">
                  <DollarSign className="w-4 h-4" />
                  <span>₹{service.price}</span>
                </div>
                <div className="flex items-center gap-1 text-sm text-gray-600">
                  <Clock className="w-4 h-4" />
                  <span>{service.duration} min</span>
                </div>
              </div>

              <div className="mt-2">
                {service.isCustom ? (
                  <span className="inline-block px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full">
                    Custom Service
                  </span>
                ) : (
                  <span className="inline-block px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                    {service.clinicName || 'Clinic Service'}
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Locations Section */}
      <div className="p-4 space-y-3 mt-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-gray-900">Working Locations ({locations.length})</h2>
          <button
            onClick={() => setShowAddLocation(true)}
            className="px-3 py-1 bg-[#FF8C42] text-white rounded-lg text-sm hover:bg-[#FF7A29] transition-colors"
          >
            <Plus className="w-4 h-4 inline-block mr-1" />
            Add Location
          </button>
        </div>

        {locations.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center border border-gray-200">
            <MapPin className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <h3 className="text-gray-900 mb-2">No Locations Added</h3>
            <p className="text-gray-500 mb-4">
              Add clinics or locations where you provide services
            </p>
          </div>
        ) : (
          locations.map((location) => (
            <div key={location.id} className="bg-white rounded-xl p-4 border border-gray-200">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-gray-900 mb-1">{location.clinicName}</h3>
                  <p className="text-sm text-gray-600">{location.address}</p>
                  <p className="text-sm text-gray-500 mt-1">Hours: {location.workingHours}</p>
                </div>
                <button
                  onClick={() => {/* TODO: Remove location */}}
                  className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4 text-red-500" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Service Modal - TODO: Implement */}
      {showAddService && (
        <Dialog open={true} onOpenChange={() => setShowAddService(false)}>
          <DialogContent className="max-w-[400px]">
            <DialogHeader>
              <DialogTitle>Create Custom Service</DialogTitle>
              <DialogDescription>
                Create a service that you offer independently
              </DialogDescription>
            </DialogHeader>
            <div className="p-4 text-center text-gray-500">
              Coming soon...
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Add from Clinic Dialog */}
      <Dialog open={showAddFromClinicDialog} onOpenChange={setShowAddFromClinicDialog}>
        <DialogContent className="max-w-[600px] max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Add Service from Clinic</DialogTitle>
            <DialogDescription>
              Select services from your clinic's offerings
            </DialogDescription>
          </DialogHeader>

          {/* Tabs for Service Style */}
          <div className="flex gap-2 border-b border-gray-200 pb-2">
            <button
              onClick={() => setSelectedServiceStyle('at_home')}
              className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                selectedServiceStyle === 'at_home'
                  ? 'bg-[#FF8C42] text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              🏠 At Home
            </button>
            <button
              onClick={() => setSelectedServiceStyle('at_center')}
              className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                selectedServiceStyle === 'at_center'
                  ? 'bg-[#FF8C42] text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              🏥 At Center
            </button>
            <button
              onClick={() => setSelectedServiceStyle('tele')}
              className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                selectedServiceStyle === 'tele'
                  ? 'bg-[#FF8C42] text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              📱 Tele Consultation
            </button>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search services..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Selected Count */}
          {selectedClinicServices.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center justify-between">
              <span className="text-sm text-blue-900">
                {selectedClinicServices.length} service{selectedClinicServices.length > 1 ? 's' : ''} selected
              </span>
              <button
                onClick={() => setSelectedClinicServices([])}
                className="text-sm text-blue-600 hover:text-blue-800 underline"
              >
                Clear all
              </button>
            </div>
          )}

          {/* Services List */}
          <div className="flex-1 overflow-y-auto space-y-2">
            {filteredClinicServices.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>No services available for {selectedServiceStyle === 'at_home' ? 'At Home' : selectedServiceStyle === 'at_center' ? 'At Center' : 'Tele Consultation'}</p>
              </div>
            ) : (
              filteredClinicServices.map((service) => {
                const isSelected = selectedClinicServices.some(s => s.serviceId === service.serviceId);
                
                return (
                  <div
                    key={service.serviceId}
                    className={`p-3 border rounded-lg cursor-pointer transition-all ${
                      isSelected
                        ? 'border-[#FF8C42] bg-orange-50'
                        : 'border-gray-200 hover:border-[#FF8C42] hover:bg-gray-50'
                    }`}
                    onClick={() => {
                      if (isSelected) {
                        setSelectedClinicServices(prev => prev.filter(s => s.serviceId !== service.serviceId));
                      } else {
                        setSelectedClinicServices(prev => [...prev, service]);
                      }
                    }}
                  >
                    <div className="flex items-start gap-3">
                      {/* Checkbox */}
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                        isSelected ? 'bg-[#FF8C42] border-[#FF8C42]' : 'border-gray-300'
                      }`}>
                        {isSelected && (
                          <Check className="w-3.5 h-3.5 text-white" />
                        )}
                      </div>

                      {/* Service Details */}
                      <div className="flex-1">
                        <h4 className="text-gray-900 mb-1">{service.serviceName}</h4>
                        <p className="text-sm text-gray-600 mb-2">{service.categoryName}</p>
                        <div className="flex items-center gap-3 text-sm text-gray-600">
                          <span>{(service.price || service.customPrice || 0) > 0 ? `₹${service.price || service.customPrice}` : 'Free'}</span>
                          <span>•</span>
                          <span>{(service.duration || service.customDuration || 0) > 0 ? `${service.duration || service.customDuration} min` : 'Not set'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Add Selected Button */}
          <DialogFooter>
            <Button
              onClick={async () => {
                if (selectedClinicServices.length === 0) {
                  toast.info('Please select at least one service');
                  return;
                }

                try {
                  // Add all selected services
                  for (const service of selectedClinicServices) {
                    const response = await fetch(
                      `${getApiBaseUrl()}/staff/${staff.id}/services/add-clinic-service`,
                      {
                        method: 'POST',
                        headers: {
                          ...getAuthHeaders(),
                          'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                          serviceId: service.serviceId,
                          serviceName: service.serviceName,
                          category: service.category,
                          categoryName: service.categoryName,
                          price: service.price || service.customPrice,
                          duration: service.duration || service.customDuration,
                          description: service.description,
                          serviceStyle: service.serviceStyle || selectedServiceStyle
                        })
                      }
                    );
                    
                    if (!response.ok) {
                      const error = await response.json();
                      if (error.error !== 'Service already assigned to staff') {
                        throw new Error(error.error);
                      }
                    }
                  }

                  toast.success(`${selectedClinicServices.length} service${selectedClinicServices.length > 1 ? 's' : ''} added successfully!`);
                  setSelectedClinicServices([]);
                  setShowAddFromClinicDialog(false);
                  await loadData();
                } catch (error) {
                  console.error('Error adding services:', error);
                  toast.error('Failed to add some services');
                }
              }}
              disabled={selectedClinicServices.length === 0}
              className="bg-[#FF8C42] hover:bg-[#ff7a28] text-white"
            >
              Add {selectedClinicServices.length > 0 ? `${selectedClinicServices.length} ` : ''}Service{selectedClinicServices.length > 1 ? 's' : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Location Modal - TODO: Implement */}
      {showAddLocation && (
        <Dialog open={true} onOpenChange={() => setShowAddLocation(false)}>
          <DialogContent className="max-w-[400px]">
            <DialogHeader>
              <DialogTitle>Add Working Location</DialogTitle>
              <DialogDescription>
                Add a clinic or location where you provide services
              </DialogDescription>
            </DialogHeader>
            <div className="p-4 text-center text-gray-500">
              Coming soon...
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}