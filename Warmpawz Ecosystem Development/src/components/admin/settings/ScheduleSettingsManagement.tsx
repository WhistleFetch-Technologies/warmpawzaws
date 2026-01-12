import { useState, useEffect } from 'react';
import { ArrowLeft, Save, Clock, Calendar, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '../../ui/button';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';

interface ScheduleSettingsManagementProps {
  onBack: () => void;
}

export function ScheduleSettingsManagement({ onBack }: ScheduleSettingsManagementProps) {
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/schedule-settings`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const data = await response.json();
      if (data.success) {
        setSettings(data.settings);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      setSaveMessage({ type: 'error', message: 'Failed to load settings' });
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    try {
      setSaving(true);
      setSaveMessage(null);

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/schedule-settings`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(settings)
        }
      );

      const data = await response.json();
      if (data.success) {
        setSaveMessage({ type: 'success', message: 'Schedule settings saved successfully!' });
        setTimeout(() => setSaveMessage(null), 3000);
      } else {
        setSaveMessage({ type: 'error', message: data.error || 'Failed to save settings' });
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      setSaveMessage({ type: 'error', message: 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  };

  const updateBufferTime = (serviceStyle: string, value: number) => {
    setSettings({
      ...settings,
      bufferTime: {
        ...settings.bufferTime,
        [serviceStyle]: value
      }
    });
  };

  const updateVendorBufferTime = (vendorType: string, serviceStyle: string, value: number) => {
    setSettings({
      ...settings,
      vendorBufferTime: {
        ...settings.vendorBufferTime,
        [vendorType]: {
          ...(settings.vendorBufferTime[vendorType] || {}),
          [serviceStyle]: value
        }
      }
    });
  };

  const updateGlobalSetting = (key: string, value: any) => {
    setSettings({
      ...settings,
      [key]: value
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#FF8C42] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading schedule settings...</p>
        </div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <p className="text-gray-600">Failed to load settings</p>
          <Button onClick={loadSettings} className="mt-4">Retry</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            className="mb-4"
            onClick={onBack}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Payment & Refund
          </Button>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <Clock className="w-6 h-6 text-[#FF8C42]" />
                  <h1 className="text-2xl font-semibold text-gray-900">Schedule Management Settings</h1>
                </div>
                <p className="text-sm text-gray-600">
                  Configure buffer times, booking windows, and schedule rules for all service types and vendor categories.
                  These settings apply universally across the customer app, vendor app, and admin portal.
                </p>
              </div>
              <Button
                onClick={saveSettings}
                disabled={saving}
                className="bg-[#FF8C42] hover:bg-[#ff7a28] text-white"
              >
                {saving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
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

            {saveMessage && (
              <div className={`mt-4 p-4 rounded-lg flex items-center gap-3 ${
                saveMessage.type === 'success' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
              }`}>
                {saveMessage.type === 'success' ? (
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-600" />
                )}
                <span className={saveMessage.type === 'success' ? 'text-green-800' : 'text-red-800'}>
                  {saveMessage.message}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Global Buffer Times */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <Clock className="w-5 h-5 text-[#FF8C42]" />
            <h2 className="text-xl font-semibold text-gray-900">Global Buffer Times</h2>
          </div>
          <p className="text-sm text-gray-600 mb-6">
            Buffer time is the minimum time before an appointment can be booked (to prevent booking appointments in the immediate past or too soon).
          </p>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                At Center Appointments
                <span className="text-gray-500 font-normal ml-2">(Clinic/Salon/Center visits)</span>
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="0"
                  value={settings.bufferTime.at_center}
                  onChange={(e) => updateBufferTime('at_center', parseInt(e.target.value))}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF8C42] focus:border-transparent"
                />
                <span className="text-sm text-gray-600">minutes</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">Recommended: 30 minutes</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                At Home Services
                <span className="text-gray-500 font-normal ml-2">(Home visits/Travel services)</span>
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="0"
                  value={settings.bufferTime.at_home}
                  onChange={(e) => updateBufferTime('at_home', parseInt(e.target.value))}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF8C42] focus:border-transparent"
                />
                <span className="text-sm text-gray-600">minutes</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">Recommended: 120 minutes (2 hours for travel preparation)</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Teleconsultation
                <span className="text-gray-500 font-normal ml-2">(Video/Phone consultations)</span>
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="0"
                  value={settings.bufferTime.tele}
                  onChange={(e) => updateBufferTime('tele', parseInt(e.target.value))}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF8C42] focus:border-transparent"
                />
                <span className="text-sm text-gray-600">minutes</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">Recommended: 15 minutes</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Instant Video Calls
                <span className="text-gray-500 font-normal ml-2">(Immediate consultation)</span>
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="0"
                  value={settings.bufferTime.instant_video}
                  onChange={(e) => updateBufferTime('instant_video', parseInt(e.target.value))}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF8C42] focus:border-transparent"
                />
                <span className="text-sm text-gray-600">minutes</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">Recommended: 5 minutes</p>
            </div>
          </div>
        </div>

        {/* Vendor-Specific Buffer Times */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <Calendar className="w-5 h-5 text-[#FF8C42]" />
            <h2 className="text-xl font-semibold text-gray-900">Vendor-Specific Buffer Times</h2>
          </div>
          <p className="text-sm text-gray-600 mb-6">
            Override global buffer times for specific vendor types. Leave blank to use global defaults.
          </p>

          <div className="space-y-6">
            {/* Veterinarian */}
            <div className="border-b border-gray-200 pb-6">
              <h3 className="font-medium text-gray-900 mb-4">Veterinarian / Vet Clinic</h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-gray-700 mb-2">At Center</label>
                  <input
                    type="number"
                    min="0"
                    value={settings.vendorBufferTime.veterinarian?.at_center || ''}
                    onChange={(e) => updateVendorBufferTime('veterinarian', 'at_center', parseInt(e.target.value))}
                    placeholder={`${settings.bufferTime.at_center} (default)`}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF8C42] focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-2">At Home</label>
                  <input
                    type="number"
                    min="0"
                    value={settings.vendorBufferTime.veterinarian?.at_home || ''}
                    onChange={(e) => updateVendorBufferTime('veterinarian', 'at_home', parseInt(e.target.value))}
                    placeholder={`${settings.bufferTime.at_home} (default)`}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF8C42] focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-2">Tele</label>
                  <input
                    type="number"
                    min="0"
                    value={settings.vendorBufferTime.veterinarian?.tele || ''}
                    onChange={(e) => updateVendorBufferTime('veterinarian', 'tele', parseInt(e.target.value))}
                    placeholder={`${settings.bufferTime.tele} (default)`}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF8C42] focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            {/* Groomer */}
            <div className="border-b border-gray-200 pb-6">
              <h3 className="font-medium text-gray-900 mb-4">Pet Groomer</h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-gray-700 mb-2">At Center</label>
                  <input
                    type="number"
                    min="0"
                    value={settings.vendorBufferTime.groomer?.at_center || ''}
                    onChange={(e) => updateVendorBufferTime('groomer', 'at_center', parseInt(e.target.value))}
                    placeholder={`${settings.bufferTime.at_center} (default)`}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF8C42] focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-2">At Home</label>
                  <input
                    type="number"
                    min="0"
                    value={settings.vendorBufferTime.groomer?.at_home || ''}
                    onChange={(e) => updateVendorBufferTime('groomer', 'at_home', parseInt(e.target.value))}
                    placeholder={`${settings.bufferTime.at_home} (default)`}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF8C42] focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-2">Tele</label>
                  <input
                    type="number"
                    min="0"
                    value={settings.vendorBufferTime.groomer?.tele || ''}
                    onChange={(e) => updateVendorBufferTime('groomer', 'tele', parseInt(e.target.value))}
                    placeholder={`${settings.bufferTime.tele} (default)`}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF8C42] focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            {/* Trainer */}
            <div className="border-b border-gray-200 pb-6">
              <h3 className="font-medium text-gray-900 mb-4">Pet Trainer</h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-gray-700 mb-2">At Center</label>
                  <input
                    type="number"
                    min="0"
                    value={settings.vendorBufferTime.pet_trainer?.at_center || ''}
                    onChange={(e) => updateVendorBufferTime('pet_trainer', 'at_center', parseInt(e.target.value))}
                    placeholder={`${settings.bufferTime.at_center} (default)`}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF8C42] focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-2">At Home</label>
                  <input
                    type="number"
                    min="0"
                    value={settings.vendorBufferTime.pet_trainer?.at_home || ''}
                    onChange={(e) => updateVendorBufferTime('pet_trainer', 'at_home', parseInt(e.target.value))}
                    placeholder={`${settings.bufferTime.at_home} (default)`}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF8C42] focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-2">Tele</label>
                  <input
                    type="number"
                    min="0"
                    value={settings.vendorBufferTime.pet_trainer?.tele || ''}
                    onChange={(e) => updateVendorBufferTime('pet_trainer', 'tele', parseInt(e.target.value))}
                    placeholder={`${settings.bufferTime.tele} (default)`}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF8C42] focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            {/* Dog Walker */}
            <div className="border-b border-gray-200 pb-6">
              <h3 className="font-medium text-gray-900 mb-4">Dog Walker</h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-gray-700 mb-2">At Home (Primary)</label>
                  <input
                    type="number"
                    min="0"
                    value={settings.vendorBufferTime.dog_walker?.at_home || ''}
                    onChange={(e) => updateVendorBufferTime('dog_walker', 'at_home', parseInt(e.target.value))}
                    placeholder={`${settings.bufferTime.at_home} (default)`}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF8C42] focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 mt-1">Recommended: 60 minutes</p>
                </div>
              </div>
            </div>

            {/* Pet Behaviourist */}
            <div className="border-b border-gray-200 pb-6">
              <h3 className="font-medium text-gray-900 mb-4">Pet Behaviourist</h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-gray-700 mb-2">At Center</label>
                  <input
                    type="number"
                    min="0"
                    value={settings.vendorBufferTime.pet_behaviourist?.at_center || ''}
                    onChange={(e) => updateVendorBufferTime('pet_behaviourist', 'at_center', parseInt(e.target.value))}
                    placeholder={`${settings.bufferTime.at_center} (default)`}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF8C42] focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-2">At Home</label>
                  <input
                    type="number"
                    min="0"
                    value={settings.vendorBufferTime.pet_behaviourist?.at_home || ''}
                    onChange={(e) => updateVendorBufferTime('pet_behaviourist', 'at_home', parseInt(e.target.value))}
                    placeholder={`${settings.bufferTime.at_home} (default)`}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF8C42] focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-2">Tele</label>
                  <input
                    type="number"
                    min="0"
                    value={settings.vendorBufferTime.pet_behaviourist?.tele || ''}
                    onChange={(e) => updateVendorBufferTime('pet_behaviourist', 'tele', parseInt(e.target.value))}
                    placeholder={`${settings.bufferTime.tele} (default)`}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF8C42] focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            {/* Pet Sitter */}
            <div className="border-b border-gray-200 pb-6">
              <h3 className="font-medium text-gray-900 mb-4">Pet Sitter</h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-gray-700 mb-2">At Home (Primary)</label>
                  <input
                    type="number"
                    min="0"
                    value={settings.vendorBufferTime.pet_sitter?.at_home || ''}
                    onChange={(e) => updateVendorBufferTime('pet_sitter', 'at_home', parseInt(e.target.value))}
                    placeholder={`${settings.bufferTime.at_home} (default)`}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF8C42] focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 mt-1">Recommended: 180 minutes (3 hours)</p>
                </div>
              </div>
            </div>

            {/* Pet Boarding */}
            <div>
              <h3 className="font-medium text-gray-900 mb-4">Pet Boarding</h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-gray-700 mb-2">At Center (Primary)</label>
                  <input
                    type="number"
                    min="0"
                    value={settings.vendorBufferTime.pet_boarding?.at_center || ''}
                    onChange={(e) => updateVendorBufferTime('pet_boarding', 'at_center', parseInt(e.target.value))}
                    placeholder={`${settings.bufferTime.at_center} (default)`}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF8C42] focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 mt-1">Recommended: 240 minutes (4 hours)</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* General Booking Settings */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <Calendar className="w-5 h-5 text-[#FF8C42]" />
            <h2 className="text-xl font-semibold text-gray-900">General Booking Settings</h2>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Maximum Days Ahead for Booking
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={settings.maxDaysAhead}
                  onChange={(e) => updateGlobalSetting('maxDaysAhead', parseInt(e.target.value))}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF8C42] focus:border-transparent"
                />
                <span className="text-sm text-gray-600">days</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">How far in advance customers can book appointments</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Minimum Slot Duration
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="15"
                  step="15"
                  value={settings.minSlotDuration}
                  onChange={(e) => updateGlobalSetting('minSlotDuration', parseInt(e.target.value))}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF8C42] focus:border-transparent"
                />
                <span className="text-sm text-gray-600">minutes</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">Minimum duration for any appointment slot</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Slot Interval
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="15"
                  step="15"
                  value={settings.slotInterval}
                  onChange={(e) => updateGlobalSetting('slotInterval', parseInt(e.target.value))}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF8C42] focus:border-transparent"
                />
                <span className="text-sm text-gray-600">minutes</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">Time interval between consecutive appointment slots</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Travel Time Between Locations
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="0"
                  value={settings.travelTimeBetweenLocations}
                  onChange={(e) => updateGlobalSetting('travelTimeBetweenLocations', parseInt(e.target.value))}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF8C42] focus:border-transparent"
                />
                <span className="text-sm text-gray-600">minutes</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">Buffer time when staff moves between different locations</p>
            </div>
          </div>
        </div>

        {/* Info Banner */}
        <div className="mt-6 bg-gradient-to-r from-orange-50 to-white border border-orange-200 rounded-lg p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-[#FF8C42] flex items-center justify-center flex-shrink-0">
              <AlertCircle className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-gray-900 mb-2">How These Settings Work</h4>
              <div className="text-sm text-gray-600 space-y-2">
                <p>
                  <strong>Buffer Times:</strong> Prevent booking appointments in the past or too soon. For example, with a 30-minute buffer, customers cannot book appointments starting within the next 30 minutes.
                </p>
                <p>
                  <strong>Service Style Priority:</strong> The system automatically uses vendor-specific buffer times if configured, otherwise falls back to global defaults.
                </p>
                <p>
                  <strong>Schedule Filtering:</strong> All appointment searches automatically filter out: past time slots, slots within buffer time, already booked slots, break times, holidays, and location conflicts for multi-location staff.
                </p>
                <p>
                  <strong>Universal Application:</strong> These settings apply across all apps (Customer, Vendor, Admin) and all vendor types (Vet, Groomer, Trainer, Walker, etc.) dynamically.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
