import { useState, useEffect } from 'react';
import { 
  Plus, MapPin, Clock, Edit, Trash2, Save, X, Search, AlertTriangle,
  Building, Map as MapIcon, Check, ChevronDown, ChevronUp, Home, Video,
  Navigation, Timer, Users, AlertCircle, Calendar
} from 'lucide-react';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Label } from '../ui/label';
import { Checkbox } from '../ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';

declare const google: any;

interface EnhancedScheduleEditorProps {
  staff: any;
  vendorData: any; // NEW: Vendor data to check centres
  roleConfiguration: any; // NEW: Role config for service filtering
  onBack: () => void;
}

interface AvailabilitySlot {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  
  // TASK 1: Location mode vs Centre mode
  mode: 'location' | 'centre';
  
  // Location mode fields (when vendor.centres.length === 0)
  location?: {
    name: string;
    address: string;
    latitude: number;
    longitude: number;
    radius: number; // in km
  };
  
  // Centre mode fields
  centreId?: string;
  centreName?: string;
  
  // TASK 1: Services filtered by role + centre
  allowedServiceIds: string[];
  
  // TASK 2: Conditional fields based on service types
  hasHomeServices?: boolean; // If any service is category=home
  hasTeleServices?: boolean; // If any service is tele
  leadTime?: number; // Required if hasHomeServices (minutes)
  maxDistance?: number; // Required if hasHomeServices (km)
  bufferTime: number; // Always present (minutes)
  
  // TASK 3: Concurrency
  maxConcurrentBookings: number;
  
  isActive: boolean;
}

interface ServiceCatalogItem {
  id: string;
  name: string;
  category: string;
  serviceStyle: 'at_home' | 'at_center' | 'tele';
  isPublished?: boolean;
}

