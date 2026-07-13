'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { X, MapPin, Home, Briefcase, MoreHorizontal, Search, ChevronRight, Loader2 } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import { EnhancedAddressAutocomplete, AddressComponents } from '@/components/shared/EnhancedAddressAutocomplete';
import { UseCurrentLocationButton } from '@/components/shared/UseCurrentLocationButton';
import { geolocationResultToFormFields, type AddressFromGeolocationResult } from '@/lib/address-from-geolocation';

// Note: Google Maps is now handled by EnhancedAddressAutocomplete component

interface AddressFormData {
  label: 'Home' | 'Work' | 'Other';
  name: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  landmark: string;
  city: string;
  state: string;
  pincode: string;
  latitude: number | null;
  longitude: number | null;
  isDefault: boolean;
  flatNo: string;
  houseNo: string;
  floor: string;
  streetName: string;
  apartmentName: string;
}

interface AddAddressModalProps {
  phone: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (address: any) => void;
  customerName?: string;
}

export function AddAddressModal({ 
  phone, 
  isOpen, 
  onClose, 
  onSuccess,
  customerName = ''
}: AddAddressModalProps) {
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState<AddressFormData>({
    label: 'Home',
    name: customerName,
    phone: phone,
    addressLine1: '',
    addressLine2: '',
    landmark: '',
    city: '',
    state: '',
    pincode: '',
    latitude: null,
    longitude: null,
    isDefault: false,
    flatNo: '',
    houseNo: '',
    floor: '',
    streetName: '',
    apartmentName: '',
  });
  
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setFormData({
        label: 'Home',
        name: customerName,
        phone: phone,
        addressLine1: '',
        addressLine2: '',
        landmark: '',
        city: '',
        state: '',
        pincode: '',
        latitude: null,
        longitude: null,
        isDefault: false,
        flatNo: '',
        houseNo: '',
        floor: '',
        streetName: '',
        apartmentName: '',
      });
      setErrors({});
    }
  }, [isOpen, customerName, phone]);

  const handleGeolocationSuccess = useCallback((result: AddressFromGeolocationResult) => {
    setFormData((prev) => ({
      ...prev,
      ...geolocationResultToFormFields(result),
      addressLine1: result.addressLine1 ?? prev.addressLine1,
      addressLine2: result.addressLine2 ?? prev.addressLine2,
      city: result.city ?? prev.city,
      state: result.state ?? prev.state,
      pincode: result.pincode ?? prev.pincode,
      landmark: result.landmark ?? prev.landmark,
    }));
  }, []);

  // Validate form
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.addressLine1.trim()) {
      newErrors.addressLine1 = 'Address line 1 is required';
    }

    if (!formData.city.trim()) {
      newErrors.city = 'City is required';
    }

    if (!formData.pincode.trim()) {
      newErrors.pincode = 'Pincode is required';
    } else if (!/^\d{6}$/.test(formData.pincode)) {
      newErrors.pincode = 'Pincode must be 6 digits';
    }

    if (!formData.state.trim()) {
      newErrors.state = 'State is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Save address
  const handleSaveAddress = async () => {
    if (!validateForm()) {
      toast.error('Please fill all required fields');
      return;
    }

    setLoading(true);

    try {
      const addressData = {
        phone: phone,
        label: formData.label.toLowerCase(),
        name: formData.name || 'Customer',
        addressLine1: formData.addressLine1,
        addressLine2: formData.addressLine2 || null,
        landmark: formData.landmark || null,
        city: formData.city,
        state: formData.state,
        pincode: formData.pincode,
        coordinates: formData.latitude && formData.longitude 
          ? JSON.stringify({ lat: formData.latitude, lng: formData.longitude })
          : null,
        latitude: formData.latitude ?? undefined,
        longitude: formData.longitude ?? undefined,
        isDefault: formData.isDefault,
        flatNo: formData.flatNo || undefined,
        houseNo: formData.houseNo || undefined,
        floor: formData.floor || undefined,
        streetName: formData.streetName || undefined,
        apartmentName: formData.apartmentName || undefined,
      };

      console.log('📍 [AddAddressModal] Saving address:', addressData);

      const response = await apiClient.post<any>('/customer/addresses', addressData);

      console.log('✅ [AddAddressModal] Address saved:', response);

      if (response.success || response.address || (response.addresses && response.addresses.length > 0)) {
        toast.success('Address saved successfully!');
        
        // Prefer response.address (created address with id); fallback to last in addresses
        const fromSingle = response.address;
        const fromList = response.addresses?.length ? response.addresses[response.addresses.length - 1] : null;
        const raw = fromSingle || fromList;
        const newAddress = raw && typeof raw === 'object'
          ? {
              id: raw.id,
              customerId: raw.customerId ?? raw.customer_id,
              label: raw.label ?? raw.address_type,
              name: raw.name ?? raw.full_name,
              phone: raw.phone,
              addressLine1: raw.addressLine1 ?? raw.address_line1,
              addressLine2: raw.addressLine2 ?? raw.address_line2,
              city: raw.city,
              state: raw.state,
              pincode: raw.pincode,
              landmark: raw.landmark,
              coordinates: raw.coordinates,
              flatNo: raw.flatNo ?? raw.flat_no,
              houseNo: raw.houseNo ?? raw.house_no,
              floor: raw.floor,
              streetName: raw.streetName ?? raw.street_name,
              apartmentName: raw.apartmentName ?? raw.apartment_name,
              isDefault: raw.isDefault ?? raw.is_default,
              createdAt: raw.createdAt ?? raw.created_at,
              updatedAt: raw.updatedAt ?? raw.updated_at,
            }
          : raw;
        
        onSuccess(newAddress);
        onClose();
      } else {
        throw new Error(response.error || 'Failed to save address');
      }
    } catch (error: any) {
      console.error('❌ [AddAddressModal] Error saving address:', error);
      toast.error(error.message || 'Failed to save address');
    } finally {
      setLoading(false);
    }
  };

  // Don't render anything if modal is not open
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/50 transition-opacity duration-300 z-50"
      onClick={onClose}
    >
      <div 
        className="fixed inset-x-0 bottom-0 bg-white rounded-t-3xl transform transition-transform duration-300 ease-out flex flex-col translate-y-0 max-w-customer mx-auto"
        style={{ 
          height: '90vh',
          maxHeight: '90vh'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Gradient */}
        <div className="bg-gradient-to-br from-[#FF8C42] to-[#FF6B1A] p-4 pb-4 rounded-t-3xl flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <MapPin className="w-6 h-6 text-white" />
              <h3 className="font-bold text-white text-lg">Add New Address</h3>
            </div>
            <button
              onClick={onClose}
              disabled={loading}
              className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm active:scale-95 transition-transform disabled:opacity-50"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
          <p className="text-white/80 text-sm">Where should the service provider come?</p>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto" style={{ 
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'thin',
          scrollbarColor: '#FF8C42 #f3f4f6'
        }}>
          <div className="p-4 pb-24 space-y-4">
            
            {/* Address Type Selection */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">
                Save as
              </label>
              <div className="flex gap-2">
                {[
                  { value: 'Home', icon: Home, label: 'Home' },
                  { value: 'Work', icon: Briefcase, label: 'Work' },
                  { value: 'Other', icon: MoreHorizontal, label: 'Other' },
                ].map(({ value, icon: Icon, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, label: value as 'Home' | 'Work' | 'Other' }))}
                    className={`flex-1 py-3 px-4 border-2 rounded-xl transition-all font-medium text-sm flex items-center justify-center gap-2 ${
                      formData.label === value
                        ? 'border-[#FF8C42] bg-orange-50 text-[#FF8C42] shadow-sm'
                        : 'border-gray-200 text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Detect Location Button */}
            <UseCurrentLocationButton
              label="Detect My Location"
              onSuccess={handleGeolocationSuccess}
            />

            {/* Address Search with Google Maps Autocomplete */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">
                Address Line 1 <span className="text-red-500">*</span>
              </label>
              <EnhancedAddressAutocomplete
                value={formData.addressLine1}
                onChange={(address: string, components?: AddressComponents) => {
                  setFormData(prev => {
                    const next: AddressFormData = { ...prev, addressLine1: address };
                    if (components) {
                      if (components.city && !prev.city) next.city = components.city;
                      if (components.state && !prev.state) next.state = components.state;
                      if (components.pincode && !prev.pincode) next.pincode = components.pincode;
                      if (components.street) {
                        next.streetName = components.street.trim();
                        if (!prev.addressLine2) next.addressLine2 = components.street.trim();
                      }
                      if (components.landmark && !prev.landmark) next.landmark = components.landmark;
                      if (components.coordinates) {
                        next.latitude = components.coordinates.lat;
                        next.longitude = components.coordinates.lng;
                      }
                    }
                    return next;
                  });

                  if (address && errors.addressLine1) {
                    setErrors(prev => ({ ...prev, addressLine1: '' }));
                  }
                }}
                placeholder="Search address, landmark, city..."
                className={errors.addressLine1 ? 'border-red-300' : ''}
                required
              />
              {errors.addressLine1 && (
                <p className="text-xs text-red-500 mt-1">{errors.addressLine1}</p>
              )}
            </div>

            {/* Address Line 2 */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">
                Address Line 2 (Optional)
              </label>
              <input
                type="text"
                value={formData.addressLine2}
                onChange={(e) => setFormData(prev => ({ ...prev, addressLine2: e.target.value }))}
                placeholder="Apartment, floor, building name"
                className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl focus:border-[#FF8C42] focus:outline-none text-sm"
              />
            </div>

            {/* Optional: Flat, House, Floor, Street, Apartment */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Flat / Unit no.</label>
                <input
                  type="text"
                  value={formData.flatNo}
                  onChange={(e) => setFormData(prev => ({ ...prev, flatNo: e.target.value }))}
                  placeholder="e.g. 401"
                  className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl focus:border-[#FF8C42] focus:outline-none text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">House / Building no.</label>
                <input
                  type="text"
                  value={formData.houseNo}
                  onChange={(e) => setFormData(prev => ({ ...prev, houseNo: e.target.value }))}
                  placeholder="e.g. 12"
                  className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl focus:border-[#FF8C42] focus:outline-none text-sm"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Floor</label>
                <input
                  type="text"
                  value={formData.floor}
                  onChange={(e) => setFormData(prev => ({ ...prev, floor: e.target.value }))}
                  placeholder="e.g. 4th"
                  className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl focus:border-[#FF8C42] focus:outline-none text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Street name</label>
                <input
                  type="text"
                  value={formData.streetName}
                  onChange={(e) => setFormData(prev => ({ ...prev, streetName: e.target.value }))}
                  placeholder="Street name"
                  className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl focus:border-[#FF8C42] focus:outline-none text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Apartment / Building / Society name</label>
              <input
                type="text"
                value={formData.apartmentName}
                onChange={(e) => setFormData(prev => ({ ...prev, apartmentName: e.target.value }))}
                placeholder="e.g. Green Valley Apartments"
                className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl focus:border-[#FF8C42] focus:outline-none text-sm"
              />
            </div>

            {/* Landmark */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">
                Landmark (Optional)
              </label>
              <input
                type="text"
                value={formData.landmark}
                onChange={(e) => setFormData(prev => ({ ...prev, landmark: e.target.value }))}
                placeholder="Nearby landmark for easy navigation"
                className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl focus:border-[#FF8C42] focus:outline-none text-sm"
              />
            </div>

            {/* City and State Row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                  City <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                  placeholder="City"
                  className={`w-full px-3 py-2.5 border-2 rounded-xl focus:border-[#FF8C42] focus:outline-none text-sm ${
                    errors.city ? 'border-red-300' : 'border-gray-200'
                  }`}
                />
                {errors.city && (
                  <p className="text-xs text-red-500 mt-1">{errors.city}</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                  State <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.state}
                  onChange={(e) => setFormData(prev => ({ ...prev, state: e.target.value }))}
                  placeholder="State"
                  className={`w-full px-3 py-2.5 border-2 rounded-xl focus:border-[#FF8C42] focus:outline-none text-sm ${
                    errors.state ? 'border-red-300' : 'border-gray-200'
                  }`}
                />
                {errors.state && (
                  <p className="text-xs text-red-500 mt-1">{errors.state}</p>
                )}
              </div>
            </div>

            {/* Pincode */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">
                Pincode <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.pincode}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                  setFormData(prev => ({ ...prev, pincode: value }));
                }}
                placeholder="6-digit pincode"
                maxLength={6}
                className={`w-full px-3 py-2.5 border-2 rounded-xl focus:border-[#FF8C42] focus:outline-none text-sm ${
                  errors.pincode ? 'border-red-300' : 'border-gray-200'
                }`}
              />
              {errors.pincode && (
                <p className="text-xs text-red-500 mt-1">{errors.pincode}</p>
              )}
            </div>

            {/* Set as Default */}
            <label className="flex items-center gap-3 cursor-pointer p-3 bg-gray-50 rounded-xl">
              <input
                type="checkbox"
                checked={formData.isDefault}
                onChange={(e) => setFormData(prev => ({ ...prev, isDefault: e.target.checked }))}
                className="w-5 h-5 text-[#FF8C42] border-gray-300 rounded focus:ring-[#FF8C42]"
              />
              <div>
                <p className="text-sm font-medium text-gray-700">Set as default address</p>
                <p className="text-xs text-gray-500">Use this address for future bookings</p>
              </div>
            </label>

            {/* Location Status */}
            {formData.latitude && formData.longitude && (
              <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-xl">
                <MapPin className="w-4 h-4 text-green-600" />
                <p className="text-xs text-green-700">
                  Location coordinates captured for accurate distance calculation
                </p>
              </div>
            )}

          </div>
        </div>

        {/* Fixed Bottom Buttons */}
        <div className="flex-shrink-0 p-4 bg-white border-t border-gray-100 flex gap-3">
          <Button
            onClick={onClose}
            variant="outline"
            className="flex-1 h-12 border-2 border-gray-300 rounded-xl text-sm"
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSaveAddress}
            disabled={loading}
            className="flex-1 h-12 bg-[#FF8C42] hover:bg-[#FF7A2E] rounded-xl text-white text-sm"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Address'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
