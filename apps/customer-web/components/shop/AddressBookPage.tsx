"use client";

import { useState, useEffect } from 'react';
import { ArrowLeft, MapPin, Plus, Edit2, Trash2, Check, X, Home, Building2, Briefcase } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import { EnhancedAddressAutocomplete, AddressComponents } from '@/components/shared/EnhancedAddressAutocomplete';
import { CountryCodeSelector } from '@/components/ui/CountryCodeSelector';

interface AddressBookPageProps {
  phone: string;
  onBack: () => void;
  onSelect?: (address: Address) => void;
  onNavigate?: (path: string) => void;
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
  landmark?: string;
  coordinates?: { lat: number; lng: number };
  isDefault: boolean;
  createdAt?: string;
  updatedAt?: string;
  flatNo?: string;
  houseNo?: string;
  floor?: string;
  streetName?: string;
  apartmentName?: string;
}

export function AddressBookPage({ phone, onBack, onSelect, onNavigate }: AddressBookPageProps) {
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
    addressLine2: '',
    city: '',
    state: '',
    pincode: '',
    landmark: '',
    isDefault: false,
    flatNo: '',
    houseNo: '',
    floor: '',
    streetName: '',
    apartmentName: ''
  });

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
      addressLine2: address.addressLine2 || '',
      city: address.city,
      state: address.state,
      pincode: address.pincode,
      landmark: address.landmark || '',
      isDefault: address.isDefault,
      flatNo: address.flatNo || '',
      houseNo: address.houseNo || '',
      floor: address.floor || '',
      streetName: address.streetName || '',
      apartmentName: address.apartmentName || ''
    });
    setShowForm(true);
  };

  const handleDelete = async (addressId: string) => {
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

    if (formData.pincode.length !== 6) {
      toast.error('PIN code must be 6 digits');
      return;
    }

    try {
      setSaving(true);
      const addressData = {
        ...formData,
        phone: formData.phone || phone.replace(/[^0-9]/g, '')
      };

      if (editingAddress) {
        const response = await apiClient.put<any>(`/customer/${phone}/addresses/${editingAddress.id}`, addressData);
        if (response.success !== false) {
          toast.success('Address updated successfully');
        } else {
          throw new Error(response.error || 'Failed to update address');
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
        addressLine2: '',
        city: '',
        state: '',
        pincode: '',
        landmark: '',
        isDefault: false,
        flatNo: '',
        houseNo: '',
        floor: '',
        streetName: '',
        apartmentName: ''
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
      addressLine2: '',
      city: '',
      state: '',
      pincode: '',
      landmark: '',
      isDefault: addresses.length === 0, // Set as default if first address
      flatNo: '',
      houseNo: '',
      floor: '',
      streetName: '',
      apartmentName: ''
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center max-w-md mx-auto">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42]"></div>
      </div>
    );
  }

  if (showForm) {
    return (
      <div className="min-h-screen bg-gray-50 pb-24 max-w-md mx-auto">
        <div className="bg-gradient-to-r from-[#FF8C42] via-[#FF7A35] to-[#FF6B35] text-white sticky top-0 z-50 px-4 py-4 rounded-b-2xl shadow-md">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setShowForm(false);
                setEditingAddress(null);
              }}
              className="rounded-full text-white hover:bg-white/20"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex-1">
              <h1 className="text-xl font-bold text-white">
                {editingAddress ? 'Edit Address' : 'Add New Address'}
              </h1>
            </div>
          </div>
        </div>

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
                  const updates: any = { ...prev, addressLine1: address };
                  // Auto-populate city, state, pincode from Google Maps selection
                  if (components) {
                    if (components.city && !prev.city) updates.city = components.city;
                    if (components.state && !prev.state) updates.state = components.state;
                    if (components.pincode && !prev.pincode) updates.pincode = components.pincode;
                    if (components.landmark && !prev.landmark) updates.landmark = components.landmark;
                    if (components.street && !prev.addressLine2) updates.addressLine2 = components.street;
                  }
                  return updates;
                });
              }}
              placeholder="Search address, landmark, city..."
              required
            />
          </div>

          {/* Address Line 2 */}
          <div>
            <Label htmlFor="addressLine2" className="text-sm font-medium text-gray-700 mb-2 block">
              Address Line 2 (Optional)
            </Label>
            <Input
              id="addressLine2"
              type="text"
              value={formData.addressLine2}
              onChange={(e) => setFormData({ ...formData, addressLine2: e.target.value })}
              placeholder="Street, Area, Colony"
            />
          </div>

          {/* Optional: Flat, House, Floor, Street, Apartment */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="flatNo" className="block text-xs font-medium text-gray-500 mb-1.5">Flat / Unit no.</Label>
              <Input
                id="flatNo"
                type="text"
                value={formData.flatNo}
                onChange={(e) => setFormData({ ...formData, flatNo: e.target.value })}
                placeholder="e.g. 401"
                className="text-sm"
              />
            </div>
            <div>
              <Label htmlFor="houseNo" className="block text-xs font-medium text-gray-500 mb-1.5">House / Building no.</Label>
              <Input
                id="houseNo"
                type="text"
                value={formData.houseNo}
                onChange={(e) => setFormData({ ...formData, houseNo: e.target.value })}
                placeholder="e.g. 12"
                className="text-sm"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="floor" className="block text-xs font-medium text-gray-500 mb-1.5">Floor</Label>
              <Input
                id="floor"
                type="text"
                value={formData.floor}
                onChange={(e) => setFormData({ ...formData, floor: e.target.value })}
                placeholder="e.g. 4th"
                className="text-sm"
              />
            </div>
            <div>
              <Label htmlFor="streetName" className="block text-xs font-medium text-gray-500 mb-1.5">Street name</Label>
              <Input
                id="streetName"
                type="text"
                value={formData.streetName}
                onChange={(e) => setFormData({ ...formData, streetName: e.target.value })}
                placeholder="Street name"
                className="text-sm"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="apartmentName" className="block text-xs font-medium text-gray-500 mb-1.5">Apartment / Building / Society name</Label>
            <Input
              id="apartmentName"
              type="text"
              value={formData.apartmentName}
              onChange={(e) => setFormData({ ...formData, apartmentName: e.target.value })}
              placeholder="e.g. Green Valley Apartments"
              className="text-sm"
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

          {/* Landmark */}
          <div>
            <Label htmlFor="landmark" className="text-sm font-medium text-gray-700 mb-2 block">
              Landmark (Optional)
            </Label>
            <Input
              id="landmark"
              type="text"
              value={formData.landmark}
              onChange={(e) => setFormData({ ...formData, landmark: e.target.value })}
              placeholder="Nearby landmark"
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

          {/* Submit Button */}
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 max-w-md mx-auto shadow-lg">
            <Button
              type="submit"
              disabled={saving}
              className="w-full bg-gradient-to-r from-[#FF8C42] to-[#FF6B9D] hover:from-[#FF7A29] hover:to-[#FF5A8D] text-white h-12 text-lg font-semibold shadow-lg disabled:opacity-50"
            >
              {saving ? 'Saving...' : editingAddress ? 'Update Address' : 'Save Address'}
            </Button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24 max-w-md mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#FF8C42] via-[#FF7A35] to-[#FF6B35] text-white sticky top-0 z-50 px-4 py-4 rounded-b-2xl shadow-md">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="rounded-full text-white hover:bg-white/20"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-white">Address Book</h1>
            <p className="text-sm text-white/90">{addresses.length} saved {addresses.length === 1 ? 'address' : 'addresses'}</p>
          </div>
        </div>
      </div>

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
                    {(address.flatNo || address.houseNo || address.floor || address.streetName || address.apartmentName) && (
                      <div className="text-sm text-gray-600 mb-1 space-y-0.5">
                        {address.apartmentName && <p>{address.apartmentName}</p>}
                        {address.flatNo && address.houseNo && (
                          <p>Flat {address.flatNo}, House {address.houseNo}</p>
                        )}
                        {address.flatNo && !address.houseNo && <p>Flat {address.flatNo}</p>}
                        {!address.flatNo && address.houseNo && <p>House {address.houseNo}</p>}
                        {address.floor && <p>Floor {address.floor}</p>}
                        {address.streetName && <p>{address.streetName}</p>}
                      </div>
                    )}
                    <p className="text-sm text-gray-600">
                      {address.city}, {address.state} - {address.pincode}
                    </p>
                    {address.landmark && (
                      <p className="text-sm text-gray-500 mt-1">Landmark: {address.landmark}</p>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        if (onSelect) {
                          onSelect(address);
                          onBack();
                        } else {
                          handleEdit(address);
                        }
                      }}
                      className="rounded-full"
                    >
                      {onSelect ? <Check className="w-4 h-4 text-green-600" /> : <Edit2 className="w-4 h-4 text-blue-600" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(address.id)}
                      className="rounded-full"
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
