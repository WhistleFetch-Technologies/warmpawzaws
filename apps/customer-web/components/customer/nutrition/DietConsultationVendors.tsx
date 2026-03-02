"use client";

import { useState, useEffect } from 'react';
import { ArrowLeft, Star, MapPin, Video, Loader2, ChevronRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import { formatPriceWithSymbol } from '@/lib/booking-display-utils';
import { NutritionistBookingRouter } from './NutritionistBookingRouter';
import { DietConsultationVendorsProps, Vendor } from './constants/interface';



export function DietConsultationVendors({ phone, onBack, onNavigate }: DietConsultationVendorsProps) {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [pets, setPets] = useState<any[]>([]);
  const [hasPets, setHasPets] = useState<boolean | null>(null);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [nutritionist, setNutritionist] = useState<any>(null);
  const [loadingVendor, setLoadingVendor] = useState(false);

  useEffect(() => {
    fetchPets();
    loadVendors();
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

  const loadVendors = async () => {
    try {
      setLoading(true);

      // Get customer location for distance-based sorting
      let locationParams = '';
      try {
        const customerLat = localStorage.getItem('customer_latitude');
        const customerLng = localStorage.getItem('customer_longitude');
        if (customerLat && customerLng) {
          locationParams = `&latitude=${customerLat}&longitude=${customerLng}`;
        }
      } catch (e) {
        console.log('Could not get customer location');
      }

      // Fetch vendors with tele style (not services)
      const response = await apiClient.get(
        `/customer/services/by-style?style=tele&category=nutritionist&roleId=nutritionist${locationParams}`
      ) as any;
      if (response.success && response.providers) {
        // Extract vendors from providers (ignore services for now)
        const vendorList: Vendor[] = response.providers.map((provider: any) => ({
          id: provider.id || provider.vendorId || provider.providerId,
          vendorId: provider.id || provider.vendorId || provider.providerId,
          providerId: provider.id || provider.vendorId || provider.providerId,
          name: provider.name || provider.businessName || 'Nutritionist',
          businessName: provider.businessName || provider.name,
          rating: provider.rating,
          reviewCount: provider.reviewCount,
          address: provider.address,
          city: provider.city,
          distance: provider.distance,
          distanceText: provider.distanceText,
          photoUrl: provider.photoUrl,
          priceMin: provider.priceMin,
          priceMax: provider.priceMax,
          nextAvailable: provider.nextAvailable,
        }));

        setVendors(vendorList);

        console.log(`✅ Loaded ${vendorList.length} vendors with tele style`);
      } else {
        console.warn('⚠️ No vendors found or invalid response');
        setVendors([]);
      }
    } catch (error: any) {
      console.error('❌ Error loading vendors:', error);
      toast.error('Failed to load vendors. Please try again.');
      setVendors([]);
    } finally {
      setLoading(false);
    }
  };

  const loadVendorDetails = async (vendorId: string) => {
    try {
      setLoadingVendor(true);
      const vendorResponse = await apiClient.get(`/customer/vendor/${vendorId}`) as any;
      if (vendorResponse?.vendor || vendorResponse) {
        setNutritionist(vendorResponse.vendor || vendorResponse);
      }
    } catch (error) {
      console.warn('Could not load vendor details:', error);
      // Continue without vendor details - not critical
    } finally {
      setLoadingVendor(false);
    }
  };

  const handleVendorClick = async (vendor: Vendor) => {
    // Validate pet context before proceeding
    if (!hasPets || pets.length === 0) {
      toast.error('Please add a pet first before booking nutrition services');
      onNavigate?.('pets', { action: 'add' });
      return;
    }

    // Load vendor details and set selected vendor
    setSelectedVendor(vendor);
    await loadVendorDetails(vendor.vendorId);
  };

  const handleBackFromBooking = () => {
    setSelectedVendor(null);
    setNutritionist(null);
  };

  // If a vendor is selected, render the booking router
  // User will select a service from this vendor's services in the booking router
  if (selectedVendor) {
    return (
      <NutritionistBookingRouter
        phone={phone}
        vendorId={selectedVendor.vendorId}
        nutritionist={nutritionist || {
          id: selectedVendor.vendorId,
          name: selectedVendor.name,
          businessName: selectedVendor.businessName || selectedVendor.name,
          rating: selectedVendor.rating,
          address: selectedVendor.address,
        }}
        serviceStyle="tele"
        onBack={handleBackFromBooking}
        onNavigate={(screen, data) => {
          if (screen === 'pets') {
            onNavigate?.('pets', data);
          } else if (screen === 'booking-details' || screen === 'booking-confirmation') {
            onNavigate?.('booking-details', data);
          } else {
            onNavigate?.(screen, data);
          }
        }}
        onViewBooking={(bookingId) => {
          onNavigate?.('booking-details', { bookingId });
        }}
      />
    );
  }

  // Otherwise, render the services list
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
            <h2 className="text-lg font-bold text-slate-900 mb-2">Select Nutritionist</h2>
            <p className="text-sm text-slate-600">Choose a nutritionist for your diet consultation</p>
          </div>

          {/* Loading State */}
          {loading ? (
            <Card className="p-8 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-orange-500 mx-auto mb-3" />
              <p className="text-gray-600">Loading nutritionists...</p>
            </Card>
          ) : vendors.length === 0 ? (
            <Card className="p-8 text-center">
              <div className="text-4xl mb-3">🥗</div>
              <p className="text-gray-600 mb-2">No nutritionists available</p>
              <p className="text-gray-500 text-sm">Check back soon for diet consultation services!</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {vendors.map((vendor, index) => (
                <Card
                  key={vendor.id || index}
                  className="p-4 rounded-2xl border border-slate-100 shadow-sm hover:border-orange-200 hover:shadow-md transition-all cursor-pointer"
                  onClick={() => handleVendorClick(vendor)}
                >
                  <div className="flex items-start gap-4">
                    {/* Vendor Icon/Avatar */}
                    <div className="w-14 h-14 bg-green-100 rounded-xl flex items-center justify-center shrink-0 overflow-hidden">
                      {vendor.photoUrl ? (
                        <img src={vendor.photoUrl} alt={vendor.name} className="w-full h-full object-cover" />
                      ) : (
                        <Video className="w-6 h-6 text-green-600" />
                      )}
                    </div>

                    {/* Vendor Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-slate-900 truncate mb-1">
                            {vendor.businessName || vendor.name}
                          </h3>
                          <div className="flex items-center gap-3 text-xs text-slate-500 mb-2">
                            {vendor.rating !== undefined && vendor.rating > 0 && (
                              <>
                                <div className="flex items-center gap-1 text-orange-500 font-bold">
                                  <Star className="w-3 h-3 fill-current" />
                                  <span>{vendor.rating.toFixed(1)}</span>
                                </div>
                                {vendor.reviewCount && vendor.reviewCount > 0 && (
                                  <>
                                    <span>•</span>
                                    <span>{vendor.reviewCount} reviews</span>
                                  </>
                                )}
                              </>
                            )}
                            {vendor.distanceText && (
                              <>
                                <span>•</span>
                                <span>{vendor.distanceText}</span>
                              </>
                            )}
                          </div>
                          {vendor.address && (
                            <div className="flex items-center gap-1 text-xs text-slate-600 mb-2">
                              <MapPin className="w-3 h-3" />
                              <span className="truncate">{vendor.address}</span>
                            </div>
                          )}

                          {
                            vendor.nextAvailable && (
                              <div className="text-xs text-slate-500 ">
                                <span className="font-semibold text-slate-900 ">
                                  {vendor.nextAvailable.display}
                                </span>
                              </div>
                            )
                          }
                          {(vendor.priceMin || vendor.priceMax) && (
                            <div className="text-xs text-slate-500">
                              <span className="font-semibold text-slate-900">
                                {vendor.priceMin && vendor.priceMax && vendor.priceMin !== vendor.priceMax
                                  ? `${formatPriceWithSymbol(vendor.priceMin)} - ${formatPriceWithSymbol(vendor.priceMax)}`
                                  : formatPriceWithSymbol(vendor.priceMin || vendor.priceMax || 0)}
                              </span>
                            </div>
                          )}
                        </div>
                        <ChevronRight className="w-5 h-5 text-slate-400 shrink-0 mt-1" />
                      </div>
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