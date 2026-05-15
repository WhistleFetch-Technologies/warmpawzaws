"use client";

import { useState, useEffect } from 'react';
import { MapPin, Plus, Edit2, Trash2, Check, Home, Building2, Briefcase } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import { EnhancedAddressAutocomplete, AddressComponents } from '@/components/shared/EnhancedAddressAutocomplete';
import { CountryCodeSelector } from '@/components/ui/CountryCodeSelector';
import { ServiceDashboardHeader } from '@/components/customer/shared/ServiceDashboardHeader';

interface AddressBookPageProps {
  phone: string;
  onBack: () => void;
  /** Full exit to home / shell reset (same as global back). Defaults to `onBack` if omitted. */
  onCloseToHome?: () => void;
  onSelect?: (address: Address) => void;
  onNavigate?: (path: string) => void;
  /**
   * appShell: fixed submit bar sits above CustomerScreenWrapper BottomNavigation (default).
   * fullscreen: flush to viewport bottom when no bottom tab bar is present.
   */
  layoutVariant?: 'appShell' | 'fullscreen';
}

interface Address {
  id: string;
  label?: string;
  name: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  pincode: string;
  coordinates?: { lat: number; lng: number } | string | null;
  latitude?: number;
  longitude?: number;
  isDefault: boolean;
  createdAt?: string;
  updatedAt?: string;
  flatNo?: string;
  houseNo?: string;
  floor?: string;
  streetName?: string;
  apartmentName?: string;
}

function parseAddressCoordinates(address: Address): { lat: number; lng: number } | null {
  const lat = address.latitude;
  const lng = address.longitude;
  if (lat != null && lng != null && Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))) {
    return { lat: Number(lat), lng: Number(lng) };
  }
  const c = address.coordinates;
  if (!c) return null;
  if (typeof c === 'object' && typeof (c as { lat?: number }).lat === 'number' && typeof (c as { lng?: number }).lng === 'number') {
    return { lat: (c as { lat: number }).lat, lng: (c as { lng: number }).lng };
  }
  if (typeof c === 'string') {
    try {
      const o = JSON.parse(c) as { lat?: number; lng?: number };
      if (typeof o.lat === 'number' && typeof o.lng === 'number') return { lat: o.lat, lng: o.lng };
    } catch {
      return null;
    }
  }
  return null;
}

