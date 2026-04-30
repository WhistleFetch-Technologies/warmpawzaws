'use client';

import React, { useState, useEffect } from 'react';
import {
  ArrowLeft, Video, Home, Building2, Clock, ChevronRight, 
  Zap, Calendar, Star, MapPin, AlertCircle, CheckCircle,
  Stethoscope, Scissors, GraduationCap, Bike, House, Brain, Salad
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

import { UniversalServiceProviderList } from './UniversalServiceProviderList';
import { UniversalProviderProfile } from './UniversalProviderProfile';

// ============================================================================
// TYPES
// ============================================================================

interface Provider {
  providerId: string;
  providerType: 'vendor' | 'staff' | 'individual';
  vendorId?: string;
  vendorName?: string;
  staffId?: string;
  name: string;
  photo?: string;
  photos?: string[];
  address?: string;
  city?: string;
  phone?: string;
  email?: string;
  website?: string;
  role?: string;
  specialization?: string;
  qualifications?: string;
  degree?: string;
  bio?: string;
  experienceYears?: number;
  rating: number;
  reviewCount: number;
  distance?: number | null;
  isVerified?: boolean;
  isOnline?: boolean;
  nextAvailableSlot?: string;
  services: any[];
  amenities?: string[];
  languages?: string[];
  consultationFee?: number;
}

interface ServiceStyleConfig {
  style: 'tele' | 'at_home' | 'at_center';
  label: string;
  description: string;
  icon: React.ComponentType<any>;
  color: string;
  bgColor: string;
  available: boolean;
  providerCount?: number;
  earliestSlot?: string; // Phase 2: "Earliest today 2 PM"
}

interface ProblemBasedFlowRouterProps {
  phone: string;
  problemId: string;
  problemTitle: string;
  category: 'vet' | 'grooming' | 'training' | 'walking' | 'boarding' | 'behaviorist' | 'nutritionist';
  roleId: string;
  onBack: () => void;
  onNavigate: (screen: string, data?: any) => void;
}

type FlowStep = 
  | 'style-selection'     // Choose service style (tele/home/center)
  | 'tele-mode'           // For tele: choose instant vs scheduled
  | 'provider-list'       // List of providers filtered by specialization
  | 'provider-profile'    // Provider profile + services
  | 'instant-queue';      // Instant video queue

// ============================================================================
// SERVICE STYLE SELECTOR
// ============================================================================

interface ServiceStyleSelectorProps {
  phone: string;
  problemId: string;
  problemTitle: string;
  category: string;
  roleId: string;
  styles: ServiceStyleConfig[];
  loading: boolean;
  onSelectStyle: (style: string) => void;
  onBack: () => void;
}

function ServiceStyleSelector({ 
  phone,
  problemId, 
  problemTitle, 
  category, 
  roleId,
  styles, 
  loading, 
  onSelectStyle, 
  onBack 
}: ServiceStyleSelectorProps) {
  // Get category config with 2D Lucide icons (NO emojis or 3D icons)
  const getCategoryConfig = (): { Icon: React.ComponentType<any>; iconBg: string } => {
    switch (category) {
      case 'vet':
        return { Icon: Stethoscope, iconBg: 'bg-white/20' };
      case 'grooming':
        return { Icon: Scissors, iconBg: 'bg-white/20' };
      case 'training':
        return { Icon: GraduationCap, iconBg: 'bg-white/20' };
      case 'walking':
        return { Icon: Bike, iconBg: 'bg-white/20' };
      case 'boarding':
        return { Icon: House, iconBg: 'bg-white/20' };
      case 'behaviorist':
        return { Icon: Brain, iconBg: 'bg-white/20' };
      case 'nutritionist':
        return { Icon: Salad, iconBg: 'bg-white/20' };
      default:
        return { Icon: Stethoscope, iconBg: 'bg-white/20' };
    }
  };

  const config = getCategoryConfig();
  const CategoryIcon = config.Icon;

  const availableStyles = styles.filter(s => s.available);

  return (
    <div className="min-h-screen bg-[#FF8C42] max-w-md mx-auto">
      {/* Header - Matching Customer Home Design */}
      <div className="px-4 pt-12 pb-8">
        {/* Back Button */}
        <button
          onClick={onBack}
          className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center hover:bg-white/30 transition-colors mb-4"
        >
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>

        {/* Title Section with 2D Icon */}
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
            <CategoryIcon className="w-7 h-7 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-white leading-tight">{problemTitle}</h1>
            <p className="text-white/80 text-sm mt-0.5">Choose how you'd like to consult</p>
          </div>
        </div>
      </div>

      {/* Main Content - White Card with Top Radius */}
      <div className="bg-white rounded-t-[32px] px-4 pt-6 min-h-[calc(100vh-180px)] pb-8">
        {/* Section Title */}
        <h2 className="text-base font-semibold text-gray-900 mb-4">Select Service Type</h2>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 bg-gray-100 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : availableStyles.length === 0 ? (
          <div className="p-8 text-center bg-gray-50 rounded-2xl">
            <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="font-bold text-gray-900 mb-2">No Services Available</h3>
            <p className="text-gray-500 text-sm mb-4">
              No providers are currently offering services for <span className="font-semibold">{problemTitle}</span> in your area.
            </p>
            <p className="text-gray-400 text-xs">
              Try selecting a different service type or check back later.
            </p>
          </div>
        ) : availableStyles.filter(s => s.available).length === 0 ? (
          <div className="p-8 text-center bg-gray-50 rounded-2xl">
            <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="font-bold text-gray-900 mb-2">No Service Types Available</h3>
            <p className="text-gray-500 text-sm mb-4">
              No providers are currently offering <span className="font-semibold">{problemTitle}</span> for any service type in your area.
            </p>
            <button
              onClick={onBack}
              className="mt-4 px-4 py-2 bg-[#FF8C42] text-white rounded-xl text-sm font-semibold hover:bg-[#FF7A29] transition"
            >
              Go Back
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {availableStyles.map((style) => {
              const StyleIcon = style.icon;
              const bgColors: Record<string, string> = {
                blue: 'bg-blue-50',
                orange: 'bg-amber-50',
                green: 'bg-green-50',
              };
              const iconBgColors: Record<string, string> = {
                blue: 'bg-blue-500',
                orange: 'bg-orange-500',
                green: 'bg-green-500',
              };
              
              return (
                <button
                  key={style.style}
                  className={`w-full p-4 rounded-2xl text-left transition-all border-2 border-transparent hover:border-[#FF8C42] hover:shadow-md ${bgColors[style.color] || 'bg-gray-50'}`}
                  onClick={() => onSelectStyle(style.style)}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBgColors[style.color] || 'bg-gray-500'}`}>
                      <StyleIcon className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-base text-gray-900">{style.label}</h3>
                      <p className="text-sm text-gray-600 leading-snug">{style.description}</p>
                      {style.providerCount !== undefined && style.providerCount > 0 && (
                        <p className="text-xs text-gray-500 mt-1">
                          {style.providerCount} provider{style.providerCount !== 1 ? 's' : ''}
                          {style.earliestSlot ? ` • Earliest ${style.earliestSlot}` : ' available'}
                        </p>
                      )}
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Specialization Info Card */}
        <div className="mt-6 p-4 bg-green-50 rounded-xl border border-green-100 flex gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-sm text-gray-800">
              <span className="font-semibold">Specialization:</span> {problemTitle}
            </p>
            <p className="text-xs text-gray-600 mt-0.5">
              All listed providers specialize in this area
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// TELE MODE SELECTOR (Instant vs Scheduled)
// ============================================================================

interface TeleModeSelectorProps {
  problemTitle: string;
  onSelectInstant: () => void;
  onSelectScheduled: () => void;
  onBack: () => void;
}

function TeleModeSelector({ problemTitle, onSelectInstant, onSelectScheduled, onBack }: TeleModeSelectorProps) {
  return (
    <div className="min-h-screen bg-[#FF8C42] max-w-md mx-auto">
      {/* Header - Matching Customer Home Design */}
      <div className="px-4 pt-12 pb-8">
        {/* Back Button */}
        <button
          onClick={onBack}
          className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center hover:bg-white/30 transition-colors mb-4"
        >
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>

        {/* Title Section with 2D Icon */}
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
            <Video className="w-7 h-7 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-white leading-tight">Video Consultation</h1>
            <p className="text-white/80 text-sm mt-0.5">{problemTitle}</p>
          </div>
        </div>
      </div>

      {/* Main Content - White Card with Top Radius */}
      <div className="bg-white rounded-t-[32px] px-4 pt-6 min-h-[calc(100vh-180px)] pb-8">
        {/* Section Title */}
        <h2 className="text-base font-semibold text-gray-900 mb-4">How would you like to consult?</h2>

        {/* Instant Option */}
        <button
          className="w-full p-4 mb-3 rounded-2xl text-left transition-all border-2 border-transparent hover:border-green-400 hover:shadow-md bg-green-50"
          onClick={onSelectInstant}
        >
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-green-500 rounded-xl flex items-center justify-center flex-shrink-0">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <h3 className="font-semibold text-base text-gray-900">Instant</h3>
                <span className="px-2 py-0.5 bg-green-500 text-white text-xs rounded-full font-medium">Live Now</span>
              </div>
              <p className="text-sm text-gray-600 leading-snug">
                Connect immediately with the next available specialist
              </p>
              <div className="flex items-center gap-1 text-xs text-gray-500 mt-1.5">
                <Clock className="w-3.5 h-3.5" />
                <span>&lt;5 min wait</span>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0 mt-1" />
          </div>
        </button>

        {/* Scheduled Option */}
        <button
          className="w-full p-4 rounded-2xl text-left transition-all border-2 border-transparent hover:border-blue-400 hover:shadow-md bg-blue-50"
          onClick={onSelectScheduled}
        >
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center flex-shrink-0">
              <Calendar className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-base text-gray-900">Scheduled</h3>
              <p className="text-sm text-gray-600 leading-snug">
                Choose your preferred specialist and book a time
              </p>
              <div className="flex items-center gap-1 text-xs text-gray-500 mt-1.5">
                <Star className="w-3.5 h-3.5" />
                <span>Choose your expert</span>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0 mt-1" />
          </div>
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function ProblemBasedFlowRouter({ 
  phone, 
  problemId, 
  problemTitle, 
  category, 
  roleId,
  onBack, 
  onNavigate 
}: ProblemBasedFlowRouterProps) {
  const [step, setStep] = useState<FlowStep>('style-selection');
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);
  const [availableStyles, setAvailableStyles] = useState<ServiceStyleConfig[]>([]);
  const [loadingStyles, setLoadingStyles] = useState(true);
  const [previousProviderIds, setPreviousProviderIds] = useState<string[]>([]);

  // Load previous providers for "Used before" badge
  useEffect(() => {
    const load = async () => {
      if (!phone) return;
      const categoryToServiceType: Record<string, string> = {
        vet: 'vet', grooming: 'grooming', training: 'training', walking: 'walking', boarding: 'boarding', behaviorist: 'behaviourist', nutritionist: 'nutrition',
      };
      const serviceType = categoryToServiceType[category];
      if (!serviceType) return;
      try {
        const res = await apiClient.get<any>(`/customer/${phone}/previous-providers?serviceType=${serviceType}`);
        const id = res?.provider?.id || res?.provider?.vendorId;
        if (id) setPreviousProviderIds([id]);
      } catch { /* ignore */ }
    };
    load();
  }, [phone, category]);

  // Load available service styles for this problem/category
  useEffect(() => {
    loadAvailableStyles();
  }, [problemId, category, roleId]);

  const loadAvailableStyles = async () => {
    try {
      setLoadingStyles(true);

      // Define all possible styles with their config
      const allStyles: ServiceStyleConfig[] = [
        {
          style: 'tele',
          label: 'Video Consultation',
          description: 'Connect via video call from anywhere',
          icon: Video,
          color: 'blue',
          bgColor: 'bg-gradient-to-r from-blue-50 to-indigo-50',
          available: false,
          providerCount: 0,
        },
        {
          style: 'at_home',
          label: 'Home Visit',
          description: 'Expert comes to your doorstep',
          icon: Home,
          color: 'orange',
          bgColor: 'bg-gradient-to-r from-orange-50 to-amber-50',
          available: false,
          providerCount: 0,
        },
        {
          style: 'at_center',
          label: category === 'vet' ? 'Clinic Visit' : 'Center Visit',
          description: category === 'vet' ? 'Visit a veterinary clinic' : 'Visit the service center',
          icon: Building2,
          color: 'green',
          bgColor: 'bg-gradient-to-r from-green-50 to-emerald-50',
          available: false,
          providerCount: 0,
        },
      ];

      // Check which styles are available for this category
      // Different categories support different styles
      const categoryStyleMap: Record<string, string[]> = {
        vet: ['tele', 'at_home', 'at_center'],
        grooming: ['at_home', 'at_center'],
        training: ['at_home', 'at_center'],
        walking: ['at_home'], // Walking is only at_home
        boarding: ['at_center'],
        behaviorist: ['tele', 'at_home', 'at_center'],
        nutritionist: ['tele'], // Nutritionists: video call only
      };

      const allowedStyles = categoryStyleMap[category] || ['at_center'];

      // Fetch provider counts for each allowed style
      const locationParams = getLocationParams();
      
      const updatedStyles = await Promise.all(
        allStyles.map(async (style) => {
          if (!allowedStyles.includes(style.style)) {
            return { ...style, available: false };
          }

          try {
            // Check if there are providers for this style + specialization
            const phoneParam = phone ? `&customerPhone=${encodeURIComponent(phone)}` : '';
            const response = await apiClient.get(
              `/customer/services/by-style?style=${style.style}&category=${category}&roleId=${roleId}&specialization=${encodeURIComponent(problemId)}${locationParams}${phoneParam}`
            ) as any;

            let providers = response.providers || response.vendors || [];
            
            const isAvailable = providers.length > 0;
            // Phase 2: earliest slot from first provider's nextAvailable/nextAvailableSlot/nextAvailability
            let earliestSlot: string | undefined;
            const first = providers[0];
            if (first) {
              let slot: string | undefined;
              // Priority 1: nextAvailable (API returns this field name)
              if (first.nextAvailable && typeof first.nextAvailable === 'object') {
                slot = first.nextAvailable.display || first.nextAvailable.formattedDisplay || 
                  (first.nextAvailable.date && first.nextAvailable.time 
                    ? `${first.nextAvailable.date} ${first.nextAvailable.time}` 
                    : undefined);
              } else if (typeof first.nextAvailable === 'string') {
                slot = first.nextAvailable;
              }
              // Fallback: Handle nextAvailableSlot
              if (!slot) {
                if (typeof first.nextAvailableSlot === 'string') {
                  slot = first.nextAvailableSlot;
                } else if (first.nextAvailableSlot && typeof first.nextAvailableSlot === 'object') {
                  slot = first.nextAvailableSlot.formattedDisplay || first.nextAvailableSlot.display || 
                    (first.nextAvailableSlot.date && first.nextAvailableSlot.time 
                      ? `${first.nextAvailableSlot.date} ${first.nextAvailableSlot.time}` 
                      : undefined);
                }
              }
              // Fallback to nextAvailability
              if (!slot) {
                if (typeof first.nextAvailability === 'string') {
                  slot = first.nextAvailability;
                } else if (first.nextAvailability && typeof first.nextAvailability === 'object') {
                  slot = first.nextAvailability.formattedDisplay || first.nextAvailability.display || 
                    (first.nextAvailability.date && first.nextAvailability.time 
                      ? `${first.nextAvailability.date} ${first.nextAvailability.time}` 
                      : undefined);
                }
              }
              if (slot) earliestSlot = slot;
            }
            console.log(`[ServiceStyle] ${style.style}: ${providers.length} providers found, available: ${isAvailable}, earliestSlot: ${earliestSlot || 'n/a'}`);
            return {
              ...style,
              available: isAvailable,
              providerCount: providers.length,
              earliestSlot,
            };
          } catch (error: any) {
            // ✅ FIX: If endpoint fails, mark as unavailable to prevent empty fields
            console.error(`[ServiceStyle] Error checking ${style.style}:`, error);
            return { 
              ...style, 
              available: false,
              providerCount: 0,
            };
          }
        })
      );

      setAvailableStyles(updatedStyles);

      // Auto-navigate if only one style is available
      const availableCount = updatedStyles.filter(s => s.available);
      if (availableCount.length === 1) {
        // Only one option, skip selection
        handleSelectStyle(availableCount[0].style);
      }
    } catch (error) {
      console.error('Error loading available styles:', error);
      // Default to showing all styles for the category
      const categoryStyleMap: Record<string, string[]> = {
        vet: ['tele', 'at_home', 'at_center'],
        grooming: ['at_home', 'at_center'],
        training: ['at_home', 'at_center'],
        walking: ['at_home'],
        boarding: ['at_center'],
        behaviorist: ['tele', 'at_home', 'at_center'],
        nutritionist: ['tele'],
      };
      const allowedStyles = categoryStyleMap[category] || ['at_center'];
      
      setAvailableStyles([
        {
          style: 'tele',
          label: 'Video Consultation',
          description: 'Connect via video call',
          icon: Video,
          color: 'blue',
          bgColor: 'bg-blue-50',
          available: allowedStyles.includes('tele'),
        },
        {
          style: 'at_home',
          label: 'Home Visit',
          description: 'Expert comes to you',
          icon: Home,
          color: 'orange',
          bgColor: 'bg-orange-50',
          available: allowedStyles.includes('at_home'),
        },
        {
          style: 'at_center',
          label: 'Center Visit',
          description: 'Visit the center',
          icon: Building2,
          color: 'green',
          bgColor: 'bg-green-50',
          available: allowedStyles.includes('at_center'),
        },
      ]);
    } finally {
      setLoadingStyles(false);
    }
  };

  const getLocationParams = () => {
    try {
      const customerLat = localStorage.getItem('customer_latitude');
      const customerLng = localStorage.getItem('customer_longitude');
      if (customerLat && customerLng) {
        return `&latitude=${customerLat}&longitude=${customerLng}`;
      }
    } catch (e) {
      // Ignore
    }
    return '';
  };

  // Handlers
  const handleSelectStyle = (style: string) => {
    setSelectedStyle(style);
    
    if (style === 'tele') {
      // For tele, show instant vs scheduled option
      setStep('tele-mode');
    } else {
      // For home/center, go directly to provider list
      setStep('provider-list');
    }
  };

  const handleSelectProvider = (provider: Provider) => {
    setSelectedProvider(provider);
    setStep('provider-profile');
  };

  const handleProceedToPayment = (bookingData: any) => {
    onNavigate('payment', {
      ...bookingData,
      serviceType: selectedStyle,
      category,
      problemId,
      problemTitle,
      specialization: problemId,
      flowType: `${category}-${selectedStyle}-problem`,
    });
  };

  const handleBack = () => {
    switch (step) {
      case 'style-selection':
        onBack();
        break;
      case 'tele-mode':
        setSelectedStyle(null);
        setStep('style-selection');
        break;
      case 'provider-list':
        if (selectedStyle === 'tele') {
          setStep('tele-mode');
        } else {
          setSelectedStyle(null);
          setStep('style-selection');
        }
        break;
      case 'provider-profile':
        setSelectedProvider(null);
        setStep('provider-list');
        break;
      case 'instant-queue':
        setStep('tele-mode');
        break;
      default:
        onBack();
    }
  };

  // Get title for provider list based on service style
  const getProviderListTitle = () => {
    switch (selectedStyle) {
      case 'tele': return `${problemTitle} - Video Consultation`;
      case 'at_home': return `${problemTitle} - Home Visit`;
      case 'at_center': return `${problemTitle} - ${category === 'vet' ? 'Clinic' : 'Center'} Visit`;
      default: return problemTitle;
    }
  };

  // Render based on step
  switch (step) {
    case 'style-selection':
      return (
        <ServiceStyleSelector
          phone={phone}
          problemId={problemId}
          problemTitle={problemTitle}
          category={category}
          roleId={roleId}
          styles={availableStyles}
          loading={loadingStyles}
          onSelectStyle={handleSelectStyle}
          onBack={onBack}
        />
      );

    case 'tele-mode':
      return (
        <TeleModeSelector
          problemTitle={problemTitle}
          onSelectInstant={() => {
            // Navigate to instant tele queue with specialization filter
            onNavigate('instant-tele-queue', {
              roleId,
              category,
              specialization: problemId,
              problemTitle,
            });
          }}
          onSelectScheduled={() => setStep('provider-list')}
          onBack={handleBack}
        />
      );

    case 'provider-list':
      return (
        <UniversalServiceProviderList
          phone={phone}
          category={category as any}
          roleId={roleId}
          serviceStyle={selectedStyle as any}
          title={getProviderListTitle()}
          subtitle={`Specialists in ${problemTitle}`}
          problemId={problemId}
          problemTitle={problemTitle}
          previousProviderIds={previousProviderIds}
          onBack={handleBack}
          onNavigate={onNavigate}
          onSelectProvider={handleSelectProvider}
        />
      );

    case 'provider-profile':
      if (!selectedProvider) {
        setStep('provider-list');
        return null;
      }
      return (
        <UniversalProviderProfile
          phone={phone}
          provider={selectedProvider}
          category={category as any}
          serviceStyle={selectedStyle as any}
          onBack={handleBack}
          onNavigate={onNavigate}
          onProceedToPayment={handleProceedToPayment}
        />
      );

    default:
      return (
        <ServiceStyleSelector
          phone={phone}
          problemId={problemId}
          problemTitle={problemTitle}
          category={category}
          roleId={roleId}
          styles={availableStyles}
          loading={loadingStyles}
          onSelectStyle={handleSelectStyle}
          onBack={onBack}
        />
      );
  }
}

export default ProblemBasedFlowRouter;
