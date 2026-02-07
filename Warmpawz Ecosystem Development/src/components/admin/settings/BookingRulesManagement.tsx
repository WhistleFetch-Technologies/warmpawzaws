import { useState, useEffect } from 'react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Switch } from '../../ui/switch';
import { ArrowLeft, Save, RotateCcw, Clock, Package, AlertCircle } from 'lucide-react';
import { getApiBaseUrl, getAuthHeaders } from '../../../utils/api-config';
import { toast } from 'sonner@2.0.3';

interface BookingSettings {
  advanceBookingWindowDays: number;
  bufferMinutesBetweenBookings: number;
  minimumBookingCount: number;
  maximumBookingValue: number;
  lastMinuteWindowHours: number;
  lastMinuteSurchargePercent: number;
  lastMinuteCancellationFee: number;
  maximumBookingPerSlot: number;
  allowOverbooking: boolean;
  selectedVendor: string;
}

interface BookingRulesManagementProps {
  onBack: () => void;
}

export function BookingRulesManagement({ onBack }: BookingRulesManagementProps) {
  const [settings, setSettings] = useState<BookingSettings>({
    advanceBookingWindowDays: 30,
    bufferMinutesBetweenBookings: 45,
    minimumBookingCount: 120,
    maximumBookingValue: 10000,
    lastMinuteWindowHours: 1,
    lastMinuteSurchargePercent: 20,
    lastMinuteCancellationFee: 120,
    maximumBookingPerSlot: 1,
    allowOverbooking: false,
    selectedVendor: 'grooming'
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadBookingSettings();
  }, []);

  const loadBookingSettings = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `${getApiBaseUrl()}/admin/vendor-settings`,
        {
          headers: getAuthHeaders()
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.bookingSettings) {
          setSettings(data.bookingSettings);
        }
      }
    } catch (error) {
      console.error('Error loading booking settings:', error);
      toast.error('Failed to load booking settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch(
        `${getApiBaseUrl()}/admin/vendor-settings/booking`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders()
          },
          body: JSON.stringify(settings)
        }
      );

      if (response.ok) {
        toast.success('Booking settings saved successfully!');
      } else {
        toast.error('Failed to save booking settings');
      }
    } catch (error) {
      console.error('Error saving booking settings:', error);
      toast.error('Error saving booking settings');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (confirm('Are you sure you want to reset to default settings?')) {
      setSettings({
        advanceBookingWindowDays: 30,
        bufferMinutesBetweenBookings: 45,
        minimumBookingCount: 120,
        maximumBookingValue: 10000,
        lastMinuteWindowHours: 1,
        lastMinuteSurchargePercent: 20,
        lastMinuteCancellationFee: 120,
        maximumBookingPerSlot: 1,
        allowOverbooking: false,
        selectedVendor: 'grooming'
      });
      toast.success('Settings reset to defaults');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42]"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      {/* Header with Save CTA */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b-2 border-gray-200">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Booking Rules Management</h2>
            <p className="text-sm text-gray-500">Configure booking windows, buffers, and capacity rules</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={handleReset}>
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset to Default
          </Button>
          <Button 
            size="default" 
            onClick={handleSave} 
            disabled={saving} 
            className="bg-green-600 hover:bg-green-700 text-white font-semibold px-6 shadow-lg"
          >
            <Save className="w-5 h-5 mr-2" />
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </div>

      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-5 h-5 text-[#FF8C42]" />
          <h3 className="font-semibold text-gray-900">Advance Booking Settings</h3>
        </div>
        <div className="border border-gray-200 rounded-lg p-6">
          <p className="text-sm text-gray-600 mb-6">Configure how far in advance customers can book and minimum buffer times</p>
          
          <div className="grid grid-cols-2 gap-6 mb-6">
            <div>
              <Label className="text-sm mb-2">Advance Booking Window (days)</Label>
              <Input
                type="number"
                value={settings.advanceBookingWindowDays}
                onChange={(e) => setSettings({ ...settings, advanceBookingWindowDays: parseFloat(e.target.value) })}
                className="h-10"
              />
              <p className="text-xs text-gray-500 mt-1">Maximum days ahead customers can book</p>
            </div>
            <div>
              <Label className="text-sm mb-2">Buffer Between Bookings (minutes)</Label>
              <Input
                type="number"
                value={settings.bufferMinutesBetweenBookings}
                onChange={(e) => setSettings({ ...settings, bufferMinutesBetweenBookings: parseFloat(e.target.value) })}
                className="h-10"
              />
              <p className="text-xs text-gray-500 mt-1">Time gap between consecutive appointments</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <Label className="text-sm mb-2">Minimum Booking Count</Label>
              <Input
                type="number"
                value={settings.minimumBookingCount}
                onChange={(e) => setSettings({ ...settings, minimumBookingCount: parseFloat(e.target.value) })}
                className="h-10"
              />
              <p className="text-xs text-gray-500 mt-1">Minimum booking count requirement</p>
            </div>
            <div>
              <Label className="text-sm mb-2">Maximum Booking Value (₹)</Label>
              <Input
                type="number"
                value={settings.maximumBookingValue}
                onChange={(e) => setSettings({ ...settings, maximumBookingValue: parseFloat(e.target.value) })}
                className="h-10"
              />
              <p className="text-xs text-gray-500 mt-1">Maximum value allowed per booking</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <AlertCircle className="w-5 h-5 text-[#FF8C42]" />
          <h3 className="font-semibold text-gray-900">Last-Minute Booking</h3>
        </div>
        <div className="border border-gray-200 rounded-lg p-6">
          <p className="text-sm text-gray-600 mb-6">Configure pricing and rules for bookings made close to service time</p>
          
          <div className="grid grid-cols-3 gap-6 mb-6">
            <div>
              <Label className="text-sm mb-2">Last Minute Window (hours)</Label>
              <Input
                type="number"
                value={settings.lastMinuteWindowHours}
                onChange={(e) => setSettings({ ...settings, lastMinuteWindowHours: parseFloat(e.target.value) })}
                className="h-10"
              />
              <p className="text-xs text-gray-500 mt-1">Consider last-minute if within this window</p>
            </div>
            <div>
              <Label className="text-sm mb-2">Last Minute Surcharge (%)</Label>
              <Input
                type="number"
                value={settings.lastMinuteSurchargePercent}
                onChange={(e) => setSettings({ ...settings, lastMinuteSurchargePercent: parseFloat(e.target.value) })}
                className="h-10"
              />
              <p className="text-xs text-gray-500 mt-1">Extra charge for last-minute bookings</p>
            </div>
            <div>
              <Label className="text-sm mb-2">Last Minute Cancellation Fee (₹)</Label>
              <Input
                type="number"
                value={settings.lastMinuteCancellationFee}
                onChange={(e) => setSettings({ ...settings, lastMinuteCancellationFee: parseFloat(e.target.value) })}
                className="h-10"
              />
              <p className="text-xs text-gray-500 mt-1">Fee if cancelled at last minute</p>
            </div>
          </div>

          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-medium text-orange-900 mb-1">Last-Minute Pricing Example</h4>
                <p className="text-xs text-orange-700">
                  If a customer books within {settings.lastMinuteWindowHours} hour(s) of the service, they will be charged an additional {settings.lastMinuteSurchargePercent}% surcharge. If they cancel, a fee of ₹{settings.lastMinuteCancellationFee} will be applied.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-4">
          <Package className="w-5 h-5 text-[#FF8C42]" />
          <h3 className="font-semibold text-gray-900">Slot Capacity Settings</h3>
        </div>
        <div className="border border-gray-200 rounded-lg p-6">
          <p className="text-sm text-gray-600 mb-6">Manage how many bookings can be accepted per time slot</p>
          
          <div className="grid grid-cols-2 gap-6 mb-6">
            <div>
              <Label className="text-sm mb-2">Maximum Bookings Per Slot</Label>
              <Input
                type="number"
                value={settings.maximumBookingPerSlot}
                onChange={(e) => setSettings({ ...settings, maximumBookingPerSlot: parseFloat(e.target.value) })}
                className="h-10"
              />
              <p className="text-xs text-gray-500 mt-1">How many bookings can be accepted per time slot</p>
            </div>
            <div>
              <Label className="text-sm mb-2">Allow Overbooking</Label>
              <div className="flex items-center gap-3 h-10">
                <Switch
                  checked={settings.allowOverbooking}
                  onCheckedChange={(checked) => setSettings({ ...settings, allowOverbooking: checked })}
                />
                <span className="text-sm text-gray-600">
                  {settings.allowOverbooking ? 'Accept more than capacity' : 'Strict capacity limit'}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {settings.allowOverbooking 
                  ? 'Vendors can accept bookings beyond slot capacity' 
                  : 'Bookings are blocked when slot is full'}
              </p>
            </div>
          </div>

          <div>
            <Label className="text-sm mb-2">Apply to Vendor Category</Label>
            <Select
              value={settings.selectedVendor}
              onValueChange={(value) => setSettings({ ...settings, selectedVendor: value })}
            >
              <SelectTrigger className="h-10 max-w-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="grooming">Grooming Services</SelectItem>
                <SelectItem value="veterinary">Veterinary Services</SelectItem>
                <SelectItem value="walker">Dog Walker</SelectItem>
                <SelectItem value="boarding">Pet Boarding</SelectItem>
                <SelectItem value="training">Pet Training</SelectItem>
                <SelectItem value="all">All Services</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="mt-8 bg-gradient-to-r from-orange-50 to-white border border-orange-200 rounded-lg p-6">
        <h4 className="font-semibold text-gray-900 mb-4">Current Configuration Summary</h4>
        <div className="grid grid-cols-3 gap-6 text-sm">
          <div>
            <div className="text-gray-500 mb-1">Booking Window</div>
            <div className="font-medium text-gray-900">{settings.advanceBookingWindowDays} days in advance</div>
          </div>
          <div>
            <div className="text-gray-500 mb-1">Buffer Time</div>
            <div className="font-medium text-gray-900">{settings.bufferMinutesBetweenBookings} minutes</div>
          </div>
          <div>
            <div className="text-gray-500 mb-1">Slot Capacity</div>
            <div className="font-medium text-gray-900">{settings.maximumBookingPerSlot} booking(s) per slot</div>
          </div>
          <div>
            <div className="text-gray-500 mb-1">Last-Minute Window</div>
            <div className="font-medium text-gray-900">{settings.lastMinuteWindowHours} hour(s)</div>
          </div>
          <div>
            <div className="text-gray-500 mb-1">Last-Minute Surcharge</div>
            <div className="font-medium text-gray-900">{settings.lastMinuteSurchargePercent}% extra</div>
          </div>
          <div>
            <div className="text-gray-500 mb-1">Overbooking</div>
            <div className="font-medium text-gray-900">{settings.allowOverbooking ? 'Allowed' : 'Not Allowed'}</div>
          </div>
        </div>
      </div>
    </div>
  );
}