export function AddressBookPage({
  phone,
  onBack,
  onCloseToHome,
  onSelect,
  onNavigate,
  layoutVariant = 'appShell',
}: AddressBookPageProps) {
  const exitToHome = onCloseToHome ?? onBack;
  const appShell = layoutVariant === 'appShell';
  const ctaBottomClass = appShell
    ? 'bottom-[calc(4.75rem+max(0px,env(safe-area-inset-bottom,0px)))]'
    : 'bottom-0';
  const formScrollPaddingBottom = appShell
    ? 'pb-[calc(10.5rem+env(safe-area-inset-bottom,0px))]'
    : 'pb-[calc(6rem+env(safe-area-inset-bottom,0px))]';
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  const [saving, setSaving] = useState(false);
  const [countryCode, setCountryCode] = useState(() => {
    // Get saved country code or default to +91
    if (typeof window !== 'undefined') {
      return localStorage.getItem('customerCountryCode') || '+91';
    }
    return '+91';
  });
  const [formData, setFormData] = useState({
    label: 'home',
    name: '',
    phone: phone.replace(/[^0-9]/g, ''),
    addressLine1: '',
    city: '',
    state: '',
    pincode: '',
    isDefault: false,
    houseNo: '',
    floor: '',
    coordinates: null as { lat: number; lng: number } | null,
  });

  const handleFormBack = () => {
    setShowForm(false);
    setEditingAddress(null);
  };

  useEffect(() => {
    loadAddresses();
  }, [phone]);

  const loadAddresses = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<{ addresses?: Address[] }>(`/customer/addresses?phone=${encodeURIComponent(phone)}`);
      const addressList = response.addresses || [];
      setAddresses(addressList);
    } catch (error) {
      console.error('Error loading addresses:', error);
      toast.error('Failed to load addresses');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (address: Address) => {
    setEditingAddress(address);
    setFormData({
      label: address.label || 'home',
      name: address.name,
      phone: address.phone,
      addressLine1: address.addressLine1,
      city: address.city,
      state: address.state,
      pincode: address.pincode,
      isDefault: address.isDefault,
      houseNo: address.houseNo || (address as any).flatNo || '',
      floor: address.floor || '',
      coordinates: parseAddressCoordinates(address),
    });
    setShowForm(true);
  };

  const isProfileSyntheticAddress = (id: string) => id === 'profile';

  const handleDelete = async (addressId: string) => {
    if (isProfileSyntheticAddress(addressId)) {
      toast.info('This address comes from your profile. You cannot delete it from the address book.');
      return;
    }
    if (!confirm('Are you sure you want to delete this address?')) return;

    try {
      const response = await apiClient.delete<any>(`/customer/${phone}/addresses/${addressId}`);
      
      if (response.success !== false) {
        toast.success('Address deleted successfully');
        await loadAddresses();
      } else {
        throw new Error(response.error || 'Failed to delete address');
      }
    } catch (error: any) {
      console.error('Error deleting address:', error);
      toast.error(error.message || 'Failed to delete address');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim() || !formData.addressLine1.trim() || !formData.city.trim() || !formData.state.trim() || !formData.pincode.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (!formData.houseNo.trim()) {
      toast.error('Please enter House No / Flat No');
      return;
    }

    if (formData.pincode.length !== 6) {
      toast.error('PIN code must be 6 digits');
      return;
    }

    try {
      setSaving(true);
      const addressData = {
        ...formData,
        phone: formData.phone || phone.replace(/[^0-9]/g, ''),
        flatNo: null,
        addressLine2: null,
        streetName: editingAddress?.streetName ?? '',
        apartmentName: editingAddress?.apartmentName ?? '',
        coordinates: formData.coordinates ?? undefined,
        latitude: formData.coordinates?.lat,
        longitude: formData.coordinates?.lng,
      };

      if (editingAddress) {
        const savingProfileFallback = isProfileSyntheticAddress(editingAddress.id);
        if (savingProfileFallback) {
          const response = await apiClient.post<any>(`/customer/${phone}/addresses`, addressData);
          if (response.success !== false || response.addressId) {
            toast.success('Address added successfully');
          } else {
            throw new Error(response.error || 'Failed to add address');
          }
        } else {
          const response = await apiClient.put<any>(`/customer/${phone}/addresses/${editingAddress.id}`, addressData);
          if (response.success !== false) {
            toast.success('Address updated successfully');
          } else {
            throw new Error(response.error || 'Failed to update address');
          }
        }
      } else {
        const response = await apiClient.post<any>(`/customer/${phone}/addresses`, addressData);
        if (response.success !== false || response.addressId) {
          toast.success('Address added successfully');
        } else {
          throw new Error(response.error || 'Failed to add address');
        }
      }

      setShowForm(false);
      setEditingAddress(null);
      setFormData({
        label: 'home',
        name: '',
        phone: phone.replace(/[^0-9]/g, ''),
        addressLine1: '',
        city: '',
        state: '',
        pincode: '',
        isDefault: false,
        houseNo: '',
        floor: '',
        coordinates: null,
      });
      await loadAddresses();
    } catch (error: any) {
      console.error('Error saving address:', error);
      toast.error(error.message || 'Failed to save address');
    } finally {
      setSaving(false);
    }
  };

  const handleAddNew = () => {
    setEditingAddress(null);
    setFormData({
      label: 'home',
      name: '',
      phone: phone.replace(/[^0-9]/g, ''),
      addressLine1: '',
      city: '',
      state: '',
      pincode: '',
      isDefault: addresses.length === 0, // Set as default if first address
      houseNo: '',
      floor: '',
      coordinates: null,
    });
    setShowForm(true);
  };

  const getLabelIcon = (label?: string) => {
    switch (label) {
      case 'home': return <Home className="w-4 h-4" />;
      case 'work': return <Briefcase className="w-4 h-4" />;
      case 'other': return <Building2 className="w-4 h-4" />;
      default: return <MapPin className="w-4 h-4" />;
    }
  };

  const getLabelColor = (label?: string) => {
    switch (label) {
      case 'home': return 'bg-blue-100 text-blue-700';
      case 'work': return 'bg-purple-100 text-purple-700';
      case 'other': return 'bg-gray-100 text-gray-700';
      default: return 'bg-orange-100 text-orange-700';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center max-w-customer mx-auto">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42]"></div>
      </div>
    );
  }

  if (showForm) {
    return (
      <div
        className={`min-h-screen min-h-[100dvh] bg-gray-50 max-w-customer mx-auto ${formScrollPaddingBottom}`}
      >
        <ServiceDashboardHeader
          serviceName={editingAddress ? 'Edit Address' : 'Add New Address'}
          serviceSubtitle="Save delivery locations"
          serviceIcon={MapPin}
          iconColor="text-white"
          stats={[]}
          onCloseToHome={exitToHome}
          onBack={handleFormBack}
          showBackButton
        />

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Label Selection */}
          <div>
            <Label className="text-sm font-medium text-gray-700 mb-2 block">Address Type</Label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: 'home', label: 'Home', icon: Home },
                { value: 'work', label: 'Work', icon: Briefcase },
                { value: 'other', label: 'Other', icon: Building2 }
              ].map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, label: type.value })}
                  className={`p-3 rounded-lg border-2 flex flex-col items-center gap-2 transition-colors ${
                    formData.label === type.value
                      ? 'border-[#FF8C42] bg-[#FF8C42]/10'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <type.icon className={`w-5 h-5 ${formData.label === type.value ? 'text-[#FF8C42]' : 'text-gray-400'}`} />
                  <span className={`text-sm font-medium ${formData.label === type.value ? 'text-[#FF8C42]' : 'text-gray-600'}`}>
                    {type.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Name */}
          <div>
            <Label htmlFor="name" className="text-sm font-medium text-gray-700 mb-2 block">
              Name *
            </Label>
            <Input
              id="name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Full name"
              required
            />
          </div>

          {/* Phone with Country Code */}
          <div>
            <Label htmlFor="phone" className="text-sm font-medium text-gray-700 mb-2 block">
              Phone Number *
            </Label>
            <div className="flex items-stretch border-2 border-gray-200 rounded-xl overflow-hidden focus-within:border-[#FF8C42] focus-within:ring-2 focus-within:ring-[#FF8C42]/20 transition-all bg-white">
              <CountryCodeSelector
                selectedCode={countryCode}
                onSelect={setCountryCode}
                disabled={false}
              />
              <input
                id="phone"
                type="tel"
                inputMode="numeric"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/[^0-9]/g, '') })}
                placeholder="10-digit mobile number"
                maxLength={10}
                required
                className="flex-1 py-3 px-4 text-base outline-none"
              />
            </div>
          </div>

          {/* Address Line 1 with Google Maps Autocomplete */}
          <div>
            <Label htmlFor="addressLine1" className="text-sm font-medium text-gray-700 mb-2 block">
              Address Line 1 *
            </Label>
            <EnhancedAddressAutocomplete
              value={formData.addressLine1}
              onChange={(address: string, components?: AddressComponents) => {
                setFormData(prev => {
                  const updates: typeof prev = { ...prev, addressLine1: address };
                  // Auto-populate city, state, pincode from Google Maps selection
                  if (components) {
                    if (components.city && !prev.city) updates.city = components.city;
                    if (components.state && !prev.state) updates.state = components.state;
                    if (components.pincode && !prev.pincode) updates.pincode = components.pincode;
                    if (components.coordinates) {
                      updates.coordinates = {
                        lat: components.coordinates.lat,
                        lng: components.coordinates.lng,
                      };
                    }
                  }
                  return updates;
                });
              }}
              placeholder="Search address, landmark, city..."
              required
            />
          </div>

          {/* House / Flat (required) + Floor — aligned with customer profile */}
          <div>
            <Label htmlFor="houseNo" className="text-sm font-medium text-gray-700 mb-2 block">
              House No / Flat No *
            </Label>
            <Input
              id="houseNo"
              type="text"
              value={formData.houseNo}
              onChange={(e) => setFormData({ ...formData, houseNo: e.target.value })}
              placeholder="e.g., A-101, Flat 12B"
              required
              className="rounded-xl"
            />
          </div>
          <div>
            <Label htmlFor="floor" className="text-sm font-medium text-gray-700 mb-2 block">
              Floor
            </Label>
            <Input
              id="floor"
              type="text"
              value={formData.floor}
              onChange={(e) => setFormData({ ...formData, floor: e.target.value })}
              placeholder="e.g., 1st Floor"
              className="rounded-xl"
            />
          </div>

          {/* City */}
          <div>
            <Label htmlFor="city" className="text-sm font-medium text-gray-700 mb-2 block">
              City *
            </Label>
            <Input
              id="city"
              type="text"
              value={formData.city}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              placeholder="City"
              required
            />
          </div>

          {/* State */}
          <div>
            <Label htmlFor="state" className="text-sm font-medium text-gray-700 mb-2 block">
              State *
            </Label>
            <Input
              id="state"
              type="text"
              value={formData.state}
              onChange={(e) => setFormData({ ...formData, state: e.target.value })}
              placeholder="State"
              required
            />
          </div>

          {/* Pincode */}
          <div>
            <Label htmlFor="pincode" className="text-sm font-medium text-gray-700 mb-2 block">
              PIN Code *
            </Label>
            <Input
              id="pincode"
              type="text"
              value={formData.pincode}
              onChange={(e) => setFormData({ ...formData, pincode: e.target.value.replace(/[^0-9]/g, '').slice(0, 6) })}
              placeholder="6-digit PIN code"
              maxLength={6}
              required
            />
          </div>

          {/* Set as Default */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="isDefault"
              checked={formData.isDefault}
              onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
              className="w-4 h-4 text-[#FF8C42] border-gray-300 rounded focus:ring-[#FF8C42]"
            />
            <Label htmlFor="isDefault" className="text-sm text-gray-700 cursor-pointer">
              Set as default address
            </Label>
          </div>

          {/* Fixed submit — same width as BottomNavigation; above tab bar when layoutVariant is appShell */}
          <div
            className={`pointer-events-none fixed left-0 right-0 z-40 mx-auto w-full max-w-customer border-t border-gray-200 bg-white px-4 pt-4 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] shadow-lg ${ctaBottomClass}`}
          >
            <div className="pointer-events-auto">
              <Button
                type="submit"
                disabled={saving}
                className="w-full bg-gradient-to-r from-[#FF8C42] to-[#FF6B9D] hover:from-[#FF7A29] hover:to-[#FF5A8D] text-white h-12 text-lg font-semibold shadow-lg disabled:opacity-50"
              >
                {saving
                  ? 'Saving...'
                  : editingAddress
                    ? isProfileSyntheticAddress(editingAddress.id)
                      ? 'Save Address'
                      : 'Update Address'
                    : 'Save Address'}
              </Button>
            </div>
          </div>
        </form>
      </div>
    );
  }

  const defaultCount = addresses.filter((a) => a.isDefault).length;

  return (
    <div className="min-h-screen min-h-[100dvh] bg-gray-50 pb-24 max-w-customer mx-auto">
      <ServiceDashboardHeader
        serviceName="Address Book"
        serviceSubtitle={`${addresses.length} saved ${addresses.length === 1 ? 'address' : 'addresses'}`}
        serviceIcon={MapPin}
        iconColor="text-white"
        stats={[
          { value: String(addresses.length), label: 'Saved' },
          { value: String(defaultCount), label: 'Default' },
          { value: String(Math.max(0, addresses.length - defaultCount)), label: 'Other' },
        ]}
        onCloseToHome={exitToHome}
        onBack={onBack}
        showBackButton
      />

      <div className="p-4 space-y-4">
        {/* Add New Button */}
        <Button
          onClick={handleAddNew}
          className="w-full bg-gradient-to-r from-[#FF8C42] to-[#FF6B9D] hover:from-[#FF7A29] hover:to-[#FF5A8D] text-white h-12 shadow-lg"
        >
          <Plus className="w-5 h-5 mr-2" />
          Add New Address
        </Button>

        {/* Addresses List */}
        {addresses.length === 0 ? (
          <Card className="p-8 text-center">
            <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 mb-4">No addresses saved</p>
            <Button
              onClick={handleAddNew}
              variant="outline"
              className="border-[#FF8C42] text-[#FF8C42] hover:bg-[#FF8C42]/10"
            >
              Add Your First Address
            </Button>
          </Card>
        ) : (
          <div className="space-y-3">
            {addresses.map((address) => (
              <Card key={address.id} className="p-4 hover:shadow-lg transition-shadow">
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 ${getLabelColor(address.label)} rounded-lg flex items-center justify-center flex-shrink-0`}>
                    {getLabelIcon(address.label)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900 capitalize">
                          {address.label || 'Address'}
                        </h3>
                        {address.isDefault && (
                          <span className="bg-[#FF8C42] text-white text-xs px-2 py-0.5 rounded-full">
                            Default
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="font-medium text-gray-900 mb-1">{address.name}</p>
                    <p className="text-sm text-gray-600 mb-1">{address.phone}</p>
                    <p className="text-sm text-gray-600 mb-1">{address.addressLine1}</p>
                    {address.addressLine2 && (
                      <p className="text-sm text-gray-600 mb-1">{address.addressLine2}</p>
                    )}
                    {(address.houseNo || address.floor || address.streetName || address.apartmentName || (address as any).flatNo) && (
                      <div className="text-sm text-gray-600 mb-1 space-y-0.5">
                        {address.apartmentName && <p>{address.apartmentName}</p>}
                        {address.houseNo && <p>House / Flat: {address.houseNo}</p>}
                        {!address.houseNo && (address as any).flatNo && <p>Flat {(address as any).flatNo}</p>}
                        {address.floor && <p>Floor: {address.floor}</p>}
                        {address.streetName && <p>{address.streetName}</p>}
                      </div>
                    )}
                    <p className="text-sm text-gray-600">
                      {address.city}, {address.state} - {address.pincode}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2">
                    {onSelect && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          onSelect(address);
                          onBack();
                        }}
                        className="rounded-full"
                        aria-label="Select address"
                      >
                        <Check className="w-4 h-4 text-green-600" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(address)}
                      className="rounded-full"
                      aria-label="Edit address"
                    >
                      <Edit2 className="w-4 h-4 text-blue-600" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={isProfileSyntheticAddress(address.id)}
                      title={
                        isProfileSyntheticAddress(address.id)
                          ? 'Profile address cannot be deleted here'
                          : undefined
                      }
                      onClick={() => handleDelete(address.id)}
                      className="rounded-full disabled:opacity-40"
                    >
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