interface ConflictInfo {
  type: 'overlap' | 'concurrency';
  message: string;
  conflictingSlots: AvailabilitySlot[];
}

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function EnhancedScheduleEditor({ 
  staff, 
  vendorData, 
  roleConfiguration,
  onBack 
}: EnhancedScheduleEditorProps) {
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [availableServices, setAvailableServices] = useState<ServiceCatalogItem[]>([]);
  const [centres, setCentres] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Editor state
  const [editingSlot, setEditingSlot] = useState<AvailabilitySlot | null>(null);
  const [showSlotEditor, setShowSlotEditor] = useState(false);
  const [conflicts, setConflicts] = useState<ConflictInfo[]>([]);
  
  // Google Maps state
  const [showLocationSearch, setShowLocationSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [mapLoaded, setMapLoaded] = useState(false);

  const hasCentres = vendorData?.centres && vendorData.centres.length > 0;

  useEffect(() => {
    loadData();
    loadGoogleMaps();
  }, [staff.id]);

  const loadGoogleMaps = () => {
    if (typeof google !== 'undefined' && google.maps) {
      setMapLoaded(true);
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}&libraries=places`;
    script.async = true;
    script.onload = () => setMapLoaded(true);
    document.head.appendChild(script);
  };

  const loadData = async () => {
    try {
      setLoading(true);

      // Load staff availability slots
      const slotsRes = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/staff/${staff.id}/availability-slots`,
        { headers: { 'Authorization': `Bearer ${publicAnonKey}` } }
      );

      if (slotsRes.ok) {
        const data = await slotsRes.json();
        setSlots(data.slots || []);
      }

      // Load centres if available
      if (hasCentres) {
        setCentres(vendorData.centres);
      }

      // TASK 1: Load services filtered by role configuration
      await loadFilteredServices();

    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load availability data');
    } finally {
      setLoading(false);
    }
  };

  // TASK 1: Load services filtered by role and centre/published services
  const loadFilteredServices = async () => {
    try {
      // Get all catalog services
      const catalogRes = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/catalog/services`,
        { headers: { 'Authorization': `Bearer ${publicAnonKey}` } }
      );

      if (!catalogRes.ok) {
        console.error('Failed to load service catalog');
        return;
      }

      const catalogData = await catalogRes.json();
      let services = catalogData.services || [];

      // Filter by role configuration
      if (roleConfiguration?.vendorTypes && roleConfiguration.vendorTypes.length > 0) {
        services = services.filter((s: ServiceCatalogItem) => 
          roleConfiguration.vendorTypes.some((vt: string) => 
            s.category.toLowerCase().includes(vt.toLowerCase()) ||
            vt.toLowerCase().includes(s.category.toLowerCase())
          )
        );
      }

      // If vendor has centres, also load centre-published services
      if (hasCentres) {
        const centreServicesRes = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/${vendorData.id}/published-services`,
          { headers: { 'Authorization': `Bearer ${publicAnonKey}` } }
        );

        if (centreServicesRes.ok) {
          const centreData = await centreServicesRes.json();
          const publishedServiceIds = new Set(centreData.services?.map((s: any) => s.id) || []);
          
          // Mark which services are published
          services = services.map((s: ServiceCatalogItem) => ({
            ...s,
            isPublished: publishedServiceIds.has(s.id)
          }));
        }
      }

      setAvailableServices(services);
    } catch (error) {
      console.error('Error loading services:', error);
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
        fields: ['name', 'formatted_address', 'geometry', 'place_id']
      };

      service.textSearch(request, (results: any, status: any) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && results) {
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

  const handleServiceSelection = (serviceId: string, checked: boolean) => {
    if (!editingSlot) return;

    const updatedServices = checked
      ? [...editingSlot.allowedServiceIds, serviceId]
      : editingSlot.allowedServiceIds.filter(id => id !== serviceId);

    // TASK 2: Determine if we have home or tele services
    const selectedServices = availableServices.filter(s => updatedServices.includes(s.id));
    const hasHomeServices = selectedServices.some(s => s.serviceStyle === 'at_home');
    const hasTeleServices = selectedServices.every(s => s.serviceStyle === 'tele');

    setEditingSlot({
      ...editingSlot,
      allowedServiceIds: updatedServices,
      hasHomeServices,
      hasTeleServices,
      // Clear lead time and distance if no home services
      leadTime: hasHomeServices ? editingSlot.leadTime : undefined,
      maxDistance: hasHomeServices ? editingSlot.maxDistance : undefined
    });
  };

  const createNewSlot = () => {
    const newSlot: AvailabilitySlot = {
      id: `slot_${Date.now()}`,
      dayOfWeek: 1, // Monday
      startTime: '09:00',
      endTime: '17:00',
      mode: hasCentres ? 'centre' : 'location',
      allowedServiceIds: [],
      bufferTime: 15,
      maxConcurrentBookings: 1,
      isActive: true
    };

    setEditingSlot(newSlot);
    setShowSlotEditor(true);
  };

  // TASK 3: Detect conflicts
  const detectConflicts = (newSlot: AvailabilitySlot): ConflictInfo[] => {
    const conflicts: ConflictInfo[] = [];

    // Check for time overlaps on same day
    const sameDay = slots.filter(s => 
      s.id !== newSlot.id && 
      s.dayOfWeek === newSlot.dayOfWeek && 
      s.isActive
    );

    for (const slot of sameDay) {
      const newStart = parseTime(newSlot.startTime);
      const newEnd = parseTime(newSlot.endTime);
      const existingStart = parseTime(slot.startTime);
      const existingEnd = parseTime(slot.endTime);

      if (
        (newStart >= existingStart && newStart < existingEnd) ||
        (newEnd > existingStart && newEnd <= existingEnd) ||
        (newStart <= existingStart && newEnd >= existingEnd)
      ) {
        conflicts.push({
          type: 'overlap',
          message: `Time slot overlaps with existing ${DAYS_OF_WEEK[slot.dayOfWeek]} schedule (${slot.startTime} - ${slot.endTime})`,
          conflictingSlots: [slot]
        });
      }
    }

    // Check centre concurrency if in centre mode
    if (newSlot.mode === 'centre' && newSlot.centreId) {
      const sameCentreSlots = slots.filter(s => 
        s.mode === 'centre' && 
        s.centreId === newSlot.centreId && 
        s.dayOfWeek === newSlot.dayOfWeek
      );

      const totalConcurrency = sameCentreSlots.reduce((sum, s) => sum + s.maxConcurrentBookings, 0) + newSlot.maxConcurrentBookings;
      const centreLimit = centres.find(c => c.id === newSlot.centreId)?.maxConcurrentBookings || 10;

      if (totalConcurrency > centreLimit) {
        conflicts.push({
          type: 'concurrency',
          message: `Centre concurrency limit exceeded. Total: ${totalConcurrency}, Limit: ${centreLimit}`,
          conflictingSlots: sameCentreSlots
        });
      }
    }

    return conflicts;
  };

  const parseTime = (time: string): number => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  };

  const handleSaveSlot = async () => {
    if (!editingSlot) return;

    // Validation
    if (editingSlot.allowedServiceIds.length === 0) {
      toast.error('Please select at least one service');
      return;
    }

    // TASK 2: Validate conditional fields
    if (editingSlot.hasHomeServices) {
      if (!editingSlot.leadTime || editingSlot.leadTime < 30) {
        toast.error('Lead time is required (minimum 30 minutes) for home services');
        return;
      }
      if (!editingSlot.maxDistance || editingSlot.maxDistance <= 0) {
        toast.error('Maximum distance is required for home services');
        return;
      }
    }

    if (editingSlot.mode === 'location' && !editingSlot.location) {
      toast.error('Please select a location');
      return;
    }

    if (editingSlot.mode === 'centre' && !editingSlot.centreId) {
      toast.error('Please select a centre');
      return;
    }

    // TASK 3: Check for conflicts
    const detectedConflicts = detectConflicts(editingSlot);
    if (detectedConflicts.length > 0) {
      setConflicts(detectedConflicts);
      return;
    }

    try {
      setSaving(true);

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/staff/${staff.id}/availability-slots`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            slot: editingSlot
          })
        }
      );

      if (response.ok) {
        const data = await response.json();
        toast.success('Availability slot saved successfully');
        await loadData();
        setShowSlotEditor(false);
        setEditingSlot(null);
        setConflicts([]);
      } else if (response.status === 409) {
        // TASK 3: Handle conflict from server
        const error = await response.json();
        toast.error(error.message || 'Conflict detected');
        if (error.conflicts) {
          setConflicts(error.conflicts);
        }
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to save availability');
      }
    } catch (error) {
      console.error('Error saving slot:', error);
      toast.error('Error saving availability slot');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSlot = async (slotId: string) => {
    if (!confirm('Are you sure you want to delete this availability slot?')) return;

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/staff/${staff.id}/availability-slots/${slotId}`,
        {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }
      );

      if (response.ok) {
        toast.success('Slot deleted successfully');
        await loadData();
      } else {
        toast.error('Failed to delete slot');
      }
    } catch (error) {
      console.error('Error deleting slot:', error);
      toast.error('Error deleting slot');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto p-4">
        {/* Header */}
        <div className="mb-6">
          <Button variant="ghost" onClick={onBack} className="mb-4">
            ← Back
          </Button>
          <h1 className="text-2xl font-bold text-gray-900">Schedule & Availability</h1>
          <p className="text-gray-600 mt-1">
            Manage {staff.fullName}'s availability slots and service locations
          </p>
        </div>

        {/* Mode Indicator */}
        <Card className="p-4 mb-6 bg-blue-50 border-blue-200">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
            <div>
              <h3 className="font-semibold text-blue-900">
                {hasCentres ? 'Centre-Based Scheduling' : 'Location-Based Scheduling'}
              </h3>
              <p className="text-sm text-blue-700 mt-1">
                {hasCentres
                  ? 'Your vendor has centres configured. Schedule availability at specific centre locations.'
                  : 'No centres configured. Define custom service locations with coverage radius for mobile services.'}
              </p>
            </div>
          </div>
        </Card>

        {/* Slots List */}
        <div className="space-y-4 mb-6">
          {slots.map(slot => (
            <Card key={slot.id} className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className="bg-[#FF8C42]">
                      {DAYS_OF_WEEK[slot.dayOfWeek]}
                    </Badge>
                    <span className="font-semibold">
                      {slot.startTime} - {slot.endTime}
                    </span>
                  </div>

                  <div className="space-y-2 text-sm">
                    {/* Location/Centre Info */}
                    {slot.mode === 'location' && slot.location && (
                      <div className="flex items-start gap-2">
                        <MapPin className="w-4 h-4 text-gray-500 mt-0.5" />
                        <div>
                          <div className="font-medium">{slot.location.name}</div>
                          <div className="text-gray-600">{slot.location.address}</div>
                          <div className="text-gray-500">
                            Coverage radius: {slot.location.radius} km
                          </div>
                        </div>
                      </div>
                    )}

                    {slot.mode === 'centre' && (
                      <div className="flex items-center gap-2">
                        <Building className="w-4 h-4 text-gray-500" />
                        <span>{slot.centreName}</span>
                      </div>
                    )}

                    {/* Services */}
                    <div className="flex flex-wrap gap-1">
                      {slot.allowedServiceIds.slice(0, 3).map(serviceId => {
                        const service = availableServices.find(s => s.id === serviceId);
                        return service ? (
                          <Badge key={serviceId} variant="outline" className="text-xs">
                            {service.name}
                          </Badge>
                        ) : null;
                      })}
                      {slot.allowedServiceIds.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{slot.allowedServiceIds.length - 3} more
                        </Badge>
                      )}
                    </div>

                    {/* Conditional Fields */}
                    <div className="flex flex-wrap gap-3 text-xs text-gray-600">
                      {slot.hasHomeServices && (
                        <>
                          <div className="flex items-center gap-1">
                            <Timer className="w-3 h-3" />
                            Lead: {slot.leadTime}min
                          </div>
                          <div className="flex items-center gap-1">
                            <Navigation className="w-3 h-3" />
                            Max: {slot.maxDistance}km
                          </div>
                        </>
                      )}
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Buffer: {slot.bufferTime}min
                      </div>
                      <div className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        Concurrent: {slot.maxConcurrentBookings}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditingSlot(slot);
                      setShowSlotEditor(true);
                    }}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteSlot(slot.id)}
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}

          {slots.length === 0 && (
            <Card className="p-8 text-center">
              <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <h3 className="font-semibold text-gray-900 mb-2">No Availability Slots</h3>
              <p className="text-sm text-gray-600 mb-4">
                Create your first availability slot to start accepting bookings
              </p>
            </Card>
          )}
        </div>

        {/* Add Slot Button */}
        <Button onClick={createNewSlot} className="w-full">
          <Plus className="w-4 h-4 mr-2" />
          Add Availability Slot
        </Button>

        {/* Slot Editor Dialog */}
        <Dialog open={showSlotEditor} onOpenChange={setShowSlotEditor}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingSlot?.id.startsWith('slot_') ? 'New' : 'Edit'} Availability Slot
              </DialogTitle>
            </DialogHeader>

            {editingSlot && (
              <div className="space-y-4">
                {/* TASK 3: Conflict Banner */}
                {conflicts.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <h4 className="font-semibold text-red-900 mb-2">Scheduling Conflicts Detected</h4>
                        <ul className="space-y-1 text-sm text-red-700">
                          {conflicts.map((conflict, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <span className="text-red-600">•</span>
                              <span>{conflict.message}</span>
                            </li>
                          ))}
                        </ul>
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-3 border-red-300 text-red-700"
                          onClick={() => setConflicts([])}
                        >
                          Dismiss and Edit
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Day and Time */}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label>Day of Week</Label>
                    <select
                      value={editingSlot.dayOfWeek}
                      onChange={(e) => setEditingSlot({ ...editingSlot, dayOfWeek: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border rounded-lg"
                    >
                      {DAYS_OF_WEEK.map((day, idx) => (
                        <option key={idx} value={idx}>{day}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <Label>Start Time</Label>
                    <Input
                      type="time"
                      value={editingSlot.startTime}
                      onChange={(e) => setEditingSlot({ ...editingSlot, startTime: e.target.value })}
                    />
                  </div>

                  <div>
                    <Label>End Time</Label>
                    <Input
                      type="time"
                      value={editingSlot.endTime}
                      onChange={(e) => setEditingSlot({ ...editingSlot, endTime: e.target.value })}
                    />
                  </div>
                </div>

                {/* TASK 1: Mode Selection (Centre vs Location) */}
                {hasCentres && (
                  <div>
                    <Label className="mb-2 block">Service Location</Label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => setEditingSlot({ ...editingSlot, mode: 'centre', location: undefined })}
                        className={`p-4 rounded-lg border-2 text-left ${
                          editingSlot.mode === 'centre'
                            ? 'border-[#FF8C42] bg-orange-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <Building className="w-6 h-6 text-[#FF8C42] mb-2" />
                        <div className="font-medium">At Centre</div>
                        <div className="text-xs text-gray-600">Service at specific centre location</div>
                      </button>

                      <button
                        onClick={() => setEditingSlot({ ...editingSlot, mode: 'location', centreId: undefined })}
                        className={`p-4 rounded-lg border-2 text-left ${
                          editingSlot.mode === 'location'
                            ? 'border-[#FF8C42] bg-orange-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <MapPin className="w-6 h-6 text-[#FF8C42] mb-2" />
                        <div className="font-medium">Custom Location</div>
                        <div className="text-xs text-gray-600">Define service area with radius</div>
                      </button>
                    </div>
                  </div>
                )}

                {/* Centre Selection */}
                {editingSlot.mode === 'centre' && (
                  <div>
                    <Label>Select Centre *</Label>
                    <select
                      value={editingSlot.centreId || ''}
                      onChange={(e) => {
                        const centre = centres.find(c => c.id === e.target.value);
                        setEditingSlot({
                          ...editingSlot,
                          centreId: e.target.value,
                          centreName: centre?.name
                        });
                      }}
                      className="w-full px-3 py-2 border rounded-lg"
                    >
                      <option value="">Choose a centre...</option>
                      {centres.map(centre => (
                        <option key={centre.id} value={centre.id}>
                          {centre.name} - {centre.address}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* TASK 1: Location Search (if no centres or location mode) */}
                {editingSlot.mode === 'location' && (
                  <div>
                    <Label>Service Location *</Label>
                    {!editingSlot.location ? (
                      <div>
                        <div className="flex gap-2 mb-2">
                          <Input
                            placeholder="Search for a location..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && searchGooglePlaces()}
                          />
                          <Button onClick={searchGooglePlaces} disabled={!mapLoaded}>
                            <Search className="w-4 h-4" />
                          </Button>
                        </div>

                        {searchResults.length > 0 && (
                          <div className="border rounded-lg max-h-60 overflow-y-auto">
                            {searchResults.map((place, idx) => (
                              <button
                                key={idx}
                                onClick={() => {
                                  setEditingSlot({
                                    ...editingSlot,
                                    location: {
                                      name: place.name,
                                      address: place.formatted_address,
                                      latitude: place.geometry.location.lat(),
                                      longitude: place.geometry.location.lng(),
                                      radius: 5 // Default 5km
                                    }
                                  });
                                  setSearchResults([]);
                                  setSearchQuery('');
                                }}
                                className="w-full p-3 text-left hover:bg-gray-50 border-b last:border-b-0"
                              >
                                <div className="font-medium">{place.name}</div>
                                <div className="text-sm text-gray-600">{place.formatted_address}</div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <Card className="p-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="font-medium">{editingSlot.location.name}</div>
                            <div className="text-sm text-gray-600">{editingSlot.location.address}</div>
                            <div className="mt-2">
                              <Label className="text-xs">Coverage Radius (km)</Label>
                              <Input
                                type="number"
                                value={editingSlot.location.radius}
                                onChange={(e) => setEditingSlot({
                                  ...editingSlot,
                                  location: {
                                    ...editingSlot.location!,
                                    radius: parseFloat(e.target.value) || 0
                                  }
                                })}
                                min="0.5"
                                step="0.5"
                                className="mt-1"
                              />
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingSlot({ ...editingSlot, location: undefined })}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      </Card>
                    )}
                  </div>
                )}

                {/* TASK 1: Services Selection (Filtered by Role + Centre) */}
                <div>
                  <Label className="mb-2 block">Allowed Services *</Label>
                  <Card className="p-4 max-h-60 overflow-y-auto">
                    {availableServices.length === 0 ? (
                      <p className="text-sm text-gray-500 text-center py-4">
                        No services available for this role
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {availableServices.map(service => (
                          <label key={service.id} className="flex items-start gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer">
                            <Checkbox
                              checked={editingSlot.allowedServiceIds.includes(service.id)}
                              onCheckedChange={(checked) => handleServiceSelection(service.id, checked as boolean)}
                            />
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm">{service.name}</span>
                                {service.serviceStyle === 'at_home' && (
                                  <Badge variant="outline" className="text-xs">
                                    <Home className="w-3 h-3 mr-1" />
                                    Home
                                  </Badge>
                                )}
                                {service.serviceStyle === 'tele' && (
                                  <Badge variant="outline" className="text-xs">
                                    <Video className="w-3 h-3 mr-1" />
                                    Tele
                                  </Badge>
                                )}
                                {service.isPublished && (
                                  <Badge className="bg-green-100 text-green-800 text-xs">Published</Badge>
                                )}
                              </div>
                              <div className="text-xs text-gray-500">{service.category}</div>
                            </div>
                          </label>
                        ))}
                      </div>
                    )}
                  </Card>
                </div>

                {/* TASK 2: Conditional Fields based on Service Types */}
                {editingSlot.hasHomeServices && (
                  <Card className="p-4 bg-yellow-50 border-yellow-200">
                    <h4 className="font-semibold text-yellow-900 mb-3 flex items-center gap-2">
                      <Home className="w-4 h-4" />
                      Home Service Requirements
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Lead Time (minutes) *</Label>
                        <Input
                          type="number"
                          value={editingSlot.leadTime || ''}
                          onChange={(e) => setEditingSlot({ ...editingSlot, leadTime: parseInt(e.target.value) || undefined })}
                          placeholder="e.g., 60"
                          min="30"
                          step="15"
                        />
                        <p className="text-xs text-yellow-700 mt-1">
                          Minimum advance booking time (min: 30 min)
                        </p>
                      </div>

                      <div>
                        <Label>Max Distance (km) *</Label>
                        <Input
                          type="number"
                          value={editingSlot.maxDistance || ''}
                          onChange={(e) => setEditingSlot({ ...editingSlot, maxDistance: parseFloat(e.target.value) || undefined })}
                          placeholder="e.g., 10"
                          min="0.5"
                          step="0.5"
                        />
                        <p className="text-xs text-yellow-700 mt-1">
                          Maximum travel distance from location
                        </p>
                      </div>
                    </div>
                  </Card>
                )}

                {/* TASK 2: Buffer Time (Always Present) */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Buffer Time (minutes)</Label>
                    <Input
                      type="number"
                      value={editingSlot.bufferTime}
                      onChange={(e) => setEditingSlot({ ...editingSlot, bufferTime: parseInt(e.target.value) || 0 })}
                      min="0"
                      step="5"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Gap between consecutive bookings
                    </p>
                  </div>

                  {/* TASK 3: Concurrency */}
                  <div>
                    <Label>Max Concurrent Bookings</Label>
                    <Input
                      type="number"
                      value={editingSlot.maxConcurrentBookings}
                      onChange={(e) => setEditingSlot({ ...editingSlot, maxConcurrentBookings: parseInt(e.target.value) || 1 })}
                      min="1"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Number of simultaneous appointments
                    </p>
                  </div>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setShowSlotEditor(false);
                setEditingSlot(null);
                setConflicts([]);
              }}>
                Cancel
              </Button>
              <Button onClick={handleSaveSlot} disabled={saving}>
                {saving ? 'Saving...' : 'Save Slot'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
