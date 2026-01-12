'use client';

import { useState, useEffect } from 'react';
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/states';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowLeft, User, Phone, Mail, MapPin, ChevronRight, Calendar } from 'lucide-react';
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
      
      const data = await apiClient.get<{ profile?: Profile }>(
        `/customer/profile?phone=${encodeURIComponent(phone)}`
      );
      
      setProfile(data.profile || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load profile');
      console.error('Error fetching profile:', err);
    } finally {
      setLoading(false);
    }
  };
  
  if (loading) return <LoadingState message="Loading profile..." />;
  if (error) return <ErrorState message={error} onRetry={fetchProfile} />;
  if (!profile) return <EmptyState message="Profile not found" />;

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#FF8C42] text-white px-4 py-4 flex items-center gap-3 shadow-sm">
        <button onClick={onBack} className="p-1 hover:bg-white/20 rounded-lg transition-colors">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-lg font-bold">My Profile</h1>
      </div>

      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Personal Information */}
        <Card className="p-5">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center text-[#FF8C42]">
              <User className="w-8 h-8" />
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
        </Card>

        {/* Address */}
        {profile.address && (
          <Card className="p-5">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-[#FF8C42]" /> Address
            </h3>
            <div className="text-gray-600 text-sm space-y-1">
              <p>{profile.address.street}</p>
              <p>{profile.address.city}, {profile.address.state} - {profile.address.pincode}</p>
            </div>
          </Card>
        )}

        {/* My Pets */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              🐾 My Pets ({profile.pets?.length || 0})
            </h3>
            <div className="flex gap-2">
              {onNavigate && (
                <>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => onNavigate('add-pet')} 
                    className="text-[#FF8C42]"
                  >
                    Add Pet
                  </Button>
                  {profile.pets && profile.pets.length > 0 && (
                    <Button variant="ghost" size="sm" onClick={() => onNavigate('pets')} className="text-[#FF8C42]">
                      Manage
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
          
          {profile.pets && profile.pets.length > 0 ? (
            <div className="space-y-3">
              {profile.pets.map((pet) => (
                <button
                  key={pet.id}
                  onClick={() => onNavigate && onNavigate('pet-details', { petId: pet.id })}
                  className="w-full flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors text-left"
                >
                  <div>
                    <p className="font-medium text-gray-900">{pet.name}</p>
                    <p className="text-xs text-gray-500">{pet.type}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </button>
              ))}
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-sm text-gray-500 mb-3">No pets added yet.</p>
              {onNavigate && (
                <Button 
                  onClick={() => onNavigate('add-pet')} 
                  className="bg-[#FF8C42] hover:bg-[#FF7A2E] text-white"
                >
                  Add Your First Pet
                </Button>
              )}
            </div>
          )}
        </Card>

        {/* Quick Links */}
        <Card className="p-0 overflow-hidden">
          <div className="divide-y">
            {onNavigate && (
              <button 
                onClick={() => onNavigate('bookings')}
                className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <Calendar className="w-5 h-5 text-blue-500" />
                  <span className="font-medium text-gray-700">My Bookings</span>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </button>
            )}
            {/* Add more links here if needed */}
          </div>
        </Card>
      </div>
    </div>
  );
}
