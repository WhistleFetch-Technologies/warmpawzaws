'use client';

import { useState, useEffect } from 'react';
import { MapPin, Phone, User, Settings, Loader2, Save, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import { hasVendorRole } from '@/lib/vendor-utils';
import { VendorReferralModal } from './VendorReferralModal';

interface VendorGeneralSettingsProps {
  vendorId: string;
  vendorData?: any;
  onBack?: () => void;
}

interface EmergencyContact {
  name: string;
  phone: string;
}

interface VendorConfig {
  service_radius?: number; // in km
  emergency_contact?: EmergencyContact;
  max_dogs_per_walk?: number; // for walkers
  walk_durations?: string[]; // for walkers
  other_config?: Record<string, any>;
}

export function VendorGeneralSettings({ vendorId, vendorData, onBack }: VendorGeneralSettingsProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showReferralModal, setShowReferralModal] = useState(false);
  const [config, setConfig] = useState<VendorConfig>({
    service_radius: undefined,
    emergency_contact: { name: '', phone: '' },
    max_dogs_per_walk: undefined,
    walk_durations: [],
    other_config: {},
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const isWalker = hasVendorRole(vendorData, 'walker');

  useEffect(() => {
    loadSettings();
  }, [vendorId]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get(`/vendor/${vendorId}/settings`) as any;
      
      if (response && response.success && response.settings) {
        setConfig({
          service_radius: response.settings.service_radius,
          emergency_contact: response.settings.emergency_contact || { name: '', phone: '' },
          max_dogs_per_walk: response.settings.max_dogs_per_walk,
          walk_durations: response.settings.walk_durations || [],
          other_config: response.settings.other_config || {},
        });
      }
    } catch (error: any) {
      console.error('Error loading settings:', error);
      // If 404, settings don't exist yet - that's fine
      if (error.status !== 404) {
        toast.error('Failed to load settings');
      }
    } finally {
      setLoading(false);
    }
  };

  const validateSettings = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (config.emergency_contact) {
      if (!config.emergency_contact.name.trim()) {
        newErrors.emergency_contact_name = 'Emergency contact name is required';
      }
      if (!config.emergency_contact.phone.trim()) {
        newErrors.emergency_contact_phone = 'Emergency contact phone is required';
      } else if (!/^[6-9]\d{9}$/.test(config.emergency_contact.phone.replace(/\D/g, ''))) {
        newErrors.emergency_contact_phone = 'Invalid phone number (10 digits, starting with 6-9)';
      }
    }

    if (config.service_radius !== undefined && config.service_radius < 0) {
      newErrors.service_radius = 'Service radius must be positive';
    }

    if (isWalker) {
      if (config.max_dogs_per_walk !== undefined && config.max_dogs_per_walk < 1) {
        newErrors.max_dogs_per_walk = 'Must be at least 1';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateSettings()) {
      toast.error('Please fix the errors before saving');
      return;
    }

    try {
      setSaving(true);
      const response = await apiClient.put(`/vendor/${vendorId}/settings`, {
        service_radius: config.service_radius,
        emergency_contact: config.emergency_contact,
        max_dogs_per_walk: config.max_dogs_per_walk,
        walk_durations: config.walk_durations,
        other_config: config.other_config,
      }) as any;

      if (response && response.success) {
        toast.success('Settings saved successfully!');
      } else {
        throw new Error(response?.message || 'Failed to save settings');
      }
    } catch (error: any) {
      console.error('Error saving settings:', error);
      toast.error(error.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleWalkDurationToggle = (duration: string) => {
    setConfig(prev => ({
      ...prev,
      walk_durations: prev.walk_durations?.includes(duration)
        ? prev.walk_durations.filter(d => d !== duration)
        : [...(prev.walk_durations || []), duration],
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-[#FF8C42]" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">General Settings</h2>
            <p className="text-sm text-gray-600 mt-1">Configure your service settings and preferences</p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Service Radius */}
        <div>
          <Label htmlFor="service_radius" className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            Service Radius (km)
          </Label>
          <Input
            id="service_radius"
            type="number"
            value={config.service_radius || ''}
            onChange={(e) => setConfig({ ...config, service_radius: e.target.value ? parseFloat(e.target.value) : undefined })}
            placeholder="Enter service radius in kilometers"
            className={`mt-1 ${errors.service_radius ? 'border-red-500' : ''}`}
            min="0"
            step="0.1"
          />
          {errors.service_radius && (
            <p className="text-xs text-red-600 mt-1">{errors.service_radius}</p>
          )}
          <p className="text-xs text-gray-500 mt-1">
            Maximum distance you're willing to travel for service delivery
          </p>
        </div>

        {/* Emergency Contact */}
        <div className="border-t border-gray-200 pt-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Phone className="w-5 h-5" />
            Emergency Contact
          </h3>
          <div className="space-y-4">
            <div>
              <Label htmlFor="emergency_contact_name" className="text-sm font-semibold text-gray-700">
                Contact Name *
              </Label>
              <Input
                id="emergency_contact_name"
                value={config.emergency_contact?.name || ''}
                onChange={(e) => setConfig({
                  ...config,
                  emergency_contact: { ...config.emergency_contact!, name: e.target.value },
                })}
                placeholder="Enter emergency contact name"
                className={`mt-1 ${errors.emergency_contact_name ? 'border-red-500' : ''}`}
              />
              {errors.emergency_contact_name && (
                <p className="text-xs text-red-600 mt-1">{errors.emergency_contact_name}</p>
              )}
            </div>

            <div>
              <Label htmlFor="emergency_contact_phone" className="text-sm font-semibold text-gray-700">
                Contact Phone *
              </Label>
              <Input
                id="emergency_contact_phone"
                type="tel"
                value={config.emergency_contact?.phone || ''}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '').slice(0, 10);
                  setConfig({
                    ...config,
                    emergency_contact: { ...config.emergency_contact!, phone: value },
                  });
                }}
                placeholder="Enter 10-digit phone number"
                className={`mt-1 ${errors.emergency_contact_phone ? 'border-red-500' : ''}`}
                maxLength={10}
              />
              {errors.emergency_contact_phone && (
                <p className="text-xs text-red-600 mt-1">{errors.emergency_contact_phone}</p>
              )}
              <p className="text-xs text-gray-500 mt-1">
                Emergency contact for safety and support purposes
              </p>
            </div>
          </div>
        </div>

        {/* Refer Vendor Section */}
        <div className="border-t border-gray-200 pt-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-[#FF8C42]" />
            Refer Vendor
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            Refer other vendors and earn points when they get approved!
          </p>
          <Button
            onClick={() => setShowReferralModal(true)}
            className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white"
          >
            <UserPlus className="w-4 h-4 mr-2" />
            Refer Vendor & Earn Points
          </Button>
        </div>

        {/* Walker-Specific Settings */}
        {isWalker && (
          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <User className="w-5 h-5" />
              Walker Preferences
            </h3>
            <div className="space-y-4">
              <div>
                <Label htmlFor="max_dogs_per_walk" className="text-sm font-semibold text-gray-700">
                  Maximum Dogs Per Walk
                </Label>
                <Input
                  id="max_dogs_per_walk"
                  type="number"
                  value={config.max_dogs_per_walk || ''}
                  onChange={(e) => setConfig({ ...config, max_dogs_per_walk: e.target.value ? parseInt(e.target.value) : undefined })}
                  placeholder="Enter maximum number of dogs"
                  className={`mt-1 ${errors.max_dogs_per_walk ? 'border-red-500' : ''}`}
                  min="1"
                />
                {errors.max_dogs_per_walk && (
                  <p className="text-xs text-red-600 mt-1">{errors.max_dogs_per_walk}</p>
                )}
                <p className="text-xs text-gray-500 mt-1">
                  Maximum number of dogs you can walk simultaneously
                </p>
              </div>

              <div>
                <Label className="text-sm font-semibold text-gray-700 mb-2 block">
                  Walk Durations Offered
                </Label>
                <div className="flex flex-wrap gap-2">
                  {['15', '30', '45', '60', '90', '120'].map((duration) => (
                    <button
                      key={duration}
                      type="button"
                      onClick={() => handleWalkDurationToggle(duration)}
                      className={`px-4 py-2 rounded-lg border-2 transition-all ${
                        config.walk_durations?.includes(duration)
                          ? 'border-[#FF8C42] bg-orange-50 text-[#FF8C42] font-semibold'
                          : 'border-gray-200 text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      {duration} min
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Select all walk durations you offer
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Save Button */}
        <div className="border-t border-gray-200 pt-6">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-[#FF8C42] hover:bg-[#FF7A2E] text-white"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save Settings
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Referral Modal */}
      {vendorId && (
        <VendorReferralModal
          open={showReferralModal}
          onOpenChange={setShowReferralModal}
          vendorId={vendorId}
        />
      )}
    </div>
  );
}
