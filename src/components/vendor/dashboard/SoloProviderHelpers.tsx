/**
 * SOLO PROVIDER DASHBOARD HELPER COMPONENTS
 * Consolidated file containing all helper components for solo provider dashboard
 */

import { useState, useEffect } from 'react';
import { MapPin, Plus, X, Clock, User, Calendar, Phone, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { Card } from '../../ui/card';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Textarea } from '../../ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../ui/dialog';
import { toast } from 'sonner@2.0.3';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;

// ============================================
// SERVICE AREA CONFIG MODAL
// ============================================
export function ServiceAreaConfigModal({ centerId, currentServiceArea, onClose, onSave }: any) {
  const [areaType, setAreaType] = useState<'RADIUS' | 'SPECIFIC_AREAS'>(
    currentServiceArea?.type || 'SPECIFIC_AREAS'
  );
  const [radiusKm, setRadiusKm] = useState(currentServiceArea?.radiusKm || 10);
  const [areas, setAreas] = useState<Array<{name: string, placeId?: string, lat?: number, lng?: number}>>(
    currentServiceArea?.areas?.map((a: any) => typeof a === 'string' ? { name: a } : a) || []
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [saving, setSaving] = useState(false);

  // Search for places using Google Places API
  const searchPlaces = async (input: string) => {
    if (input.length < 3) {
      setSuggestions([]);
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(
        `${API_BASE}/places/autocomplete?input=${encodeURIComponent(input)}&types=(cities)|(regions)`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setSuggestions(data.predictions || []);
        setShowSuggestions(true);
      }
    } catch (error) {
      console.error('Places search error:', error);
    } finally {
      setLoading(false);
    }
  };

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery) {
        searchPlaces(searchQuery);
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Get place details and add to areas
  const selectPlace = async (prediction: any) => {
    try {
      setLoading(true);
      const response = await fetch(
        `${API_BASE}/places/details?placeId=${prediction.place_id}`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        const place = data.place;
        
        // Extract area name (prefer locality or sublocality, fallback to formatted address)
        const areaName = place.addressComponents?.locality || 
                        place.addressComponents?.sublocality || 
                        place.addressComponents?.neighborhood ||
                        prediction.description.split(',')[0] ||
                        prediction.description;

        const newArea = {
          name: areaName,
          placeId: prediction.place_id,
          lat: place.location?.lat,
          lng: place.location?.lng,
          fullAddress: place.formattedAddress
        };

        // Check if area already exists
        if (!areas.some(a => a.placeId === newArea.placeId || a.name.toLowerCase() === newArea.name.toLowerCase())) {
          setAreas([...areas, newArea]);
        } else {
          toast.error('This area is already added');
        }
        
        setSearchQuery('');
        setShowSuggestions(false);
      }
    } catch (error) {
      console.error('Place details error:', error);
      toast.error('Failed to get place details');
    } finally {
      setLoading(false);
    }
  };

  const removeArea = (index: number) => {
    setAreas(areas.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    // Validate: Only one type should be used
    if (areaType === 'RADIUS' && areas.length > 0) {
      toast.error('Please choose either Radius OR Specific Areas, not both');
      return;
    }
    if (areaType === 'SPECIFIC_AREAS' && areas.length === 0) {
      toast.error('Please add at least one area');
      return;
    }

    setSaving(true);
    try {
      const serviceArea = {
        type: areaType,
        displayText: areaType === 'RADIUS' 
          ? `Within ${radiusKm} km radius`
          : `Serves ${areas.map(a => a.name).join(', ')}`,
        center: areas.length > 0 && areas[0].lat && areas[0].lng 
          ? { lat: areas[0].lat, lng: areas[0].lng }
          : { lat: 0, lng: 0 },
        radiusKm: areaType === 'RADIUS' ? radiusKm : undefined,
        areas: areaType === 'SPECIFIC_AREAS' ? areas : undefined
      };

      const response = await fetch(`${API_BASE}/center/${centerId}/service-area`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`
        },
        body: JSON.stringify({ serviceArea })
      });

      if (response.ok) {
        toast.success('Service area updated!');
        onSave();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update');
      }
    } catch (error: any) {
      console.error('Service area update error:', error);
      toast.error(error.message || 'Failed to update service area');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configure Service Area</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant={areaType === 'RADIUS' ? 'default' : 'outline'}
              onClick={() => {
                setAreaType('RADIUS');
                setAreas([]); // Clear areas when switching to radius
              }}
              className={areaType === 'RADIUS' ? 'bg-orange-600' : ''}
            >
              Radius Based
            </Button>
            <Button
              variant={areaType === 'SPECIFIC_AREAS' ? 'default' : 'outline'}
              onClick={() => {
                setAreaType('SPECIFIC_AREAS');
                setRadiusKm(10); // Reset radius when switching to areas
              }}
              className={areaType === 'SPECIFIC_AREAS' ? 'bg-orange-600' : ''}
            >
              Specific Areas
            </Button>
          </div>

          {areaType === 'RADIUS' ? (
            <div>
              <Label>Service Radius (km)</Label>
              <Input
                type="number"
                value={radiusKm}
                onChange={(e) => setRadiusKm(parseInt(e.target.value) || 10)}
                min={1}
                max={50}
                className="mt-1"
              />
              <p className="text-xs text-gray-500 mt-1">
                Service will be available within {radiusKm} km radius from your location
              </p>
            </div>
          ) : (
            <div>
              <Label>Areas You Serve (Search and Add Multiple Areas)</Label>
              <div className="relative mt-1">
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search for area, city, or locality..."
                  onFocus={() => searchQuery && setShowSuggestions(true)}
                />
                {loading && (
                  <div className="absolute right-3 top-3">
                    <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                  </div>
                )}
                
                {/* Suggestions Dropdown */}
                {showSuggestions && suggestions.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {suggestions.map((prediction, idx) => (
                      <div
                        key={prediction.place_id || idx}
                        className="px-4 py-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                        onClick={() => selectPlace(prediction)}
                      >
                        <div className="flex items-start gap-2">
                          <MapPin className="w-4 h-4 text-orange-600 mt-0.5 flex-shrink-0" />
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900">
                              {prediction.structured_formatting?.main_text || prediction.description}
                            </p>
                            {prediction.structured_formatting?.secondary_text && (
                              <p className="text-xs text-gray-500">
                                {prediction.structured_formatting.secondary_text}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Selected Areas */}
              {areas.length > 0 && (
                <div className="mt-3">
                  <Label className="mb-2 block">Selected Areas ({areas.length})</Label>
                  <div className="flex flex-wrap gap-2">
                    {areas.map((area, idx) => (
                      <Badge key={idx} variant="secondary" className="px-3 py-1.5">
                        <MapPin className="w-3 h-3 mr-1 inline" />
                        {area.name}
                        <X 
                          className="w-3 h-3 ml-2 cursor-pointer hover:text-red-600" 
                          onClick={() => removeArea(idx)} 
                        />
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {areas.length === 0 && (
                <p className="text-xs text-gray-500 mt-2">
                  Search and add areas you serve. You can add multiple areas.
                </p>
              )}
            </div>
          )}

          <div className="flex gap-3 pt-4 border-t">
            <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
            <Button onClick={handleSave} className="flex-1 bg-orange-600" disabled={saving}>
              {saving ? 'Saving...' : 'Save Service Area'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============================================
// OPERATING HOURS MANAGER
// ============================================
export function OperatingHoursManager({ centerId, currentHours, onUpdate }: any) {
  const [hours, setHours] = useState(currentHours || {
    monday: { open: '09:00', close: '18:00', enabled: true },
    tuesday: { open: '09:00', close: '18:00', enabled: true },
    wednesday: { open: '09:00', close: '18:00', enabled: true },
    thursday: { open: '09:00', close: '18:00', enabled: true },
    friday: { open: '09:00', close: '18:00', enabled: true },
    saturday: { open: '09:00', close: '18:00', enabled: true },
    sunday: { open: '09:00', close: '18:00', enabled: false }
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch(`${API_BASE}/center/${centerId}/operating-hours`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`
        },
        body: JSON.stringify({ operatingHours: hours })
      });

      if (response.ok) {
        toast.success('Operating hours updated!');
        onUpdate();
      } else {
        throw new Error('Failed to update');
      }
    } catch (error) {
      toast.error('Failed to update operating hours');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="p-6">
      <h2 className="text-xl font-semibold mb-4">Operating Hours</h2>
      <div className="space-y-3">
        {Object.entries(hours).map(([day, schedule]: [string, any]) => (
          <div key={day} className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={schedule.enabled}
              onChange={(e) => setHours({ ...hours, [day]: { ...schedule, enabled: e.target.checked } })}
              className="w-4 h-4"
            />
            <span className="w-24 capitalize">{day}</span>
            {schedule.enabled ? (
              <>
                <Input
                  type="time"
                  value={schedule.open}
                  onChange={(e) => setHours({ ...hours, [day]: { ...schedule, open: e.target.value } })}
                  className="w-32"
                />
                <span>to</span>
                <Input
                  type="time"
                  value={schedule.close}
                  onChange={(e) => setHours({ ...hours, [day]: { ...schedule, close: e.target.value } })}
                  className="w-32"
                />
              </>
            ) : (
              <span className="text-gray-400">Closed</span>
            )}
          </div>
        ))}
      </div>
      <Button onClick={handleSave} className="mt-6 bg-orange-600" disabled={saving}>
        {saving ? 'Saving...' : 'Save Operating Hours'}
      </Button>
    </Card>
  );
}

// ============================================
// BUSINESS INFO EDITOR
// ============================================
export function BusinessInfoEditor({ vendorId, vendor, center, onUpdate }: any) {
  const [formData, setFormData] = useState({
    businessName: vendor?.businessName || '',
    ownerName: vendor?.ownerName || '',
    email: vendor?.email || '',
    bio: vendor?.bio || ''
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch(`${API_BASE}/vendor/${vendorId}/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        toast.success('Business information updated!');
        onUpdate();
      } else {
        throw new Error('Failed to update');
      }
    } catch (error) {
      toast.error('Failed to update business information');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="p-6">
      <h2 className="text-xl font-semibold mb-4">Business Information</h2>
      <div className="space-y-4">
        <div>
          <Label>Business Name</Label>
          <Input
            value={formData.businessName}
            onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
          />
        </div>
        <div>
          <Label>Owner Name</Label>
          <Input
            value={formData.ownerName}
            onChange={(e) => setFormData({ ...formData, ownerName: e.target.value })}
          />
        </div>
        <div>
          <Label>Email</Label>
          <Input
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          />
        </div>
        <div>
          <Label>Bio / About</Label>
          <Textarea
            value={formData.bio}
            onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
            rows={4}
          />
        </div>
        <Button onClick={handleSave} className="bg-orange-600" disabled={saving}>
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </Card>
  );
}

// ============================================
// ACTIVE BOOKINGS LIST
// ============================================
export function ActiveBookingsList({ bookings, staffId, onUpdate }: any) {
  if (!bookings || bookings.length === 0) {
    return (
      <div className="text-center py-8 bg-gray-50 rounded-lg">
        <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-3" />
        <p className="text-gray-600">No active bookings</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {bookings.map((booking: any) => (
        <div key={booking.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="font-semibold">{booking.serviceName}</h3>
              <p className="text-sm text-gray-600">{booking.customerName} - {booking.petName}</p>
              <div className="flex items-center gap-3 mt-2">
                <Badge variant="secondary">
                  <Clock className="w-3 h-3 mr-1" />
                  {new Date(booking.dateTime).toLocaleString()}
                </Badge>
                <Badge variant="secondary">₹{booking.price}</Badge>
                <Badge variant={booking.status === 'confirmed' ? 'default' : 'secondary'}>
                  {booking.status}
                </Badge>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================
// AVAILABILITY TOGGLE
// ============================================
export function AvailabilityToggle({ staffId, currentStatus, onUpdate }: any) {
  const [status, setStatus] = useState(currentStatus);
  const [updating, setUpdating] = useState(false);

  const handleToggle = async (newStatus: string) => {
    setUpdating(true);
    try {
      const response = await fetch(`${API_BASE}/staff/${staffId}/availability`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`
        },
        body: JSON.stringify({ availability: newStatus })
      });

      if (response.ok) {
        setStatus(newStatus);
        toast.success(`Status updated to ${newStatus}`);
        onUpdate();
      } else {
        throw new Error('Failed to update');
      }
    } catch (error) {
      toast.error('Failed to update availability');
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="flex gap-2">
      <Button
        size="sm"
        variant={status === 'available' ? 'default' : 'outline'}
        onClick={() => handleToggle('available')}
        disabled={updating}
        className={status === 'available' ? 'bg-green-600' : ''}
      >
        <CheckCircle className="w-4 h-4 mr-1" />
        Available
      </Button>
      <Button
        size="sm"
        variant={status === 'busy' ? 'default' : 'outline'}
        onClick={() => handleToggle('busy')}
        disabled={updating}
      >
        Busy
      </Button>
    </div>
  );
}

