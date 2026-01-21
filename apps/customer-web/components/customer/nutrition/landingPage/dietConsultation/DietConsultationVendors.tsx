"use client";

import { useState, useEffect } from 'react';
import { ArrowLeft, Star, CheckCircle2, MapPin, Clock } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

interface DietConsultationVendorsProps {
  vendors: any[];
  phone: string;
  onBack: () => void;
  onNavigate?: (screen: string, data?: any) => void;
}

interface BookedVendor {
  vendorId: string;
  bookedAt: Date;
}

export function DietConsultationVendors({ vendors, phone, onBack, onNavigate }: DietConsultationVendorsProps) {
  const [pets, setPets] = useState<any[]>([]);
  const [hasPets, setHasPets] = useState<boolean | null>(null);
  const [bookedVendors, setBookedVendors] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchPets();
  }, [phone]);

  const fetchPets = async () => {
    try {
      const petsData = await apiClient.get(`/customer/pets/${phone}`) as any;
      const petsList = petsData?.pets || [];
      setPets(petsList);
      setHasPets(petsList.length > 0);
    } catch (err: any) {
      console.error('Error loading pets:', err);
      setHasPets(false);
    }
  };

  const handleVendorClick = (vendor: any) => {
    const vendorId = vendor.id || vendor.vendorId;
    
    // Check if already booked
    if (bookedVendors.has(vendorId)) {
      toast.info('You have already booked a consultation with this vendor');
      return;
    }

    // ✅ FIX: Validate pet context before navigation (fallback)
    if (!hasPets || pets.length === 0) {
      toast.error('Please add a pet first before booking nutrition services');
      onNavigate?.('pets', { action: 'add' });
      return;
    }
    
    try {
      onNavigate?.('create-booking', { 
        vendorId: vendorId,
        serviceId: 'pet_nutritionist',
        serviceType: 'Diet Consultation'
      });
    } catch (err: any) {
      console.error('Navigation error:', err);
      toast.error('Failed to navigate. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-[#FF8C42] max-w-md mx-auto pb-24">
      {/* Header - Orange Background */}
      <div className="px-6 pt-12 pb-6">
        <div className="flex items-center gap-4 mb-6">
          <button 
            onClick={onBack}
            className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center hover:bg-white/30 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <h1 className="text-2xl font-bold text-white">Diet Consultation</h1>
        </div>
      </div>

      {/* Main Content - White Card with Top Radius */}
      <div className="bg-white rounded-t-[32px] px-6 pt-8 min-h-[calc(100vh-180px)]">
        <div className="space-y-4">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-slate-900 mb-2">Select a Nutritionist</h2>
            <p className="text-sm text-slate-600">Choose an expert for personalized diet consultation</p>
          </div>

          {/* Vendors List */}
          {vendors.length === 0 ? (
            <Card className="p-8 text-center">
              <div className="text-4xl mb-3">🥗</div>
              <p className="text-gray-600 mb-2">No nutritionists available</p>
              <p className="text-gray-500 text-sm">Check back soon for expert consultants!</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {vendors.map((vendor: any, index: number) => {
                const vendorId = vendor.id || vendor.vendorId;
                const isBooked = bookedVendors.has(vendorId);

                return (
                  <Card
                    key={vendorId || index}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                      isBooked
                        ? 'border-green-200 bg-green-50'
                        : 'border-slate-100 shadow-sm hover:border-orange-200 hover:shadow-md'
                    }`}
                    onClick={() => !isBooked && handleVendorClick(vendor)}
                  >
                    <div className="flex items-start gap-4">
                      {/* Vendor Avatar */}
                      <div className="w-14 h-14 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 font-bold text-xl shrink-0">
                        {vendor.businessName ? vendor.businessName.charAt(0).toUpperCase() : vendor.name ? vendor.name.charAt(0).toUpperCase() : 'N'}
                      </div>

                      {/* Vendor Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-slate-900 truncate mb-1">
                              {vendor.businessName || vendor.name || `Nutritionist ${index + 1}`}
                            </h3>
                            <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
                              {vendor.rating && (
                                <>
                                  <span className="flex items-center gap-1 text-orange-500 font-bold">
                                    <Star className="w-3 h-3 fill-current" />
                                    {vendor.rating.toFixed(1)}
                                  </span>
                                  <span>•</span>
                                </>
                              )}
                              <span>Certified Expert</span>
                            </div>
                            {vendor.address && (
                              <div className="flex items-center gap-1 text-xs text-slate-600 mb-1">
                                <MapPin className="w-3 h-3" />
                                <span className="truncate">{vendor.address}</span>
                              </div>
                            )}
                            {vendor.consultationDuration && (
                              <div className="flex items-center gap-1 text-xs text-slate-600">
                                <Clock className="w-3 h-3" />
                                <span>{vendor.consultationDuration} mins</span>
                              </div>
                            )}
                          </div>
                          
                          {/* Booked Badge */}
                          {isBooked && (
                            <div className="flex items-center gap-1 text-green-600 text-xs font-semibold shrink-0">
                              <CheckCircle2 className="w-4 h-4" />
                              <span>Booked</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}