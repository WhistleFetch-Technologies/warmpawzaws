'use client';

import React, { useState, useMemo, useEffect } from 'react';
import type { LucideIcon } from 'lucide-react';
import { 
  Stethoscope, Scissors, GraduationCap, Home as HomeIcon, 
  Bone, Heart, Pill, Users, TrendingUp, ChevronRight,
  Footprints, Bath, Brush, Hand, Dog, Sparkles, Plus,
  PawPrint, AlertTriangle, Trophy, Mountain,
  Frown, Volume2, Bomb, Ghost, Shield,
  Hotel, Sun, Star, Activity, FileText, Eye, Siren, Package,
  ShoppingBag, Bike, Wheat, Coffee, Camera, Phone, Truck,
  FlaskConical, Brain, Folder, Moon, Clock, Calendar, Microscope, Flower2,
  Home,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api-client';
import { sanitizeCustomerAllowedServiceStyles } from '@/lib/sanitize-customer-allowed-service-styles';

// Import local problem data from ProblemGridSection (fallback when API has no data)
import { 
  VET_PROBLEMS, 
  GROOMING_NEEDS, 
  TRAINING_GOALS, 
  WALKING_NEEDS, 
  BEHAVIORAL_ISSUES,
  BOARDING_NEEDS,
  NUTRITIONIST_NEEDS,
} from './ProblemGridSection';
import { isEmergencyProblemTileLocked } from '@/lib/problem-grid-emergency-lock';

// Import service ordering configuration
import { 
  getCategoryPriority, 
  getServiceItemPriority,
  getMixedDisplayOrder,
  sortItemsWithinCategory 
} from '@/lib/service-ordering-config';

// Map API categoryId (from specialization_master) to category slug and roleId for display
// When admin adds a specialization in Categories tab, category_id drives this mapping
const CATEGORY_ID_TO_SLUG: Record<string, { category: string; roleId: string }> = {
  veterinary: { category: 'vet', roleId: 'veterinarian' },
  vet: { category: 'vet', roleId: 'veterinarian' },
  grooming: { category: 'grooming', roleId: 'groomer' },
  training: { category: 'training', roleId: 'trainer' },
  walking: { category: 'walker', roleId: 'walker' },
  walker: { category: 'walker', roleId: 'walker' },
  boarding: { category: 'boarding', roleId: 'boarding' },
  behavioral: { category: 'behavioral', roleId: 'behaviorist' },
  behaviour: { category: 'behavioral', roleId: 'behaviorist' },
  wellness: { category: 'nutrition', roleId: 'nutritionist' },
  nutrition: { category: 'nutrition', roleId: 'nutritionist' },
  diagnostic: { category: 'vet', roleId: 'veterinarian' },
  diagnostics: { category: 'vet', roleId: 'veterinarian' },
  shop: { category: 'shop', roleId: 'seller' },
  cafe: { category: 'cafe', roleId: 'pet_cafe' },
  photography: { category: 'photography', roleId: 'pet_photographer' },
  insurance: { category: 'insurance', roleId: 'pet_insurance' },
  ambulance: { category: 'ambulance', roleId: 'pet_ambulance' },
  breeder: { category: 'breeder', roleId: 'pet_breeder' },
  relocation: { category: 'relocation', roleId: 'pet_taxi' },
  resort: { category: 'resort', roleId: 'pet_resort' },
  sunset: { category: 'sunset', roleId: 'pet_sunset_services' },
  adoption: { category: 'adoption', roleId: 'pet_shelter' },
};

/** Admin catalog icons + known specialization_master values (avoids lucide namespace import). */
const PROBLEM_GRID_DYNAMIC_ICON_MAP: Record<string, LucideIcon> = {
  Stethoscope, Scissors, ShoppingBag, GraduationCap, Bike, Home, Heart, Wheat,
  Coffee, Camera, Shield, PawPrint, Phone, Truck, Sparkles, Sun, Pill,
  FlaskConical, Package, Eye, Activity, FileText, Siren, Hand, Brush, Dog,
  Bath, Trophy, AlertTriangle, Footprints, Mountain, Bone, Hotel, Star,
  Frown, Volume2, Ghost, Bomb, Brain, Folder, Moon, Clock, Calendar,
  Microscope, Flower2,
};

function resolveProblemGridIconName(raw?: string): string | undefined {
  if (!raw || typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  if (PROBLEM_GRID_DYNAMIC_ICON_MAP[trimmed]) return trimmed;
  const pascal = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  if (PROBLEM_GRID_DYNAMIC_ICON_MAP[pascal]) return pascal;
  return undefined;
}

function DynamicProblemIcon({ iconName, iconColor }: { iconName?: string; iconColor?: string }) {
  const resolved = resolveProblemGridIconName(iconName);
  if (!resolved) {
    return <Package className="w-6 h-6 text-gray-500" />;
  }
  const Icon = PROBLEM_GRID_DYNAMIC_ICON_MAP[resolved];
  return <Icon className={`w-6 h-6 ${iconColor || 'text-gray-600'}`} />;
}

interface LocalProblem {
  id: string;
  name: string;
  icon: React.ReactNode;
  category: string;
  roleId: string;
  priority: number; // Lower number = shown first (1-20: daily, 21-40: regular, 41+: specialty)
  allowedServiceStyles?: string[]; // From specialization_master; used to filter booking flow
}

interface ProblemGridNavigationProps {
  onProblemSelect: (problemId: string, problem: any) => void;
  vendorType?: string;
  showTrending?: boolean;
  className?: string;
  compact?: boolean; // Compact horizontal slider mode
}

/**
 * CATEGORY CONFIGURATION
 * Ordered by daily usage frequency for optimal UX:
 * - Daily use services first (Grooming, Walker, Nutrition)
 * - Regular services next (Training, Boarding)
 * - Health services last (Vet - important but less frequent)
 * 
 * The displayPriority controls tab order
 */
const CATEGORIES = [
  { id: 'all', name: 'All', icon: Sparkles, color: 'orange', displayPriority: 0 },
  // DAILY USE SERVICES (Priority 1-10)
  { id: 'grooming', name: 'Grooming', icon: Scissors, color: 'pink', roleId: 'groomer', displayPriority: 1 },
  { id: 'walker', name: 'Walker', icon: Footprints, color: 'green', roleId: 'walker', displayPriority: 2 },
  { id: 'nutrition', name: 'Nutrition', icon: Bone, color: 'amber', roleId: 'nutritionist', displayPriority: 3 },
  // REGULAR SERVICES (Priority 11-20)
  { id: 'training', name: 'Training', icon: GraduationCap, color: 'purple', roleId: 'trainer', displayPriority: 11 },
  { id: 'boarding', name: 'Boarding', icon: Hotel, color: 'blue', roleId: 'boarding', displayPriority: 12 },
  { id: 'behavioral', name: 'Behavioral', icon: Heart, color: 'indigo', roleId: 'behaviorist', displayPriority: 13 },
  // HEALTH SERVICES (Priority 21+)
  { id: 'vet', name: 'Vet', icon: Stethoscope, color: 'teal', roleId: 'veterinarian', displayPriority: 21 },
].sort((a, b) => a.displayPriority - b.displayPriority);

/**
 * Map local problem data with category info and priority
 * Priority is taken from the item's priority field, or defaults to 50
 */
const mapProblemsWithCategory = (problems: any[], category: string, roleId: string): LocalProblem[] => {
  return problems
    .filter(p => p.id !== 'view_all') // Exclude "view all" items
    .map(p => ({
      id: p.id,
      name: p.name,
      icon: p.icon,
      category,
      roleId,
      priority: p.priority ?? 50,
      allowedServiceStyles: sanitizeCustomerAllowedServiceStyles(null, {
        roleId,
        specializationId: p.id,
        categoryHint: category,
      }),
    }));
};

export function ProblemGridNavigation({ 
  onProblemSelect, 
  vendorType,
  showTrending = true,
  className = '',
  compact = false
}: ProblemGridNavigationProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [apiProblems, setApiProblems] = useState<LocalProblem[] | null>(null);

  // Fetch problem grid from Catalog (specialization_master) so admin-created specializations appear
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await apiClient.get<{ success?: boolean; problems?: any[] }>('/public/problem-grid');
        if (cancelled || !data?.success || !Array.isArray(data.problems) || data.problems.length === 0) {
          if (!cancelled && data?.success && Array.isArray(data.problems) && data.problems.length === 0) setApiProblems([]);
          return;
        }
        const mapped: LocalProblem[] = data.problems
          .filter((p: any) => p.id && p.name)
          .map((p: any) => {
            const slug = CATEGORY_ID_TO_SLUG[p.categoryId] || { category: p.categoryId || 'vet', roleId: 'veterinarian' };
            return {
              id: p.id,
              name: p.displayName || p.name,
              icon: <DynamicProblemIcon iconName={p.iconName} iconColor={p.iconColor} />,
              category: slug.category,
              roleId: slug.roleId,
              priority: p.displayOrder ?? 50,
              allowedServiceStyles: sanitizeCustomerAllowedServiceStyles(p.allowedServiceStyles, {
                roleId: slug.roleId,
                specializationId: p.id,
                categoryHint: slug.category,
              }),
            };
          });
        if (!cancelled) setApiProblems(mapped);
      } catch (_) {
        // Keep apiProblems null so we use hardcoded fallback
      }
    })();
    return () => { cancelled = true; };
  }, []);

  /**
   * Build all problems: use API data from Catalog when available, else hardcoded
   */
  const allProblems = useMemo(() => {
    if (apiProblems && apiProblems.length > 0) return apiProblems;
    return [
      ...mapProblemsWithCategory(GROOMING_NEEDS, 'grooming', 'groomer'),
      ...mapProblemsWithCategory(WALKING_NEEDS, 'walker', 'walker'),
      ...mapProblemsWithCategory(NUTRITIONIST_NEEDS, 'nutrition', 'nutritionist'),
      ...mapProblemsWithCategory(TRAINING_GOALS, 'training', 'trainer'),
      ...mapProblemsWithCategory(BOARDING_NEEDS, 'boarding', 'boarding'),
      ...mapProblemsWithCategory(BEHAVIORAL_ISSUES, 'behavioral', 'behaviorist'),
      ...mapProblemsWithCategory(VET_PROBLEMS, 'vet', 'veterinarian'),
    ];
  }, [apiProblems]);

  /**
   * Filter and sort problems based on selected category
   * 
   * When "All" is selected:
   * - Uses smart mixed display order: daily use items first, then regular, then specialty
   * - Items from different categories are interleaved by priority tier
   * 
   * When a specific category is selected:
   * - Shows items from that category sorted by priority (general first, specialty last)
   */
  const filteredProblems = useMemo(() => {
    if (selectedCategory === 'all') {
      // Use smart mixed display order for "All" view
      // This groups items by priority tier (daily, regular, specialty) across all categories
      return getMixedDisplayOrder(allProblems);
    }
    
    // For specific category, filter and sort by item priority
    const categoryItems = allProblems.filter(p => p.category === selectedCategory);
    
    // Sort by priority within category (lower priority number = shown first)
    return categoryItems.sort((a, b) => a.priority - b.priority);
  }, [selectedCategory, allProblems]);

  const handleProblemClick = (problem: LocalProblem) => {
    if (isEmergencyProblemTileLocked({ id: problem.id, name: problem.name })) return;
    onProblemSelect(problem.id, {
      problemId: problem.id,
      title: problem.name,
      name: problem.name,
      roleId: problem.roleId,
      category: problem.category,
      allowedServiceStyles: problem.allowedServiceStyles,
    });
  };

  // Get category color - using white background for clean look
  const getCategoryConfig = (category: string) => {
    // All icons now use white background with subtle gray border for a clean, unified look
    return { bgColor: 'bg-white', borderColor: 'border-gray-200', textColor: 'text-gray-700' };
  };

  // Compact horizontal slider mode
  if (compact) {
    return (
      <div className={`${className} w-full`}>
        {/* Category Filters - Compact Sliding Pills */}
        <div className="flex gap-1.5 overflow-x-auto px-4 pb-2 scrollbar-hide" style={{ display: 'flex', flexWrap: 'nowrap' }}>
          {CATEGORIES.map((cat) => {
            const CatIcon = cat.icon;
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition-all flex-shrink-0 ${
                  isSelected
                    ? 'bg-gradient-to-r from-[#FF8C42] to-[#FF6B35] text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
                style={{ flexShrink: 0 }}
              >
                <CatIcon className="w-3 h-3" />
                {cat.name}
              </button>
            );
          })}
        </div>

        {/* Problems - Compact Circular Slider */}
        <div 
          className="flex gap-3 overflow-x-auto px-4 py-2 scrollbar-hide" 
          style={{ 
            display: 'flex', 
            flexWrap: 'nowrap',
            width: '100%',
            overflowX: 'auto',
            WebkitOverflowScrolling: 'touch'
          }}
        >
          {filteredProblems.map((problem) => {
            const config = getCategoryConfig(problem.category);
            const locked = isEmergencyProblemTileLocked({ id: problem.id, name: problem.name });

            return (
              <button
                key={`${problem.category}-${problem.id}`}
                type="button"
                disabled={locked}
                onClick={() => handleProblemClick(problem)}
                className={`flex-shrink-0 flex flex-col items-center gap-1 group ${locked ? 'cursor-not-allowed opacity-80' : ''}`}
                style={{ 
                  minWidth: '60px', 
                  maxWidth: '60px',
                  flexShrink: 0,
                  flexGrow: 0
                }}
              >
                {/* Circular Icon */}
                <div className={`relative w-12 h-12 rounded-full ${config.bgColor} border-2 ${config.borderColor} flex items-center justify-center ${locked ? '' : 'group-hover:scale-110'} transition-transform shadow-sm`}>
                  {locked && (
                    <span className="absolute -top-0.5 -right-0.5 text-[7px] font-bold uppercase text-slate-600 bg-slate-100 border border-slate-200 px-1 rounded leading-none py-0.5">
                      Soon
                    </span>
                  )}
                  <div className={locked ? 'text-slate-400' : config.textColor}>
                    {problem.icon}
                  </div>
                </div>
                
                {/* Label */}
                <span className={`text-[10px] text-center leading-tight max-w-[50px] line-clamp-2 font-medium ${locked ? 'text-slate-400' : 'text-gray-700'}`}>
                  {problem.name.split(' ').slice(0, 2).join(' ')}
                </span>
              </button>
            );
          })}
        </div>

        {/* Empty State */}
        {filteredProblems.length === 0 && (
          <div className="text-center py-4 px-4">
            <p className="text-gray-500 text-sm">No services found</p>
          </div>
        )}
      </div>
    );
  }

  // Original grid mode
  return (
    <div className={`${className}`}>
      {/* Category Filters */}
      <div className="flex gap-2 overflow-x-auto pb-3 mb-4 scrollbar-hide">
        {CATEGORIES.map((cat) => {
          const CatIcon = cat.icon;
          const isSelected = selectedCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm whitespace-nowrap transition-all ${
                isSelected
                  ? 'bg-gradient-to-r from-orange-500 to-pink-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <CatIcon className="w-4 h-4" />
              {cat.name}
            </button>
          );
        })}
      </div>

      {/* Problem Grid */}
      <div className="grid grid-cols-2 gap-3">
        {filteredProblems.map((problem) => {
          const config = getCategoryConfig(problem.category);
          const locked = isEmergencyProblemTileLocked({ id: problem.id, name: problem.name });

          return (
            <button
              key={`${problem.category}-${problem.id}`}
              type="button"
              disabled={locked}
              onClick={() => handleProblemClick(problem)}
              className={`relative p-4 rounded-xl border-2 ${config.borderColor} ${config.bgColor} ${locked ? 'cursor-not-allowed opacity-85' : 'hover:shadow-lg'} transition-all duration-300 text-left group`}
            >
              {locked && (
                <span className="absolute top-2 right-2 text-[8px] font-semibold uppercase tracking-wide text-slate-500 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded-md z-10">
                  Soon
                </span>
              )}
              {/* Icon */}
              <div className={`w-12 h-12 rounded-lg ${config.bgColor} flex items-center justify-center mb-3`}>
                <div className={locked ? 'text-slate-400' : config.textColor}>
                  {problem.icon}
                </div>
              </div>

              {/* Title */}
              <h3 className={`text-sm font-medium ${locked ? 'text-slate-500' : config.textColor} mb-1`}>
                {problem.name}
              </h3>

              {/* Category Badge */}
              <span className="text-[10px] text-gray-500 capitalize">
                {problem.category}
              </span>

              {/* Arrow */}
              <ChevronRight className={`absolute bottom-3 right-3 w-4 h-4 ${config.textColor} opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all`} />
            </button>
          );
        })}
      </div>

      {/* Empty State */}
      {filteredProblems.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">No services found</p>
          <p className="text-sm text-gray-400 mt-1">Try selecting a different category</p>
        </div>
      )}
    </div>
  );
}
