'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { 
  ArrowLeft, 
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
  Building
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
  enabled_by_staff: boolean;
  service_styles: string[];
}

export default function StaffSchedulePage() {
  const router = useRouter();
  const [staff, setStaff] = useState<any>(null);
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSlotDialog, setShowSlotDialog] = useState(false);
  const [editingSlot, setEditingSlot] = useState<AvailabilitySlot | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [locationSearch, setLocationSearch] = useState('');
  const [locationResults, setLocationResults] = useState<any[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<any>(null);

  const [slotForm, setSlotForm] = useState({
    date: new Date().toISOString().split('T')[0],
    startTime: '09:00',
    endTime: '17:00',
    locationOverride: null as any,
    isAvailable: true,
    notes: '',
    services: [] as string[],
    breaks: [] as { startTime: string; endTime: string; reason: string }[],
  });

  useEffect(() => {
    // Check if logged in
    if (typeof window !== 'undefined') {
      const staffSession = localStorage.getItem('staff_session');
      if (staffSession) {
        try {
          const staffData = JSON.parse(staffSession);
          setStaff(staffData);
          loadData(staffData.id);
        } catch (error) {
          console.error('Error parsing staff session:', error);
          router.push('/staff/login');
        }
      } else {
        router.push('/staff/login');
      }
    }
  }, [router]);

  const loadData = async (staffId: string) => {
    try {
      setLoading(true);
      
      // Load slots
      const startDate = new Date().toISOString().split('T')[0];
      const endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      const slotsResponse = await apiClient.get<any>(`/staff/${staffId}/availability-slots?startDate=${startDate}&endDate=${endDate}`);
      if (slotsResponse.success) {
        setSlots(slotsResponse.slots || []);
      }

      // Load enabled services
      const servicesResponse = await apiClient.get<any>(`/staff/${staffId}/services`);
      if (servicesResponse.success) {
        const enabledServices = (servicesResponse.services || []).filter((s: Service) => s.enabled_by_staff);
        setServices(enabledServices);
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
    if (!staff) return;

    // Validate
    if (slotForm.startTime >= slotForm.endTime) {
      toast.error('End time must be after start time');
      return;
    }

    if (slotForm.services.length === 0) {
      toast.error('Please select at least one service for this slot');
      return;
    }

    // Validate breaks are within slot time
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
          leadTimeMinutes: 0, // Default, can be configured per service
          bufferTimeMinutes: 0,
          radiusKm: null,
        })),
        breaks: slotForm.breaks,
      };

      if (editingSlot) {
        // Update
        const response = await apiClient.put<any>(
          `/staff/${staff.id}/availability-slots/${editingSlot.id}`,
          slotData
        );
        if (response.success) {
          toast.success('Slot updated successfully');
          setShowSlotDialog(false);
          await loadData(staff.id);
        } else {
          throw new Error(response.error || 'Failed to update slot');
        }
      } else {
        // Create
        const response = await apiClient.post<any>(
          `/staff/${staff.id}/availability-slots`,
          slotData
        );
        if (response.success) {
          toast.success('Slot created successfully');
          setShowSlotDialog(false);
          await loadData(staff.id);
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
    if (!confirm('Are you sure you want to delete this slot?')) return;

    try {
      const response = await apiClient.delete<any>(`/staff/${staff.id}/availability-slots/${slotId}`);
      if (response.success) {
        toast.success('Slot deleted successfully');
        await loadData(staff.id);
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

  const slotsForDate = slots.filter(s => s.date === selectedDate);

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
              <h1 className="text-xl font-bold text-gray-900">My Schedule</h1>
              <p className="text-sm text-gray-600">Manage your availability slots</p>
            </div>
            <Button
              onClick={handleAddSlot}
              className="bg-[#FF8C42] hover:bg-[#FF7A29] text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Slot
            </Button>
          </div>

          {/* Date Selector */}
          <div className="px-4 pb-4">
            <Label htmlFor="date" className="text-sm font-medium text-gray-700 mb-2 block">
              Select Date
            </Label>
            <Input
              id="date"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="max-w-xs"
            />
          </div>
        </div>

        {/* Info Banner */}
        <div className="p-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2">
            <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1 text-sm text-blue-800">
              <p className="font-semibold mb-1">Schedule Management:</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>Create availability slots with start/end time</li>
                <li>Assign services to each slot</li>
                <li>Add breaks within slots</li>
                <li>Override location per slot (defaults to business location)</li>
                <li>Only enabled services can be assigned to slots</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Slots List */}
        <div className="p-4 space-y-3">
          {slotsForDate.length === 0 ? (
            <div className="bg-white rounded-xl p-8 text-center border border-gray-200">
              <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="font-semibold text-gray-900 mb-2">No Slots for This Date</h3>
              <p className="text-sm text-gray-600 mb-4">
                Create availability slots to start accepting bookings
              </p>
              <Button
                onClick={handleAddSlot}
                className="bg-[#FF8C42] hover:bg-[#FF7A29] text-white"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create First Slot
              </Button>
            </div>
          ) : (
            slotsForDate.map((slot) => (
              <div
                key={slot.id}
                className={`bg-white rounded-xl border-2 p-4 ${
                  slot.is_available ? 'border-green-500' : 'border-gray-200'
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

                    {/* Location */}
                    {slot.location_override ? (
                      <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                        <MapPin className="w-4 h-4" />
                        <span>{slot.location_override.formatted_address || slot.location_override.address}</span>
                        <Badge variant="outline" className="text-xs">Custom Location</Badge>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
                        <Building className="w-4 h-4" />
                        <span>Default location (Business)</span>
                      </div>
                    )}

                    {/* Services */}
                    <div className="mb-2">
                      <p className="text-xs text-gray-500 mb-1">Services in this slot:</p>
                      <div className="flex flex-wrap gap-1">
                        {slot.services.map((s) => (
                          <Badge key={s.id} variant="outline" className="text-xs">
                            {s.service_name}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {/* Breaks */}
                    {slot.breaks.length > 0 && (
                      <div className="mb-2">
                        <p className="text-xs text-gray-500 mb-1">Breaks:</p>
                        <div className="flex flex-wrap gap-1">
                          {slot.breaks.map((b) => (
                            <Badge key={b.id} variant="outline" className="text-xs bg-yellow-50">
                              <Coffee className="w-3 h-3 mr-1" />
                              {b.start_time} - {b.end_time}
                              {b.reason && ` (${b.reason})`}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {slot.notes && (
                      <p className="text-xs text-gray-600 italic">{slot.notes}</p>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEditSlot(slot)}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                      title="Edit slot"
                    >
                      <Edit className="w-4 h-4 text-gray-600" />
                    </button>
                    <button
                      onClick={() => handleDeleteSlot(slot.id)}
                      className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete slot"
                    >
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Slot Dialog */}
      <Dialog open={showSlotDialog} onOpenChange={setShowSlotDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingSlot ? 'Edit Slot' : 'Create Availability Slot'}</DialogTitle>
            <DialogDescription>
              Configure time, services, breaks, and location for this slot
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Date */}
            <div>
              <Label htmlFor="slot-date" className="text-sm font-medium text-gray-700 mb-1 block">
                Date <span className="text-red-500">*</span>
              </Label>
              <Input
                id="slot-date"
                type="date"
                value={slotForm.date}
                onChange={(e) => setSlotForm(prev => ({ ...prev, date: e.target.value }))}
                min={new Date().toISOString().split('T')[0]}
                className="h-10"
                required
              />
            </div>

            {/* Time Range */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="start-time" className="text-sm font-medium text-gray-700 mb-1 block">
                  Start Time <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="start-time"
                  type="time"
                  value={slotForm.startTime}
                  onChange={(e) => setSlotForm(prev => ({ ...prev, startTime: e.target.value }))}
                  className="h-10"
                  required
                />
              </div>
              <div>
                <Label htmlFor="end-time" className="text-sm font-medium text-gray-700 mb-1 block">
                  End Time <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="end-time"
                  type="time"
                  value={slotForm.endTime}
                  onChange={(e) => setSlotForm(prev => ({ ...prev, endTime: e.target.value }))}
                  className="h-10"
                  required
                />
              </div>
            </div>

            {/* Location Override */}
            <div>
              <Label htmlFor="location" className="text-sm font-medium text-gray-700 mb-1 block">
                Location Override (Optional)
              </Label>
              <p className="text-xs text-gray-500 mb-2">
                Leave empty to use default location. Search to override for this slot.
              </p>
              <div className="relative">
                <Input
                  id="location"
                  type="text"
                  value={locationSearch}
                  onChange={(e) => {
                    setLocationSearch(e.target.value);
                    handleLocationSearch(e.target.value);
                  }}
                  placeholder="Search location..."
                  className="h-10 pr-10"
                />
                {selectedLocation && (
                  <button
                    onClick={() => {
                      setSelectedLocation(null);
                      setLocationSearch('');
                      setSlotForm(prev => ({ ...prev, locationOverride: null }));
                    }}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 hover:bg-gray-100 rounded"
                  >
                    <X className="w-4 h-4 text-gray-500" />
                  </button>
                )}
                {locationResults.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {locationResults.map((result) => (
                      <button
                        key={result.place_id}
                        onClick={() => handleSelectLocation(result.place_id)}
                        className="w-full text-left px-4 py-2 hover:bg-gray-50 border-b last:border-b-0"
                      >
                        <p className="font-medium text-sm">{result.description}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {selectedLocation && (
                <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-xs text-green-800">
                    <MapPin className="w-3 h-3 inline mr-1" />
                    {selectedLocation.formatted_address || selectedLocation.address}
                  </p>
                </div>
              )}
            </div>

            {/* Services */}
            <div>
              <Label className="text-sm font-medium text-gray-700 mb-2 block">
                Services in This Slot <span className="text-red-500">*</span>
              </Label>
              <p className="text-xs text-gray-500 mb-2">Select services available in this slot</p>
              {services.length === 0 ? (
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    No enabled services. Please enable services first from Services page.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-3">
                  {services.map((service) => (
                    <label
                      key={service.id}
                      className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={slotForm.services.includes(service.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSlotForm(prev => ({ ...prev, services: [...prev.services, service.id] }));
                          } else {
                            setSlotForm(prev => ({ ...prev, services: prev.services.filter(id => id !== service.id) }));
                          }
                        }}
                        className="w-4 h-4 text-[#FF8C42]"
                      />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">{service.name}</p>
                        <div className="flex gap-1 mt-1">
                          {service.service_styles?.map((style) => (
                            <Badge key={style} variant="outline" className="text-xs">
                              {style === 'at_home' && <Home className="w-3 h-3 mr-1" />}
                              {style === 'tele' && <Phone className="w-3 h-3 mr-1" />}
                              {style === 'at_center' && <Building className="w-3 h-3 mr-1" />}
                              {style}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Breaks */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm font-medium text-gray-700">
                  Breaks (Optional)
                </Label>
                <Button
                  type="button"
                  onClick={addBreak}
                  variant="outline"
                  size="sm"
                  className="h-8"
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Add Break
                </Button>
              </div>
              <div className="space-y-2">
                {slotForm.breaks.map((breakItem, index) => (
                  <div key={index} className="flex gap-2 items-end p-3 bg-gray-50 rounded-lg">
                    <div className="flex-1 grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs text-gray-600 mb-1 block">Start</Label>
                        <Input
                          type="time"
                          value={breakItem.startTime}
                          onChange={(e) => updateBreak(index, 'startTime', e.target.value)}
                          className="h-8 text-sm"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-gray-600 mb-1 block">End</Label>
                        <Input
                          type="time"
                          value={breakItem.endTime}
                          onChange={(e) => updateBreak(index, 'endTime', e.target.value)}
                          className="h-8 text-sm"
                        />
                      </div>
                    </div>
                    <div className="flex-1">
                      <Label className="text-xs text-gray-600 mb-1 block">Reason</Label>
                      <Input
                        type="text"
                        value={breakItem.reason}
                        onChange={(e) => updateBreak(index, 'reason', e.target.value)}
                        placeholder="e.g., Lunch"
                        className="h-8 text-sm"
                      />
                    </div>
                    <button
                      onClick={() => removeBreak(index)}
                      className="p-2 hover:bg-red-50 rounded transition-colors"
                    >
                      <X className="w-4 h-4 text-red-600" />
                    </button>
                  </div>
                ))}
                {slotForm.breaks.length === 0 && (
                  <p className="text-xs text-gray-500 text-center py-2">No breaks added</p>
                )}
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
                placeholder="Any additional notes..."
                className="h-10"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowSlotDialog(false);
                setEditingSlot(null);
                setSelectedLocation(null);
                setLocationSearch('');
              }}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveSlot}
              disabled={saving || slotForm.services.length === 0}
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
                  {editingSlot ? 'Update Slot' : 'Create Slot'}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
