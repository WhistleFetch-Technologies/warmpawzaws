'use client';

/**
 * Solo Provider Schedule Manager
 * 
 * Allows solo providers to manage their availability with:
 * - Multi-service style support (at_home, tele - no at_center for solo)
 * - Breaks and holidays
 * - Buffer times
 * - Service radius for home services
 * - Location override per slot
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { 
  Plus, 
  Calendar, 
  Clock, 
  MapPin, 
  Package, 
  X, 
  Edit, 
  Trash2,
  Save,
  Loader2,
  AlertCircle,
  Info,
  Coffee,
  Home,
  Phone,
  Building,
  Video
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { VendorHeader } from '@/components/vendor/VendorHeader';

interface AvailabilitySlot {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  location_override: any;
  is_available: boolean;
  notes?: string;
  services: SlotService[];
  breaks: SlotBreak[];
  service_styles?: string[]; // Service styles this slot supports (at_home, tele - no at_center for solo)
}

interface SlotService {
  id: string;
  service_id: string;
  service_name: string;
  lead_time_minutes: number;
  buffer_time_minutes: number;
  radius_km?: number;
}

interface SlotBreak {
  id: string;
  start_time: string;
  end_time: string;
  reason?: string;
}

interface Service {
  id: string;
  name: string;
  service_name: string;
  service_styles: string[];
  enabled: boolean;
}

export default function SoloSchedulePage() {
  const router = useRouter();
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [vendorData, setVendorData] = useState<any>(null);
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [holidays, setHolidays] = useState<{ id: string; date: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSlotDialog, setShowSlotDialog] = useState(false);
  const [showHolidayDialog, setShowHolidayDialog] = useState(false);
  const [editingSlot, setEditingSlot] = useState<AvailabilitySlot | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [locationSearch, setLocationSearch] = useState('');
  const [locationResults, setLocationResults] = useState<any[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<any>(null);
  const [newHoliday, setNewHoliday] = useState({ date: '', name: '' });

  // Solo providers can only use at_home and tele (no at_center)
  const allowedServiceStyles = ['at_home', 'tele'];

  const [slotForm, setSlotForm] = useState({
    date: new Date().toISOString().split('T')[0],
    startTime: '09:00',
    endTime: '17:00',
    locationOverride: null as any,
    isAvailable: true,
    notes: '',
    services: [] as string[],
    serviceStyles: [] as string[],
    breaks: [] as { startTime: string; endTime: string; reason: string }[],
  });

  useEffect(() => {
    // Check if logged in
    if (typeof window !== 'undefined') {
      const vendorIdFromStorage = localStorage.getItem('vendorId');
      const vendorDataFromStorage = localStorage.getItem('vendorData');
      
      if (!vendorIdFromStorage) {
        router.push('/auth');
        return;
      }

      try {
        setVendorId(vendorIdFromStorage);
        if (vendorDataFromStorage) {
          setVendorData(JSON.parse(vendorDataFromStorage));
        }
        loadData(vendorIdFromStorage);
      } catch (error) {
        console.error('Error loading vendor data:', error);
        router.push('/auth');
      }
    }
  }, [router]);

  const loadData = async (id: string) => {
    try {
      setLoading(true);
      
      // Load slots - use vendor availability endpoint
      const startDate = new Date().toISOString().split('T')[0];
      const endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      const slotsResponse = await apiClient.get<any>(`/vendor/${id}/availability-slots?startDate=${startDate}&endDate=${endDate}`).catch(() => ({ success: false, slots: [] }));
      if (slotsResponse.success) {
        setSlots(slotsResponse.slots || []);
      }

      // Load enabled services
      const servicesResponse = await apiClient.get<any>(`/vendor/${id}/services`).catch(() => ({ success: false, services: [] }));
      if (servicesResponse.success) {
        const allServices = servicesResponse.services || servicesResponse.allServices || [];
        // Filter to only enabled services
        const enabledServices = allServices.filter((s: any) => s.is_active !== false && s.enabled !== false);
        setServices(enabledServices.map((s: any) => ({
          id: s.id || s.service_id,
          name: s.name || s.service_name,
          service_name: s.name || s.service_name,
          service_styles: s.service_styles || s.serviceStyle ? [s.serviceStyle] : [],
          enabled: true,
        })));
      }

      // Load holidays
      const holidaysResponse = await apiClient.get<any>(`/vendor/${id}/holidays`).catch(() => ({ success: false, holidays: [] }));
      if (holidaysResponse.success) {
        setHolidays(holidaysResponse.holidays || []);
      }
    } catch (error: any) {
      console.error('[SCHEDULE] Error:', error);
      toast.error('Failed to load schedule');
    } finally {
      setLoading(false);
    }
  };

  const handleLocationSearch = async (query: string) => {
    if (query.length < 3) {
      setLocationResults([]);
      return;
    }

    try {
      const response = await apiClient.post<any>('/location/autocomplete', { input: query });
      if (response.success) {
        setLocationResults(response.predictions || []);
      }
    } catch (error) {
      console.error('Location search error:', error);
    }
  };

  const handleSelectLocation = async (placeId: string) => {
    try {
      const response = await apiClient.post<any>('/location/details', { placeId });
      if (response.success && response.location) {
        setSelectedLocation(response.location);
        setSlotForm(prev => ({ ...prev, locationOverride: response.location }));
        setLocationSearch(response.location.formatted_address || response.location.address);
        setLocationResults([]);
      }
    } catch (error) {
      console.error('Location details error:', error);
    }
  };

  const handleAddSlot = () => {
    setEditingSlot(null);
    setSlotForm({
      date: selectedDate,
      startTime: '09:00',
      endTime: '17:00',
      locationOverride: null,
      isAvailable: true,
      notes: '',
      services: [],
      serviceStyles: [],
      breaks: [],
    });
    setSelectedLocation(null);
    setLocationSearch('');
    setShowSlotDialog(true);
  };

  const handleEditSlot = (slot: AvailabilitySlot) => {
    setEditingSlot(slot);
    setSlotForm({
      date: slot.date,
      startTime: slot.start_time,
      endTime: slot.end_time,
      locationOverride: slot.location_override,
      isAvailable: slot.is_available,
      notes: slot.notes || '',
      services: slot.services.map(s => s.service_id),
      serviceStyles: slot.service_styles || [],
      breaks: slot.breaks.map(b => ({
        startTime: b.start_time,
        endTime: b.end_time,
        reason: b.reason || '',
      })),
    });
    if (slot.location_override) {
      setSelectedLocation(slot.location_override);
      setLocationSearch(slot.location_override.formatted_address || slot.location_override.address);
    }
    setShowSlotDialog(true);
  };

  const handleSaveSlot = async () => {
    if (!vendorId) return;

    // Validate
    if (slotForm.startTime >= slotForm.endTime) {
      toast.error('End time must be after start time');
      return;
    }

    if (slotForm.services.length === 0) {
      toast.error('Please select at least one service for this slot');
      return;
    }

    if (slotForm.serviceStyles.length === 0) {
      toast.error('Please select at least one service style for this slot');
      return;
    }

    // Validate breaks
    for (const breakItem of slotForm.breaks) {
      if (breakItem.startTime < slotForm.startTime || breakItem.endTime > slotForm.endTime) {
        toast.error('Breaks must be within slot time');
        return;
      }
      if (breakItem.startTime >= breakItem.endTime) {
        toast.error('Break end time must be after start time');
        return;
      }
    }

    try {
      setSaving(true);

      const slotData = {
        date: slotForm.date,
        startTime: slotForm.startTime,
        endTime: slotForm.endTime,
        locationOverride: slotForm.locationOverride,
        isAvailable: slotForm.isAvailable,
        notes: slotForm.notes,
        services: slotForm.services.map(serviceId => ({
          serviceId,
          leadTimeMinutes: 0,
          bufferTimeMinutes: 0,
          radiusKm: null,
        })),
        serviceStyles: slotForm.serviceStyles,
        breaks: slotForm.breaks,
      };

      if (editingSlot) {
        // Update
        const response = await apiClient.put<any>(
          `/vendor/${vendorId}/availability-slots/${editingSlot.id}`,
          slotData
        );
        if (response.success) {
          toast.success('Slot updated successfully');
          setShowSlotDialog(false);
          await loadData(vendorId);
        } else {
          throw new Error(response.error || 'Failed to update slot');
        }
      } else {
        // Create
        const response = await apiClient.post<any>(
          `/vendor/${vendorId}/availability-slots`,
          slotData
        );
        if (response.success) {
          toast.success('Slot created successfully');
          setShowSlotDialog(false);
          await loadData(vendorId);
        } else {
          throw new Error(response.error || 'Failed to create slot');
        }
      }
    } catch (error: any) {
      console.error('[SAVE SLOT] Error:', error);
      toast.error(error.message || 'Failed to save slot');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSlot = async (slotId: string) => {
    if (!vendorId || !confirm('Are you sure you want to delete this slot?')) return;

    try {
      const response = await apiClient.delete<any>(`/vendor/${vendorId}/availability-slots/${slotId}`);
      if (response.success) {
        toast.success('Slot deleted successfully');
        await loadData(vendorId);
      } else {
        throw new Error(response.error || 'Failed to delete slot');
      }
    } catch (error: any) {
      console.error('[DELETE SLOT] Error:', error);
      toast.error(error.message || 'Failed to delete slot');
    }
  };

  const addBreak = () => {
    setSlotForm(prev => ({
      ...prev,
      breaks: [...prev.breaks, { startTime: '12:00', endTime: '13:00', reason: 'Lunch' }],
    }));
  };

  const removeBreak = (index: number) => {
    setSlotForm(prev => ({
      ...prev,
      breaks: prev.breaks.filter((_, i) => i !== index),
    }));
  };

  const updateBreak = (index: number, field: string, value: string) => {
    setSlotForm(prev => ({
      ...prev,
      breaks: prev.breaks.map((b, i) => (i === index ? { ...b, [field]: value } : b)),
    }));
  };

  const handleAddHoliday = async () => {
    if (!vendorId || !newHoliday.date) {
      toast.error('Please select a date');
      return;
    }

    try {
      const response = await apiClient.post<any>(`/vendor/${vendorId}/holidays`, {
        date: newHoliday.date,
        name: newHoliday.name || 'Day Off'
      });

      if (response.success) {
        toast.success('Holiday added successfully');
        setShowHolidayDialog(false);
        setNewHoliday({ date: '', name: '' });
        await loadData(vendorId);
      } else {
        throw new Error(response.error || 'Failed to add holiday');
      }
    } catch (error: any) {
      console.error('[ADD HOLIDAY] Error:', error);
      toast.error(error.message || 'Failed to add holiday');
    }
  };

  const handleDeleteHoliday = async (holidayId: string) => {
    if (!vendorId || !confirm('Are you sure you want to remove this holiday?')) return;

    try {
      const response = await apiClient.delete<any>(`/vendor/${vendorId}/holidays/${holidayId}`);
      if (response.success) {
        toast.success('Holiday removed successfully');
        await loadData(vendorId);
      } else {
        throw new Error(response.error || 'Failed to remove holiday');
      }
    } catch (error: any) {
      console.error('[DELETE HOLIDAY] Error:', error);
      toast.error(error.message || 'Failed to remove holiday');
    }
  };

  const isHoliday = holidays.some(h => h.date === selectedDate);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-[#FF8C42] mx-auto mb-4" />
          <p className="text-gray-600">Loading schedule...</p>
        </div>
      </div>
    );
  }

  const dateSlots = slots.filter(s => s.date === selectedDate);

  return (
    <div className="vendor-page-shell bg-gray-50">
      <div className="vendor-app-column bg-white min-h-screen">
        <VendorHeader
          title="My Schedule"
          subtitle="Manage your availability and time slots"
          onBack={() => router.push('/dashboard')}
          actions={[
            <Button
              key="add-holiday"
              type="button"
              onClick={() => setShowHolidayDialog(true)}
              variant="outline"
              size="sm"
              className="h-9 shrink-0 text-sm"
            >
              <Calendar className="mr-1 inline h-4 w-4" />
              Add Holiday
            </Button>,
          ]}
        />

        <div className="border-b border-gray-200 bg-white px-4 pb-4 sm:px-6">
          <Label htmlFor="date" className="mb-2 block text-sm font-medium text-gray-700">
            Select Date
          </Label>
          <div className="flex items-center gap-2">
            <Input
              id="date"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="max-w-xs"
            />
            {isHoliday && (
              <Badge className="bg-red-100 text-red-700">
                <Coffee className="mr-1 inline h-3 w-3" />
                Holiday
              </Badge>
            )}
          </div>
        </div>

        {/* Info Banner */}
        <div className="p-4 sm:px-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2">
            <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1 text-sm text-blue-800">
              <p className="font-semibold mb-1">Solo Provider Schedule:</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>Create availability slots for your services</li>
                <li>Select service styles: Home Visit or Tele Consultation (no at-center for solo providers)</li>
                <li>Add breaks and holidays to manage your time</li>
                <li>Set location override for specific slots</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Slots List */}
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">
              Availability Slots for {new Date(selectedDate).toLocaleDateString()}
            </h2>
            <Button onClick={handleAddSlot} className="bg-[#FF8C42] hover:bg-[#FF7A29]">
              <Plus className="w-4 h-4 mr-2" />
              Add Slot
            </Button>
          </div>

          {dateSlots.length === 0 ? (
            <div className="bg-white rounded-xl p-8 text-center border border-gray-200">
              <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="font-semibold text-gray-900 mb-2">No Slots Available</h3>
              <p className="text-sm text-gray-600 mb-4">
                {isHoliday 
                  ? 'This date is marked as a holiday'
                  : 'Create availability slots to start receiving bookings'}
              </p>
              {!isHoliday && (
                <Button onClick={handleAddSlot} className="bg-[#FF8C42] hover:bg-[#FF7A29]">
                  <Plus className="w-4 h-4 mr-2" />
                  Add First Slot
                </Button>
              )}
            </div>
          ) : (
            dateSlots.map((slot) => (
              <div
                key={slot.id}
                className={`bg-white rounded-xl border-2 p-4 ${
                  slot.is_available ? 'border-green-200' : 'border-gray-200'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="w-4 h-4 text-gray-500" />
                      <span className="font-semibold text-gray-900">
                        {slot.start_time} - {slot.end_time}
                      </span>
                      {slot.is_available ? (
                        <Badge className="bg-green-500 text-white">Available</Badge>
                      ) : (
                        <Badge variant="outline">Unavailable</Badge>
                      )}
                    </div>

                    {slot.service_styles && slot.service_styles.length > 0 && (
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs text-gray-500">Service Styles:</span>
                        {slot.service_styles.map((style) => (
                          <Badge key={style} variant="outline" className="text-xs">
                            {style === 'at_home' && <Home className="w-3 h-3 mr-1" />}
                            {style === 'tele' && <Video className="w-3 h-3 mr-1" />}
                            {style}
                          </Badge>
                        ))}
                      </div>
                    )}

                    {slot.services && slot.services.length > 0 && (
                      <div className="flex items-center gap-2 mb-2">
                        <Package className="w-4 h-4 text-gray-500" />
                        <span className="text-sm text-gray-700">
                          {slot.services.length} service{slot.services.length > 1 ? 's' : ''}
                        </span>
                      </div>
                    )}

                    {slot.location_override && (
                      <div className="flex items-center gap-2 mb-2">
                        <MapPin className="w-4 h-4 text-gray-500" />
                        <span className="text-sm text-gray-700">
                          {slot.location_override.formatted_address || slot.location_override.address}
                        </span>
                      </div>
                    )}

                    {slot.breaks && slot.breaks.length > 0 && (
                      <div className="mt-2">
                        <span className="text-xs text-gray-500">Breaks:</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {slot.breaks.map((breakItem, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs">
                              <Coffee className="w-3 h-3 mr-1" />
                              {breakItem.start_time} - {breakItem.end_time}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {slot.notes && (
                      <p className="text-sm text-gray-600 mt-2">{slot.notes}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditSlot(slot)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteSlot(slot.id)}
                      className="border-red-500 text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Holidays List */}
        {holidays.length > 0 && (
          <div className="p-4">
            <h2 className="font-semibold text-gray-900 mb-3">Upcoming Holidays</h2>
            <div className="space-y-2">
              {holidays.slice(0, 5).map((holiday) => (
                <div
                  key={holiday.id}
                  className="bg-white rounded-lg border border-gray-200 p-3 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-500" />
                    <span className="text-sm font-medium text-gray-900">
                      {new Date(holiday.date).toLocaleDateString()}
                    </span>
                    <span className="text-sm text-gray-600">- {holiday.name}</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteHoliday(holiday.id)}
                    className="border-red-500 text-red-600 hover:bg-red-50"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Slot Dialog */}
      <Dialog open={showSlotDialog} onOpenChange={setShowSlotDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingSlot ? 'Edit Availability Slot' : 'Create Availability Slot'}
            </DialogTitle>
            <DialogDescription>
              Set your availability for {new Date(slotForm.date).toLocaleDateString()}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Time Range */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="startTime" className="text-sm font-medium text-gray-700 mb-1 block">
                  Start Time
                </Label>
                <Input
                  id="startTime"
                  type="time"
                  value={slotForm.startTime}
                  onChange={(e) => setSlotForm(prev => ({ ...prev, startTime: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="endTime" className="text-sm font-medium text-gray-700 mb-1 block">
                  End Time
                </Label>
                <Input
                  id="endTime"
                  type="time"
                  value={slotForm.endTime}
                  onChange={(e) => setSlotForm(prev => ({ ...prev, endTime: e.target.value }))}
                />
              </div>
            </div>

            {/* Service Styles - Only at_home and tele for solo */}
            <div>
              <Label className="text-sm font-medium text-gray-700 mb-2 block">
                Service Styles <span className="text-red-500">*</span>
              </Label>
              <p className="text-xs text-gray-500 mb-2">Select how services can be delivered (solo providers: no at-center)</p>
              <div className="space-y-2">
                <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                  <input
                    type="checkbox"
                    checked={slotForm.serviceStyles.includes('at_home')}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSlotForm(prev => ({
                          ...prev,
                          serviceStyles: [...prev.serviceStyles, 'at_home'],
                        }));
                      } else {
                        setSlotForm(prev => ({
                          ...prev,
                          serviceStyles: prev.serviceStyles.filter(s => s !== 'at_home'),
                        }));
                      }
                    }}
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
                    checked={slotForm.serviceStyles.includes('tele')}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSlotForm(prev => ({
                          ...prev,
                          serviceStyles: [...prev.serviceStyles, 'tele'],
                        }));
                      } else {
                        setSlotForm(prev => ({
                          ...prev,
                          serviceStyles: prev.serviceStyles.filter(s => s !== 'tele'),
                        }));
                      }
                    }}
                    className="w-4 h-4 text-[#FF8C42]"
                  />
                  <Video className="w-5 h-5 text-gray-600" />
                  <div className="flex-1">
                    <p className="font-medium text-sm">Tele Consultation</p>
                    <p className="text-xs text-gray-500">Video/phone consultation</p>
                  </div>
                </label>
              </div>
            </div>

            {/* Services */}
            <div>
              <Label className="text-sm font-medium text-gray-700 mb-2 block">
                Services <span className="text-red-500">*</span>
              </Label>
              <p className="text-xs text-gray-500 mb-2">Select services available in this slot</p>
              <div className="max-h-40 overflow-y-auto border rounded-lg p-2 space-y-2">
                {services.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">
                    No services available. Please add services first.
                  </p>
                ) : (
                  services.map((service) => (
                    <label
                      key={service.id}
                      className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={slotForm.services.includes(service.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSlotForm(prev => ({
                              ...prev,
                              services: [...prev.services, service.id],
                            }));
                          } else {
                            setSlotForm(prev => ({
                              ...prev,
                              services: prev.services.filter(s => s !== service.id),
                            }));
                          }
                        }}
                        className="w-4 h-4 text-[#FF8C42]"
                      />
                      <span className="text-sm text-gray-700">{service.name || service.service_name}</span>
                    </label>
                  ))
                )}
              </div>
            </div>

            {/* Location Override */}
            <div>
              <Label htmlFor="location" className="text-sm font-medium text-gray-700 mb-1 block">
                Location Override (Optional)
              </Label>
              <p className="text-xs text-gray-500 mb-2">Override default location for this slot</p>
              <Input
                id="location"
                type="text"
                value={locationSearch}
                onChange={(e) => {
                  setLocationSearch(e.target.value);
                  handleLocationSearch(e.target.value);
                }}
                placeholder="Search for location..."
              />
              {locationResults.length > 0 && (
                <div className="mt-2 border rounded-lg max-h-40 overflow-y-auto">
                  {locationResults.map((result: any, idx: number) => (
                    <button
                      key={idx}
                      onClick={() => handleSelectLocation(result.place_id)}
                      className="w-full text-left p-2 hover:bg-gray-50 border-b last:border-b-0"
                    >
                      <p className="text-sm text-gray-900">{result.description}</p>
                    </button>
                  ))}
                </div>
              )}
              {selectedLocation && (
                <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-blue-800">
                      {selectedLocation.formatted_address || selectedLocation.address}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedLocation(null);
                        setLocationSearch('');
                        setSlotForm(prev => ({ ...prev, locationOverride: null }));
                      }}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Breaks */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm font-medium text-gray-700">Breaks</Label>
                <Button variant="outline" size="sm" onClick={addBreak}>
                  <Plus className="w-4 h-4 mr-1" />
                  Add Break
                </Button>
              </div>
              <div className="space-y-2">
                {slotForm.breaks.map((breakItem, index) => (
                  <div key={index} className="flex items-center gap-2 p-2 border rounded-lg">
                    <Input
                      type="time"
                      value={breakItem.startTime}
                      onChange={(e) => updateBreak(index, 'startTime', e.target.value)}
                      className="flex-1"
                    />
                    <Input
                      type="time"
                      value={breakItem.endTime}
                      onChange={(e) => updateBreak(index, 'endTime', e.target.value)}
                      className="flex-1"
                    />
                    <Input
                      type="text"
                      value={breakItem.reason}
                      onChange={(e) => updateBreak(index, 'reason', e.target.value)}
                      placeholder="Reason"
                      className="flex-1"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => removeBreak(index)}
                      className="border-red-500 text-red-600 hover:bg-red-50"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div>
              <Label htmlFor="notes" className="text-sm font-medium text-gray-700 mb-1 block">
                Notes (Optional)
              </Label>
              <Input
                id="notes"
                type="text"
                value={slotForm.notes}
                onChange={(e) => setSlotForm(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Add any notes about this slot..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowSlotDialog(false);
                setEditingSlot(null);
              }}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveSlot}
              disabled={saving || slotForm.serviceStyles.length === 0 || slotForm.services.length === 0}
              className="bg-[#FF8C42] hover:bg-[#FF7A29]"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Slot
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Holiday Dialog */}
      <Dialog open={showHolidayDialog} onOpenChange={setShowHolidayDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Holiday</DialogTitle>
            <DialogDescription>
              Mark a date as unavailable (holiday)
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="holidayDate" className="text-sm font-medium text-gray-700 mb-1 block">
                Date <span className="text-red-500">*</span>
              </Label>
              <Input
                id="holidayDate"
                type="date"
                value={newHoliday.date}
                onChange={(e) => setNewHoliday(prev => ({ ...prev, date: e.target.value }))}
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
            <div>
              <Label htmlFor="holidayName" className="text-sm font-medium text-gray-700 mb-1 block">
                Name (Optional)
              </Label>
              <Input
                id="holidayName"
                type="text"
                value={newHoliday.name}
                onChange={(e) => setNewHoliday(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Day Off, Holiday"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowHolidayDialog(false);
                setNewHoliday({ date: '', name: '' });
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddHoliday}
              disabled={!newHoliday.date}
              className="bg-[#FF8C42] hover:bg-[#FF7A29]"
            >
              Add Holiday
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
