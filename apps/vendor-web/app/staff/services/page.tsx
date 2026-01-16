'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { 
  ArrowLeft, 
  Package, 
  Check, 
  X, 
  Settings, 
  MapPin, 
  Clock, 
  Home, 
  Phone, 
  Loader2,
  AlertCircle,
  Info,
  DollarSign
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

interface StaffService {
  id: string;
  service_id: string;
  service_name: string;
  description: string;
  category: string;
  base_price: number;
  base_duration: number;
  price?: number;
  duration_minutes?: number;
  service_styles: string[];
  lead_time_minutes: number;
  buffer_time_minutes: number;
  radius_km?: number;
  enabled_by_staff: boolean;
  assigned_by_vendor: boolean;
  is_active: boolean;
}

export default function StaffServicesPage() {
  const router = useRouter();
  const [staff, setStaff] = useState<any>(null);
  const [services, setServices] = useState<StaffService[]>([]);
  const [loading, setLoading] = useState(true);
  const [configuringService, setConfiguringService] = useState<StaffService | null>(null);
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [serviceConfig, setServiceConfig] = useState({
    serviceStyles: [] as string[],
    leadTimeMinutes: 0,
    bufferTimeMinutes: 0,
    radiusKm: null as number | null,
  });

  useEffect(() => {
    // Check if logged in
    if (typeof window !== 'undefined') {
      const staffSession = localStorage.getItem('staff_session');
      if (!staffSession) {
        router.push('/staff/login');
        return;
      }

      try {
        const staffData = JSON.parse(staffSession);
        setStaff(staffData);
        loadServices(staffData.id);
      } catch (error) {
        console.error('Error parsing staff session:', error);
        router.push('/staff/login');
      }
    }
  }, [router]);

  const loadServices = async (staffId: string) => {
    try {
      setLoading(true);
      const response = await apiClient.get<any>(`/staff/${staffId}/services`);
      
      if (response.success) {
        setServices(response.services || []);
      } else {
        throw new Error(response.error || 'Failed to load services');
      }
    } catch (error: any) {
      console.error('[STAFF SERVICES] Error:', error);
      toast.error(error.message || 'Failed to load services');
      setServices([]);
    } finally {
      setLoading(false);
    }
  };

  const handleEnableService = async (service: StaffService) => {
    try {
      setSaving(true);
      
      // If not configured, open config dialog first
      if (!service.enabled_by_staff && (!service.service_styles || service.service_styles.length === 0)) {
        setConfiguringService(service);
        setServiceConfig({
          serviceStyles: [],
          leadTimeMinutes: service.lead_time_minutes || 0,
          bufferTimeMinutes: service.buffer_time_minutes || 0,
          radiusKm: service.radius_km || null,
        });
        setConfigDialogOpen(true);
        return;
      }

      // Enable service
      const response = await apiClient.put<any>(`/staff/${staff.id}/services/${service.service_id}/enable`, {
        serviceStyles: service.service_styles || [],
        leadTimeMinutes: service.lead_time_minutes || 0,
        bufferTimeMinutes: service.buffer_time_minutes || 0,
        radiusKm: service.radius_km || null,
      });

      if (response.success) {
        toast.success('Service enabled and is now live!');
        await loadServices(staff.id);
      } else {
        throw new Error(response.error || 'Failed to enable service');
      }
    } catch (error: any) {
      console.error('[ENABLE SERVICE] Error:', error);
      toast.error(error.message || 'Failed to enable service');
    } finally {
      setSaving(false);
    }
  };

  const handleDisableService = async (service: StaffService) => {
    if (!confirm('Are you sure you want to disable this service? It will no longer appear in customer searches.')) {
      return;
    }

    try {
      setSaving(true);
      const response = await apiClient.put<any>(`/staff/${staff.id}/services/${service.service_id}/disable`);

      if (response.success) {
        toast.success('Service disabled');
        await loadServices(staff.id);
      } else {
        throw new Error(response.error || 'Failed to disable service');
      }
    } catch (error: any) {
      console.error('[DISABLE SERVICE] Error:', error);
      toast.error(error.message || 'Failed to disable service');
    } finally {
      setSaving(false);
    }
  };

  const handleConfigureService = async () => {
    if (!configuringService) return;

    if (serviceConfig.serviceStyles.length === 0) {
      toast.error('Please select at least one service style');
      return;
    }

    try {
      setSaving(true);
      
      // First enable with configuration
      const response = await apiClient.put<any>(`/staff/${staff.id}/services/${configuringService.service_id}/enable`, {
        serviceStyles: serviceConfig.serviceStyles,
        leadTimeMinutes: serviceConfig.leadTimeMinutes,
        bufferTimeMinutes: serviceConfig.bufferTimeMinutes,
        radiusKm: serviceConfig.radiusKm,
      });

      if (response.success) {
        toast.success('Service configured and enabled!');
        setConfigDialogOpen(false);
        setConfiguringService(null);
        await loadServices(staff.id);
      } else {
        throw new Error(response.error || 'Failed to configure service');
      }
    } catch (error: any) {
      console.error('[CONFIGURE SERVICE] Error:', error);
      toast.error(error.message || 'Failed to configure service');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateServiceConfig = async (service: StaffService) => {
    setConfiguringService(service);
    setServiceConfig({
      serviceStyles: service.service_styles || [],
      leadTimeMinutes: service.lead_time_minutes || 0,
      bufferTimeMinutes: service.buffer_time_minutes || 0,
      radiusKm: service.radius_km || null,
    });
    setConfigDialogOpen(true);
  };

  const toggleServiceStyle = (style: string) => {
    setServiceConfig(prev => ({
      ...prev,
      serviceStyles: prev.serviceStyles.includes(style)
        ? prev.serviceStyles.filter(s => s !== style)
        : [...prev.serviceStyles, style],
    }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-[#FF8C42] mx-auto mb-4" />
          <p className="text-gray-600">Loading services...</p>
        </div>
      </div>
    );
  }

  const enabledServices = services.filter(s => s.enabled_by_staff);
  const assignedServices = services.filter(s => s.assigned_by_vendor);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white border-b sticky top-0 z-10">
          <div className="p-4 flex items-center gap-3">
            <button
              onClick={() => router.push('/staff/dashboard')}
              className="w-10 h-10 flex items-center justify-center hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-700" />
            </button>
            <div className="flex-1">
              <h1 className="text-xl font-bold text-gray-900">My Services</h1>
              <p className="text-sm text-gray-600">Manage services assigned by business</p>
            </div>
          </div>

          {/* Stats */}
          <div className="px-4 pb-4 grid grid-cols-3 gap-2">
            <div className="bg-blue-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-blue-600">{assignedServices.length}</div>
              <div className="text-xs text-blue-700">Assigned</div>
            </div>
            <div className="bg-green-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-green-600">{enabledServices.length}</div>
              <div className="text-xs text-green-700">Enabled</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-gray-600">{assignedServices.length - enabledServices.length}</div>
              <div className="text-xs text-gray-700">Pending</div>
            </div>
          </div>
        </div>

        {/* Info Banner */}
        <div className="p-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2">
            <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1 text-sm text-blue-800">
              <p className="font-semibold mb-1">How it works:</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>Business assigns services to you</li>
                <li>You enable and configure services (goes live immediately)</li>
                <li>Set service styles, lead time, buffer time, and radius</li>
                <li>Services appear in customer searches when enabled</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Services List */}
        <div className="p-4 space-y-3">
          {services.length === 0 ? (
            <div className="bg-white rounded-xl p-8 text-center border border-gray-200">
              <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="font-semibold text-gray-900 mb-2">No Services Assigned</h3>
              <p className="text-sm text-gray-600">
                Ask your business owner to assign services to you
              </p>
            </div>
          ) : (
            services.map((service) => (
              <div
                key={service.id}
                className={`bg-white rounded-xl border-2 transition-all ${
                  service.enabled_by_staff
                    ? 'border-green-500 shadow-sm'
                    : 'border-gray-200'
                }`}
              >
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-gray-900">{service.service_name}</h3>
                        {service.enabled_by_staff && (
                          <Badge className="bg-green-500 text-white">Live</Badge>
                        )}
                        {service.assigned_by_vendor && (
                          <Badge variant="outline">Assigned</Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{service.description}</p>
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <DollarSign className="w-3 h-3" />
                          ₹{service.price || service.base_price}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {service.duration_minutes || service.base_duration}m
                        </span>
                        <span className="text-gray-400">{service.category}</span>
                      </div>
                    </div>
                    <Switch
                      checked={service.enabled_by_staff}
                      onCheckedChange={() => {
                        if (service.enabled_by_staff) {
                          handleDisableService(service);
                        } else {
                          handleEnableService(service);
                        }
                      }}
                      className="data-[state=checked]:bg-green-500"
                    />
                  </div>

                  {/* Service Configuration (if enabled) */}
                  {service.enabled_by_staff && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                        <div>
                          <p className="text-gray-500 mb-1">Service Styles</p>
                          <div className="flex flex-wrap gap-1">
                            {service.service_styles?.map((style) => (
                              <Badge key={style} variant="outline" className="text-xs">
                                {style === 'at_home' && <Home className="w-3 h-3 mr-1" />}
                                {style === 'tele' && <Phone className="w-3 h-3 mr-1" />}
                                {style === 'at_center' && <MapPin className="w-3 h-3 mr-1" />}
                                {style}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <div>
                          <p className="text-gray-500 mb-1">Lead Time</p>
                          <p className="font-medium">{service.lead_time_minutes || 0}m</p>
                        </div>
                        <div>
                          <p className="text-gray-500 mb-1">Buffer Time</p>
                          <p className="font-medium">{service.buffer_time_minutes || 0}m</p>
                        </div>
                        {service.radius_km && (
                          <div>
                            <p className="text-gray-500 mb-1">Radius</p>
                            <p className="font-medium">{service.radius_km} km</p>
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => handleUpdateServiceConfig(service)}
                        className="mt-2 text-xs text-[#FF8C42] hover:underline flex items-center gap-1"
                      >
                        <Settings className="w-3 h-3" />
                        Configure
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Configuration Dialog */}
      <Dialog open={configDialogOpen} onOpenChange={setConfigDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Configure Service</DialogTitle>
            <DialogDescription>
              Set service styles, timing, and radius for {configuringService?.service_name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Service Styles */}
            <div>
              <Label className="text-sm font-medium text-gray-700 mb-2 block">
                Service Styles <span className="text-red-500">*</span>
              </Label>
              <p className="text-xs text-gray-500 mb-2">Select how this service can be delivered</p>
              <div className="space-y-2">
                <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                  <input
                    type="checkbox"
                    checked={serviceConfig.serviceStyles.includes('at_home')}
                    onChange={() => toggleServiceStyle('at_home')}
                    className="w-4 h-4 text-[#FF8C42]"
                  />
                  <Home className="w-5 h-5 text-gray-600" />
                  <div className="flex-1">
                    <p className="font-medium text-sm">At Home</p>
                    <p className="text-xs text-gray-500">Service delivered at customer location</p>
                  </div>
                </label>
                <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                  <input
                    type="checkbox"
                    checked={serviceConfig.serviceStyles.includes('tele')}
                    onChange={() => toggleServiceStyle('tele')}
                    className="w-4 h-4 text-[#FF8C42]"
                  />
                  <Phone className="w-5 h-5 text-gray-600" />
                  <div className="flex-1">
                    <p className="font-medium text-sm">Tele Consultation</p>
                    <p className="text-xs text-gray-500">Video/phone consultation</p>
                  </div>
                </label>
                <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                  <input
                    type="checkbox"
                    checked={serviceConfig.serviceStyles.includes('at_center')}
                    onChange={() => toggleServiceStyle('at_center')}
                    className="w-4 h-4 text-[#FF8C42]"
                  />
                  <MapPin className="w-5 h-5 text-gray-600" />
                  <div className="flex-1">
                    <p className="font-medium text-sm">At Center</p>
                    <p className="text-xs text-gray-500">Customer visits your location</p>
                  </div>
                </label>
              </div>
            </div>

            {/* Lead Time */}
            <div>
              <Label htmlFor="leadTime" className="text-sm font-medium text-gray-700 mb-1 block">
                Lead Time (minutes)
              </Label>
              <p className="text-xs text-gray-500 mb-2">Time needed before service starts (preparation)</p>
              <Input
                id="leadTime"
                type="number"
                value={serviceConfig.leadTimeMinutes}
                onChange={(e) => setServiceConfig(prev => ({ ...prev, leadTimeMinutes: parseInt(e.target.value) || 0 }))}
                min="0"
                className="h-10"
              />
            </div>

            {/* Buffer Time */}
            <div>
              <Label htmlFor="bufferTime" className="text-sm font-medium text-gray-700 mb-1 block">
                Buffer Time (minutes)
              </Label>
              <p className="text-xs text-gray-500 mb-2">Time needed after service ends (cleanup/travel)</p>
              <Input
                id="bufferTime"
                type="number"
                value={serviceConfig.bufferTimeMinutes}
                onChange={(e) => setServiceConfig(prev => ({ ...prev, bufferTimeMinutes: parseInt(e.target.value) || 0 }))}
                min="0"
                className="h-10"
              />
            </div>

            {/* Radius (for at_home) */}
            {serviceConfig.serviceStyles.includes('at_home') && (
              <div>
                <Label htmlFor="radius" className="text-sm font-medium text-gray-700 mb-1 block">
                  Service Radius (km)
                </Label>
                <p className="text-xs text-gray-500 mb-2">Maximum distance for home service delivery</p>
                <Input
                  id="radius"
                  type="number"
                  value={serviceConfig.radiusKm || ''}
                  onChange={(e) => setServiceConfig(prev => ({ ...prev, radiusKm: e.target.value ? parseFloat(e.target.value) : null }))}
                  min="0"
                  step="0.5"
                  className="h-10"
                  placeholder="e.g., 10"
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setConfigDialogOpen(false);
                setConfiguringService(null);
              }}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfigureService}
              disabled={saving || serviceConfig.serviceStyles.length === 0}
              className="bg-[#FF8C42] hover:bg-[#FF7A29]"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save & Enable'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
