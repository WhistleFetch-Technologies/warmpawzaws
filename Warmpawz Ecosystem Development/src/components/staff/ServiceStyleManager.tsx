/**
 * SERVICE STYLE MANAGER
 * Allows staff to control which service styles they offer
 * - At Center: Services at clinic/facility
 * - At Home: Services at customer location (with distance control)
 * - Tele: Remote video consultations
 */

import { useState, useEffect } from 'react';
import { ArrowLeft, Home, Building2, Video, MapPin, Settings, Save, Check } from 'lucide-react';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { toast } from 'sonner';

interface ServiceStyleManagerProps {
  staff: any;
  onBack: () => void;
}

export function ServiceStyleManager({ staff, onBack }: ServiceStyleManagerProps) {
  const [preferences, setPreferences] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadPreferences();
  }, [staff.id]);

  const loadPreferences = async () => {
    try {
      setLoading(true);
      
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/staff/${staff.id}/style-preferences`,
        {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }
      );

      if (res.ok) {
        const data = await res.json();
        setPreferences(data.preferences);
      }
    } catch (error) {
      console.error('Error loading preferences:', error);
      toast.error('Failed to load preferences');
    } finally {
      setLoading(false);
    }
  };

  const toggleStyle = async (style: 'at_center' | 'at_home' | 'tele', enabled: boolean) => {
    try {
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/staff/${staff.id}/toggle-style`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ style, enabled })
        }
      );

      if (res.ok) {
        const data = await res.json();
        setPreferences(data.preferences);
        toast.success(`${getStyleLabel(style)} ${enabled ? 'enabled' : 'disabled'}`);
      } else {
        const error = await res.json();
        toast.error(error.error || 'Failed to update');
      }
    } catch (error) {
      console.error('Error toggling style:', error);
      toast.error('Failed to update');
    }
  };

  const updateHomeDistance = async (maxDistance: number) => {
    try {
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/staff/${staff.id}/home-distance`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ maxDistance })
        }
      );

      if (res.ok) {
        toast.success(`Home service radius updated to ${maxDistance}km`);
        await loadPreferences();
      } else {
        const error = await res.json();
        toast.error(error.error || 'Failed to update');
      }
    } catch (error) {
      console.error('Error updating distance:', error);
      toast.error('Failed to update');
    }
  };

  const updateTeleSettings = async (updates: any) => {
    try {
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/staff/${staff.id}/tele-settings`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(updates)
        }
      );

      if (res.ok) {
        toast.success('Tele settings updated');
        await loadPreferences();
      } else {
        const error = await res.json();
        toast.error(error.error || 'Failed to update');
      }
    } catch (error) {
      console.error('Error updating tele settings:', error);
      toast.error('Failed to update');
    }
  };

  const getStyleLabel = (style: string) => {
    switch (style) {
      case 'at_center': return 'At Center';
      case 'at_home': return 'At Home';
      case 'tele': return 'Tele Consultation';
      default: return style;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white w-full max-w-[430px] mx-auto flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42] mx-auto mb-4"></div>
          <p className="text-gray-600">Loading preferences...</p>
        </div>
      </div>
    );
  }

  if (!preferences) {
    return (
      <div className="min-h-screen bg-white w-full max-w-[430px] mx-auto p-4">
        <p className="text-center text-gray-600">Failed to load preferences</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white w-full max-w-[430px] mx-auto pb-20">
      {/* Header */}
      <div className="bg-[#FF8C42] text-white p-4 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 hover:bg-white/10 rounded-full transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-xl text-white">Service Styles</h1>
            <p className="text-sm text-white/90">Control where you offer services</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* At Center */}
        <div className="bg-white rounded-xl p-4 border-2 border-gray-200">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                <Building2 className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h3 className="text-gray-900">At Center</h3>
                <p className="text-sm text-gray-600">Services at your clinic/facility</p>
              </div>
            </div>
            <button
              onClick={() => toggleStyle('at_center', !preferences.at_center?.enabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                preferences.at_center?.enabled ? 'bg-[#FF8C42]' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  preferences.at_center?.enabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
          
          {preferences.at_center?.enabled && (
            <div className="mt-3 p-3 bg-green-50 rounded-lg border border-green-200">
              <div className="flex items-center gap-2 text-green-700">
                <Check className="w-4 h-4" />
                <span className="text-sm">Active - Customers can book at your center</span>
              </div>
            </div>
          )}
        </div>

        {/* At Home */}
        <div className="bg-white rounded-xl p-4 border-2 border-gray-200">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center">
                <Home className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <h3 className="text-gray-900">At Home</h3>
                <p className="text-sm text-gray-600">Travel to customer's location</p>
              </div>
            </div>
            <button
              onClick={() => toggleStyle('at_home', !preferences.at_home?.enabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                preferences.at_home?.enabled ? 'bg-[#FF8C42]' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  preferences.at_home?.enabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {preferences.at_home?.enabled && (
            <div className="mt-3 space-y-3">
              <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                <div className="flex items-center gap-2 text-green-700 mb-2">
                  <Check className="w-4 h-4" />
                  <span className="text-sm">Active - You'll receive home service bookings</span>
                </div>
              </div>

              {/* Distance Control */}
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="w-4 h-4 text-gray-600" />
                  <span className="text-sm text-gray-900">Service Radius</span>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 text-sm">Maximum distance</span>
                    <span className="text-[#FF8C42]">{preferences.at_home?.maxDistance || 10} km</span>
                  </div>
                  
                  <input
                    type="range"
                    min="1"
                    max="50"
                    value={preferences.at_home?.maxDistance || 10}
                    onChange={(e) => {
                      const newDistance = parseInt(e.target.value);
                      setPreferences({
                        ...preferences,
                        at_home: { ...preferences.at_home, maxDistance: newDistance }
                      });
                    }}
                    onMouseUp={(e) => {
                      const newDistance = parseInt((e.target as HTMLInputElement).value);
                      updateHomeDistance(newDistance);
                    }}
                    onTouchEnd={(e) => {
                      const newDistance = parseInt((e.target as HTMLInputElement).value);
                      updateHomeDistance(newDistance);
                    }}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#FF8C42]"
                  />
                  
                  <p className="text-xs text-gray-500">
                    You'll only receive bookings from customers within {preferences.at_home?.maxDistance || 10}km of your location
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Tele Consultation */}
        <div className="bg-white rounded-xl p-4 border-2 border-gray-200">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center">
                <Video className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <h3 className="text-gray-900">Tele Consultation</h3>
                <p className="text-sm text-gray-600">Remote video consultations</p>
              </div>
            </div>
            <button
              onClick={() => toggleStyle('tele', !preferences.tele?.enabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                preferences.tele?.enabled ? 'bg-[#FF8C42]' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  preferences.tele?.enabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {preferences.tele?.enabled && (
            <div className="mt-3 space-y-3">
              <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                <div className="flex items-center gap-2 text-green-700">
                  <Check className="w-4 h-4" />
                  <span className="text-sm">Active - Customers can book video consultations</span>
                </div>
              </div>

              {/* Tele Settings */}
              <div className="p-3 bg-gray-50 rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-900">Video Calling</span>
                  <button
                    onClick={() => updateTeleSettings({ videoEnabled: !preferences.tele?.videoEnabled })}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      preferences.tele?.videoEnabled ? 'bg-[#FF8C42]' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        preferences.tele?.videoEnabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-900">In-call Chat</span>
                  <button
                    onClick={() => updateTeleSettings({ chatEnabled: !preferences.tele?.chatEnabled })}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      preferences.tele?.chatEnabled ? 'bg-[#FF8C42]' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        preferences.tele?.chatEnabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-900">Max Session Duration</span>
                    <span className="text-[#FF8C42]">{preferences.tele?.maxSessionDuration || 30} min</span>
                  </div>
                  
                  <input
                    type="range"
                    min="5"
                    max="60"
                    step="5"
                    value={preferences.tele?.maxSessionDuration || 30}
                    onChange={(e) => {
                      const newDuration = parseInt(e.target.value);
                      setPreferences({
                        ...preferences,
                        tele: { ...preferences.tele, maxSessionDuration: newDuration }
                      });
                    }}
                    onMouseUp={(e) => {
                      const newDuration = parseInt((e.target as HTMLInputElement).value);
                      updateTeleSettings({ maxSessionDuration: newDuration });
                    }}
                    onTouchEnd={(e) => {
                      const newDuration = parseInt((e.target as HTMLInputElement).value);
                      updateTeleSettings({ maxSessionDuration: newDuration });
                    }}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#FF8C42]"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-900">
            <strong>💡 Tip:</strong> Enable service styles that match your availability and preferences. 
            Customers will only see you for the styles you've enabled.
          </p>
        </div>
      </div>
    </div>
  );
}
