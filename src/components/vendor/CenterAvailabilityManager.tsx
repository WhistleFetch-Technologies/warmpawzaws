import { useState, useEffect } from 'react';
import { Clock, Calendar, Ambulance, Home, Pill, Activity, Save, ArrowLeft } from 'lucide-react';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { toast } from 'sonner@2.0.3';
import { Button } from '../ui/button';

interface CenterAvailabilityManagerProps {
  vendorId: string;
  vendorName: string;
  onBack: () => void;
}

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const DAY_LABELS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export function CenterAvailabilityManager({
  vendorId,
  vendorName,
  onBack
}: CenterAvailabilityManagerProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [availability, setAvailability] = useState<any>(null);

  useEffect(() => {
    loadAvailability();
  }, [vendorId]);

  const loadAvailability = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/${vendorId}/center-availability`,
        { headers: { 'Authorization': `Bearer ${publicAnonKey}` } }
      );

      if (response.ok) {
        const data = await response.json();
        // ✅ FIX: Handle standardized response format
        // Response format: { success: true, availability: {...}, ... }
        setAvailability(data.availability || data.data?.availability);
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Failed to load availability settings:', errorData);
        // Don't show error toast on initial load - just log
      }
    } catch (error: any) {
      console.error('Error:', error);
      const errorMessage = error?.message || 'Failed to load availability settings. Please try again.';
      // Don't show error toast on initial load - just log
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/${vendorId}/center-availability`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(availability)
        }
      );

      if (response.ok) {
        const data = await response.json();
        // ✅ FIX: Handle standardized response format
        if (data.success || data.data?.success) {
          toast.success('Settings saved successfully');
        } else {
          const errorMessage = data.error || data.message || 'Failed to save settings';
          toast.error(errorMessage);
        }
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error occurred' }));
        const errorMessage = errorData.error || errorData.message || 'Failed to save settings';
        toast.error(errorMessage);
      }
    } catch (error: any) {
      console.error('Error saving availability:', error);
      const errorMessage = error?.message || 'Network error. Please check your connection and try again.';
      toast.error(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  if (loading || !availability) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-lg">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1">
              <h1 className="font-bold text-gray-900">Center Settings</h1>
              <p className="text-sm text-gray-600">{vendorName}</p>
            </div>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Save className="w-4 h-4 mr-2" />
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Operating Hours */}
        <div className="bg-white rounded-xl border p-6">
          <h2 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-600" />
            Operating Hours
          </h2>
          <div className="space-y-3">
            {DAYS.map((day, idx) => (
              <div key={day} className="flex items-center gap-4">
                <div className="w-32">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={availability.operatingHours[day]?.isOpen || false}
                      onChange={(e) => setAvailability({
                        ...availability,
                        operatingHours: {
                          ...availability.operatingHours,
                          [day]: {
                            ...availability.operatingHours[day],
                            isOpen: e.target.checked
                          }
                        }
                      })}
                      className="w-4 h-4"
                    />
                    <span className="text-sm font-medium">{DAY_LABELS[idx]}</span>
                  </label>
                </div>
                {availability.operatingHours[day]?.isOpen && (
                  <>
                    <input
                      type="time"
                      value={availability.operatingHours[day]?.open || '09:00'}
                      onChange={(e) => setAvailability({
                        ...availability,
                        operatingHours: {
                          ...availability.operatingHours,
                          [day]: {
                            ...availability.operatingHours[day],
                            open: e.target.value
                          }
                        }
                      })}
                      className="px-3 py-2 border rounded-lg"
                    />
                    <span className="text-gray-500">to</span>
                    <input
                      type="time"
                      value={availability.operatingHours[day]?.close || '21:00'}
                      onChange={(e) => setAvailability({
                        ...availability,
                        operatingHours: {
                          ...availability.operatingHours,
                          [day]: {
                            ...availability.operatingHours[day],
                            close: e.target.value
                          }
                        }
                      })}
                      className="px-3 py-2 border rounded-lg"
                    />
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Emergency Services */}
        <div className="bg-white rounded-xl border p-6">
          <h2 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-red-600" />
            Emergency Services
          </h2>
          <div className="space-y-4">
            <label className="flex items-center gap-3 p-4 border rounded-lg cursor-pointer hover:bg-gray-50">
              <input
                type="checkbox"
                checked={availability.emergencyServices?.enabled || false}
                onChange={(e) => setAvailability({
                  ...availability,
                  emergencyServices: {
                    ...availability.emergencyServices,
                    enabled: e.target.checked
                  }
                })}
                className="w-5 h-5"
              />
              <div className="flex-1">
                <p className="font-medium">Enable Emergency Services</p>
                <p className="text-sm text-gray-600">Accept emergency appointments</p>
              </div>
            </label>

            {availability.emergencyServices?.enabled && (
              <label className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg cursor-pointer">
                <input
                  type="checkbox"
                  checked={availability.emergencyServices?.is24x7 || false}
                  onChange={(e) => setAvailability({
                    ...availability,
                    emergencyServices: {
                      ...availability.emergencyServices,
                      is24x7: e.target.checked
                    }
                  })}
                  className="w-5 h-5"
                />
                <div className="flex-1">
                  <p className="font-medium text-red-900">24×7 Emergency</p>
                  <p className="text-sm text-red-700">Available round the clock</p>
                </div>
              </label>
            )}
          </div>
        </div>

        {/* Ambulance Service */}
        <div className="bg-white rounded-xl border p-6">
          <h2 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Ambulance className="w-5 h-5 text-orange-600" />
            Ambulance Service
          </h2>
          <div className="space-y-4">
            <label className="flex items-center gap-3 p-4 border rounded-lg cursor-pointer hover:bg-gray-50">
              <input
                type="checkbox"
                checked={availability.ambulanceService?.enabled || false}
                onChange={(e) => setAvailability({
                  ...availability,
                  ambulanceService: {
                    ...availability.ambulanceService,
                    enabled: e.target.checked
                  }
                })}
                className="w-5 h-5"
              />
              <div className="flex-1">
                <p className="font-medium">Enable Ambulance Service</p>
              </div>
            </label>

            {availability.ambulanceService?.enabled && (
              <div className="grid grid-cols-3 gap-4 p-4 bg-orange-50 rounded-lg">
                <div>
                  <label className="block text-xs text-gray-700 mb-1">Price per KM (₹)</label>
                  <input
                    type="number"
                    value={availability.ambulanceService?.pricePerKm || 50}
                    onChange={(e) => setAvailability({
                      ...availability,
                      ambulanceService: {
                        ...availability.ambulanceService,
                        pricePerKm: Number(e.target.value)
                      }
                    })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-700 mb-1">Min Charge (₹)</label>
                  <input
                    type="number"
                    value={availability.ambulanceService?.minCharge || 200}
                    onChange={(e) => setAvailability({
                      ...availability,
                      ambulanceService: {
                        ...availability.ambulanceService,
                        minCharge: Number(e.target.value)
                      }
                    })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-700 mb-1">Max Radius (KM)</label>
                  <input
                    type="number"
                    value={availability.ambulanceService?.maxRadius || 25}
                    onChange={(e) => setAvailability({
                      ...availability,
                      ambulanceService: {
                        ...availability.ambulanceService,
                        maxRadius: Number(e.target.value)
                      }
                    })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Home Sample Collection */}
        <div className="bg-white rounded-xl border p-6">
          <h2 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Home className="w-5 h-5 text-green-600" />
            Home Sample Collection
          </h2>
          <div className="space-y-4">
            <label className="flex items-center gap-3 p-4 border rounded-lg cursor-pointer hover:bg-gray-50">
              <input
                type="checkbox"
                checked={availability.homeSampleCollection?.enabled || false}
                onChange={(e) => setAvailability({
                  ...availability,
                  homeSampleCollection: {
                    ...availability.homeSampleCollection,
                    enabled: e.target.checked
                  }
                })}
                className="w-5 h-5"
              />
              <div className="flex-1">
                <p className="font-medium">Enable Home Collection</p>
              </div>
            </label>

            {availability.homeSampleCollection?.enabled && (
              <div className="p-4 bg-green-50 rounded-lg space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-700 mb-1">Price per Visit (₹)</label>
                    <input
                      type="number"
                      value={availability.homeSampleCollection?.pricePerVisit || 150}
                      onChange={(e) => setAvailability({
                        ...availability,
                        homeSampleCollection: {
                          ...availability.homeSampleCollection,
                          pricePerVisit: Number(e.target.value)
                        }
                      })}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-700 mb-1">Max Radius (KM)</label>
                    <input
                      type="number"
                      value={availability.homeSampleCollection?.maxRadius || 15}
                      onChange={(e) => setAvailability({
                        ...availability,
                        homeSampleCollection: {
                          ...availability.homeSampleCollection,
                          maxRadius: Number(e.target.value)
                        }
                      })}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Pharmacy */}
        <div className="bg-white rounded-xl border p-6">
          <h2 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Pill className="w-5 h-5 text-blue-600" />
            Pharmacy
          </h2>
          <div className="space-y-4">
            <label className="flex items-center gap-3 p-4 border rounded-lg cursor-pointer hover:bg-gray-50">
              <input
                type="checkbox"
                checked={availability.pharmacy?.enabled || false}
                onChange={(e) => setAvailability({
                  ...availability,
                  pharmacy: {
                    ...availability.pharmacy,
                    enabled: e.target.checked
                  }
                })}
                className="w-5 h-5"
              />
              <div className="flex-1">
                <p className="font-medium">Enable Pharmacy</p>
              </div>
            </label>

            {availability.pharmacy?.enabled && (
              <div className="space-y-3">
                <label className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                  <input
                    type="checkbox"
                    checked={availability.pharmacy?.deliveryAvailable || false}
                    onChange={(e) => setAvailability({
                      ...availability,
                      pharmacy: {
                        ...availability.pharmacy,
                        deliveryAvailable: e.target.checked
                      }
                    })}
                    className="w-4 h-4"
                  />
                  <span className="text-sm font-medium">Home Delivery Available</span>
                </label>
              </div>
            )}
          </div>
        </div>

        {/* Diagnostics */}
        <div className="bg-white rounded-xl border p-6">
          <h2 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-purple-600" />
            Diagnostics
          </h2>
          <label className="flex items-center gap-3 p-4 border rounded-lg cursor-pointer hover:bg-gray-50">
            <input
              type="checkbox"
              checked={availability.diagnostics?.enabled || false}
              onChange={(e) => setAvailability({
                ...availability,
                diagnostics: {
                  ...availability.diagnostics,
                  enabled: e.target.checked
                }
              })}
              className="w-5 h-5"
            />
            <div className="flex-1">
              <p className="font-medium">Enable Diagnostics Lab</p>
            </div>
          </label>
        </div>
      </div>
    </div>
  );
}
