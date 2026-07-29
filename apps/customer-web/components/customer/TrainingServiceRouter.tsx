"use client";

import { useState, useEffect, useMemo, useCallback, type MouseEvent } from 'react';
import { CachedImage } from '@/components/shared/CachedImage';
import {
  GraduationCap,
  Building2,
  Home as HomeIcon,
  Star,
  ChevronRight,
  Trophy,
  Package,
  TrendingUp,
  CheckCircle,
  Clock,
  RefreshCw,
  PawPrint,
  ArrowRight,
  Award,
  BookOpen,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import { useCategoryBootstrap } from '@/hooks/useCategoryBootstrap';
import { useProblemGridByRole } from './useProblemGridByRole';
import { FeaturedVendorSpotlights } from './shared/FeaturedVendorSpotlights';
import { ServiceDashboardHeader } from './shared/ServiceDashboardHeader';
import { TrainingGoalGrid } from './training/TrainingGoalGrid';
import {
  TRAINING_HEADER_BANNER,
  TRAINING_TYPE_CARDS,
} from './training/constants/training-hub-assets';
import { EMPTY_SERVICE_HEADER_STATS } from '@/lib/service-header-stats';
import { BoardingVendorExpandableCard } from './boarding/BoardingVendorExpandableCard';
import { useHubVendorDiscovery } from '@/hooks/useHubVendorDiscovery';
import { DiscoveryVendorFeedSentinel } from './shared/DiscoveryVendorFeedSentinel';
import { useDiscoveryCount } from '@/hooks/useDiscoveryCount';
import { formatDiscoveryCountStat } from '@/lib/format-floored-ten-plus';
import { HUB_DISCOVERY_TRAINING } from '@/lib/service-hub-discovery-config';
import { buildHubWarmpawzBookingNav } from '@/lib/wappt-hub-booking-nav';
import { minPriceForVendor } from '@/lib/boarding-vendor-booking-utils';
import type { BoardingListVendor, BoardingPlanRow } from '@/lib/boarding-vendor-discovery-map';
import type { BoardingServiceSlug } from '@/lib/boarding-service-types';
import { isWarmpawzAppointmentsHubEnabled, shouldHideMarketplaceStyleTiles } from '@/lib/warmpawz-appointments-customer';
import { Calendar } from 'lucide-react';

interface TrainingServiceRouterProps {
  phone: string;
  onBack: () => void;
  onViewBooking?: (bookingId: string) => void;
  onNavigate?: (screen: string, data?: any) => void;
}

interface ActiveTrainingPackage {
  id: string;
  packageName: string;
  trainerName: string;
  petName: string;
  totalSessions: number;
  completedSessions: number;
  skillsLearned: string[];
  nextSessionDate?: string;
}

interface PetSkillProgress {
  skillName: string;
  level: number; // 0-100
  status: 'not_started' | 'in_progress' | 'mastered';
}

const HUB_SLUG: BoardingServiceSlug = 'all';

const TRAINING_HEADER_ICON =
  'fill-none stroke-current [&>path]:fill-none [&>circle]:fill-none [&>rect]:fill-none [&>polygon]:fill-none';

function TrainingHeaderBackground() {
  return (
    <>
      <GraduationCap className={`absolute -left-0.5 top-3 h-8 w-8 rotate-[18deg] ${TRAINING_HEADER_ICON} sm:h-9 sm:w-9`} strokeWidth={1} />
      <Award className={`absolute left-[8%] top-12 h-7 w-7 -rotate-12 ${TRAINING_HEADER_ICON}`} strokeWidth={1} />
      <BookOpen className={`absolute left-[18%] top-2 h-6 w-6 rotate-[24deg] ${TRAINING_HEADER_ICON}`} strokeWidth={1} />
      <PawPrint className={`absolute left-[32%] bottom-4 h-9 w-9 rotate-6 ${TRAINING_HEADER_ICON} sm:h-10 sm:w-10`} strokeWidth={1} />
      <GraduationCap className={`absolute left-[42%] top-1 h-12 w-12 -rotate-[8deg] ${TRAINING_HEADER_ICON} sm:h-14 sm:w-14`} strokeWidth={1} />
      <Building2 className={`absolute right-[38%] top-8 h-8 w-8 rotate-12 ${TRAINING_HEADER_ICON}`} strokeWidth={1} />
      <HomeIcon className={`absolute right-[28%] bottom-2 h-9 w-9 -rotate-6 ${TRAINING_HEADER_ICON}`} strokeWidth={1} />
      <Award className={`absolute right-[14%] top-3 h-7 w-7 -rotate-[20deg] ${TRAINING_HEADER_ICON}`} strokeWidth={1} />
      <BookOpen className={`absolute right-[6%] bottom-6 h-8 w-8 rotate-[14deg] ${TRAINING_HEADER_ICON}`} strokeWidth={1} />
      <PawPrint className={`absolute -right-0.5 top-10 h-7 w-7 rotate-[32deg] ${TRAINING_HEADER_ICON}`} strokeWidth={1} />
    </>
  );
}

export function TrainingServiceRouter({ phone, onBack, onViewBooking, onNavigate }: TrainingServiceRouterProps) {
  const { problems: bootstrapProblems } = useCategoryBootstrap({
    category: 'training',
    roleId: 'trainer',
  });
  const trainingGoalsLegacy = useProblemGridByRole('trainer');
  const trainingGoals = useMemo(() => {
    if (bootstrapProblems.length > 0) {
      return bootstrapProblems.map((p) => ({
        id: p.id,
        name: p.title,
        icon: <GraduationCap className="w-6 h-6 text-orange-600" />,
      }));
    }
    return trainingGoalsLegacy;
  }, [bootstrapProblems, trainingGoalsLegacy]);
  const {
    loading: vendorsLoading,
    loadingMore: vendorsLoadingMore,
    hasMore: vendorsHasMore,
    loadMore: loadMoreVendors,
    vendors,
    relaxedFilter,
    selectedVendorId,
    setSelectedVendorId,
    toggleVendor,
    fetchingPlansFor,
  } = useHubVendorDiscovery(phone, HUB_DISCOVERY_TRAINING);
  const {
    data: trainingCenterCount = 0,
    isLoading: trainingCenterLoading,
    isFetching: trainingCenterFetching,
    isError: trainingCenterError,
  } = useDiscoveryCount({
    phone,
    serviceStyle: 'at_center',
    category: 'training',
  });

  const trainingCenterBadgeText = useMemo(() => {
    const st =
      trainingCenterLoading || trainingCenterFetching
        ? 'loading'
        : trainingCenterError
          ? 'error'
          : 'success';
    const n = formatDiscoveryCountStat(trainingCenterCount, st);
    return `${n} Centres`;
  }, [trainingCenterLoading, trainingCenterFetching, trainingCenterError, trainingCenterCount]);

  const [activePackages, setActivePackages] = useState<ActiveTrainingPackage[]>([]);
  const [petSkills, setPetSkills] = useState<PetSkillProgress[]>([]);
  const [previousTrainer, setPreviousTrainer] = useState<any>(null);

  useEffect(() => {
    loadActiveTrainingPackages();
    loadPetSkills();
    loadPreviousTrainer();
  }, [phone]);

  const loadPreviousTrainer = async () => {
    try {
      const response = await apiClient.get<any>(`/customer/${phone}/previous-providers?serviceType=training`).catch(() => null);
      if (response?.provider) {
        const p = response.provider;
        const prc = Number(p.totalReviews ?? p.reviewCount ?? 0) || 0;
        const praw = p.rating != null ? Number(p.rating) : NaN;
        const pr = prc > 0 && Number.isFinite(praw) && praw > 0 ? praw : 0;
        setPreviousTrainer({ id: p.id, name: p.businessName || p.name, photo: p.photo, rating: pr, lastVisit: p.lastVisit, sessionsCount: p.sessionsCount || 1 });
      } else {
        const pkgRes = await apiClient.get<any>(`/customer/${phone}/packages?serviceType=training`).catch(() => null);
        if (pkgRes?.packages?.length > 0) {
          const pkg = pkgRes.packages[0];
          if (pkg.vendorId && pkg.vendorName) setPreviousTrainer({ id: pkg.vendorId, name: pkg.vendorName, photo: null, rating: 0, lastVisit: pkg.lastUsed || '3 weeks ago', sessionsCount: pkg.sessionsUsed || 1 });
        }
      }
    } catch { /* ignore */ }
  };

  const loadActiveTrainingPackages = async () => {
    try {
      const response = await apiClient.get<any>(`/customer/${phone}/packages?serviceType=training`);
      if (response?.packages && Array.isArray(response.packages)) {
        setActivePackages(response.packages);
      } else {
        setActivePackages([]);
      }
    } catch (error: any) {
      // Silently fail - no packages is not an error
      console.log('No active training packages or error loading:', error?.message);
      setActivePackages([]);
    }
  };

  const loadPetSkills = async () => {
    try {
      const response = await apiClient.get<any>(`/customer/${phone}/pet-skills`);
      if (response?.skills && Array.isArray(response.skills)) {
        setPetSkills(response.skills);
      } else {
        setPetSkills([]);
      }
    } catch (error: any) {
      // Silently fail - no skills data is not an error
      console.log('No pet skills data or error loading:', error?.message);
      setPetSkills([]);
    }
  };

  const handleWarmpawzBookAppointment = useCallback(
    (v: BoardingListVendor) => {
      onNavigate?.(
        'grooming-booking',
        buildHubWarmpawzBookingNav(v, { category: 'training', serviceStyle: 'at_center' })
      );
    },
    [onNavigate]
  );

  const handleBookPlan = useCallback(
    (v: BoardingListVendor, plan: BoardingPlanRow) => {
      onNavigate?.('create-booking', {
        vendorId: v.id,
        serviceType: 'training',
        serviceId: plan.rowId,
        serviceName: plan.name,
        price: plan.price,
        duration: plan.duration,
        serviceStyle: plan.serviceStyle || 'at_center',
        vendorName: v.name,
      });
    },
    [onNavigate]
  );

  const openTrainerDetails = useCallback(
    (e: MouseEvent, vendorId: string) => {
      e.stopPropagation();
      onNavigate?.('training_center', { embedVendorId: vendorId });
    },
    [onNavigate]
  );

  const serviceTypes = useMemo(() => {
    const base = TRAINING_TYPE_CARDS.map((card) =>
      card.id === 'training_center'
        ? { ...card, badge: trainingCenterBadgeText.toUpperCase() }
        : { ...card, badge: card.badge ?? 'PERSONALIZED' },
    );
    if (shouldHideMarketplaceStyleTiles()) return [];
    return base;
  }, [trainingCenterBadgeText]);

  const serviceTypesWithWappt = useMemo(() => {
    if (!isWarmpawzAppointmentsHubEnabled('training')) return serviceTypes;
    const wapptCard = {
      id: 'wappt_training',
      name: 'Book Appointment',
      description: 'Fixed fee · pick a slot',
      image: TRAINING_TYPE_CARDS[0].image,
      Icon: Calendar,
      iconColor: 'text-white',
      iconBg: 'bg-[#FF8C42]',
      badge: 'WARMPAWZ',
      badgeClass: 'bg-[#FF8C42] text-white',
      arrowClass: 'bg-[#FF8C42] hover:bg-orange-600',
    };
    return [wapptCard, ...serviceTypes];
  }, [serviceTypes]);

  const dashboardStats = EMPTY_SERVICE_HEADER_STATS;

  if (vendorsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ✅ FIX: Restore Frame UI with ServiceDashboardHeader */}
      <ServiceDashboardHeader
        fullWidth
        serviceName="Training Services"
        serviceSubtitle="Professional pet training"
        serviceIcon={GraduationCap}
        iconColor="text-white"
        stats={dashboardStats}
        onBack={onBack}
        showBackButton={true}
        headerColor="bg-gradient-to-r from-[#FF8C42] via-[#FF7A35] to-[#FF6B35]"
        sheetToneClass="bg-white"
        headerBackground={<TrainingHeaderBackground />}
        headerTrailingImage={TRAINING_HEADER_BANNER}
        headerTrailingImageAlt="Dog and cat"
        clipHeaderTrailingImage
        headerTrailingImageClassName="pointer-events-none absolute bottom-0 right-0 top-[2.75rem] z-[5] flex w-[80%] max-w-[460px] items-end justify-end sm:top-12"
        headerTrailingImageImgClassName="block h-full w-auto max-w-full origin-bottom-right scale-[1.5] object-contain object-right object-bottom drop-shadow-lg"
      />

      {/* Main Content */}
      <div className="mx-auto w-full max-w-customer -mt-4 rounded-t-[1.75rem] bg-white px-4 pt-6 sm:rounded-t-[2rem]">
        <div className="space-y-8">

          {/* Phase 1: Book again with previous trainer */}
          {previousTrainer && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-orange-500" />
                <h2 className="text-lg font-bold text-slate-900">Book again</h2>
              </div>
              <Card className="bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200 p-4">
                <div className="flex items-center gap-4">
                  {previousTrainer.photo ? (
                    <img src={previousTrainer.photo} alt={previousTrainer.name} className="w-16 h-16 rounded-xl object-cover border-2 border-orange-200" />
                  ) : (
                    <div className="w-16 h-16 bg-orange-100 rounded-xl flex items-center justify-center text-orange-600 font-bold text-xl border-2 border-orange-200">
                      {previousTrainer.name?.charAt(0) || 'T'}
                    </div>
                  )}
                  <div className="flex-1">
                    <h3 className="font-bold text-slate-900 text-lg">{previousTrainer.name}</h3>
                    <div className="flex items-center gap-2 text-sm text-slate-600 mt-1">
                      <Star className="w-4 h-4 fill-orange-500" /> {previousTrainer.rating}
                      <span>•</span>
                      <span>Last visit: {previousTrainer.lastVisit || '3 weeks ago'}</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">{previousTrainer.sessionsCount || 1} session(s) with you</p>
                  </div>
                  <Button className="bg-[#FF8C42] hover:bg-[#FF7A2E] text-white" onClick={() => onNavigate?.('training-booking', { vendorId: previousTrainer.id })}>
                    Book Now
                  </Button>
                </div>
              </Card>
            </div>
          )}
          
          {/* Active Training Package with Progress */}
          {activePackages.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package className="w-5 h-5 text-orange-500" />
                  <h2 className="text-lg font-bold text-slate-900">Your Training</h2>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-orange-500"
                  onClick={() => onNavigate?.('training-progress', { packageId: activePackages[0].id })}
                >
                  View Progress
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
              
              <Card className="border-orange-200 bg-gradient-to-br from-orange-50 to-amber-50 p-4">
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                    <Trophy className="w-6 h-6 text-orange-500" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">{activePackages[0].packageName}</h3>
                    <p className="text-sm text-orange-600">with {activePackages[0].trainerName}</p>
                    <p className="text-xs text-gray-500 mt-1">{activePackages[0].petName}</p>
                  </div>
                </div>
                
                {/* Session Progress */}
                <div className="mb-4">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-600">Sessions Completed</span>
                    <span className="font-medium">{activePackages[0].completedSessions}/{activePackages[0].totalSessions}</span>
                  </div>
                  <div className="h-2 bg-orange-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-orange-500 to-amber-500 rounded-full transition-all"
                      style={{ width: `${(activePackages[0].completedSessions / activePackages[0].totalSessions) * 100}%` }}
                    />
                  </div>
                </div>
                
                {/* Skills Learned */}
                {activePackages[0].skillsLearned && activePackages[0].skillsLearned.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs text-gray-500 mb-2">Skills Learned</p>
                    <div className="flex flex-wrap gap-2">
                      {activePackages[0].skillsLearned.map((skill, idx) => (
                        <span key={idx} className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs">
                          <CheckCircle className="w-3 h-3" />
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Next Session */}
                {activePackages[0].nextSessionDate && (
                  <div className="flex items-center justify-between pt-3 border-t border-orange-100">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Clock className="w-4 h-4" />
                      <span>Next: {new Date(activePackages[0].nextSessionDate).toLocaleDateString()}</span>
                    </div>
                    <Button size="sm" className="bg-orange-500 hover:bg-orange-600">
                      View Details
                    </Button>
                  </div>
                )}
              </Card>
            </div>
          )}

          {/* Pet Skills Matrix Preview */}
          {petSkills.length > 0 && (
            <Card className="border-blue-200 bg-blue-50/50 p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-blue-600" />
                  <h3 className="font-semibold text-blue-900">Skill Progress</h3>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-blue-600"
                  onClick={() => onNavigate?.('training-skill-matrix')}
                >
                  Full Matrix
                </Button>
              </div>
              <div className="space-y-2">
                {petSkills.slice(0, 3).map((skill, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <div className="flex-1">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-700">{skill.skillName}</span>
                        <span className={`text-xs font-medium ${
                          skill.status === 'mastered' ? 'text-green-600' : 
                          skill.status === 'in_progress' ? 'text-blue-600' : 'text-gray-400'
                        }`}>
                          {skill.status === 'mastered' ? '✓ Mastered' : 
                           skill.status === 'in_progress' ? 'In Progress' : 'Not Started'}
                        </span>
                      </div>
                      <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all ${
                            skill.status === 'mastered' ? 'bg-green-500' : 
                            skill.status === 'in_progress' ? 'bg-blue-500' : 'bg-gray-300'
                          }`}
                          style={{ width: `${skill.level}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Vendor spotlights + promotion banner - Phase 0.1 Integration */}
          <div className="space-y-4">
            <FeaturedVendorSpotlights service="training" phone={phone} onNavigate={onNavigate} />
          </div>

          {/* Choose Training Type */}
          <div>
            <div className="mb-3 flex items-center gap-2">
              <div className="rounded-lg bg-orange-50 p-1.5">
                <PawPrint className="h-4 w-4 text-[#FF8C42]" />
              </div>
              <h2 className="text-lg font-bold text-slate-900">Choose Training Type</h2>
              <PawPrint className="h-3.5 w-3.5 text-[#FF8C42]" aria-hidden />
            </div>
            <div className="grid grid-cols-2 gap-3">
              {serviceTypesWithWappt.map((service) => (
                <button
                  key={service.id}
                  type="button"
                  onClick={() => {
                    if (service.id === 'wappt_training') {
                      onNavigate?.('wappt-discovery', { category: 'training' });
                      return;
                    }
                    onNavigate?.(service.id);
                  }}
                  className="group relative overflow-hidden rounded-2xl border border-slate-100 bg-white text-left shadow-sm transition-all hover:shadow-md"
                >
                  <div className="relative h-28 w-full sm:h-32">
                    <CachedImage
                      src={service.image}
                      alt={service.name}
                      fill
                      className="object-cover transition-transform duration-300 ease-in-out group-hover:scale-105"
                      sizes="(max-width: 640px) 45vw, 200px"
                    />
                    <span
                      className={`absolute right-2 top-2 rounded-full px-2 py-0.5 text-[8px] font-bold uppercase tracking-wide ${service.badgeClass}`}
                    >
                      {service.badge}
                    </span>
                    <div
                      className={`absolute bottom-2 left-2 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white shadow-md ${service.iconBg}`}
                    >
                      <service.Icon className={`h-4 w-4 ${service.iconColor}`} />
                    </div>
                  </div>
                  <div className="relative p-3 pb-10">
                    <h3 className="text-sm font-bold text-slate-900">{service.name}</h3>
                    <p className="mt-0.5 text-[11px] text-slate-500">{service.description}</p>
                    <div
                      className={`absolute bottom-3 right-3 flex h-8 w-8 items-center justify-center rounded-full text-white shadow-md transition-transform group-hover:scale-110 ${service.arrowClass}`}
                    >
                      <ArrowRight className="h-4 w-4" />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <TrainingGoalGrid
            problems={trainingGoals}
            onNavigate={(screen, navData) => onNavigate?.(screen, navData)}
          />

          {/* Top Trainers — expandable cards aligned with training_center list */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900">Top Trainers</h2>
              <button 
                className="text-sm text-orange-600 flex items-center gap-1 font-medium"
                onClick={() => onNavigate?.('training_center')}
              >
                View All <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            {relaxedFilter && (
              <p className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 mb-3">
                Showing all training providers we could match — expand for services and prices.
              </p>
            )}
            <div className="space-y-4">
              {vendors.length === 0 ? (
                <Card className="p-8 text-center">
                  <div className="text-4xl mb-3">🎓</div>
                  <p className="text-gray-600 mb-2">No trainers available in your area yet</p>
                  <p className="text-gray-500 text-sm">Check back soon for training options!</p>
                </Card>
              ) : (
                vendors.map((v) => {
                  const expanded = selectedVendorId === v.id;
                  const minP = minPriceForVendor(v);
                  return (
                    <BoardingVendorExpandableCard
                      key={v.id}
                      v={v}
                      serviceSlug={HUB_SLUG}
                      planBadgeLabel="Training"
                      expanded={expanded}
                      fetchingPlansFor={fetchingPlansFor}
                      minPrice={minP}
                      onToggleHeader={() => toggleVendor(v.id)}
                      onViewServices={(e) => {
                        e.stopPropagation();
                        setSelectedVendorId(v.id);
                      }}
                      onDetails={openTrainerDetails}
                      onBookPlan={handleBookPlan}
                      onOpenCenterDetails={openTrainerDetails}
                      customerId={phone}
                      serviceCategory="training"
                      onBookAppointment={handleWarmpawzBookAppointment}
                    />
                  );
                })
              )}
              <DiscoveryVendorFeedSentinel
                hasMore={vendorsHasMore}
                loading={vendorsLoading}
                loadingMore={vendorsLoadingMore}
                onLoadMore={() => void loadMoreVendors()}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
