'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, Calendar, Clock, MapPin } from 'lucide-react';
import Image from 'next/image';
import { apiClient } from '@/lib/api-client';
import { AddressAutocomplete, type AddressComponents } from '@warmpawz/ui';

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
      const response = await apiClient.get<{ pets: any[] }>(`/customer/pets?phone=${encodeURIComponent(phone)}`);
      if (response.pets) {
        setPets(response.pets);
      }
    } catch (err) {
      console.error('Error fetching pets:', err);
    } finally {
      setLoadingPets(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.petId || !formData.scheduledDate || !formData.scheduledTime) {
      alert('Please fill in all required fields');
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      const response = await apiClient.post<{ booking: { id: string } }>('/booking/create', {
        phone,
        petId: formData.petId,
        vendorId,
        serviceId,
        serviceType: 'at_home',
        scheduledDate: formData.scheduledDate,
        scheduledTime: formData.scheduledTime,
        address: formData.address,
        notes: formData.notes
      });
      
      if (response.booking) {
        alert('Booking created successfully!');
        onSuccess(response.booking.id);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create booking';
      setError(msg);
      alert(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 w-full max-w-[430px] mx-auto">
      <div className="sticky top-0 z-10 bg-white border-b px-4 py-4 flex items-center gap-0">
        <button
          onClick={onBack}
          className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-bold">Create Booking</h1>
      </div>

      <div className="px-4 py-0">
        <form onSubmit={handleSubmit} className="space-y-6 bg-white p-0 rounded-xl shadow-sm">
          {/* Pet Selection */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700">Select Pet *</label>
            {loadingPets ? (
              <div className="h-12 w-full bg-gray-100 rounded-xl animate-pulse" />
            ) : (
              <select 
                value={formData.petId} 
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormData({...formData, petId: e.target.value})}
                className="w-full px-4 py-0 border-2 border-gray-200 rounded-xl focus:border-primary focus:outline-none"
                required
              >
                <option value="">Select a pet</option>
                {pets.map((pet) => (
                  <option key={pet.id} value={pet.id}>{pet.name}</option>
                ))}
              </select>
            )}
            {pets.length === 0 && !loadingPets && (
              <p className="text-xs text-red-500">No pets found. Please add a pet first.</p>
            )}
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700">Date *</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-0/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="date"
                  value={formData.scheduledDate}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({...formData, scheduledDate: e.target.value})}
                  className="w-full pl-0 pr-4 py-0 border-2 border-gray-200 rounded-xl focus:border-primary focus:outline-none"
                  min={new Date().toISOString().split('T')[0]}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700">Time *</label>
              <div className="relative">
                <Clock className="absolute left-3 top-0/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="time"
                  value={formData.scheduledTime}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({...formData, scheduledTime: e.target.value})}
                  className="w-full pl-0 pr-4 py-0 border-2 border-gray-200 rounded-xl focus:border-primary focus:outline-none"
                  required
                />
              </div>
            </div>
          </div>

          {/* Address */}
          <div className="space-y-4 border-t pt-4">
            <label className="flex items-center gap-0 text-sm font-semibold text-gray-700">
              <MapPin className="w-4 h-4" /> Service Address
            </label>
            <AddressAutocomplete
              value={formData.address.street}
              onChange={(address: string, components?: AddressComponents) => {
                setFormData({
                  ...formData,
                  address: {
                    street: address,
                    city: components?.city || formData.address.city,
                    state: components?.state || formData.address.state,
                    pincode: components?.pincode || formData.address.pincode,
                  }
                });
              }}
              placeholder="Search address, landmark, city..."
              className="w-full"
            />
            <div className="grid grid-cols-2 gap-4">
              <input
                type="text"
                placeholder="City"
                value={formData.address.city}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({
                  ...formData,
                  address: { ...formData.address, city: e.target.value }
                })}
                className="w-full px-4 py-0 border-2 border-gray-200 rounded-xl focus:border-primary focus:outline-none"
              />
              <input
                type="text"
                placeholder="State"
                value={formData.address.state}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({
                  ...formData,
                  address: { ...formData.address, state: e.target.value }
                })}
                className="w-full px-4 py-0 border-2 border-gray-200 rounded-xl focus:border-primary focus:outline-none"
              />
            </div>
            <input
              type="text"
              placeholder="Pincode"
              value={formData.address.pincode}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({
                ...formData,
                address: { ...formData.address, pincode: e.target.value }
              })}
              className="w-full px-4 py-0 border-2 border-gray-200 rounded-xl focus:border-primary focus:outline-none"
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700">Additional Notes</label>
            <textarea
              placeholder="Any special instructions or notes..."
              value={formData.notes}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData({...formData, notes: e.target.value})}
              rows={4}
              className="w-full px-4 py-0 border-2 border-gray-200 rounded-xl focus:border-primary focus:outline-none resize-none"
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || !formData.petId}
            className="w-full py-4 bg-primary text-white rounded-xl font-semibold hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Creating Booking...' : 'Create Booking'}
          </button>
        </form>
      </div>
    </div>
  );
}

