'use client';

import { useState, useCallback, useEffect, forwardRef, useImperativeHandle } from 'react';
import {
  User,
  Store,
  CreditCard,
  Bell,
  Shield,
  MapPin,
  Phone,
  Mail,
  Building,
  Eye,
  EyeOff,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import {
  EnhancedAddressAutocomplete,
  type AddressComponents,
} from '@/components/shared/EnhancedAddressAutocomplete';
import { UseCurrentLocationButton } from '@/components/shared/UseCurrentLocationButton';
import type { VendorAddressFromGeolocationResult } from '@/lib/address-from-geolocation';
import { SellerSecuritySection } from './SellerSecuritySection';

export type SellerSettingsFormData = {
  business_name: string;
  contact_name: string;
  email: string;
  phone: string;
  gstin: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  latitude: number | undefined;
  longitude: number | undefined;
  bank_name: string;
  account_number: string;
  ifsc_code: string;
  upi_id: string;
};

function mapVendorToFormData(
  v: Record<string, unknown> | null | undefined,
  bank?: Record<string, unknown> | null,
  upi?: Record<string, unknown> | null
): SellerSettingsFormData {
  const bankDetails = bank ?? {};
  const upiData = upi ?? {};
  return {
    business_name: String(v?.business_name || v?.businessName || ''),
    contact_name: String(
      v?.owner_name || v?.ownerName || v?.full_name || v?.fullName || v?.contact_person || ''
    ),
    email: String(v?.email || ''),
    phone: String(v?.phone || ''),
    gstin: String(v?.gst_number || v?.gstin || ''),
    address: String(v?.address || ''),
    city: String(v?.city || ''),
    state: String(v?.state || ''),
    pincode: String(v?.pincode || ''),
    latitude: v?.latitude != null ? Number(v.latitude) : undefined,
    longitude: v?.longitude != null ? Number(v.longitude) : undefined,
    bank_name: String(bankDetails.bank_name || bankDetails.bankName || v?.bank_name || ''),
    account_number: String(
      bankDetails.account_number || bankDetails.accountNumber || v?.account_number || ''
    ),
    ifsc_code: String(bankDetails.ifsc_code || bankDetails.ifscCode || v?.ifsc_code || ''),
    upi_id: String(
      upiData.upi_id || upiData.upiId || v?.upi_id || v?.upiId || ''
    ),
  };
}

export type SellerSettingsHandle = {
  save: () => Promise<void>;
  isSaving: () => boolean;
};

interface SellerSettingsProps {
  sellerId: string;
  sellerData: any;
  onSavingChange?: (saving: boolean) => void;
}

export const SellerSettings = forwardRef<SellerSettingsHandle, SellerSettingsProps>(
  function SellerSettings({ sellerId, sellerData, onSavingChange }, ref) {
  const [activeTab, setActiveTab] = useState('profile');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<SellerSettingsFormData>(() =>
    mapVendorToFormData(sellerData)
  );
  const [showAccountNumber, setShowAccountNumber] = useState(false);

  const tabs = [
    { id: 'profile', label: 'Business Profile', icon: Store },
    { id: 'payment', label: 'Payment Settings', icon: CreditCard },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'security', label: 'Security', icon: Shield },
  ];

  const loadSettings = useCallback(async () => {
    if (!sellerId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const [profileRes, bankRes, upiRes] = await Promise.all([
        apiClient.get<any>(`/vendor/${sellerId}/profile`).catch(() => null),
        apiClient.get<any>(`/vendor/${sellerId}/bank-details`).catch(() => null),
        apiClient.get<any>(`/vendor/${sellerId}/upi`).catch(() => null),
      ]);

      const vendor = profileRes?.success ? profileRes.vendor : sellerData;
      const bankDetails = bankRes?.success ? bankRes.bankDetails : null;
      const upi = upiRes?.success ? upiRes.upi : null;

      if (vendor) {
        const mapped = mapVendorToFormData(vendor, bankDetails, upi);
        // #region agent log
        fetch('http://127.0.0.1:7507/ingest/bc4efe81-37d4-4685-8941-a5e34dbd571c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'7935b4'},body:JSON.stringify({sessionId:'7935b4',location:'SellerSettings.tsx:loadSettings',message:'profile loaded',data:{profileSuccess:!!profileRes?.success,rawGstNumber:vendor?.gst_number??null,rawGstin:vendor?.gstin??null,mappedGstinLen:mapped.gstin.length},timestamp:Date.now(),hypothesisId:'C-D'})}).catch(()=>{});
        // #endregion
        setFormData(mapped);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  }, [sellerId, sellerData]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const syncLocalStorage = useCallback((data: SellerSettingsFormData) => {
    try {
      const current = JSON.parse(localStorage.getItem('vendorData') || '{}');
      localStorage.setItem(
        'vendorData',
        JSON.stringify({
          ...current,
          business_name: data.business_name,
          businessName: data.business_name,
          owner_name: data.contact_name,
          ownerName: data.contact_name,
          email: data.email,
          phone: data.phone,
          gst_number: data.gstin,
          gstin: data.gstin,
          address: data.address,
          city: data.city,
          state: data.state,
          pincode: data.pincode,
          latitude: data.latitude,
          longitude: data.longitude,
          upi_id: data.upi_id,
        })
      );
    } catch {
      // non-fatal
    }
  }, []);

  const handleSave = useCallback(async () => {
    if (!sellerId || saving) return;

    setSaving(true);
    onSavingChange?.(true);
    try {
      const gstPayload = formData.gstin.trim() || undefined;
      // #region agent log
      fetch('http://127.0.0.1:7507/ingest/bc4efe81-37d4-4685-8941-a5e34dbd571c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'7935b4'},body:JSON.stringify({sessionId:'7935b4',location:'SellerSettings.tsx:handleSave:pre',message:'save payload gst',data:{formGstinLen:formData.gstin.length,gstPayloadSent:!!gstPayload,gstPayloadLen:gstPayload?.length??0},timestamp:Date.now(),hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      const profileRes = await apiClient.put<any>(`/vendor/${sellerId}/profile`, {
        businessName: formData.business_name,
        ownerName: formData.contact_name,
        email: formData.email,
        phone: formData.phone,
        address: formData.address,
        city: formData.city,
        state: formData.state,
        pincode: formData.pincode,
        gstNumber: gstPayload,
        ...(gstPayload && { gst_number: gstPayload }),
        ...(formData.latitude != null && { latitude: formData.latitude }),
        ...(formData.longitude != null && { longitude: formData.longitude }),
      });
      // #region agent log
      const respGst = profileRes?.vendor?.gst_number ?? profileRes?.vendor?.gstin ?? null;
      fetch('http://127.0.0.1:7507/ingest/bc4efe81-37d4-4685-8941-a5e34dbd571c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'7935b4'},body:JSON.stringify({sessionId:'7935b4',location:'SellerSettings.tsx:handleSave:post',message:'save response gst',data:{success:profileRes?.success??null,respGstNumber:profileRes?.vendor?.gst_number??null,respGstin:profileRes?.vendor?.gstin??null,changedFields:profileRes?.changedFields??null},timestamp:Date.now(),hypothesisId:'B',runId:'post-fix'})}).catch(()=>{});
      // #endregion

      if (gstPayload && !respGst) {
        toast.warning(
          'GSTIN could not be saved. Deploy the latest API to dev (./scripts/deploy-lambda-direct.sh), then try again.'
        );
      }

      if (profileRes && profileRes.success === false) {
        throw new Error(profileRes.error || 'Failed to save profile');
      }

      const hasBankFields =
        formData.account_number.trim() &&
        formData.ifsc_code.trim() &&
        !formData.account_number.startsWith('****');

      if (hasBankFields) {
        const accountHolderName =
          formData.contact_name.trim() || formData.business_name.trim() || 'Account Holder';
        await apiClient.put(`/vendor/${sellerId}/bank-details`, {
          account_number: formData.account_number,
          ifsc_code: formData.ifsc_code,
          bank_name: formData.bank_name,
          account_holder_name: accountHolderName,
        });
      }

      if (formData.upi_id.trim() && formData.upi_id.includes('@')) {
        try {
          await apiClient.post(`/vendor/${sellerId}/upi`, { upi_id: formData.upi_id.trim() });
        } catch (upiError: any) {
          const msg = upiError?.message || 'Failed to save UPI ID';
          toast.error(msg);
        }
      }

      syncLocalStorage(formData);
      await loadSettings();
      toast.success('Changes saved');
    } catch (error: any) {
      console.error('Error saving settings:', error);
      toast.error(error?.message || 'Failed to save settings');
      throw error;
    } finally {
      setSaving(false);
      onSavingChange?.(false);
    }
  }, [sellerId, formData, saving, onSavingChange, syncLocalStorage, loadSettings]);

  useImperativeHandle(
    ref,
    () => ({
      save: handleSave,
      isSaving: () => saving,
    }),
    [handleSave, saving]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200 pb-4 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium whitespace-nowrap transition-all ${
              activeTab === tab.id
                ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm space-y-6">
          <div className="flex items-center gap-4 pb-6 border-b border-slate-100">
            <div className="w-20 h-20 bg-gradient-to-br from-orange-500 to-amber-500 rounded-2xl flex items-center justify-center shadow-lg">
              <Store className="w-10 h-10 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900">{formData.business_name || 'Your Store'}</h3>
              <p className="text-slate-500">Seller ID: {sellerId?.slice(0, 8)}...</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                <Store className="w-4 h-4 inline mr-2" />
                Business Name *
              </label>
              <input
                value={formData.business_name}
                onChange={(e) => setFormData({ ...formData, business_name: e.target.value })}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                <User className="w-4 h-4 inline mr-2" />
                Contact Person *
              </label>
              <input
                value={formData.contact_name}
                onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                <Mail className="w-4 h-4 inline mr-2" />
                Email Address *
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                <Phone className="w-4 h-4 inline mr-2" />
                Phone Number *
              </label>
              <input
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                <Building className="w-4 h-4 inline mr-2" />
                GSTIN
              </label>
              <input
                value={formData.gstin}
                onChange={(e) => setFormData({ ...formData, gstin: e.target.value.toUpperCase() })}
                placeholder="e.g., 27ABCDE1234F1ZK"
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 font-mono uppercase"
              />
            </div>
          </div>

          <div className="pt-6 border-t border-slate-100">
            <h4 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-orange-500" />
              Business Address
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2 overflow-visible">
                <label className="block text-sm font-medium text-slate-700 mb-2">Street Address</label>
                <EnhancedAddressAutocomplete
                  value={formData.address}
                  onChange={(address: string, components?: AddressComponents) => {
                    setFormData((prev) => ({
                      ...prev,
                      address,
                      ...(components?.city != null && { city: components.city || '' }),
                      ...(components?.state != null && { state: components.state || '' }),
                      ...(components?.pincode != null && { pincode: components.pincode || '' }),
                      ...(components?.coordinates?.lat != null && {
                        latitude: components.coordinates.lat,
                      }),
                      ...(components?.coordinates?.lng != null && {
                        longitude: components.coordinates.lng,
                      }),
                    }));
                  }}
                  placeholder="Search address, landmark, city..."
                />
                <div className="mt-2">
                  <UseCurrentLocationButton
                    onSuccess={(result: VendorAddressFromGeolocationResult) => {
                      setFormData((prev) => ({
                        ...prev,
                        address: result.address ?? prev.address,
                        city: result.city ?? prev.city,
                        state: result.state ?? prev.state,
                        pincode: result.pincode ?? prev.pincode,
                        latitude: result.latitude,
                        longitude: result.longitude,
                      }));
                    }}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">City</label>
                <input
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">State</label>
                <input
                  value={formData.state}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">PIN Code</label>
                <input
                  value={formData.pincode}
                  onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment Tab */}
      {activeTab === 'payment' && (
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm space-y-6">
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100">
            <p className="text-sm text-blue-700">
              <strong>Tip:</strong> Adding your bank details ensures faster payouts. Payouts are processed every 7 days.
            </p>
          </div>

          <div className="space-y-4">
            <h4 className="font-semibold text-slate-900 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-orange-500" />
              Bank Account Details
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Bank Name</label>
                <input
                  value={formData.bank_name}
                  onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                  placeholder="e.g., State Bank of India"
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">IFSC Code</label>
                <input
                  value={formData.ifsc_code}
                  onChange={(e) => setFormData({ ...formData, ifsc_code: e.target.value.toUpperCase() })}
                  placeholder="e.g., SBIN0001234"
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 font-mono uppercase"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-2">Account Number</label>
                <div className="relative">
                  <input
                    type={showAccountNumber ? 'text' : 'password'}
                    value={formData.account_number}
                    onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
                    placeholder="Enter your account number"
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAccountNumber(!showAccountNumber)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-100 rounded"
                  >
                    {showAccountNumber ? (
                      <EyeOff className="w-5 h-5 text-slate-400" />
                    ) : (
                      <Eye className="w-5 h-5 text-slate-400" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-100 space-y-4">
            <h4 className="font-semibold text-slate-900">UPI Details</h4>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">UPI ID</label>
              <input
                value={formData.upi_id}
                onChange={(e) => setFormData({ ...formData, upi_id: e.target.value })}
                placeholder="e.g., yourname@upi"
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
              />
            </div>
          </div>
        </div>
      )}

      {/* Notifications Tab */}
      {activeTab === 'notifications' && (
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm space-y-4">
          <h4 className="font-semibold text-slate-900 mb-4">Notification Preferences</h4>

          {[
            { label: 'New Order Alerts', description: 'Get notified when you receive a new order' },
            { label: 'Order Status Updates', description: 'Updates when order status changes' },
            { label: 'Low Stock Alerts', description: 'Notify when products are running low' },
            { label: 'Payout Notifications', description: 'Updates about your payouts' },
            { label: 'Promotional Messages', description: 'Tips and offers from Warmpawz' },
            { label: 'Weekly Reports', description: 'Weekly sales and performance summary' },
          ].map((item, index) => (
            <div key={index} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
              <div>
                <p className="font-medium text-slate-900">{item.label}</p>
                <p className="text-sm text-slate-500">{item.description}</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" defaultChecked className="sr-only peer" />
                <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-500/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
              </label>
            </div>
          ))}
        </div>
      )}

      {/* Security Tab */}
      {activeTab === 'security' && (
        <SellerSecuritySection
          sellerId={sellerId}
          initialPhone={formData.phone}
          onPhoneUpdated={(p) => setFormData((prev) => ({ ...prev, phone: p }))}
        />
      )}
    </div>
  );
  }
);
