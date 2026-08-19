'use client';

/**
 * VENDOR DISCOVERY BY PROBLEM
 * 
 * Shows vendors/specialists for a selected problem category
 * Works universally for all vendor types (vet, groomer, trainer, etc.)
 * with contextual tabs and labels
 */

import { useState, useEffect } from 'react';
import { ArrowLeft, MapPin, Phone, Clock, Building2, ChevronRight, User, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api-client';
import { formatRatingNumberOrDash } from '@/lib/rating-display';
import { formatPriceWithSymbol } from '@/lib/booking-display-utils';
import { formatDistanceDisplay } from '@/lib/distance-display';
import { VendorRatingDisplay } from '@/components/customer/shared/VendorRatingDisplay';
import { resolveNextAvailableLabel } from '@/lib/available-slots-response';

interface VendorDiscoveryByProblemProps {
  roleId: string;
  roleName: string;
  problem: any;
  onBack: () => void;
  onVendorSelect: (vendor: any, serviceStyle?: string) => void;
  customerId: string;
  phone: string;
  location?: { lat: number; lng: number };
}

export function VendorDiscoveryByProblem({
  roleId,
  roleName,
  problem,
  onBack,
  onVendorSelect,
  customerId,
  phone,
  location
}: VendorDiscoveryByProblemProps) {
  const [vendors, setVendors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'vendors' | 'specialists'>('vendors');
  const [centers, setCenters] = useState<any[]>([]);
  const [individuals, setIndividuals] = useState<any[]>([]);
  const [displayMode, setDisplayMode] = useState<'staff_only' | 'center_only' | 'both'>('both'); // ✅ NEW

  // ✅ Get contextual labels based on vendor type
  const getContextualLabels = () => {
    const normalizedRole = roleId.replace(/^role_/, '').replace(/^pet_/, '');
    
    const labelMap: Record<string, { centerLabel: string; staffLabel: string; centerIcon: string; staffIcon: string }> = {
      'veterinarian': { centerLabel: 'Clinics', staffLabel: 'Doctors', centerIcon: '🏥', staffIcon: '👨‍⚕️' },
      'vet_clinic': { centerLabel: 'Clinics', staffLabel: 'Doctors', centerIcon: '🏥', staffIcon: '👨‍⚕️' },
      'groomer': { centerLabel: 'Salons', staffLabel: 'Groomers', centerIcon: '💇', staffIcon: '✂️' },
      'grooming_center': { centerLabel: 'Salons', staffLabel: 'Groomers', centerIcon: '💇', staffIcon: '✂️' },
      'trainer': { centerLabel: 'Training Centers', staffLabel: 'Trainers', centerIcon: '🎓', staffIcon: '🏆' },
      'training_center': { centerLabel: 'Training Centers', staffLabel: 'Trainers', centerIcon: '🎓', staffIcon: '🏆' },
      'behaviourist': { centerLabel: 'Behavior Centers', staffLabel: 'Behaviorists', centerIcon: '🧠', staffIcon: '🎯' },
      'behaviorist': { centerLabel: 'Behavior Centers', staffLabel: 'Behaviorists', centerIcon: '🧠', staffIcon: '🎯' },
      'dog_walker': { centerLabel: '', staffLabel: 'Dog Walkers', centerIcon: '', staffIcon: '🦮' },
      'pet_walker': { centerLabel: '', staffLabel: 'Dog Walkers', centerIcon: '', staffIcon: '🦮' },
      'boarding': { centerLabel: 'Boarding Centers', staffLabel: '', centerIcon: '🏨', staffIcon: '' },
      'pet_boarding': { centerLabel: 'Boarding Centers', staffLabel: '', centerIcon: '🏨', staffIcon: '' },
      'boarding_center': { centerLabel: 'Boarding Centers', staffLabel: '', centerIcon: '🏨', staffIcon: '' },
    };
    
    return labelMap[normalizedRole] || { 
      centerLabel: 'Centers', 
      staffLabel: 'Specialists', 
      centerIcon: '🏢', 
      staffIcon: '👤' 
    };
  };

  const labels = getContextualLabels();
  
  // ✅ UPDATED: Use displayMode from API instead of hardcoded labels
  const showCenterTab = displayMode === 'center_only' || displayMode === 'both';
  const showStaffTab = displayMode === 'staff_only' || displayMode === 'both';

  useEffect(() => {
    loadVendors();
  }, [problem]);

  const loadVendors = async () => {
    try {
      setLoading(true);
      
      if (!problem || !problem.id) {
        console.error('❌ Invalid problem object:', problem);
        setLoading(false);
        return;
      }
      
      // ✅ Check if problem already has specialists data from VetServiceRouter
      if (problem.specialists && Array.isArray(problem.specialists)) {
        console.log('✅ Using pre-loaded specialists data:', problem.specialists);
        
        // Map specialists to vendor format
        const mappedVendors = problem.specialists.map((specialist: any) => ({
          ...specialist,
          vendorId: specialist.clinicId,
          vendorName: specialist.clinicName,
          businessName: specialist.clinicName,
          vendorType: 'staff',
          specialists: [specialist],
          location: {
            address: specialist.clinicAddress
          }
        }));
        
        setVendors(mappedVendors);
        setCenters([]);
        setIndividuals(mappedVendors);
        setDisplayMode('staff_only');
        setLoading(false);
        return;
      }
      
      console.log(`🔍 Discovering vendors for problem:`, {
        problemId: problem.id,
        problemName: problem.name,
        roleId
      });

      // ✅ NEW: Use universal problem discovery API
      const problemParams = new URLSearchParams({
        problemGridId: problem.id,
        roleId: roleId,
        sortBy: 'rating',
        feeMin: '0',
        feeMax: '999999'
      });

      // Add location if available
      if (location) {
        problemParams.append('lat', location.lat.toString());
        problemParams.append('lon', location.lng.toString());
      }

      console.log('🌐 Calling universal-problem-discovery API:', problemParams.toString());

      const data = await apiClient.get<{ vendors?: any[]; specialists?: any[]; data?: { vendors?: any[]; specialists?: any[] } }>(`/customer/vendors/by-problem?${problemParams.toString()}`);
      console.log('✅ Discovered vendors via universal API:', data);
        
        // ✅ Map specialists response to vendor format
        const specialists = data.data?.specialists || data.specialists || [];
        
        // Group by vendor/clinic
        const vendorMap = new Map();
        specialists.forEach((specialist: any) => {
          const vendorId = specialist.clinicId || specialist.vendorId;
          if (!vendorMap.has(vendorId)) {
            vendorMap.set(vendorId, {
              vendorId: vendorId,
              vendorName: specialist.clinicName || specialist.vendorName,
              businessName: specialist.clinicName || specialist.vendorName,
              vendorType: 'staff',
              location: {
                address: specialist.clinicAddress || specialist.location
              },
              specialists: []
            });
          }
          vendorMap.get(vendorId).specialists.push(specialist);
        });
        
        const mappedVendors = Array.from(vendorMap.values());
        
        setVendors(mappedVendors);
        setCenters([]);
        setIndividuals(mappedVendors);
        setDisplayMode('staff_only');
        
        if (specialists.length === 0) {
          console.warn('⚠️ No specialists found in response');
        }
    } catch (error) {
      console.error('Error discovering vendors:', error);
    } finally {
      setLoading(false);
    }
  };

  const getServiceStyleIcon = (style: string) => {
    switch (style) {
      case 'at_center':
      case 'at-center':
        return <Building2 className="w-4 h-4" />;
      case 'at_home':
      case 'at-home':
        return <MapPin className="w-4 h-4" />;
      case 'tele':
      case 'teleconsultation':
        return <Phone className="w-4 h-4" />;
      default:
        return <Building2 className="w-4 h-4" />;
    }
  };

  const getServiceStyleLabel = (style: string) => {
    switch (style) {
      case 'at_center':
      case 'at-center':
        return 'At Center';
      case 'at_home':
      case 'at-home':
        return 'At Home';
      case 'tele':
      case 'teleconsultation':
        return 'Tele';
      default:
        return style;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FF8C42] flex flex-col max-w-md mx-auto">
      {/* Status Bar */}
      <div className="px-6 pt-3 pb-2 flex justify-between items-center text-white bg-[#FF8C42]">
        <span>09:41</span>
        <div className="flex gap-1 items-center">
          <div key="signal-1" className="w-4 h-3 bg-white/30"></div>
          <div key="signal-2" className="w-4 h-3 bg-white/30"></div>
          <div key="battery" className="w-6 h-3 bg-white/30"></div>
        </div>
      </div>

      {/* Header */}
      <div className="bg-[#FF8C42] px-6 pt-4 pb-8">
        <div className="flex items-center justify-between mb-6">
          <button 
            onClick={onBack}
            className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center hover:bg-white/30 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <h1 className="text-white font-bold text-xl flex-1 ml-4 line-clamp-1">
            {problem.displayName || problem.name}
          </h1>
        </div>

        {/* Problem Badge */}
        <div className="flex items-center gap-3 bg-white/20 backdrop-blur-sm rounded-xl p-3 border border-white/10">
          <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-2xl">
            {problem.icon}
          </div>
          <div className="flex-1">
            <h2 className="text-white font-medium text-sm">{problem.description}</h2>
            <p className="text-white/80 text-xs mt-1">
              {vendors.length} {vendors.length === 1 ? 'specialist' : 'specialists'} available
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 -mt-4 bg-white rounded-t-[32px] px-6 pt-6 pb-24 min-h-[500px]">
        {/* ✅ Contextual View Toggle */}
        {showCenterTab && showStaffTab && (
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setViewMode('vendors')}
              className={`flex-1 py-2 px-4 rounded-xl text-sm font-medium transition-all ${
                viewMode === 'vendors'
                  ? 'bg-[#FF8C42] text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {labels.centerLabel} ({centers.length})
            </button>
            <button
              onClick={() => setViewMode('specialists')}
              className={`flex-1 py-2 px-4 rounded-xl text-sm font-medium transition-all ${
                viewMode === 'specialists'
                  ? 'bg-[#FF8C42] text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {labels.staffLabel}
            </button>
          </div>
        )}

        {/* Vendors List */}
        {vendors.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-4xl">😔</span>
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">No {roleName}s Found</h3>
            <p className="text-sm text-gray-500 mb-4">
              We couldn't find any specialists for {problem.displayName} in your area.
            </p>
            <Button 
              onClick={onBack}
              className="bg-[#FF8C42] hover:bg-[#FF7A2E]"
            >
              Try Another Category
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* ✅ NEW: CENTER-ONLY MODE (Groomers, Boarders) */}
            {displayMode === 'center_only' && (
              <div className="space-y-3">
                {vendors.map((vendor) => (
                  <VendorCard
                    key={vendor.vendorId}
                    vendor={vendor}
                    problem={problem}
                    onVendorSelect={onVendorSelect}
                    getServiceStyleIcon={getServiceStyleIcon}
                    getServiceStyleLabel={getServiceStyleLabel}
                    labels={labels}
                  />
                ))}
              </div>
            )}

            {/* ✅ NEW: STAFF-ONLY MODE (Vets, Trainers) */}
            {displayMode === 'staff_only' && (
              <div className="space-y-3">
                {vendors.flatMap((vendor: any) => 
                  (vendor.specialists || []).map((specialist: any, idx: number) => (
                    <div
                      key={`${vendor.vendorId}-${specialist.staffId || specialist.id || idx}`}
                      className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all p-4"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white flex-shrink-0">
                          {specialist.fullName?.charAt(0) || labels.staffIcon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-gray-900">{specialist.fullName}</h4>
                          <p className="text-xs text-gray-500 mb-2">
                            {vendor.businessName || vendor.fullName}
                          </p>
                          
                          {/* Services Offered */}
                          {specialist.services && specialist.services.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-gray-100">
                              <p className="text-xs text-gray-500 mb-1">Services:</p>
                              <div className="flex flex-wrap gap-1">
                                {specialist.services.slice(0, 3).map((service: any, idx: number) => (
                                  <span
                                    key={idx}
                                    className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded"
                                  >
                                    {service.name} • ₹{service.price}
                                  </span>
                                ))}
                                {specialist.services.length > 3 && (
                                  <span className="text-xs text-gray-400">
                                    +{specialist.services.length - 3} more
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <Button
                          size="sm"
                          className="w-full bg-[#FF8C42] hover:bg-[#FF7A2E]"
                          onClick={() => onVendorSelect(vendor)}
                        >
                          Book with {specialist.fullName?.split(' ')[0]}
                          <ChevronRight className="w-4 h-4 ml-1" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* ✅ ORIGINAL: BOTH MODE (with tabs) - Legacy support */}
            {displayMode === 'both' && (
              <>
                {/* ✅ Centers Section (for vendors with centers) */}
                {showCenterTab && viewMode === 'vendors' && centers.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                      <span className="text-lg">{labels.centerIcon}</span>
                      {labels.centerLabel} ({centers.length})
                    </h3>
                    <div className="space-y-3">
                      {centers.map((vendor) => (
                        <VendorCard
                          key={vendor.vendorId}
                          vendor={vendor}
                          problem={problem}
                          onVendorSelect={onVendorSelect}
                          getServiceStyleIcon={getServiceStyleIcon}
                          getServiceStyleLabel={getServiceStyleLabel}
                          labels={labels}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* ✅ Individual Practitioners Section (for solo practitioners) */}
                {!showCenterTab && individuals.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                      <span className="text-lg">{labels.staffIcon}</span>
                      {labels.staffLabel} ({individuals.length})
                    </h3>
                    <div className="space-y-3">
                      {individuals.map((vendor) => (
                        <VendorCard
                          key={vendor.vendorId}
                          vendor={vendor}
                          problem={problem}
                          onVendorSelect={onVendorSelect}
                          getServiceStyleIcon={getServiceStyleIcon}
                          getServiceStyleLabel={getServiceStyleLabel}
                          labels={labels}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* ✅ Specialists View - shows all individual doctors/staff across all centers */}
                {showStaffTab && viewMode === 'specialists' && (
                  <div className="space-y-3">
                    {vendors.flatMap((vendor: any) => 
                      (vendor.specialists || []).map((specialist: any, idx: number) => (
                        <div
                          key={`${vendor.vendorId}-${specialist.staffId || specialist.id || idx}`}
                          className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all p-4"
                        >
                          <div className="flex items-start gap-3">
                            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white flex-shrink-0">
                              {specialist.fullName?.charAt(0) || labels.staffIcon}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-semibold text-gray-900">{specialist.fullName}</h4>
                              <p className="text-xs text-gray-500 mb-2">
                                {vendor.businessName || vendor.fullName}
                              </p>
                              
                              {/* Services Offered */}
                              {specialist.services && specialist.services.length > 0 && (
                                <div className="mt-2 pt-2 border-t border-gray-100">
                                  <p className="text-xs text-gray-500 mb-1">Services:</p>
                                  <div className="flex flex-wrap gap-1">
                                    {specialist.services.slice(0, 3).map((service: any, idx: number) => (
                                      <span
                                        key={idx}
                                        className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded"
                                      >
                                        {service.name} • ₹{service.price}
                                      </span>
                                    ))}
                                    {specialist.services.length > 3 && (
                                      <span className="text-xs text-gray-400">
                                        +{specialist.services.length - 3} more
                                      </span>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="mt-3 pt-3 border-t border-gray-100">
                            <Button
                              size="sm"
                              className="w-full bg-[#FF8C42] hover:bg-[#FF7A2E]"
                              onClick={() => onVendorSelect(vendor)}
                            >
                              Book with {specialist.fullName?.split(' ')[0]}
                              <ChevronRight className="w-4 h-4 ml-1" />
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Home Indicator */}
      <div className="fixed bottom-0 left-0 right-0 bg-white flex justify-center pb-2 max-w-md mx-auto">
        <div className="w-32 h-1 bg-black rounded-full"></div>
      </div>
    </div>
  );
}

// ✅ VendorCard component with full profile data
interface VendorCardProps {
  vendor: any;
  problem: any;
  onVendorSelect: (vendor: any, serviceStyle?: string) => void;
  getServiceStyleIcon: (style: string) => JSX.Element;
  getServiceStyleLabel: (style: string) => string;
  labels: any;
}

function VendorCard({
  vendor,
  problem,
  onVendorSelect,
  getServiceStyleIcon,
  getServiceStyleLabel,
  labels
}: VendorCardProps) {
  const nextLabel = resolveNextAvailableLabel(vendor);
  return (
    <div
      className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-all overflow-hidden"
    >
      {/* Vendor Header */}
      <div className="p-4">
        <div className="flex items-start gap-3 mb-3">
          <div className="w-16 h-16 bg-gradient-to-br from-[#FF8C42] to-[#FF6B35] rounded-xl flex items-center justify-center text-white text-xl flex-shrink-0">
            {vendor.businessName?.charAt(0) || vendor.fullName?.charAt(0) || '🏥'}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 mb-1 line-clamp-1">
              {vendor.businessName || vendor.fullName}
            </h3>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <VendorRatingDisplay
                row={{
                  vendorId: vendor.vendorId ?? vendor.id,
                  vendorRating: vendor.rating,
                  vendorReviewCount: vendor.reviewCount ?? vendor.review_count,
                }}
                vendorId={String(vendor.vendorId ?? vendor.id ?? '')}
                starsClassName="w-3.5 h-3.5"
                textClassName="text-xs text-gray-600"
              />
              {formatDistanceDisplay(vendor) && (
                <>
                  <span className="text-gray-300">•</span>
                  <div className="flex items-center gap-1 text-gray-500">
                    <MapPin className="w-4 h-4" />
                    <span className="text-sm">{formatDistanceDisplay(vendor)}</span>
                  </div>
                </>
              )}
            </div>
            <p className="text-xs text-gray-500 line-clamp-2">
              {vendor.location?.address || 'Address not available'}
            </p>
          </div>
        </div>

        {/* Next Available Slot */}
        {nextLabel && (
          <div className="flex items-center gap-2 mb-3 p-2 bg-green-50 rounded-lg border border-green-100">
            <Calendar className="w-4 h-4 text-green-600" />
            <div className="flex-1">
              <p className="text-xs text-green-900">
                Next Available: <span className="font-medium">{nextLabel}</span>
              </p>
            </div>
          </div>
        )}

        {/* Available Service Styles */}
        {vendor.availableServiceStyles && vendor.availableServiceStyles.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {vendor.availableServiceStyles.map((style: string) => (
              <div
                key={style}
                className="flex items-center gap-1 px-3 py-1.5 bg-gray-50 rounded-lg border border-gray-200"
              >
                {getServiceStyleIcon(style)}
                <span className="text-xs font-medium text-gray-700">
                  {getServiceStyleLabel(style)}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Sample Services */}
        {vendor.vendorServices && vendor.vendorServices.length > 0 && (
          <div className="mb-3">
            <p className="text-xs text-gray-500 mb-2">Popular Services:</p>
            <div className="space-y-1">
              {vendor.vendorServices.slice(0, 3).map((service: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between text-xs">
                  <span className="text-gray-700">{service.name}</span>
                  <span className="text-gray-900 font-medium">{formatPriceWithSymbol(service.price)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Specialists Count */}
        {vendor.specialistCount > 0 && (
          <div className="flex items-center justify-between py-2 px-3 bg-blue-50 rounded-lg border border-blue-100">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                <span className="text-white text-lg">{labels.staffIcon}</span>
              </div>
              <div>
                <p className="text-xs text-blue-900 font-medium">
                  {vendor.specialistCount} {labels.staffLabel} Available
                </p>
                <p className="text-xs text-blue-600">
                  Expert in {problem.displayName}
                </p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-blue-500" />
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="border-t border-gray-100 p-4 bg-gray-50">
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => {
              if (vendor.phone) {
                window.location.href = `tel:${vendor.phone}`;
              }
            }}
          >
            <Phone className="w-4 h-4 mr-1" />
            Call
          </Button>
          <Button
            size="sm"
            className="flex-1 bg-[#FF8C42] hover:bg-[#FF7A2E]"
            onClick={() => onVendorSelect(vendor)}
          >
            Book Now
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
}