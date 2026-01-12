import { useState, useEffect } from 'react';
import { 
  Plus, MapPin, Clock, Edit, Trash2, Save, X, Search, AlertTriangle,
  Building, Map as MapIcon, Check, ChevronDown, ChevronUp
} from 'lucide-react';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';

declare const google: any;

interface LocationScheduleManagerProps {
  staff: any;
  onBack: () => void;
}

interface ServiceLocation {
  id: string;
  name: string;
  address: string;
  latitude?: number;
  longitude?: number;
  contactNumber?: string;
  isClinicLocation?: boolean;
  clinicId?: string;
  availabilityWindows: AvailabilityWindow[];
}

interface AvailabilityWindow {
  id: string;
  dayOfWeek: number; // 0 = Sunday, 1 = Monday, etc.
  startTime: string; // HH:MM format
  endTime: string; // HH:MM format
  serviceStyles: string[]; // ['at_center', 'at_home', 'tele']
  maxConcurrentBookings?: number;
  isActive: boolean;
}

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function LocationScheduleManager({ staff, onBack }: LocationScheduleManagerProps) {
  const [locations, setLocations] = useState<ServiceLocation[]>([]);
  const [clinicLocations, setClinicLocations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddLocation, setShowAddLocation] = useState(false);
  const [showGoogleSearch, setShowGoogleSearch] = useState(false);
  const [expandedLocation, setExpandedLocation] = useState<string | null>(null);
  const [editingWindow, setEditingWindow] = useState<{locationId: string, window: AvailabilityWindow | null} | null>(null);
  
  // Location form state
  const [locationForm, setLocationForm] = useState({
    name: '',
    address: '',
    latitude: null as number | null,
    longitude: null as number | null,
    contactNumber: ''
  });
  
  // Google Maps state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [mapLoaded, setMapLoaded] = useState(false);

  useEffect(() => {
    loadData();
    loadGoogleMaps();
  }, [staff.id]);

  const loadGoogleMaps = () => {
    // Check if Google Maps is already loaded
    if (typeof google !== 'undefined' && google.maps) {
      setMapLoaded(true);
      return;
    }

    // Load Google Maps script
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      setMapLoaded(true);
      console.log('✅ Google Maps loaded');
    };
    document.head.appendChild(script);
  };

  const loadData = async () => {
    try {
      setLoading(true);

      // Load staff locations with availability windows
      const locationsRes = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/staff/${staff.id}/locations-with-availability`,
        {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }
      );

      if (locationsRes.ok) {
        const data = await locationsRes.json();
        setLocations(data.locations || []);
        console.log('✅ Loaded locations:', data.locations?.length);
      }

      // Load clinic locations if staff is associated with a clinic
      if (staff.vendorId) {
        const clinicRes = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/${staff.vendorId}/details`,
          {
            headers: { 'Authorization': `Bearer ${publicAnonKey}` }
          }
        );

        if (clinicRes.ok) {
          const data = await clinicRes.json();
          const clinic = data.vendor;
          if (clinic && clinic.address) {
            setClinicLocations([{
              id: `clinic_${staff.vendorId}`,
              name: clinic.businessName || clinic.fullName,
              address: clinic.address,
              latitude: clinic.location?.latitude,
              longitude: clinic.location?.longitude,
              contactNumber: clinic.phone,
              isClinicLocation: true
            }]);
          }
        }
      }

    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load locations');
    } finally {
      setLoading(false);
    }
  };

  const searchGooglePlaces = async () => {
    if (!searchQuery || !mapLoaded) {
      toast.error('Please enter a search query');
      return;
    }

    try {
      const service = new google.maps.places.PlacesService(document.createElement('div'));
      const request = {
        query: searchQuery,
        fields: ['name', 'formatted_address', 'geometry', 'place_id', 'formatted_phone_number']
      };

      service.textSearch(request, (results: any, status: any) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && results) {
          console.log('✅ Found places:', results.length);
          setSearchResults(results);
        } else {
          toast.error('No results found');
          setSearchResults([]);
        }
      });
    } catch (error) {
      console.error('Error searching places:', error);
      toast.error('Failed to search locations');
    }
  };

  const selectGooglePlace = (place: any) => {
    setLocationForm({
      name: place.name,
      address: place.formatted_address,
      latitude: place.geometry.location.lat(),
      longitude: place.geometry.location.lng(),
      contactNumber: place.formatted_phone_number || ''
    });
    setShowGoogleSearch(false);
    setShowAddLocation(true);
  };

  const selectClinicLocation = (clinic: any) => {
    setLocationForm({
      name: clinic.name,
      address: clinic.address,
      latitude: clinic.latitude,
      longitude: clinic.longitude,
      contactNumber: clinic.contactNumber || ''
    });
    setShowAddLocation(true);
  };

  const handleAddLocation = async () => {
    if (!locationForm.name || !locationForm.address) {
      toast.error('Please enter location name and address');
      return;
    }

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/staff/${staff.id}/locations`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(locationForm)
        }
      );

      if (response.ok) {
        toast.success('Location added successfully');
        setShowAddLocation(false);
        setLocationForm({ name: '', address: '', latitude: null, longitude: null, contactNumber: '' });
        loadData();
      } else {
        const error = await response.text();
        toast.error('Failed to add location');
        console.error('Error:', error);
      }
    } catch (error) {
      console.error('Error adding location:', error);
      toast.error('Failed to add location');
    }
  };

  const handleDeleteLocation = async (locationId: string) => {
    if (!confirm('Are you sure you want to delete this location? All availability windows will be removed.')) {
      return;
    }

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/staff/${staff.id}/locations/${locationId}`,
        {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }
      );

      if (response.ok) {
        toast.success('Location deleted');
        loadData();
      } else {
        toast.error('Failed to delete location');
      }
    } catch (error) {
      console.error('Error deleting location:', error);
      toast.error('Failed to delete location');
    }
  };

  const handleAddAvailabilityWindow = (locationId: string) => {
    const newWindow: AvailabilityWindow = {
      id: `window_${Date.now()}`,
      dayOfWeek: 1, // Monday
      startTime: '09:00',
      endTime: '17:00',
      serviceStyles: ['at_center'],
      maxConcurrentBookings: 1,
      isActive: true
    };
    setEditingWindow({ locationId, window: newWindow });
  };

  const handleSaveAvailabilityWindow = async () => {
    if (!editingWindow) return;

    const { locationId, window } = editingWindow;
    
    // Validate time conflict
    const location = locations.find(l => l.id === locationId);
    if (location) {
      const hasConflict = location.availabilityWindows.some(w => {
        if (w.id === window.id) return false; // Skip self
        if (w.dayOfWeek !== window.dayOfWeek) return false; // Different day
        
        // Check time overlap
        const wStart = timeToMinutes(w.startTime);
        const wEnd = timeToMinutes(w.endTime);
        const newStart = timeToMinutes(window.startTime);
        const newEnd = timeToMinutes(window.endTime);
        
        return (newStart < wEnd && newEnd > wStart);
      });

      if (hasConflict) {
        toast.error('Time conflict detected! This window overlaps with an existing window on the same day.');
        return;
      }
    }

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/staff/${staff.id}/locations/${locationId}/availability`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ window })
        }
      );

      if (response.ok) {
        toast.success('Availability window saved');
        setEditingWindow(null);
        loadData();
      } else {
        const error = await response.text();
        toast.error('Failed to save availability');
        console.error('Error:', error);
      }
    } catch (error) {
      console.error('Error saving availability:', error);
      toast.error('Failed to save availability');
    }
  };

  const handleDeleteAvailabilityWindow = async (locationId: string, windowId: string) => {
    if (!confirm('Delete this availability window?')) return;

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/staff/${staff.id}/locations/${locationId}/availability/${windowId}`,
        {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }
      );

      if (response.ok) {
        toast.success('Availability window deleted');
        loadData();
      } else {
        toast.error('Failed to delete availability');
      }
    } catch (error) {
      console.error('Error deleting availability:', error);
      toast.error('Failed to delete availability');
    }
  };

  const timeToMinutes = (time: string): number => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={onBack}>
              <X className="w-5 h-5" />
            </Button>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Location & Schedule Management</h2>
              <p className="text-sm text-gray-600">Manage your service locations and availability windows</p>
            </div>
          </div>
          <Button 
            onClick={() => setShowAddLocation(true)}
            className="bg-[#FF8C42] hover:bg-[#FF7A2E] text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Location
          </Button>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Clinic Locations */}
        {clinicLocations.length > 0 && (
          <Card className="p-4 bg-blue-50 border-blue-200">
            <h3 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
              <Building className="w-5 h-5" />
              Available Clinic Locations
            </h3>
            <div className="space-y-2">
              {clinicLocations.map((clinic) => (
                <div
                  key={clinic.id}
                  className="flex items-center justify-between p-3 bg-white rounded-lg border border-blue-200"
                >
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{clinic.name}</p>
                    <p className="text-sm text-gray-600">{clinic.address}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => selectClinicLocation(clinic)}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Locations List */}
        {locations.length === 0 ? (
          <Card className="p-8 text-center">
            <MapPin className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-gray-900">No Locations Added</h3>
            <p className="text-gray-600 mt-1 mb-4">
              Add service locations to configure your availability
            </p>
            <div className="flex gap-2 justify-center">
              <Button
                onClick={() => setShowAddLocation(true)}
                className="bg-[#FF8C42] hover:bg-[#FF7A2E] text-white"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Location
              </Button>
              {mapLoaded && (
                <Button
                  onClick={() => setShowGoogleSearch(true)}
                  variant="outline"
                >
                  <Search className="w-4 h-4 mr-2" />
                  Search on Map
                </Button>
              )}
            </div>
          </Card>
        ) : (
          <div className="space-y-4">
            {locations.map((location) => (
              <Card key={location.id} className="overflow-hidden">
                {/* Location Header */}
                <div className="p-4 bg-gray-50 border-b border-gray-200">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <MapPin className="w-5 h-5 text-[#FF8C42]" />
                        <h3 className="font-semibold text-gray-900">{location.name}</h3>
                        {location.isClinicLocation && (
                          <Badge className="bg-blue-100 text-blue-800">Clinic</Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 ml-7">{location.address}</p>
                      {location.contactNumber && (
                        <p className="text-sm text-gray-500 ml-7">📞 {location.contactNumber}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setExpandedLocation(expandedLocation === location.id ? null : location.id)}
                      >
                        {expandedLocation === location.id ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteLocation(location.id)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Availability Windows */}
                {expandedLocation === location.id && (
                  <div className="p-4 space-y-3">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium text-gray-900">Availability Windows</h4>
                      <Button
                        size="sm"
                        onClick={() => handleAddAvailabilityWindow(location.id)}
                        className="bg-[#FF8C42] hover:bg-[#FF7A2E] text-white"
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Add Window
                      </Button>
                    </div>

                    {location.availabilityWindows.length === 0 ? (
                      <div className="text-center py-6 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                        <Clock className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                        <p className="text-sm text-gray-600">No availability windows configured</p>
                        <p className="text-xs text-gray-500 mt-1">Add windows to enable bookings at this location</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {location.availabilityWindows.map((window) => (
                          <div
                            key={window.id}
                            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge className="bg-purple-100 text-purple-800">
                                  {DAYS_OF_WEEK[window.dayOfWeek]}
                                </Badge>
                                <span className="text-sm font-medium text-gray-900">
                                  {window.startTime} - {window.endTime}
                                </span>
                                {!window.isActive && (
                                  <Badge className="bg-gray-100 text-gray-600">Inactive</Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                {window.serviceStyles.map((style) => (
                                  <Badge
                                    key={style}
                                    className={
                                      style === 'at_center'
                                        ? 'bg-blue-100 text-blue-800'
                                        : style === 'at_home'
                                        ? 'bg-green-100 text-green-800'
                                        : 'bg-orange-100 text-orange-800'
                                    }
                                  >
                                    {style === 'at_center' ? 'At Center' : style === 'at_home' ? 'At Home' : 'Tele'}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setEditingWindow({ locationId: location.id, window })}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDeleteAvailabilityWindow(location.id, window.id)}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Add Location Dialog */}
      {showAddLocation && (
        <Dialog open={showAddLocation} onOpenChange={setShowAddLocation}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add Service Location</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Location Name
                </label>
                <Input
                  value={locationForm.name}
                  onChange={(e) => setLocationForm({ ...locationForm, name: e.target.value })}
                  placeholder="e.g., Downtown Clinic"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Address
                </label>
                <Input
                  value={locationForm.address}
                  onChange={(e) => setLocationForm({ ...locationForm, address: e.target.value })}
                  placeholder="Full address"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contact Number (Optional)
                </label>
                <Input
                  value={locationForm.contactNumber}
                  onChange={(e) => setLocationForm({ ...locationForm, contactNumber: e.target.value })}
                  placeholder="Phone number"
                />
              </div>
              {mapLoaded && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowAddLocation(false);
                    setShowGoogleSearch(true);
                  }}
                  className="w-full"
                >
                  <MapIcon className="w-4 h-4 mr-2" />
                  Search on Google Maps
                </Button>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddLocation(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddLocation} className="bg-[#FF8C42] hover:bg-[#FF7A2E] text-white">
                <Save className="w-4 h-4 mr-2" />
                Save Location
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Google Places Search Dialog */}
      {showGoogleSearch && mapLoaded && (
        <Dialog open={showGoogleSearch} onOpenChange={setShowGoogleSearch}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Search Location on Google Maps</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex gap-2">
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search for a place..."
                  onKeyPress={(e) => e.key === 'Enter' && searchGooglePlaces()}
                />
                <Button onClick={searchGooglePlaces}>
                  <Search className="w-4 h-4" />
                </Button>
              </div>
              
              {searchResults.length > 0 && (
                <div className="max-h-96 overflow-y-auto space-y-2">
                  {searchResults.map((place, index) => (
                    <div
                      key={index}
                      className="p-3 bg-gray-50 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-100"
                      onClick={() => selectGooglePlace(place)}
                    >
                      <p className="font-medium text-gray-900">{place.name}</p>
                      <p className="text-sm text-gray-600">{place.formatted_address}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowGoogleSearch(false)}>
                Cancel
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Edit Availability Window Dialog */}
      {editingWindow && (
        <Dialog open={!!editingWindow} onOpenChange={() => setEditingWindow(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingWindow.window.id.startsWith('window_') ? 'Add' : 'Edit'} Availability Window
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Day of Week
                </label>
                <select
                  value={editingWindow.window.dayOfWeek}
                  onChange={(e) =>
                    setEditingWindow({
                      ...editingWindow,
                      window: { ...editingWindow.window, dayOfWeek: parseInt(e.target.value) }
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF8C42]"
                >
                  {DAYS_OF_WEEK.map((day, index) => (
                    <option key={index} value={index}>
                      {day}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Start Time
                  </label>
                  <Input
                    type="time"
                    value={editingWindow.window.startTime}
                    onChange={(e) =>
                      setEditingWindow({
                        ...editingWindow,
                        window: { ...editingWindow.window, startTime: e.target.value }
                      })
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    End Time
                  </label>
                  <Input
                    type="time"
                    value={editingWindow.window.endTime}
                    onChange={(e) =>
                      setEditingWindow({
                        ...editingWindow,
                        window: { ...editingWindow.window, endTime: e.target.value }
                      })
                    }
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Service Styles
                </label>
                <div className="space-y-2">
                  {['at_center', 'at_home', 'tele'].map((style) => (
                    <label key={style} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editingWindow.window.serviceStyles.includes(style)}
                        onChange={(e) => {
                          const styles = e.target.checked
                            ? [...editingWindow.window.serviceStyles, style]
                            : editingWindow.window.serviceStyles.filter(s => s !== style);
                          setEditingWindow({
                            ...editingWindow,
                            window: { ...editingWindow.window, serviceStyles: styles }
                          });
                        }}
                        className="w-4 h-4 text-[#FF8C42] border-gray-300 rounded focus:ring-[#FF8C42]"
                      />
                      <span className="text-sm text-gray-700">
                        {style === 'at_center' ? 'At Center' : style === 'at_home' ? 'At Home' : 'Tele-health'}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {editingWindow.window.serviceStyles.length === 0 && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
                  <p className="text-sm text-yellow-800">
                    Please select at least one service style for this window
                  </p>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingWindow(null)}>
                Cancel
              </Button>
              <Button
                onClick={handleSaveAvailabilityWindow}
                disabled={editingWindow.window.serviceStyles.length === 0}
                className="bg-[#FF8C42] hover:bg-[#FF7A2E] text-white"
              >
                <Save className="w-4 h-4 mr-2" />
                Save Window
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
