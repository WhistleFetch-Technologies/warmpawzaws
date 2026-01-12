"use client";

import { useState, useEffect } from 'react';
import { ArrowLeft, Heart, Star, MapPin, Sparkles, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

interface AdoptionServiceRouterProps {
  phone: string;
  onBack: () => void;
  onViewBooking?: (bookingId: string) => void;
  onNavigate?: (screen: string, data?: any) => void;
}

export function AdoptionServiceRouter({ phone, onBack, onViewBooking, onNavigate }: AdoptionServiceRouterProps) {
  const [loading, setLoading] = useState(true);
  const [shelters, setShelters] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    loadShelters();
  }, []);

  const loadShelters = async () => {
    try {
      setLoading(true);
      const endpoint = `/customer/discover-services?category=adoption&roleId=ngo`;
      const data = await apiClient.get<{ vendors?: any[]; services?: any[] }>(endpoint);
      const shelterList = data.vendors || data.services || [];
      setShelters(shelterList);
      
      setStats({
        availablePets: shelterList.reduce((acc: number, s: any) => acc + (s.availablePets || 0), 0) || 200,
        adopted: '500+',
        rating: shelterList.length > 0 
          ? (shelterList.reduce((acc: number, s: any) => acc + (s.rating || 4.9), 0) / shelterList.length).toFixed(1) 
          : '4.9'
      });
    } catch (error) {
      console.error('Error loading shelters:', error);
      setShelters([]);
      setStats({ availablePets: 200, adopted: '500+', rating: '4.9' });
    } finally {
      setLoading(false);
    }
  };

  const handleShelterSelect = (shelter: any) => {
    onNavigate?.('adoption_questionnaire', { shelterId: shelter.id || shelter.vendorId });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-pink-50 to-white flex items-center justify-center max-w-md mx-auto">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-50 to-white max-w-md mx-auto">
      <div className="bg-gradient-to-br from-pink-500 to-rose-600 text-white px-6 pt-8 pb-16 relative">
        <button onClick={onBack} className="mb-4 flex items-center gap-2 text-white/90 hover:text-white">
          <ArrowLeft className="w-5 h-5" />
          <span>Back</span>
        </button>
        
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
            <Heart className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Adopt a Pet</h1>
            <p className="text-white/80 text-sm">Give a loving home</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 border border-white/20">
            <div className="text-2xl font-bold">{stats?.availablePets || 200}+</div>
            <div className="text-white/80 text-xs">Pets Available</div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 border border-white/20">
            <div className="text-2xl font-bold">{stats?.adopted || '500+'}</div>
            <div className="text-white/80 text-xs">Adopted</div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 border border-white/20">
            <div className="flex items-center gap-1 text-2xl font-bold">
              <Star className="w-4 h-4 fill-white" />
              {stats?.rating || '4.9'}
            </div>
            <div className="text-white/80 text-xs">Happy Homes</div>
          </div>
        </div>
        
        <div className="absolute bottom-0 left-0 right-0 h-8 bg-white" 
             style={{
               borderTopLeftRadius: '50% 100%',
               borderTopRightRadius: '50% 100%',
             }}
        />
      </div>

      <div className="px-6 py-6">
        {/* Adoption Options */}
        <div className="space-y-3 mb-6">
          {[
            {
              title: 'Adopt from NGOs',
              description: 'Give a home to rescued pets',
              icon: '❤️',
              count: `${stats?.availablePets || 200}+ pets`,
              onClick: () => onNavigate?.('adoption_questionnaire', { type: 'ngo' })
            },
            {
              title: 'Certified Breeders',
              description: 'Ethical & verified breeders',
              icon: '🏆',
              count: '30+ breeders',
              onClick: () => onNavigate?.('breeder')
            },
            {
              title: 'Pet Rehoming',
              description: 'Find loving owners',
              icon: '🏡',
              count: '20+ listings',
              onClick: () => onNavigate?.('adoption_questionnaire', { type: 'rehoming' })
            },
          ].map((option, index) => (
            <div key={index} className="bg-gradient-to-r from-red-50 to-pink-50 rounded-2xl p-4 border border-red-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-2xl shadow-sm">
                  {option.icon}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-800">{option.title}</h3>
                  <p className="text-xs text-gray-600">{option.description}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs font-medium text-red-600 mb-1">{option.count}</p>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </div>
            </div>
          ))}
        </div>

        {/* Featured Shelters */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-900">Adoption Centers</h2>
            <button 
              className="text-sm text-pink-600 flex items-center gap-1 font-medium"
              onClick={() => onNavigate?.('adoption_questionnaire')}
            >
              View All <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {shelters.length === 0 ? (
            <Card className="p-8 text-center">
              <Heart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="font-semibold text-gray-900 mb-2">No Adoption Centers Found</h3>
              <p className="text-sm text-gray-500">Try adjusting your search or check back later</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {shelters.slice(0, 5).map((shelter, index) => (
                <div 
                  key={shelter.id || shelter.vendorId || index}
                  className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4 cursor-pointer hover:border-pink-200 transition-colors"
                  onClick={() => handleShelterSelect(shelter)}
                >
                  <div className="w-14 h-14 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 font-bold text-xl shrink-0">
                     {shelter.businessName ? shelter.businessName.charAt(0) : 'A'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-slate-900 truncate">{shelter.businessName || shelter.name || `Adoption Center ${index}`}</h3>
                    <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                      <span className="flex items-center gap-1 text-pink-500 font-bold">
                        <Star className="w-3 h-3 fill-current" />
                        {shelter.rating || 4.9}
                      </span>
                      <span>•</span>
                      <span>{shelter.availablePets || 0} pets</span>
                    </div>
                  </div>
                  <div className="text-right">
                     <ChevronRight className="w-5 h-5 text-gray-400" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
