'use client';

import { useState, useEffect } from 'react';
import { LoadingState, ErrorState } from '@/components/ui/states';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Calendar, Clock, MapPin } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

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
  const [error, setError] = useState<string | null>(null);
  const [pets, setPets] = useState<any[]>([]);
  
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
  }, [phone]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.petId || !formData.scheduledDate || !formData.scheduledTime) {
      toast.error('Please fill in all required fields');
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      const data = await apiClient.post<{ success?: boolean; booking?: any }>(
        `/booking/create`,
        {
          phone,
          petId: formData.petId,
          vendorId,
          serviceId,
            serviceType: 'at_home', // Defaulting to at_home for now as per form
            scheduledDate: formData.scheduledDate,
            scheduledTime: formData.scheduledTime,
            address: formData.address,
            notes: formData.notes
          }
        );
        
        toast.success('Booking created successfully!');
        onSuccess(data.booking?.id || data.booking?.bookingId || '');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create booking';
      setError(msg);
      toast.error(msg);
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

          {/* Address */}
          <div className="space-y-4 border-t pt-4">
            <Label className="flex items-center gap-2">
              <MapPin className="w-4 h-4" /> Service Address
            </Label>
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