// ============================================
// TODAY SCHEDULE
// ============================================
export function TodaySchedule({ schedule, staffId }: any) {
  if (!schedule || schedule.length === 0) {
    return (
      <div className="text-center py-8 bg-gray-50 rounded-lg">
        <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-3" />
        <p className="text-gray-600">No appointments scheduled for today</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {schedule.map((appt: any, idx: number) => (
        <div key={idx} className="border-l-4 border-l-orange-600 pl-4 py-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold">{appt.time}</p>
              <p className="text-sm text-gray-600">{appt.serviceName}</p>
              <p className="text-sm text-gray-500">{appt.customerName} - {appt.petName}</p>
            </div>
            <Badge variant="secondary">{appt.status}</Badge>
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================
// STAFF PROFILE EDITOR
// ============================================
export function StaffProfileEditor({ staffId, staff, onUpdate }: any) {
  const [formData, setFormData] = useState({
    bio: staff?.bio || '',
    experience: staff?.experience || 0,
    specializations: staff?.specializations || []
  });
  const [newSpec, setNewSpec] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch(`${API_BASE}/staff/${staffId}/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        toast.success('Profile updated!');
        onUpdate();
      } else {
        throw new Error('Failed to update');
      }
    } catch (error) {
      toast.error('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <Label>Bio</Label>
        <Textarea
          value={formData.bio}
          onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
          rows={3}
        />
      </div>
      <div>
        <Label>Years of Experience</Label>
        <Input
          type="number"
          value={formData.experience}
          onChange={(e) => setFormData({ ...formData, experience: parseInt(e.target.value) || 0 })}
        />
      </div>
      <div>
        <Label>Specializations</Label>
        <div className="flex flex-wrap gap-2 mb-2">
          {formData.specializations.map((spec: string, idx: number) => (
            <Badge key={idx} variant="secondary">
              {spec}
              <X className="w-3 h-3 ml-1 cursor-pointer" onClick={() => setFormData({
                ...formData,
                specializations: formData.specializations.filter((_: any, i: number) => i !== idx)
              })} />
            </Badge>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            value={newSpec}
            onChange={(e) => setNewSpec(e.target.value)}
            placeholder="Add specialization"
            onKeyPress={(e) => {
              if (e.key === 'Enter' && newSpec.trim()) {
                setFormData({ ...formData, specializations: [...formData.specializations, newSpec.trim()] });
                setNewSpec('');
              }
            }}
          />
          <Button onClick={() => {
            if (newSpec.trim()) {
              setFormData({ ...formData, specializations: [...formData.specializations, newSpec.trim()] });
              setNewSpec('');
            }
          }}>
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      </div>
      <Button onClick={handleSave} className="bg-orange-600" disabled={saving}>
        {saving ? 'Saving...' : 'Save Profile'}
      </Button>
    </div>
  );
}
