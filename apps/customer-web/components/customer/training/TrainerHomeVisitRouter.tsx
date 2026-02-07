'use client';

import React, { useState, useEffect } from 'react';
import {
  ArrowLeft, Home, GraduationCap, Calendar, Clock, Star, Package,
  ChevronRight, Check, AlertCircle, History, X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

import { UniversalServiceProviderList } from '../shared/UniversalServiceProviderList';
import { UniversalProviderProfile } from '../shared/UniversalProviderProfile';

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

interface PackageType {
  id: string;
  name: string;
  description?: string;
  sessionCount: number;
  price: number;
  validityDays: number;
  discount?: number;
  popular?: boolean;
}

interface CustomerPackage {
  id: string;
  packageId: string;
  packageName: string;
  vendorId: string;
  vendorName: string;
  totalSessions: number;
  usedSessions: number;
  remainingSessions: number;
  purchaseDate: string;
  expiryDate: string;
  status: 'active' | 'expired' | 'exhausted';
  sessions: PackageSession[];
}

interface PackageSession {
  id: string;
  sessionNumber: number;
  bookingId?: string;
  scheduledDate?: string;
  completedDate?: string;
  status: 'pending' | 'scheduled' | 'completed' | 'cancelled' | 'no_show';
  notes?: string;
}

interface TrainerHomeVisitRouterProps {
  phone: string;
  onBack: () => void;
  onNavigate: (screen: string, data?: any) => void;
  initialAddressFromBook?: any;
  onConsumeInitialAddress?: () => void;
}

type FlowStep = 
  | 'mode-selection'      // Choose single session or package
  | 'provider-list'       // List of home training providers
  | 'provider-profile'    // Provider profile + services
  | 'package-selection'   // Select package type
  | 'my-packages'         // View active packages
  | 'package-detail'      // Package detail + session tracking
  | 'payment';            // Payment page

// ============================================================================
// MODE SELECTION SCREEN
// ============================================================================

interface ModeSelectionProps {
  hasActivePackages: boolean;
  activePackageCount: number;
  onSelectSingle: () => void;
  onSelectPackage: () => void;
  onViewMyPackages: () => void;
  onBack: () => void;
}

function ModeSelection({ 
  hasActivePackages, 
  activePackageCount,
  onSelectSingle, 
  onSelectPackage, 
  onViewMyPackages,
  onBack 
}: ModeSelectionProps) {
  return (
    <div className="min-h-screen bg-white max-w-md mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-br from-purple-500 to-indigo-600 text-white px-6 pt-8 pb-20 relative">
        <button
          onClick={onBack}
          className="mb-4 flex items-center gap-2 text-white/90 hover:text-white"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back</span>
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Home Training</h1>
            <p className="text-white/80 text-sm">Trainer comes to your home</p>
          </div>
        </div>

        {/* Curve */}
        <div
          className="absolute bottom-0 left-0 right-0 h-8 bg-white"
          style={{
            borderTopLeftRadius: '50% 100%',
            borderTopRightRadius: '50% 100%',
          }}
        />
      </div>

      {/* Active Packages Banner */}
      {hasActivePackages && (
        <div className="px-6 -mt-4">
          <Card 
            className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 border-green-200 cursor-pointer hover:shadow-md transition"
            onClick={onViewMyPackages}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                  <Package className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-medium text-green-800">Active Packages</p>
                  <p className="text-sm text-green-600">
                    {activePackageCount} package{activePackageCount > 1 ? 's' : ''} with sessions remaining
                  </p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-green-400" />
            </div>
          </Card>
        </div>
      )}

      {/* Options */}
      <div className="px-6 mt-6">
        <h2 className="text-lg font-semibold mb-4">How would you like to book?</h2>

        {/* Single Session */}
        <Card
          className="p-5 mb-4 cursor-pointer hover:shadow-lg transition-all border-2 border-transparent hover:border-purple-400"
          onClick={onSelectSingle}
        >
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 bg-purple-100 rounded-2xl flex items-center justify-center flex-shrink-0">
              <Calendar className="w-7 h-7 text-purple-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-lg text-gray-900">Single Session</h3>
              <p className="text-sm text-gray-600 mb-2">
                Book one training session at a time. Pay per session.
              </p>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  60 mins typical
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Home className="w-3 h-3" />
                  At your home
                </span>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0 mt-2" />
          </div>
        </Card>

        {/* Package */}
        <Card
          className="p-5 mb-4 cursor-pointer hover:shadow-lg transition-all border-2 border-transparent hover:border-amber-400 bg-gradient-to-r from-amber-50 to-orange-50"
          onClick={onSelectPackage}
        >
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 bg-amber-500 rounded-2xl flex items-center justify-center flex-shrink-0">
              <Package className="w-7 h-7 text-white" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-bold text-lg text-gray-900">Training Package</h3>
                <Badge className="bg-amber-500 text-white text-xs">Save 20%</Badge>
              </div>
              <p className="text-sm text-gray-600 mb-2">
                Buy a package of multiple sessions. Schedule as you go.
              </p>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <Package className="w-3 h-3" />
                  5, 10, 15 sessions
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Flexible scheduling
                </span>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0 mt-2" />
          </div>
        </Card>

        {/* View My Packages */}
        <button
          onClick={onViewMyPackages}
          className="w-full flex items-center justify-center gap-2 py-3 text-purple-600 hover:bg-purple-50 rounded-xl transition"
        >
          <History className="w-5 h-5" />
          <span className="font-medium">View My Packages & History</span>
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// MY PACKAGES VIEW
// ============================================================================

interface MyPackagesViewProps {
  packages: CustomerPackage[];
  loading: boolean;
  onSelectPackage: (pkg: CustomerPackage) => void;
  onBookNewPackage: () => void;
  onBack: () => void;
}

function MyPackagesView({ packages, loading, onSelectPackage, onBookNewPackage, onBack }: MyPackagesViewProps) {
  const activePackages = packages.filter(p => p.status === 'active');
  const expiredPackages = packages.filter(p => p.status !== 'active');

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-br from-purple-500 to-indigo-600 text-white px-4 pt-6 pb-12 relative">
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={onBack}
            className="w-10 h-10 bg-white/20 backdrop-blur rounded-full flex items-center justify-center"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold">My Training Packages</h1>
            <p className="text-white/80 text-sm">{activePackages.length} active packages</p>
          </div>
        </div>

        {/* Curve */}
        <div
          className="absolute bottom-0 left-0 right-0 h-6 bg-gray-50"
          style={{
            borderTopLeftRadius: '50% 100%',
            borderTopRightRadius: '50% 100%',
          }}
        />
      </div>

      <div className="px-4 -mt-4 pb-24">
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-500 mx-auto mb-4" />
            <p className="text-gray-500">Loading packages...</p>
          </div>
        ) : packages.length === 0 ? (
          <Card className="p-8 text-center">
            <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="font-bold text-gray-900 mb-2">No Packages Yet</h3>
            <p className="text-gray-500 text-sm mb-4">
              Purchase a training package to save on multiple sessions.
            </p>
            <Button onClick={onBookNewPackage} className="bg-purple-500 hover:bg-purple-600">
              Browse Packages
            </Button>
          </Card>
        ) : (
          <>
            {/* Active Packages */}
            {activePackages.length > 0 && (
              <div className="mb-6">
                <h2 className="font-semibold text-gray-700 mb-3">Active Packages</h2>
                <div className="space-y-3">
                  {activePackages.map((pkg) => (
                    <Card
                      key={pkg.id}
                      className="p-4 cursor-pointer hover:shadow-lg transition hover:border-purple-400"
                      onClick={() => onSelectPackage(pkg)}
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                          <Package className="w-6 h-6 text-purple-600" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <h3 className="font-bold text-gray-900">{pkg.packageName}</h3>
                            <Badge className="bg-green-100 text-green-700">Active</Badge>
                          </div>
                          <p className="text-sm text-gray-500">{pkg.vendorName}</p>
                          <div className="flex items-center gap-4 mt-2">
                            <div>
                              <p className="text-2xl font-bold text-purple-600">
                                {pkg.remainingSessions}
                              </p>
                              <p className="text-xs text-gray-400">sessions left</p>
                            </div>
                            <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-purple-500 rounded-full"
                                style={{ width: `${(pkg.usedSessions / pkg.totalSessions) * 100}%` }}
                              />
                            </div>
                            <p className="text-xs text-gray-400">
                              {pkg.usedSessions}/{pkg.totalSessions}
                            </p>
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-400" />
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Expired Packages */}
            {expiredPackages.length > 0 && (
              <div>
                <h2 className="font-semibold text-gray-400 mb-3">Past Packages</h2>
                <div className="space-y-3 opacity-60">
                  {expiredPackages.map((pkg) => (
                    <Card
                      key={pkg.id}
                      className="p-4 cursor-pointer hover:opacity-100 transition"
                      onClick={() => onSelectPackage(pkg)}
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center">
                          <Package className="w-6 h-6 text-gray-400" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <h3 className="font-medium text-gray-600">{pkg.packageName}</h3>
                            <Badge variant="secondary">
                              {pkg.status === 'expired' ? 'Expired' : 'Completed'}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-400">{pkg.vendorName}</p>
                          <p className="text-xs text-gray-400 mt-1">
                            {pkg.usedSessions} of {pkg.totalSessions} sessions used
                          </p>
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-300" />
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Sticky Button */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t max-w-lg mx-auto">
        <Button 
          className="w-full h-12 bg-purple-500 hover:bg-purple-600"
          onClick={onBookNewPackage}
        >
          <Package className="w-5 h-5 mr-2" />
          Buy New Package
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// PACKAGE DETAIL VIEW
// ============================================================================

interface PackageDetailViewProps {
  pkg: CustomerPackage;
  onScheduleSession: (session: PackageSession) => void;
  onBack: () => void;
  onNavigate: (screen: string, data?: any) => void;
}

function PackageDetailView({ pkg, onScheduleSession, onBack, onNavigate }: PackageDetailViewProps) {
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [selectedSession, setSelectedSession] = useState<PackageSession | null>(null);

  const getSessionStatusColor = (status: PackageSession['status']) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-700';
      case 'scheduled': return 'bg-blue-100 text-blue-700';
      case 'pending': return 'bg-gray-100 text-gray-600';
      case 'cancelled': return 'bg-red-100 text-red-700';
      case 'no_show': return 'bg-amber-100 text-amber-700';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  const getSessionStatusLabel = (status: PackageSession['status']) => {
    switch (status) {
      case 'completed': return 'Completed';
      case 'scheduled': return 'Scheduled';
      case 'pending': return 'Not Scheduled';
      case 'cancelled': return 'Cancelled';
      case 'no_show': return 'No Show';
      default: return status;
    }
  };

  const handleSchedule = (session: PackageSession) => {
    // Navigate to scheduling flow with package context
    onNavigate('schedule-package-session', {
      packageId: pkg.id,
      sessionId: session.id,
      sessionNumber: session.sessionNumber,
      vendorId: pkg.vendorId,
      vendorName: pkg.vendorName,
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-br from-purple-500 to-indigo-600 text-white px-4 pt-6 pb-16 relative">
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={onBack}
            className="w-10 h-10 bg-white/20 backdrop-blur rounded-full flex items-center justify-center"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold">{pkg.packageName}</h1>
            <p className="text-white/80 text-sm">{pkg.vendorName}</p>
          </div>
        </div>

        {/* Progress Card */}
        <Card className="bg-white/10 backdrop-blur border-white/20 p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-white/80 text-sm">Sessions Remaining</p>
              <p className="text-3xl font-bold">{pkg.remainingSessions} of {pkg.totalSessions}</p>
            </div>
            <div className={`px-3 py-1 rounded-full text-sm font-medium ${
              pkg.status === 'active' 
                ? 'bg-green-400/30 text-green-100' 
                : 'bg-gray-400/30 text-gray-200'
            }`}>
              {pkg.status === 'active' ? 'Active' : pkg.status}
            </div>
          </div>
          <div className="h-2 bg-white/20 rounded-full overflow-hidden">
            <div 
              className="h-full bg-white rounded-full transition-all"
              style={{ width: `${(pkg.usedSessions / pkg.totalSessions) * 100}%` }}
            />
          </div>
          <p className="text-white/60 text-xs mt-2">
            Expires: {new Date(pkg.expiryDate).toLocaleDateString()}
          </p>
        </Card>

        {/* Curve */}
        <div
          className="absolute bottom-0 left-0 right-0 h-6 bg-gray-50"
          style={{
            borderTopLeftRadius: '50% 100%',
            borderTopRightRadius: '50% 100%',
          }}
        />
      </div>

      {/* Sessions List */}
      <div className="px-4 -mt-4 pb-8">
        <h2 className="font-semibold text-gray-700 mb-3">Sessions</h2>
        <div className="space-y-2">
          {pkg.sessions.map((session) => (
            <Card key={session.id} className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                    session.status === 'completed' 
                      ? 'bg-green-500 text-white' 
                      : 'bg-gray-200 text-gray-600'
                  }`}>
                    {session.status === 'completed' 
                      ? <Check className="w-4 h-4" /> 
                      : session.sessionNumber
                    }
                  </div>
                  <div>
                    <p className="font-medium">Session {session.sessionNumber}</p>
                    {session.scheduledDate && (
                      <p className="text-sm text-gray-500">
                        {new Date(session.scheduledDate).toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    )}
                    {session.completedDate && (
                      <p className="text-xs text-green-600">
                        Completed on {new Date(session.completedDate).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={getSessionStatusColor(session.status)}>
                    {getSessionStatusLabel(session.status)}
                  </Badge>
                  {session.status === 'pending' && pkg.status === 'active' && (
                    <Button
                      size="sm"
                      onClick={() => handleSchedule(session)}
                      className="bg-purple-500 hover:bg-purple-600"
                    >
                      Schedule
                    </Button>
                  )}
                </div>
              </div>
              {session.notes && (
                <p className="text-sm text-gray-500 mt-2 pl-11">{session.notes}</p>
              )}
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function TrainerHomeVisitRouter({ phone, onBack, onNavigate, initialAddressFromBook, onConsumeInitialAddress }: TrainerHomeVisitRouterProps) {
  const [step, setStep] = useState<FlowStep>('mode-selection');
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);
  const [customerPackages, setCustomerPackages] = useState<CustomerPackage[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<CustomerPackage | null>(null);
  const [loadingPackages, setLoadingPackages] = useState(false);
  const [customerId, setCustomerId] = useState<string | null>(null);

  // Load customer data on mount
  useEffect(() => {
    loadCustomerData();
  }, [phone]);

  const loadCustomerData = async () => {
    try {
      // Get customer ID
      const profileResponse = await apiClient.get(`/customer/profile?phone=${encodeURIComponent(phone)}`) as any;
      const id = profileResponse?.profile?.id || profileResponse?.id;
      if (id) {
        setCustomerId(id);
        loadPackages(id);
      }
    } catch (error) {
      console.error('Error loading customer data:', error);
    }
  };

  const loadPackages = async (custId: string) => {
    try {
      setLoadingPackages(true);
      const response = await apiClient.get(`/customer/${custId}/packages?category=training`) as any;
      if (response.success && response.packages) {
        // Process packages to add session info
        const packages = response.packages.map((pkg: any) => ({
          ...pkg,
          sessions: pkg.sessions || generateSessions(pkg.totalSessions, pkg.usedSessions),
        }));
        setCustomerPackages(packages);
      }
    } catch (error) {
      console.error('Error loading packages:', error);
      setCustomerPackages([]);
    } finally {
      setLoadingPackages(false);
    }
  };

  // Helper to generate session objects
  const generateSessions = (total: number, used: number): PackageSession[] => {
    return Array.from({ length: total }, (_, i) => ({
      id: `session-${i + 1}`,
      sessionNumber: i + 1,
      status: i < used ? 'completed' : 'pending' as PackageSession['status'],
    }));
  };

  const activePackages = customerPackages.filter(p => p.status === 'active');

  // Handlers
  const handleSelectSingle = () => {
    setStep('provider-list');
  };

  const handleSelectPackage = () => {
    setStep('provider-list');
    // Will show package options in provider profile
  };

  const handleViewMyPackages = () => {
    if (customerId) {
      loadPackages(customerId);
    }
    setStep('my-packages');
  };

  const handleSelectProvider = (provider: Provider) => {
    setSelectedProvider(provider);
    setStep('provider-profile');
  };

  const handleSelectCustomerPackage = (pkg: CustomerPackage) => {
    setSelectedPackage(pkg);
    setStep('package-detail');
  };

  const handleProceedToPayment = (bookingData: any) => {
    onNavigate('payment', {
      ...bookingData,
      serviceType: 'at_home',
      category: 'training',
      flowType: 'training-home-visit',
    });
  };

  const handleBack = () => {
    switch (step) {
      case 'mode-selection':
        onBack();
        break;
      case 'provider-list':
        setStep('mode-selection');
        break;
      case 'provider-profile':
        setSelectedProvider(null);
        setStep('provider-list');
        break;
      case 'my-packages':
        setStep('mode-selection');
        break;
      case 'package-detail':
        setSelectedPackage(null);
        setStep('my-packages');
        break;
      default:
        onBack();
    }
  };

  // Render based on step
  switch (step) {
    case 'mode-selection':
      return (
        <ModeSelection
          hasActivePackages={activePackages.length > 0}
          activePackageCount={activePackages.length}
          onSelectSingle={handleSelectSingle}
          onSelectPackage={handleSelectPackage}
          onViewMyPackages={handleViewMyPackages}
          onBack={onBack}
        />
      );

    case 'provider-list':
      return (
        <UniversalServiceProviderList
          phone={phone}
          category="training"
          roleId="pet_trainer"
          serviceStyle="at_home"
          title="Home Training"
          subtitle="Trainer comes to your home"
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
          category="training"
          serviceStyle="at_home"
          onBack={handleBack}
          onNavigate={onNavigate}
          onProceedToPayment={handleProceedToPayment}
          initialSelectedAddress={initialAddressFromBook}
          onConsumeInitialAddress={onConsumeInitialAddress}
        />
      );

    case 'my-packages':
      return (
        <MyPackagesView
          packages={customerPackages}
          loading={loadingPackages}
          onSelectPackage={handleSelectCustomerPackage}
          onBookNewPackage={() => setStep('provider-list')}
          onBack={handleBack}
        />
      );

    case 'package-detail':
      if (!selectedPackage) {
        setStep('my-packages');
        return null;
      }
      return (
        <PackageDetailView
          pkg={selectedPackage}
          onScheduleSession={(session) => {
            onNavigate('schedule-package-session', {
              packageId: selectedPackage.id,
              session,
            });
          }}
          onBack={handleBack}
          onNavigate={onNavigate}
        />
      );

    default:
      return (
        <ModeSelection
          hasActivePackages={activePackages.length > 0}
          activePackageCount={activePackages.length}
          onSelectSingle={handleSelectSingle}
          onSelectPackage={handleSelectPackage}
          onViewMyPackages={handleViewMyPackages}
          onBack={onBack}
        />
      );
  }
}

export default TrainerHomeVisitRouter;
