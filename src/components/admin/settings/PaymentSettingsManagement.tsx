import { useState, useEffect } from 'react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Switch } from '../../ui/switch';
import { ArrowLeft, Save, RotateCcw, CreditCard, Package } from 'lucide-react';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';
import { toast } from 'sonner@2.0.3';

interface PaymentSettings {
  reservationType: 'flat' | 'percentage' | 'full';
  reservationPercentage: number;
  flatAmount: number;
  minimumAdvancePayment: number;
  partialPaymentAllowed: boolean;
  escrowHoldPeriodHours: number;
  cancellationGracePeriodHours: number;
  autoCapturePayment: boolean;
  premiumBookingValue: number;
  travelDistanceLimitKm: number;
  travelSurchargePerKm: number;
  equipmentFee: number;
  selectedVendorPayment: string;
}

interface PaymentSettingsManagementProps {
  onBack: () => void;
}

export function PaymentSettingsManagement({ onBack }: PaymentSettingsManagementProps) {
  const [settings, setSettings] = useState<PaymentSettings>({
    reservationType: 'percentage',
    reservationPercentage: 20,
    flatAmount: 100,
    minimumAdvancePayment: 20,
    partialPaymentAllowed: true,
    escrowHoldPeriodHours: 24,
    cancellationGracePeriodHours: 4,
    autoCapturePayment: true,
    premiumBookingValue: 100,
    travelDistanceLimitKm: 0,
    travelSurchargePerKm: 12,
    equipmentFee: 50,
    selectedVendorPayment: 'grooming'
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadPaymentSettings();
  }, []);

  const loadPaymentSettings = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/vendor-settings`,
        {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.paymentSettings) {
          // Merge with defaults to ensure all fields are defined
          setSettings({
            reservationType: data.paymentSettings.reservationType ?? 'percentage',
            reservationPercentage: data.paymentSettings.reservationPercentage ?? 20,
            flatAmount: data.paymentSettings.flatAmount ?? 100,
            minimumAdvancePayment: data.paymentSettings.minimumAdvancePayment ?? 20,
            partialPaymentAllowed: data.paymentSettings.partialPaymentAllowed ?? true,
            escrowHoldPeriodHours: data.paymentSettings.escrowHoldPeriodHours ?? 24,
            cancellationGracePeriodHours: data.paymentSettings.cancellationGracePeriodHours ?? 4,
            autoCapturePayment: data.paymentSettings.autoCapturePayment ?? true,
            premiumBookingValue: data.paymentSettings.premiumBookingValue ?? 100,
            travelDistanceLimitKm: data.paymentSettings.travelDistanceLimitKm ?? 0,
            travelSurchargePerKm: data.paymentSettings.travelSurchargePerKm ?? 12,
            equipmentFee: data.paymentSettings.equipmentFee ?? 50,
            selectedVendorPayment: data.paymentSettings.selectedVendorPayment ?? 'grooming'
          });
        }
      }
    } catch (error) {
      console.error('Error loading payment settings:', error);
      toast.error('Failed to load payment settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/vendor-settings/payment`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`
          },
          body: JSON.stringify(settings)
        }
      );

      if (response.ok) {
        toast.success('Payment settings saved successfully!');
      } else {
        toast.error('Failed to save payment settings');
      }
    } catch (error) {
      console.error('Error saving payment settings:', error);
      toast.error('Error saving payment settings');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (confirm('Are you sure you want to reset to default settings?')) {
      setSettings({
        reservationType: 'percentage',
        reservationPercentage: 20,
        flatAmount: 100,
        minimumAdvancePayment: 20,
        partialPaymentAllowed: true,
        escrowHoldPeriodHours: 24,
        cancellationGracePeriodHours: 4,
        autoCapturePayment: true,
        premiumBookingValue: 100,
        travelDistanceLimitKm: 0,
        travelSurchargePerKm: 12,
        equipmentFee: 50,
        selectedVendorPayment: 'grooming'
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
      {/* Header with Edit Settings CTA */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b-2 border-gray-200">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Payment & Reservation Settings</h2>
            <p className="text-sm text-gray-500">Configure payment types, escrow, and service charges</p>
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
          <CreditCard className="w-5 h-5 text-[#FF8C42]" />
          <h3 className="font-semibold text-gray-900">Reservation & Payment Type</h3>
        </div>
        <div className="border border-gray-200 rounded-lg p-6">
          {/* Payment Type Selector */}
          <div className="grid grid-cols-3 gap-6 mb-6">
            <div 
              className={`text-center p-4 border-2 rounded-lg cursor-pointer transition-all ${
                settings.reservationType === 'flat' 
                  ? 'border-[#FF8C42] bg-orange-50 shadow-md' 
                  : 'border-gray-200 hover:border-[#FF8C42]'
              }`}
              onClick={() => setSettings({ ...settings, reservationType: 'flat' })}
            >
              <div className={`w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center font-bold text-lg ${
                settings.reservationType === 'flat' ? 'bg-[#FF8C42] text-white' : 'bg-gray-100 text-gray-600'
              }`}>
                ₹
              </div>
              <div className="font-medium text-gray-900">Flat Amount</div>
              <div className="text-xs text-gray-500 mt-1">Fixed amount per service</div>
            </div>
            <div 
              className={`text-center p-4 border-2 rounded-lg cursor-pointer transition-all ${
                settings.reservationType === 'percentage' 
                  ? 'border-[#FF8C42] bg-orange-50 shadow-md' 
                  : 'border-gray-200 hover:border-[#FF8C42]'
              }`}
              onClick={() => setSettings({ ...settings, reservationType: 'percentage' })}
            >
              <div className={`w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center font-bold text-lg ${
                settings.reservationType === 'percentage' ? 'bg-[#FF8C42] text-white' : 'bg-gray-100 text-gray-600'
              }`}>
                %
              </div>
              <div className="font-medium text-gray-900">Percentage</div>
              <div className="text-xs text-gray-500 mt-1">Percentage of total amount</div>
            </div>
            <div 
              className={`text-center p-4 border-2 rounded-lg cursor-pointer transition-all ${
                settings.reservationType === 'full' 
                  ? 'border-[#FF8C42] bg-orange-50 shadow-md' 
                  : 'border-gray-200 hover:border-[#FF8C42]'
              }`}
              onClick={() => setSettings({ ...settings, reservationType: 'full' })}
            >
              <div className={`w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center font-bold text-lg ${
                settings.reservationType === 'full' ? 'bg-[#FF8C42] text-white' : 'bg-gray-100 text-gray-600'
              }`}>
                100%
              </div>
              <div className="font-medium text-gray-900">Full Payment</div>
              <div className="text-xs text-gray-500 mt-1">100% upfront payment</div>
            </div>
          </div>

          {/* Conditional Fields based on Reservation Type */}
          <div className="bg-gradient-to-r from-orange-50 to-white border border-orange-200 rounded-lg p-5 mb-6">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full bg-[#FF8C42]"></div>
              <h4 className="font-semibold text-gray-900">
                {settings.reservationType === 'flat' && 'Flat Amount Configuration'}
                {settings.reservationType === 'percentage' && 'Percentage-Based Configuration'}
                {settings.reservationType === 'full' && 'Full Payment Configuration'}
              </h4>
            </div>
            
            {settings.reservationType === 'flat' && (
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <Label className="text-sm mb-2 font-medium">Flat Reservation Amount (₹)</Label>
                  <Input
                    type="number"
                    value={settings.flatAmount}
                    onChange={(e) => setSettings({ ...settings, flatAmount: parseFloat(e.target.value) || 0 })}
                    className="h-10 border-[#FF8C42] focus:ring-[#FF8C42]"
                    placeholder="e.g., 100"
                  />
                  <p className="text-xs text-gray-600 mt-1">Fixed amount to collect upfront for any service</p>
                </div>
                <div>
                  <Label className="text-sm mb-2 font-medium">Minimum Advance Payment (₹)</Label>
                  <Input
                    type="number"
                    value={settings.minimumAdvancePayment}
                    onChange={(e) => setSettings({ ...settings, minimumAdvancePayment: parseFloat(e.target.value) || 0 })}
                    className="h-10"
                    placeholder="e.g., 50"
                  />
                  <p className="text-xs text-gray-600 mt-1">Minimum amount required to confirm booking</p>
                </div>
              </div>
            )}

            {settings.reservationType === 'percentage' && (
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <Label className="text-sm mb-2 font-medium">Reservation Percentage (%)</Label>
                  <Input
                    type="number"
                    value={settings.reservationPercentage}
                    onChange={(e) => setSettings({ ...settings, reservationPercentage: parseFloat(e.target.value) || 0 })}
                    className="h-10 border-[#FF8C42] focus:ring-[#FF8C42]"
                    placeholder="e.g., 20"
                    min="0"
                    max="100"
                  />
                  <p className="text-xs text-gray-600 mt-1">Percentage of total service amount to collect upfront</p>
                </div>
                <div>
                  <Label className="text-sm mb-2 font-medium">Minimum Advance Payment (₹)</Label>
                  <Input
                    type="number"
                    value={settings.minimumAdvancePayment}
                    onChange={(e) => setSettings({ ...settings, minimumAdvancePayment: parseFloat(e.target.value) || 0 })}
                    className="h-10"
                    placeholder="e.g., 20"
                  />
                  <p className="text-xs text-gray-600 mt-1">Minimum amount even if percentage is lower</p>
                </div>
              </div>
            )}

            {settings.reservationType === 'full' && (
              <div className="space-y-4">
                <div className="bg-white rounded-lg p-4 border border-green-200">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                      <CreditCard className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900 mb-1">Full Payment Mode Active</h4>
                      <p className="text-sm text-gray-600">
                        Customers will pay 100% of the service cost upfront at the time of booking. 
                        No partial payments or advance percentage applies in this mode.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <Label className="text-sm mb-2 font-medium">Minimum Advance Payment (₹)</Label>
                    <Input
                      type="number"
                      value={settings.minimumAdvancePayment}
                      onChange={(e) => setSettings({ ...settings, minimumAdvancePayment: parseFloat(e.target.value) || 0 })}
                      className="h-10"
                      placeholder="Not applicable"
                      disabled
                    />
                    <p className="text-xs text-gray-600 mt-1">Not applicable for full payment mode</p>
                  </div>
                  <div>
                    <Label className="text-sm mb-2 font-medium">Payment Confirmation</Label>
                    <div className="h-10 flex items-center text-sm text-gray-700 bg-gray-50 px-3 rounded border">
                      Immediate full payment required
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Payment Behavior Summary */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-blue-900 mb-2">Current Payment Behavior</h4>
            <p className="text-sm text-blue-800">
              {settings.reservationType === 'flat' && (
                <>Customer will pay <span className="font-bold">₹{settings.flatAmount}</span> as reservation fee at booking. Remaining amount will be collected {settings.partialPaymentAllowed ? 'partially or at service completion' : 'at service completion'}.</>
              )}
              {settings.reservationType === 'percentage' && (
                <>Customer will pay <span className="font-bold">{settings.reservationPercentage}%</span> of total service cost (minimum ₹{settings.minimumAdvancePayment}) as advance. Remaining {100 - settings.reservationPercentage}% will be collected {settings.partialPaymentAllowed ? 'partially or at service completion' : 'at service completion'}.</>
              )}
              {settings.reservationType === 'full' && (
                <>Customer must pay <span className="font-bold">100% of the total service cost</span> upfront at the time of booking. No additional payment required later.</>
              )}
            </p>
          </div>
        </div>
      </div>

      <div className="mb-8">
        <h3 className="font-semibold text-gray-900 mb-4">Payment Processing & Escrow</h3>
        <div className="border border-gray-200 rounded-lg p-6">
          <div className="grid grid-cols-2 gap-6 mb-6">
            <div>
              <Label className="text-sm mb-2">Partial Payment Allowed</Label>
              <div className="flex items-center gap-3 h-10">
                <Switch
                  checked={settings.partialPaymentAllowed}
                  onCheckedChange={(checked) => setSettings({ ...settings, partialPaymentAllowed: checked })}
                />
                <span className="text-sm text-gray-600">
                  {settings.partialPaymentAllowed ? 'Customers can pay in parts' : 'Full payment required'}
                </span>
              </div>
            </div>
            <div>
              <Label className="text-sm mb-2">Auto-Capture Payment</Label>
              <div className="flex items-center gap-3 h-10">
                <Switch
                  checked={settings.autoCapturePayment}
                  onCheckedChange={(checked) => setSettings({ ...settings, autoCapturePayment: checked })}
                />
                <span className="text-sm text-gray-600">
                  {settings.autoCapturePayment ? 'Auto capture after service' : 'Manual capture required'}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <Label className="text-sm mb-2">Escrow Hold Period (hours)</Label>
              <Input
                type="number"
                value={settings.escrowHoldPeriodHours}
                onChange={(e) => setSettings({ ...settings, escrowHoldPeriodHours: parseFloat(e.target.value) })}
                className="h-10"
              />
              <p className="text-xs text-gray-500 mt-1">Time to hold payment before releasing to vendor</p>
            </div>
            <div>
              <Label className="text-sm mb-2">Cancellation Grace Period (hours)</Label>
              <Input
                type="number"
                value={settings.cancellationGracePeriodHours}
                onChange={(e) => setSettings({ ...settings, cancellationGracePeriodHours: parseFloat(e.target.value) })}
                className="h-10"
              />
              <p className="text-xs text-gray-500 mt-1">Free cancellation window</p>
            </div>
          </div>
        </div>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-4">
          <Package className="w-5 h-5 text-[#FF8C42]" />
          <h3 className="font-semibold text-gray-900">Service-Specific Charges</h3>
        </div>
        <div className="border border-gray-200 rounded-lg p-6">
          <div className="grid grid-cols-2 gap-6 mb-6">
            <div>
              <Label className="text-sm mb-2">Premium Booking Value (₹)</Label>
              <Input
                type="number"
                value={settings.premiumBookingValue}
                onChange={(e) => setSettings({ ...settings, premiumBookingValue: parseFloat(e.target.value) })}
                className="h-10"
              />
              <p className="text-xs text-gray-500 mt-1">Minimum amount for premium booking</p>
            </div>
            <div>
              <Label className="text-sm mb-2">Fixed Distance Limit (km)</Label>
              <Input
                type="number"
                value={settings.travelDistanceLimitKm}
                onChange={(e) => setSettings({ ...settings, travelDistanceLimitKm: parseFloat(e.target.value) })}
                className="h-10"
              />
              <p className="text-xs text-gray-500 mt-1">Free travel distance included</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <Label className="text-sm mb-2">Travel Surcharge (₹/km)</Label>
              <Input
                type="number"
                value={settings.travelSurchargePerKm}
                onChange={(e) => setSettings({ ...settings, travelSurchargePerKm: parseFloat(e.target.value) })}
                className="h-10"
              />
              <p className="text-xs text-gray-500 mt-1">Charge per km beyond limit</p>
            </div>
            <div>
              <Label className="text-sm mb-2">Equipment Fee (%)</Label>
              <Input
                type="number"
                value={settings.equipmentFee}
                onChange={(e) => setSettings({ ...settings, equipmentFee: parseFloat(e.target.value) })}
                className="h-10"
              />
              <p className="text-xs text-gray-500 mt-1">Equipment rental fee percentage</p>
            </div>
          </div>

          <div className="mt-6">
            <Label className="text-sm mb-2">Apply to Vendor Category</Label>
            <Select
              value={settings.selectedVendorPayment}
              onValueChange={(value) => setSettings({ ...settings, selectedVendorPayment: value })}
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
    </div>
  );
}