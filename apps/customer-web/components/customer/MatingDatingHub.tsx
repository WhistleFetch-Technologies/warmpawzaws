"use client";

import { useState, useEffect } from 'react';
import { ArrowLeft, Heart, Search, Filter, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

interface MatingDatingHubProps {
  phone?: string;
  customerPhone?: string;
  customerId?: string;
  petId?: string;
  bookingId?: string;
  orderId?: string;
  cafeId?: string;
  preSelectedVendorId?: string;
  vendorId?: string;
  onBack: () => void;
  onNavigate?: (screen: string, data?: any) => void;
  onSuccess?: (bookingId?: string) => void;
  onComplete?: () => void;
}

export function MatingDatingHub(props: MatingDatingHubProps) {
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterBreed, setFilterBreed] = useState('');
  const phone = props.customerPhone || props.phone;

  useEffect(() => {
    if (phone) {
      loadProfiles();
    } else {
      setLoading(false);
    }
  }, [phone, filterBreed]);

  const loadProfiles = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filterBreed) params.append('breed', filterBreed);
      const response = await apiClient.get<any>(`/customer/pet-matching?${params.toString()}`);
      setProfiles(response.profiles || response || []);
    } catch (error: any) {
      console.error('Error loading profiles:', error);
      setProfiles([]);
      // ✅ FIX: Show error toast for API failures
      toast.error('Failed to load pet profiles. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const filteredProfiles = profiles.filter(profile =>
    !searchQuery || 
    profile.petName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    profile.breed?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!phone) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-md mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <Button variant="ghost" size="icon" onClick={props.onBack} className="rounded-full">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-xl font-semibold">Pet Matching</h1>
          </div>
          <Card className="p-6 text-center">
            <p className="text-gray-600">Please login to access pet matching</p>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="max-w-md mx-auto bg-white min-h-screen">
        <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={props.onBack} className="rounded-full">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-xl font-semibold">Pet Matching</h1>
          </div>
        </div>

        <div className="p-4 space-y-4">
          <Card className="p-4 bg-gradient-to-br from-pink-50 to-purple-50 border-pink-200">
            <div className="flex items-center gap-3">
              <Heart className="w-8 h-8 text-pink-600" />
              <div>
                <h3 className="font-semibold text-gray-900">Find Your Pet's Match</h3>
                <p className="text-sm text-gray-600">Connect with other pet owners</p>
              </div>
            </div>
          </Card>

          <div className="space-y-3">
            <Input
              placeholder="Search by name or breed..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full"
            />
            <div className="flex gap-2 overflow-x-auto pb-2">
              {['All', 'Labrador', 'Golden Retriever', 'German Shepherd', 'Persian', 'Siamese'].map((breed) => (
                <Button
                  key={breed}
                  variant={filterBreed === breed ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilterBreed(breed === 'All' ? '' : breed)}
                  className={`flex-shrink-0 ${filterBreed === breed ? 'bg-pink-600 text-white' : ''}`}
                >
                  {breed}
                </Button>
              ))}
            </div>
          </div>

          {loading ? (
            <Card className="p-8 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-pink-500 border-t-transparent mx-auto mb-4"></div>
              <p className="text-gray-600">Loading profiles...</p>
            </Card>
          ) : filteredProfiles.length === 0 ? (
            <Card className="p-8 text-center">
              <Heart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 font-medium mb-2">No matches found</p>
              <p className="text-sm text-gray-500">Try adjusting your search or filters</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredProfiles.map((profile) => (
                <Card key={profile.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-16 h-16 bg-gradient-to-br from-pink-200 to-purple-200 rounded-full flex items-center justify-center text-2xl">
                      {profile.emoji || '🐾'}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3 className="font-semibold text-gray-900">{profile.petName || 'Pet'}</h3>
                          <p className="text-sm text-gray-600">{profile.breed || 'Mixed'}</p>
                        </div>
                        {profile.age && (
                          <Badge variant="outline">{profile.age} years</Badge>
                        )}
                      </div>
                      {profile.ownerName && (
                        <div className="flex items-center gap-1 text-sm text-gray-500 mb-2">
                          <User className="w-4 h-4" />
                          Owner: {profile.ownerName}
                        </div>
                      )}
                      {profile.location && (
                        <p className="text-xs text-gray-500">{profile.location}</p>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
