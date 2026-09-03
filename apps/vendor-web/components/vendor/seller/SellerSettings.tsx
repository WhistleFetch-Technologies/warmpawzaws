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
  Eye,
  EyeOff,
  Loader2,
  CheckCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import { isValidGSTIN, type GSTVerificationData } from '@/lib/gstin';
import {
  formatAccountNumber,
  formatIFSC,
  formatUPI,
  isMaskedAccountNumber,
  isValidAccountNumber,
  isValidIFSC,
  isValidUPI,
  looksLikeIndianPhone,
  accountNumberSuffix,
} from '@/lib/bank-payment';
import { GSTVerification } from '@/components/vendor/kyc/GSTVerification';
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
  return_window_days: string;
  return_policy_text: string;
};

const EMPTY_PAYMENT_FIELDS = {
  bank_name: '',
  account_number: '',
  ifsc_code: '',
  upi_id: '',
  return_window_days: '7',
  return_policy_text: '',
};

function mapProfileFieldsFromVendor(
  v: Record<string, unknown> | null | undefined
): Omit<SellerSettingsFormData, 'bank_name' | 'account_number' | 'ifsc_code' | 'upi_id'> {
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
    return_window_days: String(v?.return_window_days ?? '7'),
    return_policy_text: String(v?.return_policy_text || ''),
  };
}

function mapPaymentFieldsFromApi(
  bank: Record<string, unknown> | null | undefined,
  vendor: Record<string, unknown> | null | undefined,
  upi: Record<string, unknown> | null | undefined
): {
  bank_name: string;
  account_number: string;
  ifsc_code: string;
  upi_id: string;
  hasStoredBankAccount: boolean;
  storedAccountSuffix: string;
  upiVerified: boolean;
  upiHolderName: string;
} {
  const bankDetails = bank ?? null;
  let hasStoredBankAccount = false;
  let storedAccountSuffix = '';

  let bank_name = '';
  let ifsc_code = '';
  let account_number = '';

  if (bankDetails) {
    bank_name = String(bankDetails.bank_name || bankDetails.bankName || '').trim();
    ifsc_code = formatIFSC(String(bankDetails.ifsc_code || bankDetails.ifscCode || ''));
    const rawAccount = String(bankDetails.account_number || bankDetails.accountNumber || '').trim();
    if (rawAccount && isMaskedAccountNumber(rawAccount)) {
      hasStoredBankAccount = true;
      storedAccountSuffix = accountNumberSuffix(rawAccount);
      account_number = '';
    } else if (rawAccount && isValidAccountNumber(rawAccount)) {
      hasStoredBankAccount = true;
      storedAccountSuffix = accountNumberSuffix(rawAccount);
      account_number = rawAccount;
    }
  }

  const upiFromApi =
    upi?.upi_id != null && String(upi.upi_id).trim() !== ''
      ? String(upi.upi_id).trim()
      : upi?.upiId != null && String(upi.upiId).trim() !== ''
        ? String(upi.upiId).trim()
        : '';
  const upiFromVendor =
    vendor?.upi_id != null && String(vendor.upi_id).trim() !== ''
      ? String(vendor.upi_id).trim()
      : vendor?.upiId != null && String(vendor.upiId).trim() !== ''
        ? String(vendor.upiId).trim()
        : '';

  return {
    bank_name,
    account_number,
    ifsc_code,
    upi_id: upiFromApi || upiFromVendor,
    hasStoredBankAccount,
    storedAccountSuffix,
    upiVerified: upi?.is_verified === true || upi?.isVerified === true,
    upiHolderName: String(upi?.vpa_holder_name || upi?.vpaHolderName || '').trim(),
  };
}

function normalizeGstStatus(status: string | undefined): GSTVerificationData['status'] {
  const s = String(status || '').toLowerCase();
  if (s === 'active') return 'Active';
  if (s === 'cancelled') return 'Cancelled';
  if (s === 'suspended') return 'Suspended';
  return 'unknown';
}

