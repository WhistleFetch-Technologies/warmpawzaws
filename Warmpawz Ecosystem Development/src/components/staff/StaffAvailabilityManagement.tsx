import { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Plus,
  MapPin,
  Clock,
  Calendar,
  Edit,
  Trash2,
  Save,
  X,
  Search
} from 'lucide-react';
import { getApiBaseUrl, getAuthHeaders } from '../../utils/api-config';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Label } from '../ui/label';

interface StaffAvailabilityManagementProps {
  staff: any;
  onBack: () => void;
}

interface Location {
  id: string;
  name: string;
  address: string;
  latitude?: number;
  longitude?: number;
  contactNumber?: string;
}

interface DaySchedule {
  day: string;
  isWorking: boolean;
  locationId: string | null;
  locationName?: string;
  timeSlots: {
    startTime: string;
    endTime: string;
  }[];
  breaks: {
    startTime: string;
    endTime: string;
  }[];
}

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export function StaffAvailabilityManagement({ staff, onBack }: StaffAvailabilityManagementProps) {
  const [locations, setLocations] = useState<Location[]>([]);
  const [schedule, setSchedule] = useState<DaySchedule[]>([]);
  const [holidays, setHolidays] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddLocation, setShowAddLocation] = useState(false);
  const [showMapSearch, setShowMapSearch] = useState(false);
  const [editingDay, setEditingDay] = useState<string | null>(null);
  
  // Location form state
  const [locationName, setLocationName] = useState('');
  const [locationAddress, setLocationAddress] = useState('');
  const [locationContact, setLocationContact] = useState('');
  const [searchAddress, setSearchAddress] = useState('');
  const [selectedCoordinates, setSelectedCoordinates] = useState<{lat: number, lng: number} | null>(null);

  useEffect(() => {
    loadData();
    initializeDefaultSchedule();
  }, [staff.id]);

  const initializeDefaultSchedule = () => {
    const defaultSchedule: DaySchedule[] = DAYS_OF_WEEK.map(day => ({
      day,
      isWorking: ['Saturday', 'Sunday'].includes(day) ? false : true,
      locationId: null,
      timeSlots: ['Saturday', 'Sunday'].includes(day) ? [] : [{ startTime: '09:00', endTime: '18:00' }],
      breaks: ['Saturday', 'Sunday'].includes(day) ? [] : [{ startTime: '13:00', endTime: '14:00' }]
    }));
    setSchedule(defaultSchedule);
  };

  const loadData = async () => {
    try {
      setLoading(true);

      // Load locations
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

      // Load schedule
      const scheduleRes = await fetch(
        `${getApiBaseUrl()}/staff/${staff.id}/schedule`,
        {
          headers: getAuthHeaders()
        }
      );

      if (scheduleRes.ok) {
        const data = await scheduleRes.json();
        if (data.schedule && data.schedule.length > 0) {
          setSchedule(data.schedule);
        }
      }

      // Load holidays
      const holidaysRes = await fetch(
        `${getApiBaseUrl()}/staff/${staff.id}/holidays`,
        {
          headers: getAuthHeaders()
        }
      );

      if (holidaysRes.ok) {
        const data = await holidaysRes.json();
        setHolidays(data.holidays || []);
      }

    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load availability data');
    } finally {
      setLoading(false);
    }
  };

  const handleAddLocation = async () => {
    if (!locationName || !locationAddress) {
      toast.error('Please enter location name and address');
      return;
    }

    try {
      const response = await fetch(
        `${getApiBaseUrl()}/staff/${staff.id}/locations`,
        {
          method: 'POST',
          headers: {
            ...getAuthHeaders(),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            name: locationName,
            address: locationAddress,
            latitude: selectedCoordinates?.lat,
            longitude: selectedCoordinates?.lng,
            contactNumber: locationContact
          })
        }
      );

      if (response.ok) {
        toast.success('Location added successfully!');
        setShowAddLocation(false);
        setLocationName('');
        setLocationAddress('');
        setLocationContact('');
        setSelectedCoordinates(null);
        await loadData();
      } else {
        const error = await response.json();
        throw new Error(error.error);
      }
    } catch (error: any) {
      console.error('Error adding location:', error);
      toast.error(error.message || 'Failed to add location');
    }
  };

  const handleSearchAddress = async () => {
    if (!searchAddress) return;

    try {
      // Use Google Maps Geocoding API
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(searchAddress)}&key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}`
      );
      
      const data = await response.json();
      
      if (data.results && data.results.length > 0) {
        const result = data.results[0];
        setLocationAddress(result.formatted_address);
        setSelectedCoordinates({
          lat: result.geometry.location.lat,
          lng: result.geometry.location.lng
        });
        toast.success('Address found!');
        setShowMapSearch(false);
      } else {
        toast.error('Address not found. Please enter manually.');
      }
    } catch (error) {
      console.error('Error searching address:', error);
      toast.error('Failed to search address. Please enter manually.');
    }
  };

  const handleSaveSchedule = async () => {
    try {
      const response = await fetch(
        `${getApiBaseUrl()}/staff/${staff.id}/schedule`,
        {
          method: 'PUT',
          headers: {
            ...getAuthHeaders(),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ schedule })
        }
      );

      if (response.ok) {
        toast.success('Schedule saved successfully!');
        setEditingDay(null);
      } else {
        const error = await response.json();
        throw new Error(error.error);
      }
    } catch (error: any) {
      console.error('Error saving schedule:', error);
      toast.error(error.message || 'Failed to save schedule');
    }
  };

  const toggleDayWorking = (day: string) => {
    setSchedule(prev => prev.map(d => {
      if (d.day === day) {
        return {
          ...d,
          isWorking: !d.isWorking,
          timeSlots: !d.isWorking ? [{ startTime: '09:00', endTime: '18:00' }] : [],
          breaks: !d.isWorking ? [{ startTime: '13:00', endTime: '14:00' }] : []
        };
      }
      return d;
    }));
  };

  const updateDayLocation = (day: string, locationId: string) => {
    const location = locations.find(l => l.id === locationId);
    setSchedule(prev => prev.map(d => {
      if (d.day === day) {
        return {
          ...d,
          locationId,
          locationName: location?.name
        };
      }
      return d;
    }));
  };

  const updateTimeSlot = (day: string, index: number, field: 'startTime' | 'endTime', value: string) => {
    setSchedule(prev => prev.map(d => {
      if (d.day === day) {
        const newSlots = [...d.timeSlots];
        newSlots[index] = { ...newSlots[index], [field]: value };
        return { ...d, timeSlots: newSlots };
      }
      return d;
    }));
  };

  const addTimeSlot = (day: string) => {
    setSchedule(prev => prev.map(d => {
      if (d.day === day) {
        return {
          ...d,
          timeSlots: [...d.timeSlots, { startTime: '09:00', endTime: '18:00' }]
        };
      }
      return d;
    }));
  };

  const removeTimeSlot = (day: string, index: number) => {
    setSchedule(prev => prev.map(d => {
      if (d.day === day && d.timeSlots.length > 1) {
        return {
          ...d,
          timeSlots: d.timeSlots.filter((_, i) => i !== index)
        };
      }
      return d;
    }));
  };

  const updateBreak = (day: string, index: number, field: 'startTime' | 'endTime', value: string) => {
    setSchedule(prev => prev.map(d => {
      if (d.day === day) {
        const newBreaks = [...d.breaks];
        newBreaks[index] = { ...newBreaks[index], [field]: value };
        return { ...d, breaks: newBreaks };
      }
      return d;
    }));
  };

  const addBreak = (day: string) => {
    setSchedule(prev => prev.map(d => {
      if (d.day === day) {
        return {
          ...d,
          breaks: [...d.breaks, { startTime: '13:00', endTime: '14:00' }]
        };
      }
      return d;
    }));
  };

  const removeBreak = (day: string, index: number) => {
    setSchedule(prev => prev.map(d => {
      if (d.day === day) {
        return {
          ...d,
          breaks: d.breaks.filter((_, i) => i !== index)
        };
      }
      return d;
    }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white w-full max-w-[430px] mx-auto flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42] mx-auto mb-4"></div>
          <p className="text-gray-600">Loading availability...</p>
        </div>
      </div>
    );
  }

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
            <h1 className="text-xl text-white">Availability & Schedule</h1>
            <p className="text-sm text-white/90">Manage your working hours</p>
          </div>
        </div>

        <button
          onClick={handleSaveSchedule}
          className="w-full bg-white text-[#FF8C42] rounded-lg py-2 flex items-center justify-center gap-2 hover:bg-gray-100 transition-colors text-sm"
        >
          <Save className="w-4 h-4" />
          Save Schedule
        </button>
      </div>

      {/* Locations Section */}
      <div className="p-4 space-y-3">
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
              Add locations where you provide services
            </p>
          </div>
        ) : (
          locations.map((location) => (
            <div key={location.id} className="bg-white rounded-xl p-4 border border-gray-200">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <MapPin className="w-4 h-4 text-[#FF8C42]" />
                    <h3 className="text-gray-900">{location.name}</h3>
                  </div>
                  <p className="text-sm text-gray-600 ml-6">{location.address}</p>
                  {location.contactNumber && (
                    <p className="text-sm text-gray-500 ml-6 mt-1">{location.contactNumber}</p>
                  )}
                </div>
                <button
                  onClick={async () => {
                    if (confirm('Remove this location?')) {
                      try {
                        const response = await fetch(
                          `${getApiBaseUrl()}/staff/${staff.id}/locations/${location.id}`,
                          {
                            method: 'DELETE',
                            headers: getAuthHeaders()
                          }
                        );
                        if (response.ok) {
                          toast.success('Location removed');
                          await loadData();
                        }
                      } catch (error) {
                        toast.error('Failed to remove location');
                      }
                    }
                  }}
                  className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4 text-red-500" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Weekly Schedule */}
      <div className="p-4 space-y-3 mt-6">
        <h2 className="text-gray-900 mb-3">Weekly Schedule</h2>
        
        {schedule.map((daySchedule) => (
          <div key={daySchedule.day} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {/* Day Header */}
            <div className="p-4 bg-gray-50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={daySchedule.isWorking}
                  onChange={() => toggleDayWorking(daySchedule.day)}
                  className="w-5 h-5 rounded border-gray-300 text-[#FF8C42] focus:ring-[#FF8C42]"
                />
                <div>
                  <h3 className="text-gray-900">{daySchedule.day}</h3>
                  {!daySchedule.isWorking && (
                    <p className="text-sm text-gray-500">Day off</p>
                  )}
                </div>
              </div>
              
              {daySchedule.isWorking && (
                <button
                  onClick={() => setEditingDay(editingDay === daySchedule.day ? null : daySchedule.day)}
                  className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  {editingDay === daySchedule.day ? (
                    <X className="w-4 h-4 text-gray-600" />
                  ) : (
                    <Edit className="w-4 h-4 text-gray-600" />
                  )}
                </button>
              )}
            </div>

            {/* Day Details */}
            {daySchedule.isWorking && editingDay === daySchedule.day && (
              <div className="p-4 space-y-4 border-t border-gray-200">
                {/* Location Selection */}
                <div>
                  <Label className="text-gray-700 mb-2 block text-sm">Location</Label>
                  <select
                    value={daySchedule.locationId || ''}
                    onChange={(e) => updateDayLocation(daySchedule.day, e.target.value)}
                    className="w-full border border-gray-300 rounded-lg p-2 text-sm"
                  >
                    <option value="">Select location</option>
                    {locations.map(loc => (
                      <option key={loc.id} value={loc.id}>{loc.name}</option>
                    ))}
                  </select>
                </div>

                {/* Time Slots */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-gray-700 text-sm">Working Hours</Label>
                    <button
                      onClick={() => addTimeSlot(daySchedule.day)}
                      className="text-xs text-[#FF8C42] hover:text-[#FF7A29]"
                    >
                      + Add slot
                    </button>
                  </div>
                  {daySchedule.timeSlots.map((slot, index) => (
                    <div key={index} className="flex items-center gap-2 mb-2">
                      <Input
                        type="time"
                        value={slot.startTime}
                        onChange={(e) => updateTimeSlot(daySchedule.day, index, 'startTime', e.target.value)}
                        className="flex-1 text-sm"
                      />
                      <span className="text-gray-500">to</span>
                      <Input
                        type="time"
                        value={slot.endTime}
                        onChange={(e) => updateTimeSlot(daySchedule.day, index, 'endTime', e.target.value)}
                        className="flex-1 text-sm"
                      />
                      {daySchedule.timeSlots.length > 1 && (
                        <button
                          onClick={() => removeTimeSlot(daySchedule.day, index)}
                          className="p-2 hover:bg-red-50 rounded-lg"
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {/* Breaks */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-gray-700 text-sm">Breaks</Label>
                    <button
                      onClick={() => addBreak(daySchedule.day)}
                      className="text-xs text-[#FF8C42] hover:text-[#FF7A29]"
                    >
                      + Add break
                    </button>
                  </div>
                  {daySchedule.breaks.map((breakSlot, index) => (
                    <div key={index} className="flex items-center gap-2 mb-2">
                      <Input
                        type="time"
                        value={breakSlot.startTime}
                        onChange={(e) => updateBreak(daySchedule.day, index, 'startTime', e.target.value)}
                        className="flex-1 text-sm"
                      />
                      <span className="text-gray-500">to</span>
                      <Input
                        type="time"
                        value={breakSlot.endTime}
                        onChange={(e) => updateBreak(daySchedule.day, index, 'endTime', e.target.value)}
                        className="flex-1 text-sm"
                      />
                      <button
                        onClick={() => removeBreak(daySchedule.day, index)}
                        className="p-2 hover:bg-red-50 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    </div>
                  ))}
                  {daySchedule.breaks.length === 0 && (
                    <p className="text-sm text-gray-500">No breaks</p>
                  )}
                </div>
              </div>
            )}

            {/* Summary when not editing */}
            {daySchedule.isWorking && editingDay !== daySchedule.day && (
              <div className="p-4 border-t border-gray-200">
                {daySchedule.locationName && (
                  <div className="flex items-center gap-2 mb-2 text-sm text-gray-600">
                    <MapPin className="w-3.5 h-3.5" />
                    <span>{daySchedule.locationName}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Clock className="w-3.5 h-3.5" />
                  <span>
                    {daySchedule.timeSlots.map(s => `${s.startTime}-${s.endTime}`).join(', ')}
                  </span>
                </div>
                {daySchedule.breaks.length > 0 && (
                  <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
                    <span className="text-xs">Breaks:</span>
                    <span>{daySchedule.breaks.map(b => `${b.startTime}-${b.endTime}`).join(', ')}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add Location Dialog */}
      <Dialog open={showAddLocation} onOpenChange={setShowAddLocation}>
        <DialogContent className="max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Add Working Location</DialogTitle>
            <DialogDescription>
              Add a clinic or location where you provide services
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="locationName" className="text-gray-700 mb-2 block">
                Location Name *
              </Label>
              <Input
                id="locationName"
                value={locationName}
                onChange={(e) => setLocationName(e.target.value)}
                placeholder="e.g., Downtown Clinic"
              />
            </div>

            <div>
              <Label htmlFor="locationAddress" className="text-gray-700 mb-2 block">
                Address *
              </Label>
              <div className="flex gap-2">
                <Input
                  id="locationAddress"
                  value={locationAddress}
                  onChange={(e) => setLocationAddress(e.target.value)}
                  placeholder="Enter address"
                  className="flex-1"
                />
                <Button
                  onClick={() => setShowMapSearch(true)}
                  variant="outline"
                  size="sm"
                >
                  <Search className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div>
              <Label htmlFor="locationContact" className="text-gray-700 mb-2 block">
                Contact Number
              </Label>
              <Input
                id="locationContact"
                value={locationContact}
                onChange={(e) => setLocationContact(e.target.value)}
                placeholder="e.g., +91 98765 43210"
              />
            </div>

            {selectedCoordinates && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800">
                📍 Location verified on map
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              onClick={handleAddLocation}
              className="bg-[#FF8C42] hover:bg-[#ff7a28] text-white"
            >
              Add Location
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Map Search Dialog */}
      <Dialog open={showMapSearch} onOpenChange={setShowMapSearch}>
        <DialogContent className="max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Search Address</DialogTitle>
            <DialogDescription>
              Search for address using Google Maps
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="searchAddress" className="text-gray-700 mb-2 block">
                Search Address
              </Label>
              <Input
                id="searchAddress"
                value={searchAddress}
                onChange={(e) => setSearchAddress(e.target.value)}
                placeholder="e.g., Connaught Place, New Delhi"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSearchAddress();
                  }
                }}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              onClick={handleSearchAddress}
              className="bg-[#FF8C42] hover:bg-[#ff7a28] text-white"
            >
              <Search className="w-4 h-4 mr-2" />
              Search
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
