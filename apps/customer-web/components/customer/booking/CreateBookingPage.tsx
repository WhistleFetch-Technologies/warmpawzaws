'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Building2, Clock, Home, MapPin, Plus, Scissors } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { mergeCustomerVendorServicesPayload } from '@/lib/customer-vendor-services-merge';
import { pickBookingApiMessage } from '@/lib/booking-response-message';
import { formatPriceWithSymbol } from '@/lib/booking-display-utils';
import { toast } from 'sonner';

interface SavedAddress {
  id: string;
  label?: string;
  name?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  pincode: string;
  landmark?: string;
  isDefault?: boolean;
}

interface CreateBookingPageProps {
  phone: string;
  serviceId?: string;
  vendorId?: string;
  /** at_home | at_center — controls address section and booking payload */
  serviceStyle?: string;
  vendorName?: string;
  serviceName?: string;
  price?: number;
  duration?: number;
  groomer?: {
    name?: string;
    business_name?: string;
    businessName?: string;
    address?: string;
    business_address?: string;
    businessAddress?: string;
    photo?: string;
    profile_photo?: string;
  };
  onBack: () => void;
  onSuccess: (bookingId: string) => void;
}

const scheduleFieldInputClassName =
  'block w-full min-w-0 max-w-full box-border rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500';

function formatAddressShort(addr: SavedAddress): string {
  const label = addr.label || 'Address';
  const line1 = (addr.addressLine1 || '').trim();
  if (!line1) return label;
  return `${label} · ${line1}`;
}

function formatAddressMeta(addr: SavedAddress): string {
  return [addr.city, addr.state, addr.pincode].filter(Boolean).join(', ');
}

function isHomeServiceStyle(style?: string): boolean {
  const s = String(style || 'at_home').toLowerCase();
  return s !== 'at_center' && s !== 'at_vendor' && s !== 'clinic';
}

function pickVendorDisplayName(vendor: any, groomer?: CreateBookingPageProps['groomer'], fallback?: string): string {
  return (
    vendor?.business_name ||
    vendor?.businessName ||
    vendor?.name ||
    groomer?.business_name ||
    groomer?.businessName ||
    groomer?.name ||
    fallback ||
    'Service provider'
  );
}

