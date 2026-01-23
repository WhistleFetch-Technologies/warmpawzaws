'use client';

import { useState, useEffect } from 'react';
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/states';
import { Button } from '@/components/ui/button';
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
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header - gradient matching customer home (FF8C42 → FF6B35) */}
      <div className="bg-gradient-to-br from-[#FF8C42] via-[#FF7A35] to-[#FF6B35] px-4 pt-4 pb-5 flex items-center gap-3">
        <button
          onClick={onBack}
          className="w-10 h-10 flex-shrink-0 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white/30 transition-colors"
          aria-label="Go back"
        >
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        <h1 className="text-lg font-bold text-white tracking-tight">My Profile</h1>
      </div>

      {/* Content - curved top matching customer home */}
      <div className="max-w-[430px] mx-auto -mt-1 rounded-t-[24px] bg-white shadow-[0_-4px_20px_rgba(0,0,0,0.06)] px-4 pt-6 pb-8">
        {/* Personal Information - design system card */}
        <div className="card rounded-2xl p-5 border border-gray-100 mb-4">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#FFF5EE] to-[#FFE8D6] flex items-center justify-center border border-orange-100/50">
              <User className="w-8 h-8 text-[#FF8C42]" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold text-gray-900 truncate">{profile.name}</h2>
              <p className="text-sm text-gray-500">{profile.phone}</p>
            </div>
          </div>

          <div className="space-y-3 pt-4 border-t border-gray-100">
            <div className="flex items-center gap-3 text-gray-700">
              <Phone className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <span className="text-sm">{profile.phone}</span>
            </div>
            {profile.email && (
              <div className="flex items-center gap-3 text-gray-700">
                <Mail className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <span className="text-sm">{profile.email}</span>
              </div>
            )}
          </div>
        </div>

        {/* Address */}
        {profile.address && (
          <div className="card rounded-2xl p-5 border border-gray-100 mb-4">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-[#FF8C42]" /> Address
            </h3>
            <div className="text-gray-600 text-sm space-y-1">
              <p>{profile.address.street}</p>
              <p>
                {profile.address.city}, {profile.address.state} – {profile.address.pincode}
              </p>
            </div>
          </div>
        )}

        {/* My Pets */}
        <div className="card rounded-2xl p-5 border border-gray-100 mb-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              🐾 My Pets ({profile.pets?.length || 0})
            </h3>
            <div className="flex gap-2">
              {onNavigate && (
                <>
                  <button
                    onClick={() => onNavigate('add-pet')}
                    className="text-sm font-semibold text-[#FF8C42] hover:text-[#FF7A35] transition-colors"
                  >
                    Add Pet
                  </button>
                  {profile.pets && profile.pets.length > 0 && (
                    <button
                      onClick={() => onNavigate('pets')}
                      className="text-sm font-semibold text-[#FF8C42] hover:text-[#FF7A35] transition-colors"
                    >
                      Manage
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {profile.pets && profile.pets.length > 0 ? (
            <div className="space-y-2">
              {profile.pets.map((pet) => (
                <button
                  key={pet.id}
                  onClick={() => onNavigate && onNavigate('pet-details', { petId: pet.id })}
                  className="w-full flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors text-left border border-transparent hover:border-gray-100"
                >
                  <div>
                    <p className="font-medium text-gray-900">{pet.name}</p>
                    <p className="text-xs text-gray-500">{pet.type}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                </button>
              ))}
            </div>
          ) : (
            <div className="text-center py-6">
              <p className="text-sm text-gray-500 mb-4">No pets added yet.</p>
              {onNavigate && (
                <Button
                  onClick={() => onNavigate('add-pet')}
                  className="bg-[#FF8C42] hover:bg-[#FF7A35] text-white font-semibold rounded-xl px-6 py-2.5 shadow-[0_2px_8px_rgba(255,140,66,0.35)]"
                >
                  Add Your First Pet
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Quick Links - list item style matching design system */}
        <div className="rounded-2xl overflow-hidden border border-gray-100 bg-white shadow-sm">
          {onNavigate && (
            <button
              onClick={() => onNavigate('bookings')}
              className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#EBF5FF] flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-[#3348FF]" />
                </div>
                <span className="font-medium text-gray-800">My Bookings</span>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
