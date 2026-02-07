'use client';

import { useState, useEffect } from 'react';
import { LoadingState, ErrorState } from '@/components/ui/states';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Calendar, Clock, MapPin, Plus } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
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
  onBack: () => void;
  onSuccess: (bookingId: string) => void;
}

export function CreateBookingPage({ phone, serviceId, vendorId, onBack, onSuccess }: CreateBookingPageProps) {
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

  const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

  useEffect(() => {
    if (vendorId && serviceId && isUuid(serviceId)) {
      setResolvedServiceId(serviceId);
    } else if (vendorId && (!serviceId || !isUuid(serviceId))) {
      resolveServiceId();
    } else if (serviceId && isUuid(serviceId)) {
      setResolvedServiceId(serviceId);
    }
  }, [serviceId, vendorId]);

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
    
    try {
      const response = await apiClient.get<{ services?: any[] }>(
        `/vendor/${vendorId}/services/available`
      );
      
      const services = response.services || [];
      if (services.length > 0 && services[0].id) {
        setResolvedServiceId(services[0].id);
      }
    } catch (err) {
      console.error('Failed to get vendor services:', err);
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

    if (!customerId) {
      toast.error('Customer information not found. Please try again.');
      return;
    }

    if (!vendorId) {
      toast.error('Vendor information is missing');
      return;
    }

    let finalServiceId = resolvedServiceId || serviceId;
    
    if (!finalServiceId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(finalServiceId)) {
      if (vendorId) {
        try {
          const response = await apiClient.get<{ services?: any[] }>(
            `/vendor/${vendorId}/services/available`
          );
          const services = response.services || [];
          if (services.length > 0 && services[0].id) {
            finalServiceId = services[0].id;
            setResolvedServiceId(services[0].id);
          }
        } catch (err) {
          console.error('Failed to get service:', err);
        }
      }
      
      if (!finalServiceId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(finalServiceId)) {
        toast.error('Unable to find service information. Please try selecting the service again.');
        return;
      }
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
        serviceType: 'at_home' as const,
        address: addressString || undefined,
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
        
      toast.success('Booking created successfully!');
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

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="sticky top-0 z-10 bg-white border-b px-4 py-4 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-lg font-bold">Create Booking</h1>
      </div>

      <div className="container mx-auto px-4 py-6 max-w-lg">
        <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded-xl shadow-sm">
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
                <SelectTrigger>
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

          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Date</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  type="date"
                  value={formData.scheduledDate}
                  onChange={(e) => setFormData({...formData, scheduledDate: e.target.value})}
                  className="pl-10"
                  min={new Date().toISOString().split('T')[0]}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Time</Label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  type="time"
                  value={formData.scheduledTime}
                  onChange={(e) => setFormData({...formData, scheduledTime: e.target.value})}
                  className="pl-10"
                  required
                />
              </div>
            </div>
          </div>

          {/* Service Address: use existing or add new (standard address selection flow) */}
          <div className="space-y-4 border-t pt-4">
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
                  <SelectTrigger>
                    <SelectValue placeholder="Select address" />
                  </SelectTrigger>
                  <SelectContent>
                    {savedAddresses.map((addr) => (
                      <SelectItem key={addr.id} value={addr.id}>
                        {addr.addressLine1}, {addr.city} {addr.pincode}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedAddressId && savedAddresses.find((a) => a.id === selectedAddressId) && (
                  <div className="rounded-lg bg-gray-50 p-3 text-sm text-gray-700 border">
                    {(() => {
                      const addr = savedAddresses.find((a) => a.id === selectedAddressId)!;
                      return (
                        <>
                          <p className="font-medium">{addr.label || 'Address'}</p>
                          <p>{addr.addressLine1}</p>
                          {addr.addressLine2 && <p>{addr.addressLine2}</p>}
                          <p>{addr.city}, {addr.state} {addr.pincode}</p>
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