function pickVendorAddress(vendor: any, groomer?: CreateBookingPageProps['groomer']): string {
  const raw =
    vendor?.address ||
    vendor?.business_address ||
    vendor?.businessAddress ||
    vendor?.location?.address ||
    groomer?.address ||
    groomer?.business_address ||
    groomer?.businessAddress;
  if (typeof raw === 'string' && raw.trim()) return raw.trim();
  const parts = [vendor?.address_line1, vendor?.addressLine1, vendor?.city, vendor?.state, vendor?.pincode].filter(Boolean);
  return parts.join(', ');
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuidString(s: string | undefined): boolean {
  return typeof s === 'string' && UUID_RE.test(s);
}

/** Prefer catalog `id`; support snake_case `service_id` from API rows. */
function serviceRowUuid(row: any): string | null {
  const raw = row?.id ?? row?.service_id ?? row?.serviceId;
  return typeof raw === 'string' && isUuidString(raw) ? raw : null;
}

/**
 * Resolve a bookable service UUID: vendor /available, then grooming catalog (matches GroomingBookingRouter).
 */
async function fetchResolvedServiceId(vendorId: string, preferred?: string): Promise<string | null> {
  if (preferred && isUuidString(preferred)) {
    return preferred;
  }

  let available: any[] = [];
  try {
    const response = await apiClient.get<{ services?: any[] }>(`/vendor/${vendorId}/services/available`);
    available = response.services || [];
  } catch (err) {
    console.error('Failed to get vendor services:', err);
  }

  if (preferred) {
    const match = available.find(
      (s) => String(s?.id ?? s?.service_id ?? s?.serviceId) === String(preferred)
    );
    const u = match ? serviceRowUuid(match) : null;
    if (u) return u;
  }
  for (const s of available) {
    const u = serviceRowUuid(s);
    if (u) return u;
  }

  try {
    const res = await apiClient.get<any>(`/customer/vendor/${vendorId}/services?category=grooming`);
    const grooming = mergeCustomerVendorServicesPayload(res);
    if (preferred) {
      const match = grooming.find(
        (s: any) => String(s?.id ?? s?.service_id ?? s?.serviceId) === String(preferred)
      );
      const u = match ? serviceRowUuid(match) : null;
      if (u) return u;
    }
    for (const s of grooming) {
      const u = serviceRowUuid(s);
      if (u) return u;
    }
  } catch (err) {
    console.error('Failed to get grooming catalog services:', err);
  }

  return null;
}

export function CreateBookingPage({
  phone,
  serviceId,
  vendorId,
  serviceStyle,
  vendorName: vendorNameProp,
  serviceName: serviceNameProp,
  price: priceProp,
  duration: durationProp,
  groomer,
  onBack,
  onSuccess,
}: CreateBookingPageProps) {
  const needsServiceAddress = isHomeServiceStyle(serviceStyle);
  const isCenterVisit = !needsServiceAddress;
  const resolvedServiceType = (() => {
    const s = String(serviceStyle || '').toLowerCase();
    if (s === 'at_center' || s === 'at_vendor' || s === 'clinic') return 'at_center' as const;
    return 'at_home' as const;
  })();
  const [loading, setLoading] = useState(false);
  const [loadingPets, setLoadingPets] = useState(true);
  const [loadingAddresses, setLoadingAddresses] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pets, setPets] = useState<any[]>([]);
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [useNewAddress, setUseNewAddress] = useState(false);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [resolvedServiceId, setResolvedServiceId] = useState<string | null>(null);
  const [vendorProfile, setVendorProfile] = useState<any>(null);
  const [loadingVendor, setLoadingVendor] = useState(false);

  const [formData, setFormData] = useState({
    petId: '',
    scheduledDate: '',
    scheduledTime: '',
    address: {
      street: '',
      city: '',
      state: '',
      pincode: ''
    },
    notes: ''
  });

  useEffect(() => {
    fetchPets();
    fetchCustomerId();
    fetchAddresses();
  }, [phone]);

  useEffect(() => {
    if (vendorId && serviceId && isUuidString(serviceId)) {
      setResolvedServiceId(serviceId);
    } else if (vendorId && (!serviceId || !isUuidString(serviceId))) {
      resolveServiceId();
    } else if (serviceId && isUuidString(serviceId)) {
      setResolvedServiceId(serviceId);
    }
  }, [serviceId, vendorId]);

  useEffect(() => {
    if (!vendorId) {
      setVendorProfile(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setLoadingVendor(true);
        const raw = (await apiClient.get(`/customer/vendor/${encodeURIComponent(vendorId)}`)) as any;
        const vendor = raw?.vendor || raw?.data?.vendor || raw;
        if (!cancelled && vendor && typeof vendor === 'object') {
          setVendorProfile(vendor);
        }
      } catch (err) {
        console.error('Error loading vendor profile:', err);
        if (!cancelled) setVendorProfile(null);
      } finally {
        if (!cancelled) setLoadingVendor(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [vendorId]);

  const fetchPets = async () => {
    try {
      setLoadingPets(true);
      const data = await apiClient.get<{ pets?: any[] }>(
        `/customer/pets?phone=${encodeURIComponent(phone)}`
      );
      setPets(data.pets || []);
    } catch (err) {
      console.error('Error fetching pets:', err);
    } finally {
      setLoadingPets(false);
    }
  };

  const fetchAddresses = async () => {
    try {
      setLoadingAddresses(true);
      const data = await apiClient.get<{ addresses?: SavedAddress[] }>(
        `/customer/addresses?phone=${encodeURIComponent(phone)}`
      );
      const list = data.addresses || [];
      setSavedAddresses(list);
      if (list.length > 0 && !useNewAddress) {
        const defaultAddr = list.find((a: SavedAddress) => a.isDefault) || list[0];
        setSelectedAddressId(defaultAddr.id);
      }
    } catch (err) {
      console.error('Error fetching addresses:', err);
    } finally {
      setLoadingAddresses(false);
    }
  };

  const resolveServiceId = async () => {
    if (!vendorId) return;
    const id = await fetchResolvedServiceId(vendorId, serviceId);
    if (id) {
      setResolvedServiceId(id);
    }
  };

  const fetchCustomerId = async () => {
    try {
      const data = await apiClient.get<{ success?: boolean; profile?: { id?: string }; customer?: { id?: string }; id?: string }>(
        `/customer/profile/unified/${phone}`
      );
      
      const id = data.profile?.id || data.customer?.id || data.id || null;
      
      if (id) {
        setCustomerId(id);
        return;
      }
    } catch (err) {
      console.error('Error fetching customer ID from unified endpoint:', err);
    }

    try {
      const data = await apiClient.get<{ success?: boolean; profile?: { id?: string }; customer?: { id?: string }; id?: string }>(
        `/customer/profile?phone=${encodeURIComponent(phone)}`
      );
      
      const id = data.profile?.id || data.customer?.id || data.id || null;
      if (id) {
        setCustomerId(id);
        return;
      }
    } catch (err) {
      console.error('Error fetching customer ID from query endpoint:', err);
    }

    // Last fallback: try path parameter endpoint
    try {
      const data = await apiClient.get<{ success?: boolean; profile?: { id?: string }; id?: string }>(
        `/customer/profile/${phone}`
      );
      const id = data.profile?.id || data.id || null;
      setCustomerId(id);
    } catch (err) {
      console.error('Error fetching customer ID from path endpoint:', err);
      setCustomerId(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.petId || !formData.scheduledDate || !formData.scheduledTime) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (needsServiceAddress) {
      const hasSaved = !useNewAddress && selectedAddressId && savedAddresses.some((a) => a.id === selectedAddressId);
      const hasManual = Boolean(
        formData.address.street.trim() &&
          formData.address.city.trim() &&
          formData.address.pincode.trim()
      );
      if (!hasSaved && !hasManual) {
        toast.error('Please select or enter a service address');
        return;
      }
    }

    if (!customerId) {
      toast.error('Customer information not found. Please try again.');
      return;
    }

    if (!vendorId) {
      toast.error('Vendor information is missing');
      return;
    }

    let finalServiceId = resolvedServiceId || serviceId;

    if (!finalServiceId || !isUuidString(finalServiceId)) {
      const resolved = await fetchResolvedServiceId(
        vendorId,
        typeof finalServiceId === 'string' ? finalServiceId : undefined
      );
      if (resolved) {
        finalServiceId = resolved;
        setResolvedServiceId(resolved);
      }
    }

    if (!finalServiceId || !isUuidString(finalServiceId)) {
      toast.error('Unable to find service information. Please try selecting the service again.');
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      // Format date to YYYY-MM-DD if needed
      const bookingDate = formData.scheduledDate.includes('T') 
        ? formData.scheduledDate.split('T')[0] 
        : formData.scheduledDate;
      
      // Format time to HH:MM if needed
      const bookingTime = formData.scheduledTime.includes(':') 
        ? formData.scheduledTime.split(':').slice(0, 2).join(':')
        : formData.scheduledTime;

      // Ingest address: use selected saved address or manual form
      let addressString: string;
      let city: string | undefined;
      let state: string | undefined;
      let pincode: string | undefined;
      if (!useNewAddress && selectedAddressId && savedAddresses.length > 0) {
        const addr = savedAddresses.find((a) => a.id === selectedAddressId);
        if (addr) {
          addressString = [addr.addressLine1, addr.addressLine2, addr.city, addr.state, addr.pincode].filter(Boolean).join(', ');
          city = addr.city;
          state = addr.state;
          pincode = addr.pincode;
        } else {
          addressString = [formData.address.street, formData.address.city, formData.address.state, formData.address.pincode].filter(Boolean).join(', ');
          city = formData.address.city || undefined;
          state = formData.address.state || undefined;
          pincode = formData.address.pincode || undefined;
        }
      } else {
        addressString = [formData.address.street, formData.address.city, formData.address.state, formData.address.pincode].filter(Boolean).join(', ');
        city = formData.address.city || undefined;
        state = formData.address.state || undefined;
        pincode = formData.address.pincode || undefined;
      }

      const requestBody = {
        customerId,
        vendorId,
        serviceId: finalServiceId,
        bookingDate,
        bookingTime,
        serviceType: resolvedServiceType,
        address: needsServiceAddress ? (addressString || undefined) : undefined,
        city,
        state,
        pincode,
        petId: formData.petId || undefined,
        notes: formData.notes || undefined
      };
      
      const data = await apiClient.post<{ success?: boolean; data?: { bookingId?: string }; booking?: any }>(
        `/booking/create`,
        requestBody
      );

      toast.success(pickBookingApiMessage(data, 'Booking created successfully!'));
      const bookingId = data.data?.bookingId || data.booking?.id || data.booking?.bookingId || '';
      onSuccess(bookingId);
    } catch (err: any) {
      console.error('Booking creation error:', err);
      const errorMessage = err?.response?.data?.error?.message || 
                          err?.message || 
                          'Failed to create booking';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const displayVendorName = pickVendorDisplayName(vendorProfile, groomer, vendorNameProp);
  const displayServiceName = serviceNameProp || 'Grooming service';
  const displayPrice = priceProp ?? 0;
  const displayDuration = durationProp ?? 0;
  const vendorLocation = pickVendorAddress(vendorProfile, groomer);
  const vendorPhoto =
    vendorProfile?.profile_image_url ||
    vendorProfile?.photo ||
    groomer?.photo ||
    groomer?.profile_photo;

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="sticky top-0 z-10 bg-white border-b px-4 py-4 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-lg font-bold">Create Booking</h1>
      </div>

      <div className="container mx-auto min-w-0 max-w-lg px-4 py-6">
        <form onSubmit={handleSubmit} className="min-w-0 space-y-6 overflow-hidden rounded-xl bg-white p-6 shadow-sm">
          {/* Vendor & service summary */}
          {(vendorId || vendorNameProp || serviceNameProp) && (
            <div className="min-w-0 space-y-3 border-b border-gray-100 pb-5">
              <div className="flex min-w-0 items-start gap-3">
                <div
                  className={`flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl ${
                    isCenterVisit ? 'bg-purple-100 text-purple-600' : 'bg-green-100 text-green-600'
                  }`}
                >
                  {vendorPhoto ? (
                    <img src={vendorPhoto} alt="" className="h-full w-full object-cover" />
                  ) : isCenterVisit ? (
                    <Building2 className="h-6 w-6" />
                  ) : (
                    <Home className="h-6 w-6" />
                  )}
                </div>
                <div className="min-w-0 flex-1 overflow-hidden">
                  <p className="truncate text-base font-semibold text-gray-900">{displayVendorName}</p>
                  <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-sm text-gray-600">
                    <Scissors className="h-3.5 w-3.5 shrink-0 text-orange-500" />
                    <span className="truncate">{displayServiceName}</span>
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                    {displayDuration > 0 && (
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {displayDuration} mins
                      </span>
                    )}
                    {displayPrice > 0 && (
                      <span className="font-semibold text-orange-600">{formatPriceWithSymbol(displayPrice)}</span>
                    )}
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 capitalize">
                      {isCenterVisit ? 'At center' : 'At home'}
                    </span>
                  </div>
                </div>
              </div>
              {loadingVendor && !vendorLocation && (
                <div className="h-14 animate-pulse rounded-lg bg-gray-100" />
              )}
            </div>
          )}

          {/* Pet Selection */}
          <div className="space-y-2">
            <Label>Select Pet</Label>
            {loadingPets ? (
              <div className="h-10 w-full bg-gray-100 rounded animate-pulse" />
            ) : (
              <Select 
                value={formData.petId} 
                onValueChange={(val: string) => setFormData({...formData, petId: val})}
              >
                <SelectTrigger className="min-w-0 max-w-full [&_[data-slot=select-value]]:min-w-0 [&_[data-slot=select-value]]:flex-1 [&_[data-slot=select-value]]:truncate">
                  <SelectValue placeholder="Select a pet" />
                </SelectTrigger>
                <SelectContent>
                  {pets.map((pet) => (
                    <SelectItem key={pet.id} value={pet.id}>{pet.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {pets.length === 0 && !loadingPets && (
              <p className="text-xs text-red-500">No pets found. Please add a pet first.</p>
            )}
          </div>

          {/* Date & Time — warmpawz wrappers avoid iOS WKWebView overflow / duplicate picker chrome */}
          <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="min-w-0 space-y-2">
              <Label>Date</Label>
              <div className="warmpawz-date-field-wrap">
                <Input
                  type="date"
                  value={formData.scheduledDate}
                  onChange={(e) => setFormData({...formData, scheduledDate: e.target.value})}
                  className={scheduleFieldInputClassName}
                  min={new Date().toISOString().split('T')[0]}
                  required
                />
              </div>
            </div>
            <div className="min-w-0 space-y-2">
              <Label>Time</Label>
              <div className="warmpawz-time-field-wrap">
                <Input
                  type="time"
                  value={formData.scheduledTime}
                  onChange={(e) => setFormData({...formData, scheduledTime: e.target.value})}
                  className={scheduleFieldInputClassName}
                  required
                />
              </div>
            </div>
          </div>

          {/* Clinic / vendor location (center visits) */}
          {isCenterVisit && (
            <div className="min-w-0 space-y-3 border-t border-gray-100 pt-4">
              <Label className="flex items-center gap-2">
                <Building2 className="h-4 w-4" /> Clinic location
              </Label>
              <div className="min-w-0 rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm text-gray-700">
                <p className="font-medium text-gray-900">{displayVendorName}</p>
                <p className="mt-1 break-words">
                  {vendorLocation || 'Address will be shared after confirmation'}
                </p>
              </div>
            </div>
          )}

          {/* Service Address: home visits */}
          {needsServiceAddress && (
          <div className="min-w-0 space-y-4 border-t pt-4">
            <Label className="flex items-center gap-2">
              <MapPin className="w-4 h-4" /> Service Address
            </Label>
            {loadingAddresses ? (
              <div className="h-20 bg-gray-100 rounded-lg animate-pulse" />
            ) : savedAddresses.length > 0 && !useNewAddress ? (
              <>
                <p className="text-sm text-gray-600">Use a saved address or add a new one</p>
                <Select
                  value={selectedAddressId || ''}
                  onValueChange={(id) => setSelectedAddressId(id)}
                >
                  <SelectTrigger className="min-w-0 max-w-full [&_[data-slot=select-value]]:min-w-0 [&_[data-slot=select-value]]:flex-1 [&_[data-slot=select-value]]:truncate">
                    <SelectValue placeholder="Select address" />
                  </SelectTrigger>
                  <SelectContent className="max-w-[min(100vw-2rem,32rem)]">
                    {savedAddresses.map((addr) => (
                      <SelectItem key={addr.id} value={addr.id} className="min-w-0">
                        <span className="block truncate">{formatAddressShort(addr)}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedAddressId && savedAddresses.find((a) => a.id === selectedAddressId) && (
                  <div className="min-w-0 rounded-lg border bg-gray-50 p-3 text-sm text-gray-700">
                    {(() => {
                      const addr = savedAddresses.find((a) => a.id === selectedAddressId)!;
                      return (
                        <>
                          <p className="font-medium">{addr.label || 'Address'}</p>
                          <p className="break-words">{addr.addressLine1}</p>
                          {addr.addressLine2 && <p className="break-words">{addr.addressLine2}</p>}
                          <p className="break-words">{formatAddressMeta(addr)}</p>
                        </>
                      );
                    })()}
                  </div>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setUseNewAddress(true)}
                  className="text-[#FF8C42] border-[#FF8C42] hover:bg-[#FF8C42] hover:text-white"
                >
                  <Plus className="w-4 h-4 mr-1" /> Add new address instead
                </Button>
              </>
            ) : (
              <>
                {savedAddresses.length > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => { setUseNewAddress(false); setSelectedAddressId(savedAddresses[0]?.id ?? null); }}
                    className="text-[#FF8C42] hover:bg-orange-50 mb-2"
                  >
                    Use saved address
                  </Button>
                )}
                <Input
                  placeholder="Street Address"
                  value={formData.address.street}
                  onChange={(e) => setFormData({
                    ...formData,
                    address: { ...formData.address, street: e.target.value }
                  })}
                />
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    placeholder="City"
                    value={formData.address.city}
                    onChange={(e) => setFormData({
                      ...formData,
                      address: { ...formData.address, city: e.target.value }
                    })}
                  />
                  <Input
                    placeholder="Pincode"
                    value={formData.address.pincode}
                    onChange={(e) => setFormData({
                      ...formData,
                      address: { ...formData.address, pincode: e.target.value }
                    })}
                  />
                </div>
              </>
            )}
          </div>
          )}

          {/* Notes */}
          <div className="space-y-2">
            <Label>Special Instructions</Label>
            <Textarea
              placeholder="Any notes for the service provider..."
              value={formData.notes}
              onChange={(e) => setFormData({...formData, notes: e.target.value})}
              rows={3}
            />
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
              {error}
            </div>
          )}

          <Button 
            type="submit" 
            className="w-full bg-[#FF8C42] hover:bg-[#FF7A2E]"
            disabled={loading}
          >
            {loading ? 'Confirming...' : 'Confirm Booking'}
          </Button>
        </form>
      </div>
    </div>
  );
}
