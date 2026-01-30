'use client';

/**
 * ============================================================================
 * PROBLEM GRID FLOW ROUTER
 * ============================================================================
 * 
 * Orchestrates the complete flow from Problem Grid selection to booking
 * - User selects a problem/need from grid
 * - Shows available service styles (Home, Center, Tele)
 * - Routes to appropriate service discovery with pre-applied filters
 * - Maintains context through the entire booking flow
 * 
 * Date: 2026-01-20
 * ============================================================================
 */

import React, { useState, useEffect } from 'react';
import { 
  Home, Building2, Video, ArrowLeft, ArrowRight, 
  Loader2, MapPin, Calendar, Filter, X, Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api-client';
import { ServiceDiscovery } from './ServiceDiscovery';
import { BookingFlow } from './BookingFlow';

// ============================================================================
// TYPES
// ============================================================================

interface ProblemGridItem {
  id: string;
  name: string;
  icon: string;
  description?: string;
  allowedServiceStyles?: ServiceStyle[];  // Optional - fetched from API
  linkedServiceRoles: string[];
  specializations?: string[];
  category: string;
  popular?: boolean;
  roleId?: string;
}

type ServiceStyle = 'at_home' | 'at_center' | 'tele';

interface ServiceProvider {
  id: string;
  type: 'vendor' | 'staff';
  vendorId: string;
  name: string;
  photo?: string;
  rating: number;
  reviewCount: number;
  experience?: string;
  specializations: string[];
  distance: number;
  distanceFormatted: string;
  nextAvailable?: string;
  price: number;
  priceFormatted: string;
  serviceId: string;
  serviceName: string;
  isInstantAvailable?: boolean;
}

interface ProblemGridFlowRouterProps {
  initialProblem?: ProblemGridItem;
  location?: { lat: number; lng: number };
  customerId?: string;
  onClose?: () => void;
  onBookingComplete?: (bookingId: string) => void;
}

// ============================================================================
// SERVICE STYLE CONFIGURATION
// ============================================================================

const SERVICE_STYLE_CONFIG: Record<ServiceStyle, {
  label: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  description: string;
}> = {
  at_home: {
    label: 'At Home',
    icon: <Home className="w-6 h-6" />,
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    description: 'Service at your doorstep',
  },
  at_center: {
    label: 'At Clinic/Center',
    icon: <Building2 className="w-6 h-6" />,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    description: 'Visit the service center',
  },
  tele: {
    label: 'Video Call',
    icon: <Video className="w-6 h-6" />,
    color: 'text-purple-600',
    bgColor: 'bg-purple-100',
    description: 'Online consultation',
  },
};

// ============================================================================
// FLOW STEPS
// ============================================================================

type FlowStep = 'service-style' | 'discovery' | 'booking' | 'confirmation';

// ============================================================================
// COMPONENT
// ============================================================================

export function ProblemGridFlowRouter({
  initialProblem,
  location,
  customerId,
  onClose,
  onBookingComplete,
}: ProblemGridFlowRouterProps) {
  // State
  const [currentStep, setCurrentStep] = useState<FlowStep>('service-style');
  const [selectedProblem, setSelectedProblem] = useState<ProblemGridItem | null>(initialProblem || null);
  const [selectedServiceStyle, setSelectedServiceStyle] = useState<ServiceStyle | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<ServiceProvider | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingProblemDetails, setLoadingProblemDetails] = useState(false);
  const [providers, setProviders] = useState<ServiceProvider[]>([]);
  const [showInstantOption, setShowInstantOption] = useState(false);
  const [isInstantMode, setIsInstantMode] = useState(false);
  const [allowedServiceStyles, setAllowedServiceStyles] = useState<ServiceStyle[]>(['at_home', 'at_center', 'tele']);
  
  // Computed - use fetched allowedServiceStyles, fallback to problem's styles, then default
  const availableStyles = allowedServiceStyles.length > 0 
    ? allowedServiceStyles 
    : (selectedProblem?.allowedServiceStyles || ['at_home', 'at_center', 'tele']);
  const hasTeleOption = availableStyles.includes('tele');

  // Fetch problem details including allowedServiceStyles when problem changes
  useEffect(() => {
    if (selectedProblem?.id && selectedProblem?.roleId) {
      fetchProblemDetails();
    }
  }, [selectedProblem?.id, selectedProblem?.roleId]);

  const fetchProblemDetails = async () => {
    if (!selectedProblem) return;
    
    setLoadingProblemDetails(true);
    try {
      // Fetch problem details including allowedServiceStyles from public/problems
      const roleId = selectedProblem.roleId || selectedProblem.linkedServiceRoles?.[0] || 'vet';
      const res = await apiClient.get<any>(`/public/problems?roleId=${roleId}`);
      
      if (res.success && res.problems) {
        // Find the matching problem to get its allowedServiceStyles
        const matchingProblem = res.problems.find(
          (p: any) => p.id === selectedProblem.id
        );
        
        if (matchingProblem?.allowedServiceStyles) {
          setAllowedServiceStyles(matchingProblem.allowedServiceStyles as ServiceStyle[]);
        } else if (selectedProblem.allowedServiceStyles) {
          // Use the styles from initialProblem if API doesn't return them
          setAllowedServiceStyles(selectedProblem.allowedServiceStyles);
        }
      }
    } catch (error: any) {
      console.error('Error fetching problem details:', error);
      // Fallback to problem's styles or defaults
      if (selectedProblem.allowedServiceStyles) {
        setAllowedServiceStyles(selectedProblem.allowedServiceStyles);
      }
    } finally {
      setLoadingProblemDetails(false);
    }
  };

  // Fetch providers when service style is selected
  useEffect(() => {
    if (selectedServiceStyle && selectedProblem) {
      fetchProviders();
    }
  }, [selectedServiceStyle, selectedProblem]);

  const fetchProviders = async () => {
    if (!selectedProblem || !selectedServiceStyle) return;
    
    // Validate that the selected style is allowed for this problem
    if (!availableStyles.includes(selectedServiceStyle)) {
      console.warn(`Service style ${selectedServiceStyle} is not allowed for problem ${selectedProblem.id}`);
      setProviders([]);
      return;
    }
    
    setLoading(true);
    try {
      const params = new URLSearchParams({
        serviceStyle: selectedServiceStyle,
        problemGridId: selectedProblem.id,
        specializations: selectedProblem.specializations?.join(',') || '',
        roles: selectedProblem.linkedServiceRoles?.join(',') || '',
        ...(location && {
          lat: location.lat.toString(),
          lng: location.lng.toString(),
        }),
      });

      // Try the search/providers endpoint first, fall back to customer/services/by-problem
      let res: any;
      try {
        res = await apiClient.get<any>(`/search/providers?${params}`);
      } catch (searchError) {
        // Fallback to by-problem endpoint with serviceStyle filter
        const byProblemParams = new URLSearchParams({
          problemId: selectedProblem.id,
          serviceStyle: selectedServiceStyle,
          ...(location && {
            lat: location.lat.toString(),
            lng: location.lng.toString(),
          }),
        });
        res = await apiClient.get<any>(`/customer/services/by-problem?${byProblemParams}`);
      }
      
      if (res.success) {
        setProviders(res.providers || res.services || []);
        
        // Check if instant booking is available for tele
        if (selectedServiceStyle === 'tele') {
          const providerList = res.providers || res.services || [];
          const instantAvailable = providerList.some((p: ServiceProvider) => p.isInstantAvailable);
          setShowInstantOption(instantAvailable);
        }
      }
    } catch (error: any) {
      console.error('Error fetching providers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleServiceStyleSelect = (style: ServiceStyle) => {
    setSelectedServiceStyle(style);
    setCurrentStep('discovery');
  };

  const handleProviderSelect = (provider: ServiceProvider) => {
    setSelectedProvider(provider);
    setCurrentStep('booking');
  };

  const handleBookingComplete = (bookingId: string) => {
    setCurrentStep('confirmation');
    onBookingComplete?.(bookingId);
  };

  const goBack = () => {
    switch (currentStep) {
      case 'discovery':
        setCurrentStep('service-style');
        setSelectedServiceStyle(null);
        setProviders([]);
        setIsInstantMode(false);
        break;
      case 'booking':
        setCurrentStep('discovery');
        setSelectedProvider(null);
        break;
      case 'service-style':
        // Reset allowed styles when going back from service style selection
        setAllowedServiceStyles(['at_home', 'at_center', 'tele']);
        onClose?.();
        break;
      default:
        onClose?.();
    }
  };

  // ============================================================================
  // RENDER SERVICE STYLE SELECTION
  // ============================================================================

  const renderServiceStyleSelection = () => (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={onClose}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h2 className="text-xl font-bold text-gray-900">
            {selectedProblem?.name || 'Select Service Type'}
          </h2>
          <p className="text-sm text-gray-500">
            Choose how you'd like to receive this service
          </p>
        </div>
        {selectedProblem && (
          <span className="text-4xl">{selectedProblem.icon}</span>
        )}
      </div>

      {/* Loading state while fetching problem details */}
      {loadingProblemDetails && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-[#FF8C42]" />
          <span className="ml-2 text-gray-500">Loading options...</span>
        </div>
      )}

      {/* Service Style Options - only show allowed styles */}
      {!loadingProblemDetails && (
        <div className="grid gap-4">
          {availableStyles.map((style) => {
            const config = SERVICE_STYLE_CONFIG[style];
            if (!config) return null; // Skip unknown styles
            
            return (
              <Card
                key={style}
                onClick={() => handleServiceStyleSelect(style)}
                className="p-4 cursor-pointer hover:shadow-md transition border-gray-200 hover:border-[#FF8C42]"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-14 h-14 ${config.bgColor} rounded-2xl flex items-center justify-center ${config.color}`}>
                    {config.icon}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">{config.label}</h3>
                    <p className="text-sm text-gray-500">{config.description}</p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-gray-400" />
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* No styles available message */}
      {!loadingProblemDetails && availableStyles.length === 0 && (
        <div className="text-center py-8">
          <p className="text-gray-500">No service styles available for this problem.</p>
          <Button variant="outline" onClick={onClose} className="mt-4">
            Go Back
          </Button>
        </div>
      )}

      {/* Tele Instant Option - only show if tele is in allowed styles */}
      {!loadingProblemDetails && hasTeleOption && (
        <Card className="bg-gradient-to-r from-purple-500 to-indigo-600 p-4 text-white">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center">
              <Clock className="w-7 h-7" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold">Need Instant Consultation?</h3>
              <p className="text-sm text-purple-100">
                Connect with an available doctor in minutes
              </p>
            </div>
            <Button 
              variant="secondary"
              className="bg-white text-purple-600 hover:bg-purple-50"
              onClick={() => {
                setSelectedServiceStyle('tele');
                setIsInstantMode(true);
                setCurrentStep('discovery');
              }}
            >
              Instant
            </Button>
          </div>
        </Card>
      )}

      {/* Info */}
      {!loadingProblemDetails && availableStyles.length > 0 && (
        <div className="text-center">
          <p className="text-sm text-gray-500">
            Service providers are filtered based on "{selectedProblem?.name}"
          </p>
          {availableStyles.length < 3 && (
            <p className="text-xs text-gray-400 mt-1">
              Only {availableStyles.map(s => SERVICE_STYLE_CONFIG[s]?.label).filter(Boolean).join(' and ')} available for this service
            </p>
          )}
        </div>
      )}
    </div>
  );

  // ============================================================================
  // RENDER DISCOVERY
  // ============================================================================

  const renderDiscovery = () => (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={goBack}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-gray-900">
              {selectedProblem?.name}
            </h2>
            {selectedServiceStyle && (
              <Badge className={`${SERVICE_STYLE_CONFIG[selectedServiceStyle].bgColor} ${SERVICE_STYLE_CONFIG[selectedServiceStyle].color}`}>
                {SERVICE_STYLE_CONFIG[selectedServiceStyle].label}
              </Badge>
            )}
          </div>
          <p className="text-sm text-gray-500">
            {isInstantMode ? 'Instantly available providers' : 'Select a service provider'}
          </p>
        </div>
      </div>

      {/* Active Filters */}
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline" className="bg-orange-50 border-orange-200 text-orange-700">
          <Filter className="w-3 h-3 mr-1" />
          {selectedProblem?.name}
        </Badge>
        {selectedProblem?.specializations?.map((spec) => (
          <Badge key={spec} variant="outline" className="bg-gray-50">
            {spec}
          </Badge>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-[#FF8C42]" />
        </div>
      )}

      {/* Providers List */}
      {!loading && providers.length > 0 && (
        <div className="space-y-3">
          {providers
            .filter(p => !isInstantMode || p.isInstantAvailable)
            .map((provider) => (
              <Card
                key={provider.id}
                onClick={() => handleProviderSelect(provider)}
                className="p-4 cursor-pointer hover:shadow-md transition border-gray-200 hover:border-[#FF8C42]"
              >
                <div className="flex gap-4">
                  {/* Photo */}
                  <div className="w-16 h-16 bg-gray-100 rounded-xl overflow-hidden flex-shrink-0">
                    {provider.photo ? (
                      <img 
                        src={provider.photo} 
                        alt={provider.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-2xl">
                        🩺
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-gray-900 truncate">
                          {provider.name}
                        </h3>
                        <p className="text-sm text-gray-500 truncate">
                          {provider.specializations.slice(0, 2).join(', ')}
                        </p>
                      </div>
                      {provider.isInstantAvailable && (
                        <Badge className="bg-green-100 text-green-700 flex-shrink-0">
                          Available Now
                        </Badge>
                      )}
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-3 mt-2 text-sm">
                      <span className="flex items-center gap-1 text-yellow-600">
                        ⭐ {provider.rating.toFixed(1)}
                        <span className="text-gray-400">({provider.reviewCount})</span>
                      </span>
                      {selectedServiceStyle !== 'tele' && (
                        <span className="flex items-center gap-1 text-gray-500">
                          <MapPin className="w-3 h-3" />
                          {provider.distanceFormatted}
                        </span>
                      )}
                      {provider.nextAvailable && !provider.isInstantAvailable && (
                        <span className="flex items-center gap-1 text-gray-500">
                          <Calendar className="w-3 h-3" />
                          {provider.nextAvailable}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Price */}
                  <div className="text-right flex-shrink-0">
                    <p className="text-lg font-bold text-[#FF8C42]">
                      {provider.priceFormatted}
                    </p>
                    <p className="text-xs text-gray-500">onwards</p>
                  </div>
                </div>
              </Card>
            ))}
        </div>
      )}

      {/* No Results */}
      {!loading && providers.length === 0 && (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Filter className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="font-semibold text-gray-900 mb-2">No providers found</h3>
          <p className="text-sm text-gray-500 mb-4">
            Try changing the service type or check back later
          </p>
          <Button variant="outline" onClick={goBack}>
            Change Service Type
          </Button>
        </div>
      )}
    </div>
  );

  // ============================================================================
  // RENDER BOOKING
  // ============================================================================

  const renderBooking = () => {
    if (!selectedProvider || !selectedServiceStyle) return null;

    // Use BookingFlow with callbacks for proper navigation
    // BookingFlow has its own header, so we just pass the callbacks
    return (
      <BookingFlow
        serviceId={selectedProvider.serviceId}
        customerPhone={customerId || ''}
        onBack={goBack}
        onComplete={handleBookingComplete}
      />
    );
  };

  // ============================================================================
  // RENDER CONFIRMATION
  // ============================================================================

  const renderConfirmation = () => (
    <div className="min-h-[400px] flex flex-col items-center justify-center text-center p-6">
      <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mb-6">
        <span className="text-5xl">✓</span>
      </div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Booking Confirmed!</h2>
      <p className="text-gray-600 mb-6">
        Your {selectedProblem?.name} {selectedServiceStyle && SERVICE_STYLE_CONFIG[selectedServiceStyle].label.toLowerCase()} appointment is confirmed.
      </p>
      <div className="flex gap-3">
        <Button variant="outline" onClick={onClose}>
          Back to Home
        </Button>
        <Button 
          className="bg-[#FF8C42] hover:bg-[#E67A35]"
          onClick={() => window.location.href = '/bookings'}
        >
          View Booking
        </Button>
      </div>
    </div>
  );

  // ============================================================================
  // MAIN RENDER
  // ============================================================================

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-lg mx-auto">
        {currentStep === 'service-style' && renderServiceStyleSelection()}
        {currentStep === 'discovery' && renderDiscovery()}
        {currentStep === 'booking' && renderBooking()}
        {currentStep === 'confirmation' && renderConfirmation()}
      </div>
    </div>
  );
}

export default ProblemGridFlowRouter;
