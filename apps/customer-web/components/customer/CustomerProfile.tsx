'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, User, Phone, Mail, MapPin, ChevronRight } from 'lucide-react';
import Image from 'next/image';
import { apiClient } from '@/lib/api-client';

interface CustomerProfileProps {
  phone: string;
  onBack: () => void;
  onNavigate?: (screen: string, data?: any) => void;
}

interface Profile {
  id: string;
  phone: string;
  name: string;
  email?: string;
  address?: {
    street: string;
    city: string;
    state: string;
    pincode: string;
  };
  pets: Array<{
    id: string;
    name: string;
    type: string;
  }>;
}

export function CustomerProfile({ phone, onBack, onNavigate }: CustomerProfileProps) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    fetchProfile();
  }, [phone]);
  
  const fetchProfile = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await apiClient.get<{ profile: Profile }>(`/customer/profile?phone=${encodeURIComponent(phone)}`);
      if (response.profile) {
        setProfile(response.profile);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load profile');
      console.error('Error fetching profile:', err);
    } finally {
      setLoading(false);
    }
  };
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={fetchProfile}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Profile not found</p>
          <button
            onClick={onBack}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-primary text-white px-4 py-4 flex items-center gap-3 shadow-sm">
        <button 
          onClick={onBack} 
          className="p-1 hover:bg-white/20 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-lg font-bold">My Profile</h1>
      </div>

      <div className="container mx-auto px-4 py-6 space-y-6 max-w-[430px]">
        {/* Personal Information */}
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center">
              <User className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">{profile.name}</h2>
              <p className="text-sm text-gray-500">{profile.phone}</p>
            </div>
          </div>
          
          <div className="space-y-3 pt-4 border-t">
            <div className="flex items-center gap-3 text-gray-700">
              <Phone className="w-4 h-4 text-gray-400" />
              <span>{profile.phone}</span>
            </div>
            {profile.email && (
              <div className="flex items-center gap-3 text-gray-700">
                <Mail className="w-4 h-4 text-gray-400" />
                <span>{profile.email}</span>
              </div>
            )}
          </div>
        </div>

        {/* Address */}
        {profile.address && (
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-primary" /> Address
            </h3>
            <div className="text-gray-600 text-sm space-y-1">
              <p>{profile.address.street}</p>
              <p>{profile.address.city}, {profile.address.state} - {profile.address.pincode}</p>
            </div>
          </div>
        )}

        {/* My Pets */}
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              🐾 My Pets ({profile.pets?.length || 0})
            </h3>
            {onNavigate && (
              <button 
                onClick={() => onNavigate('pets')} 
                className="text-primary hover:text-primary-dark text-sm font-medium"
              >
                Manage
              </button>
            )}
          </div>
          
          {profile.pets && profile.pets.length > 0 ? (
            <div className="space-y-3">
              {profile.pets.map((pet) => (
                <div 
                  key={pet.id} 
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                  onClick={() => onNavigate?.('pet-details', { petId: pet.id })}
                >
                  <div>
                    <p className="font-medium text-gray-900">{pet.name}</p>
                    <p className="text-xs text-gray-500">{pet.type}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500 text-sm mb-4">No pets added yet</p>
              {onNavigate && (
                <button
                  onClick={() => onNavigate('add-pet')}
                  className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors text-sm"
                >
                  Add Pet
                </button>
              )}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <h3 className="font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div className="space-y-2">
            {onNavigate && (
              <>
                <button
                  onClick={() => onNavigate('bookings')}
                  className="w-full flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <span className="text-gray-700">View All Bookings</span>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </button>
                <button
                  onClick={() => onNavigate('orders')}
                  className="w-full flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <span className="text-gray-700">Order History</span>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