function deriveGstVerificationFromLoad(
  vendor: Record<string, unknown>,
  kycData: Record<string, unknown> | null | undefined
): { gstVerified: boolean; initialVerifiedData: GSTVerificationData | null } {
  const loadedGstin = String(vendor?.gst_number || vendor?.gstin || '').trim().toUpperCase();
  if (!loadedGstin) {
    return { gstVerified: false, initialVerifiedData: null };
  }

  const kycGstin = String(kycData?.gstin || '').trim().toUpperCase();
  const kycVerified = kycData?.gstin_verified === true;
  const vendorVerified = vendor?.gstin_verified === true;

  const verified =
    (kycVerified && kycGstin === loadedGstin) ||
    (vendorVerified && loadedGstin.length > 0);

  if (!verified) {
    return { gstVerified: false, initialVerifiedData: null };
  }

  const status = normalizeGstStatus(
    String(kycData?.gstin_status || vendor?.gstin_status || 'Active')
  );

  return {
    gstVerified: true,
    initialVerifiedData: {
      verified: true,
      gstin: loadedGstin,
      legalName: String(kycData?.gstin_legal_name || vendor?.business_name || ''),
      tradeName: kycData?.gstin_trade_name ? String(kycData.gstin_trade_name) : undefined,
      status,
      stateCode: loadedGstin.substring(0, 2),
      stateName: '',
    },
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
  const [formData, setFormData] = useState<SellerSettingsFormData>(() => ({
    ...mapProfileFieldsFromVendor(sellerData),
    ...EMPTY_PAYMENT_FIELDS,
  }));
  const [showAccountNumber, setShowAccountNumber] = useState(false);
  const [gstVerified, setGstVerified] = useState(false);
  const [initialVerifiedData, setInitialVerifiedData] = useState<GSTVerificationData | null>(null);
  const [hasStoredBankAccount, setHasStoredBankAccount] = useState(false);
  const [storedAccountSuffix, setStoredAccountSuffix] = useState('');
  const [storedIfsc, setStoredIfsc] = useState('');
  const [storedBankName, setStoredBankName] = useState('');
  const [upiVerified, setUpiVerified] = useState(false);
  const [upiHolderName, setUpiHolderName] = useState('');
  const [storedUpi, setStoredUpi] = useState('');
  const [verifyingUpi, setVerifyingUpi] = useState(false);

  const DEFAULT_NOTIFICATION_PREFS = {
    newOrder: true,
    orderStatusChange: true,
    lowStock: true,
    settlementProcessed: true,
    promotionPerformance: false,
    weeklyReport: true,
  };
  const [notifPrefs, setNotifPrefs] = useState(DEFAULT_NOTIFICATION_PREFS);
  const [notifSaving, setNotifSaving] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);

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
      const [profileRes, bankRes, upiRes, kycRes, notifRes] = await Promise.all([
        apiClient.get<any>(`/vendor/${sellerId}/profile`).catch(() => null),
        apiClient.get<any>(`/vendor/${sellerId}/bank-details`).catch(() => null),
        apiClient.get<any>(`/vendor/${sellerId}/upi`).catch(() => null),
        apiClient.get<any>(`/kyc/status/${sellerId}`).catch(() => null),
        apiClient.get<any>(`/vendor/${sellerId}/notification-preferences`).catch(() => null),
      ]);

      const vendor = profileRes?.success ? profileRes.vendor : sellerData;
      const bankDetails = bankRes?.success ? bankRes.bankDetails : null;
      const upi = upiRes?.success ? upiRes.upi : null;
      const kycData = kycRes?.success ? kycRes.data : null;
      if (notifRes?.success && notifRes.notificationPreferences) {
        setNotifPrefs((prev) => ({ ...prev, ...notifRes.notificationPreferences }));
      }
      const profileImageUrl = profileRes?.vendor?.profile_image || profileRes?.vendor?.logo_url || null;
      if (profileImageUrl) setLogoUrl(profileImageUrl);

      if (vendor) {
        const payment = mapPaymentFieldsFromApi(bankDetails, vendor as Record<string, unknown>, upi);
        const mapped = {
          ...mapProfileFieldsFromVendor(vendor as Record<string, unknown>),
          bank_name: payment.bank_name,
          account_number: payment.account_number,
          ifsc_code: payment.ifsc_code,
          upi_id: payment.upi_id,
        };
        const gstState = deriveGstVerificationFromLoad(vendor as Record<string, unknown>, kycData);
        setFormData(mapped);
        setGstVerified(gstState.gstVerified);
        setInitialVerifiedData(gstState.initialVerifiedData);
        setHasStoredBankAccount(payment.hasStoredBankAccount);
        setStoredAccountSuffix(payment.storedAccountSuffix);
        setStoredIfsc(payment.ifsc_code);
        setStoredBankName(payment.bank_name);
        setUpiVerified(payment.upiVerified);
        setUpiHolderName(payment.upiHolderName);
        setStoredUpi(payment.upi_id);
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
          upiId: data.upi_id,
          bank_name: data.bank_name,
          ifsc_code: data.ifsc_code,
        })
      );
    } catch {
      // non-fatal
    }
  }, []);

  const handleIFSCLookup = useCallback(async (ifsc: string) => {
    if (!isValidIFSC(ifsc)) return;
    try {
      const response = await fetch(`https://ifsc.razorpay.com/${ifsc.toUpperCase()}`);
      if (!response.ok) return;
      const data = await response.json();
      if (data.BANK) {
        setFormData((prev) => ({
          ...prev,
          bank_name: prev.bank_name.trim() ? prev.bank_name : String(data.BANK),
        }));
      }
    } catch {
      // non-fatal — user can enter bank name manually
    }
  }, []);

  const validateBankFields = useCallback((acct: string, ifsc: string, requireAccount: boolean): string | null => {
    if (requireAccount && !acct) {
      return 'Please enter a valid account number (9–18 digits)';
    }
    if (acct && !isValidAccountNumber(acct)) {
      return 'Please enter a valid account number (9–18 digits)';
    }
    if (acct || requireAccount) {
      if (!ifsc) return 'Please enter IFSC code for the bank account';
      if (looksLikeIndianPhone(ifsc)) return 'IFSC code cannot be a phone number';
      if (!isValidIFSC(ifsc)) return 'Please enter a valid 11-character IFSC code (e.g., SBIN0001234)';
    } else if (ifsc) {
      if (looksLikeIndianPhone(ifsc)) return 'IFSC code cannot be a phone number';
      if (!isValidIFSC(ifsc)) return 'Please enter a valid 11-character IFSC code (e.g., SBIN0001234)';
    }
    return null;
  }, []);

  const saveProfile = useCallback(async () => {
    const gst = formData.gstin.trim();
    if (gst) {
      if (!isValidGSTIN(gst)) {
        toast.error('Please enter a valid 15-character GSTIN');
        return;
      }
      if (!gstVerified) {
        toast.error('Please verify your GSTIN before saving');
        return;
      }
    }

    setSaving(true);
    onSavingChange?.(true);
    try {
      const gstPayload = formData.gstin.trim() || undefined;
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
        returnWindowDays: formData.return_window_days ? Number(formData.return_window_days) : undefined,
        returnPolicyText: formData.return_policy_text || undefined,
      });
      const respGst = profileRes?.vendor?.gst_number ?? profileRes?.vendor?.gstin ?? null;

      if (gstPayload && !respGst) {
        toast.warning(
          'GSTIN could not be saved. Deploy the latest API to dev (./scripts/deploy-lambda-direct.sh), then try again.'
        );
      }

      if (profileRes && profileRes.success === false) {
        throw new Error(profileRes.error || 'Failed to save profile');
      }

      syncLocalStorage(formData);
      await loadSettings();
      toast.success('Profile saved');
    } catch (error: any) {
      console.error('Error saving profile:', error);
      toast.error(error?.message || 'Failed to save profile');
      throw error;
    } finally {
      setSaving(false);
      onSavingChange?.(false);
    }
  }, [sellerId, formData, gstVerified, onSavingChange, syncLocalStorage, loadSettings]);

  const persistUpi = useCallback(async (upi: string): Promise<boolean> => {
    const validateRes = await apiClient.post<any>(`/vendor/${sellerId}/upi/validate`, { upi_id: upi });
    if (!validateRes?.valid && validateRes?.success === false) {
      throw new Error(validateRes?.error || 'UPI verification failed');
    }
    if (validateRes && validateRes.valid === false) {
      throw new Error(validateRes.error || 'This UPI ID could not be verified');
    }
    const saveRes = await apiClient.post<any>(`/vendor/${sellerId}/upi`, { upi_id: upi });
    if (saveRes && saveRes.success === false) {
      throw new Error(saveRes.error || 'Failed to save UPI ID');
    }
    return true;
  }, [sellerId]);

  const handleVerifyUpi = useCallback(async () => {
    if (!sellerId || verifyingUpi) return;
    const upi = formatUPI(formData.upi_id);
    if (!upi) {
      toast.error('Please enter a UPI ID');
      return;
    }
    if (!isValidUPI(upi)) {
      toast.error('Please enter a valid UPI ID (e.g., yourname@upi)');
      return;
    }
    setVerifyingUpi(true);
    try {
      const res = await apiClient.post<any>(`/vendor/${sellerId}/upi/validate`, { upi_id: upi });
      if (res?.valid) {
        setUpiVerified(true);
        setUpiHolderName(String(res.vpa_holder_name || '').trim());
        toast.success(res.vpa_holder_name ? `UPI verified: ${res.vpa_holder_name}` : 'UPI ID verified');
      } else {
        setUpiVerified(false);
        toast.error(res?.error || 'This UPI ID could not be verified');
      }
    } catch (error: any) {
      setUpiVerified(false);
      toast.error(error?.message || 'UPI verification failed');
    } finally {
      setVerifyingUpi(false);
    }
  }, [sellerId, formData.upi_id, verifyingUpi]);

  const savePayment = useCallback(async () => {
    const ifsc = formData.ifsc_code.trim().toUpperCase();
    const acct = formData.account_number.trim();
    const bankName = formData.bank_name.trim();
    const upi = formatUPI(formData.upi_id);

    const wantsNewAccount = acct.length > 0;
    const bankMetaChanged =
      hasStoredBankAccount &&
      acct.length === 0 &&
      (ifsc !== storedIfsc || bankName !== storedBankName) &&
      (ifsc.length > 0 || bankName.length > 0);
    const shouldSaveBank = wantsNewAccount || bankMetaChanged;

    if (shouldSaveBank) {
      const bankError = validateBankFields(acct, ifsc, wantsNewAccount || !hasStoredBankAccount);
      if (bankError) {
        toast.error(bankError);
        return;
      }
    }

    const shouldSaveUpi = Boolean(upi) && upi !== storedUpi;

    if (shouldSaveUpi && !isValidUPI(upi)) {
      toast.error('Please enter a valid UPI ID (e.g., yourname@upi)');
      return;
    }

    if (!shouldSaveBank && !shouldSaveUpi) {
      toast.info('Enter bank details or a new UPI ID to save');
      return;
    }

    setSaving(true);
    onSavingChange?.(true);
    let bankOk = false;
    let upiOk = false;
    let bankTried = false;
    let upiTried = false;
    try {
      if (shouldSaveBank) {
        bankTried = true;
        const accountHolderName =
          formData.contact_name.trim() || formData.business_name.trim() || 'Account Holder';
        try {
          await apiClient.put(`/vendor/${sellerId}/bank-details`, {
            ...(wantsNewAccount ? { account_number: acct } : { keep_existing_account: true }),
            ifsc_code: ifsc,
            bank_name: bankName || undefined,
            account_holder_name: accountHolderName,
          });
          bankOk = true;
          toast.success('Bank details saved');
        } catch (error: any) {
          toast.error(error?.message || 'Failed to save bank details');
        }
      }

      if (shouldSaveUpi) {
        upiTried = true;
        try {
          await persistUpi(upi);
          upiOk = true;
          toast.success('UPI ID verified and saved');
        } catch (error: any) {
          toast.error(error?.message || 'Failed to save UPI ID');
        }
      }

      if (bankOk || upiOk) {
        syncLocalStorage(formData);
        await loadSettings();
      }
      if ((bankTried || upiTried) && !bankOk && !upiOk) {
        throw new Error('Payment details could not be saved');
      }
    } finally {
      setSaving(false);
      onSavingChange?.(false);
    }
  }, [
    sellerId,
    formData,
    hasStoredBankAccount,
    storedIfsc,
    storedBankName,
    storedUpi,
    onSavingChange,
    syncLocalStorage,
    loadSettings,
    validateBankFields,
    persistUpi,
  ]);

  const handleSave = useCallback(async () => {
    if (!sellerId || saving) return;
    if (activeTab === 'profile') {
      await saveProfile();
      return;
    }
    if (activeTab === 'payment') {
      await savePayment();
      return;
    }
    toast.info(
      activeTab === 'notifications'
        ? 'Notification preferences save automatically'
        : 'Use the controls on this tab to update security settings'
    );
  }, [sellerId, saving, activeTab, saveProfile, savePayment]);

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
            <label className="relative cursor-pointer group" title="Upload business logo">
              <div className="w-20 h-20 rounded-2xl overflow-hidden shadow-lg bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center">
                {logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logoUrl} alt="Business logo" className="w-full h-full object-cover" />
                ) : (
                  <Store className="w-10 h-10 text-white" />
                )}
              </div>
              <div className="absolute inset-0 rounded-2xl bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                {logoUploading ? (
                  <Loader2 className="w-6 h-6 text-white animate-spin" />
                ) : (
                  <span className="text-white text-xs font-medium">Change</span>
                )}
              </div>
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                disabled={logoUploading}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setLogoUploading(true);
                  try {
                    const fd = new FormData();
                    fd.append('logo', file);
                    const res = await apiClient.post<{ success: boolean; logo_url: string }>(
                      `/vendor/${sellerId}/logo`,
                      fd
                    );
                    if (res?.logo_url) {
                      setLogoUrl(res.logo_url);
                      toast.success('Logo updated');
                    }
                  } catch {
                    toast.error('Failed to upload logo');
                  } finally {
                    setLogoUploading(false);
                    e.target.value = '';
                  }
                }}
              />
            </label>
            <div>
              <h3 className="text-xl font-bold text-slate-900">{formData.business_name || 'Your Store'}</h3>
              <p className="text-slate-500">Seller ID: {sellerId?.slice(0, 8)}...</p>
              <p className="text-xs text-slate-400 mt-1">Click the logo to change it (max 5 MB)</p>
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
            <div className="md:col-span-2">
              <GSTVerification
                vendorId={sellerId}
                value={formData.gstin}
                onChange={(val) => {
                  setFormData((prev) => ({ ...prev, gstin: val }));
                  setGstVerified(false);
                }}
                onVerified={(data) => {
                  setFormData((prev) => ({ ...prev, gstin: data.gstin }));
                  setGstVerified(true);
                }}
                initialVerifiedData={initialVerifiedData}
                label="GSTIN"
                helpText="GST will be verified automatically"
                required={false}
                conditional={true}
                autoVerify={true}
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

          <div className="pt-6 border-t border-slate-100 space-y-4">
            <h4 className="font-semibold text-slate-900">Return Policy</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Return Window (days)
                </label>
                <input
                  type="number"
                  min={0}
                  max={90}
                  value={formData.return_window_days}
                  onChange={(e) => setFormData({ ...formData, return_window_days: e.target.value })}
                  placeholder="e.g., 7"
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                />
                <p className="mt-1 text-xs text-slate-400">Number of days customers can request a return after delivery</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Return Policy Description
                </label>
                <textarea
                  rows={3}
                  value={formData.return_policy_text}
                  onChange={(e) => setFormData({ ...formData, return_policy_text: e.target.value })}
                  placeholder="Describe your return policy (e.g., items must be unused and in original packaging)"
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 resize-none"
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
                  autoComplete="off"
                  name="vendor-bank-name"
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">IFSC Code</label>
                <input
                  value={formData.ifsc_code}
                  onChange={(e) => {
                    const formatted = formatIFSC(e.target.value);
                    setFormData({ ...formData, ifsc_code: formatted });
                    if (formatted.length === 11 && isValidIFSC(formatted)) {
                      void handleIFSCLookup(formatted);
                    }
                  }}
                  placeholder="e.g., SBIN0001234"
                  maxLength={11}
                  autoComplete="off"
                  name="vendor-ifsc"
                  className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 font-mono uppercase ${
                    formData.ifsc_code &&
                    (looksLikeIndianPhone(formData.ifsc_code) ||
                      (!isValidIFSC(formData.ifsc_code) && formData.ifsc_code.length >= 11))
                      ? 'border-red-300'
                      : 'border-slate-200'
                  }`}
                />
                {formData.ifsc_code && looksLikeIndianPhone(formData.ifsc_code) && (
                  <p className="mt-1 text-sm text-red-600">IFSC cannot be a phone number</p>
                )}
                {formData.ifsc_code &&
                  formData.ifsc_code.length >= 11 &&
                  !looksLikeIndianPhone(formData.ifsc_code) &&
                  !isValidIFSC(formData.ifsc_code) && (
                    <p className="mt-1 text-sm text-red-600">
                      Invalid IFSC format (e.g., SBIN0001234)
                    </p>
                  )}
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-2">Account Number</label>
                {hasStoredBankAccount && storedAccountSuffix && (
                  <p className="mb-2 text-sm text-slate-500">
                    Account on file ending in {storedAccountSuffix}. Enter full number to update.
                  </p>
                )}
                <div className="relative">
                  <input
                    type={showAccountNumber ? 'text' : 'password'}
                    value={formData.account_number}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        account_number: formatAccountNumber(e.target.value),
                      })
                    }
                    placeholder={
                      hasStoredBankAccount
                        ? 'Enter full account number to update'
                        : 'Enter your account number'
                    }
                    autoComplete="off"
                    name="vendor-account-number"
                    inputMode="numeric"
                    className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 font-mono ${
                      formData.account_number && !isValidAccountNumber(formData.account_number)
                        ? 'border-red-300'
                        : 'border-slate-200'
                    }`}
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
                {formData.account_number && !isValidAccountNumber(formData.account_number) && (
                  <p className="mt-1 text-sm text-red-600">
                    Account number must be 9–18 digits
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-100 space-y-4">
            <h4 className="font-semibold text-slate-900">UPI Details</h4>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">UPI ID</label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  value={formData.upi_id}
                  onChange={(e) => {
                    setFormData({ ...formData, upi_id: formatUPI(e.target.value) });
                    setUpiVerified(false);
                    setUpiHolderName('');
                  }}
                  placeholder="e.g., yourname@upi"
                  autoComplete="off"
                  name="vendor-upi-id"
                  className={`flex-1 px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 ${
                    formData.upi_id && !isValidUPI(formData.upi_id)
                      ? 'border-red-300'
                      : 'border-slate-200'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => void handleVerifyUpi()}
                  disabled={verifyingUpi || saving}
                  className="shrink-0 px-4 py-3 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  {verifyingUpi ? 'Verifying...' : 'Verify UPI'}
                </button>
              </div>
              {formData.upi_id && !isValidUPI(formData.upi_id) && (
                <p className="mt-1 text-sm text-red-600">
                  Enter a valid UPI ID (e.g., yourname@upi)
                </p>
              )}
              {upiVerified && formData.upi_id && isValidUPI(formData.upi_id) && (
                <p className="mt-2 flex items-center gap-1.5 text-sm text-green-700">
                  <CheckCircle className="w-4 h-4" />
                  {upiHolderName ? `Verified — ${upiHolderName}` : 'Verified'}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Notifications Tab */}
      {activeTab === 'notifications' && (
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm space-y-4">
          <h4 className="font-semibold text-slate-900 mb-4">Notification Preferences</h4>

          {(
            [
              { key: 'newOrder', label: 'New Order Alerts', description: 'Get notified when you receive a new order' },
              { key: 'orderStatusChange', label: 'Order Status Updates', description: 'Updates when order status changes' },
              { key: 'lowStock', label: 'Low Stock Alerts', description: 'Notify when products are running low' },
              { key: 'settlementProcessed', label: 'Payout Notifications', description: 'Updates about your payouts' },
              { key: 'promotionPerformance', label: 'Promotional Messages', description: 'Tips and offers from Warmpawz' },
              { key: 'weeklyReport', label: 'Weekly Reports', description: 'Weekly sales and performance summary' },
            ] as { key: keyof typeof notifPrefs; label: string; description: string }[]
          ).map((item) => (
            <div key={item.key} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
              <div>
                <p className="font-medium text-slate-900">{item.label}</p>
                <p className="text-sm text-slate-500">{item.description}</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifPrefs[item.key]}
                  onChange={async (e) => {
                    const updated = { ...notifPrefs, [item.key]: e.target.checked };
                    setNotifPrefs(updated);
                    if (!notifSaving) {
                      setNotifSaving(true);
                      try {
                        await apiClient.put(`/vendor/${sellerId}/notification-preferences`, updated);
                      } catch {
                        toast.error('Failed to save notification preference');
                        setNotifPrefs(notifPrefs);
                      } finally {
                        setNotifSaving(false);
                      }
                    }
                  }}
                  className="sr-only peer"
                />
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
