'use client';

/**
 * UNIVERSAL PROBLEM GRID SELECTOR
 * 
 * Reusable component that displays problem categories for any vendor type
 * Dynamically loads problem grid based on roleId (vet, groomer, trainer, etc.)
 * 
 * DESIGN UPDATE:
 * - Enforced Warmpawz Design Philosophy (Orange Header / White Card)
 * - Uses consistent lucide-react icons instead of emojis
 */

import { useState, useEffect, type ReactNode } from 'react';
import { ArrowLeft, Search, ChevronRight, Check, Loader2, AlertCircle, 
  Stethoscope, Syringe, Bone, Heart, Activity, AlertTriangle, 
  Scissors, Droplets, Sparkles, Hand, Wind, Brush,
  GraduationCap, Home as HomeIcon, Users, Dog, PawPrint, Trophy,
  MapPin, Clock, Timer, Bike, Sun,
  Frown, Volume2, Zap, Ghost,
  Hotel, Building, CalendarDays, Star,
  Scale, Apple, Baby, HeartPulse
} from 'lucide-react';

// Map problem IDs to lucide-react icons for consistent display
const getProblemIcon = (problemId: string, roleId: string): React.ReactNode => {
  const iconMap: Record<string, any> = {
    // Vet problems
    'general_consultation': Stethoscope,
    'vaccination': Syringe,
    'dental_care': Bone,
    'skin_allergies': Heart,
    'digestive_issues': Activity,
    'emergency': AlertTriangle,
    
    // Groomer problems
    'full_grooming': Scissors,
    'bath_only': Droplets,
    'haircut_styling': Scissors,
    'nail_care': Hand,
    'deshedding': Wind,
    'spa_treatment': Sparkles,
    
    // Trainer problems
    'basic_obedience': GraduationCap,
    'potty_training': HomeIcon,
    'socialization': Users,
    'aggression': AlertTriangle,
    'leash_training': Dog,
    'advanced_training': Trophy,
    
    // Walker problems
    'daily_walk': Bike,
    'puppy_walk': PawPrint,
    'senior_walk': Clock,
    'long_walk': MapPin,
    
    // Behavioral problems
    'separation_anxiety': Frown,
    'barking': Volume2,
    'destructive': Zap,
    'fear_phobia': Ghost,
    
    // Boarding problems
    'short_stay': Hotel,
    'long_stay': Building,
    'daycare': Sun,
    'luxury_boarding': Star,
    
    // Nutritionist problems
    'weight_management': Scale,
    'allergies_sensitivities': AlertTriangle,
    'puppy_kitten_nutrition': Baby,
    'senior_nutrition': HeartPulse,
  };

  const IconComponent = iconMap[problemId] || PawPrint;
  return <IconComponent className="w-6 h-6 text-[#FF8C42]" />;
};

import { apiClient } from '@/lib/api-client';
import { defaultAllowedServiceStylesForRole } from '@/lib/default-allowed-service-styles';
import { sanitizeCustomerAllowedServiceStyles } from '@/lib/sanitize-customer-allowed-service-styles';
import { PROBLEM_GRID_CATEGORY_TO_ROLE } from '@/lib/problem-grid-catalog-fallback';
import { problemGridAliasesForApi } from '@/lib/problem-grid-role-aliases';
import { DynamicProblemIcon } from '@/lib/problem-grid-dynamic-icon';
import { problemIconTextColorToBgClass } from '@/lib/problem-grid-icon-bg';
import {
  GROOMING_NEEDS,
  WALKING_NEEDS,
  NUTRITIONIST_NEEDS,
  TRAINING_GOALS,
  BOARDING_NEEDS,
  BEHAVIORAL_ISSUES,
  VET_PROBLEMS,
} from './ProblemGridSection';
import { isEmergencyProblemTileLocked } from '@/lib/problem-grid-emergency-lock';

function normalizeStyles(raw: unknown, roleIdForFallback?: string): string[] {
  if (Array.isArray(raw) && raw.length > 0) return raw as string[];
  if (typeof raw === 'string') {
    try {
      const p = JSON.parse(raw);
      return Array.isArray(p) && p.length > 0 ? p : defaultAllowedServiceStylesForRole(roleIdForFallback);
    } catch {
      return defaultAllowedServiceStylesForRole(roleIdForFallback);
    }
  }
  return defaultAllowedServiceStylesForRole(roleIdForFallback);
}

function mapFromProblemGridRow(p: any, roleIdForFlow: string): any {
  const label = p.displayName || p.name;
  return {
    id: p.id ?? p.problemId,
    name: p.name,
    displayName: label,
    description:
      typeof p.description === 'string' && p.description.trim()
        ? p.description
        : `Find ${label} specialists`,
    roleId: roleIdForFlow,
    allowedServiceStyles: sanitizeCustomerAllowedServiceStyles(
      normalizeStyles(p.allowedServiceStyles ?? p.allowed_service_styles, roleIdForFlow),
      {
        roleId: roleIdForFlow,
        specializationId: String(p.id ?? p.problemId ?? ''),
      }
    ),
    keywords: [String(p.name || '').toLowerCase(), String(p.id || '').toLowerCase()],
    iconName: p.iconName ?? p.icon_name,
    iconColor: p.iconColor ?? p.icon_color,
    displayOrder: p.displayOrder ?? p.display_order ?? 100,
  };
}

/** Same catalog as home when APIs return nothing or legacy single "General Service". */
function buildLocalAllProblemsFallback(): any[] {
  const rows = (items: { id: string; name: string }[], roleId: string) =>
    items
      .filter((p) => p.id !== 'view_all')
      .map((p) => ({
        id: p.id,
        name: p.name,
        displayName: p.name,
        description: 'Select to find specialists',
        roleId,
        allowedServiceStyles: sanitizeCustomerAllowedServiceStyles(null, {
          roleId,
          specializationId: p.id,
        }),
        keywords: [p.name.toLowerCase(), p.id.toLowerCase()],
      }));
  return [
    ...rows(GROOMING_NEEDS, 'groomer'),
    ...rows(WALKING_NEEDS, 'walker'),
    ...rows(NUTRITIONIST_NEEDS, 'nutritionist'),
    ...rows(TRAINING_GOALS, 'trainer'),
    ...rows(BOARDING_NEEDS, 'boarding'),
    ...rows(BEHAVIORAL_ISSUES, 'behaviorist'),
    ...rows(VET_PROBLEMS, 'veterinarian'),
  ];
}

interface ProblemGridSelectorProps {
  roleId: string;
  roleName: string;
  onBack: () => void;
  onProblemSelect: (problem: any) => void;
  customerId: string;
  phone: string;
  /** e.g. category placement banners on Find All Services */
  topSlot?: ReactNode;
}

export function ProblemGridSelector({
  roleId,
  roleName,
  onBack,
  onProblemSelect,
  customerId,
  phone,
  topSlot,
}: ProblemGridSelectorProps) {
  const [problems, setProblems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProblemId, setSelectedProblemId] = useState<string | null>(null);
  const [processingSelection, setProcessingSelection] = useState(false);
  const [selectionSuccess, setSelectionSuccess] = useState(false);

  useEffect(() => {
    loadProblemGrid();
  }, [roleId]);

  const loadProblemGrid = async () => {
    try {
      setLoading(true);
      const isAll = String(roleId || '').toLowerCase() === 'all';
      let list: any[] = [];

      if (isAll) {
        try {
          const pg = await apiClient.get<{ success?: boolean; problems?: any[] }>('/public/problem-grid');
          if (pg?.success && Array.isArray(pg.problems) && pg.problems.length > 0) {
            list = pg.problems
              .filter((p: any) => p?.id && p?.name)
              .map((p: any) => {
                const cat = String(p.categoryId || '').toLowerCase();
                const roleForRow = PROBLEM_GRID_CATEGORY_TO_ROLE[cat] || 'veterinarian';
                return mapFromProblemGridRow(p, roleForRow);
              });
          }
        } catch {
          /* fall through */
        }
        if (list.length === 0) {
          list = buildLocalAllProblemsFallback();
        }
      } else {
        const aliases = problemGridAliasesForApi(roleId);
        for (const rid of aliases) {
          try {
            const res = await apiClient.get<{ success?: boolean; problems?: any[] }>(
              `/public/problem-grid/${encodeURIComponent(rid)}`
            );
            if (
              res?.success !== false &&
              Array.isArray(res.problems) &&
              res.problems.length > 0
            ) {
              list = res.problems
                .filter((p: any) => p?.id && (p.name || p.displayName))
                .map((p: any) => mapFromProblemGridRow(p, roleId));
              break;
            }
          } catch {
            continue;
          }
        }
        if (list.length === 0) {
          try {
            const data = await apiClient.get<{ problems?: any[] }>(
              `/public/problems?roleId=${encodeURIComponent(roleId)}`
            );
            list = Array.isArray(data.problems) ? data.problems : [];
          } catch {
            list = [];
          }
        }
      }

      list.sort((a, b) => {
        const ao = a.displayOrder ?? 100;
        const bo = b.displayOrder ?? 100;
        if (ao !== bo) return Number(ao) - Number(bo);
        const an = (a.displayName || a.name || '').toString();
        const bn = (b.displayName || b.name || '').toString();
        return an.localeCompare(bn);
      });

      setProblems(list);
    } catch (error) {
      console.error('Error loading problem grid:', error);
      if (String(roleId || '').toLowerCase() === 'all') {
        setProblems(buildLocalAllProblemsFallback());
      } else {
        setProblems([]);
      }
    } finally {
      setLoading(false);
    }
  };

  const filteredProblems = problems.filter((problem) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    const name = (problem.name || problem.displayName || '').toLowerCase();
    const display = (problem.displayName || '').toLowerCase();
    return (
      name.includes(query) ||
      display.includes(query) ||
      (problem.description && String(problem.description).toLowerCase().includes(query)) ||
      (problem.keywords &&
        problem.keywords.some((keyword: string) => String(keyword).toLowerCase().includes(query)))
    );
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FF8C42]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FF8C42] max-w-md mx-auto">
      {/* Header - Orange Background */}
      <div className="px-6 cw-header-safe-top pb-6">
        <div className="flex items-center gap-4 mb-2">
          <button 
            onClick={onBack}
            className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center hover:bg-white/30 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div>
             <h1 className="text-2xl font-bold text-white">
               Find {roleName}
             </h1>
             <p className="text-white/80 text-sm">
               {roleId === 'all'
                 ? 'Browse grooming, walks, vet care, and more'
                 : "Select your pet's health concern"}
             </p>
          </div>
        </div>
      </div>

      {/* Main Content - White Card with Top Radius */}
      <div className="bg-white rounded-t-[32px] px-6 pt-6 min-h-[calc(100vh-140px)] pb-12">
        {topSlot ? <div className="mb-4">{topSlot}</div> : null}

        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search symptoms (e.g. itching, fever)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF8C42] focus:border-transparent text-slate-900 placeholder:text-slate-400"
            />
          </div>
        </div>

        {/* Problem Grid */}
        {filteredProblems.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <Search className="w-12 h-12 mx-auto mb-3 text-slate-200" />
            <p className="text-sm font-medium text-slate-600">No matching problems found</p>
            <p className="text-xs mt-1">Try searching with different keywords</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filteredProblems.map((problem) => {
              const locked = isEmergencyProblemTileLocked({
                id: String(problem.id),
                name: problem.name,
                displayName: problem.displayName,
              });
              const isSelected = selectedProblemId === problem.id;
              const isProcessing = isSelected && processingSelection;
              const isSuccess = isSelected && selectionSuccess;
              const specIconName = problem.iconName ?? problem.icon_name;
              const specIconColor = problem.iconColor ?? problem.icon_color;
              const hasAdminIcon = Boolean(specIconName);
              const adminIconBg = problemIconTextColorToBgClass(specIconColor);
              const iconChipClass = hasAdminIcon
                ? `${adminIconBg || (isSelected ? 'bg-white' : 'bg-slate-50 group-hover:bg-orange-50')} ${isSelected && adminIconBg ? 'ring-2 ring-orange-200' : ''}`
                : isSelected
                  ? 'bg-white'
                  : 'bg-slate-50 group-hover:bg-orange-50';

              return (
              <button
                key={problem.id}
                type="button"
                onClick={() => {
                  if (locked) return;
                  if (navigator.vibrate) navigator.vibrate(10);
                  setSelectedProblemId(problem.id);
                  setProcessingSelection(true);
                  setSelectionSuccess(false);
                  
                  setTimeout(() => {
                    setProcessingSelection(false);
                    setSelectionSuccess(true);
                    setTimeout(() => {
                      onProblemSelect(problem);
                    }, 300);
                  }, 500);
                }}
                disabled={processingSelection || locked}
                className={`relative group text-left h-full ${locked ? 'cursor-not-allowed' : ''}`}
              >
                <div className={`
                  relative overflow-hidden rounded-2xl p-4 h-full flex flex-col justify-between transition-all duration-200
                  ${locked
                    ? 'bg-slate-50 border border-slate-100 text-slate-400 opacity-90'
                    : isSelected 
                    ? 'bg-orange-50 border-2 border-orange-500 shadow-md scale-[0.98]' 
                    : 'bg-white border border-slate-100 shadow-sm hover:border-orange-200 hover:shadow-md hover:-translate-y-0.5'
                  }
                `}>
                  {locked && (
                    <span className="absolute top-2 right-2 z-10 text-[8px] font-semibold uppercase tracking-wide text-slate-500 bg-white/95 border border-slate-200 px-1.5 py-0.5 rounded-md">
                      Soon
                    </span>
                  )}
                  
                  {/* Success Overlay */}
                  {isSuccess && (
                    <div className="absolute inset-0 bg-green-500 flex items-center justify-center z-20 animate-in fade-in duration-200">
                      <Check className="w-10 h-10 text-white animate-bounce" />
                    </div>
                  )}
                  
                  {/* Loading Overlay */}
                  {isProcessing && (
                    <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-20">
                      <Loader2 className="w-8 h-8 text-[#FF8C42] animate-spin" />
                    </div>
                  )}
                  
                  <div className="relative z-10">
                    {/* Icon - Using lucide-react for consistency */}
                    <div
                      className={`
                      w-12 h-12 rounded-xl flex items-center justify-center mb-3 transition-colors
                      ${iconChipClass}
                    `}
                    >
                      {hasAdminIcon ? (
                        <DynamicProblemIcon
                          iconName={specIconName}
                          iconColor={specIconColor}
                        />
                      ) : (
                        getProblemIcon(problem.id, roleId)
                      )}
                    </div>
                    
                    {/* Text */}
                    <div>
                      <h3 className={`font-bold text-sm mb-1 leading-tight ${isSelected ? 'text-orange-900' : 'text-slate-900'}`}>
                        {problem.displayName || problem.name}
                      </h3>
                      <p className={`text-xs line-clamp-2 ${isSelected ? 'text-orange-700/80' : 'text-slate-500'}`}>
                        {problem.description || 'Select to find specialists'}
                      </p>
                    </div>
                  </div>

                  {/* Arrow Indicator (Only visible on hover or select) */}
                  <div className={`
                    absolute bottom-4 right-4 transition-all duration-300
                    ${isSelected ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-2 group-hover:opacity-100 group-hover:translate-x-0'}
                  `}>
                    <ChevronRight className={`w-4 h-4 ${isSelected ? 'text-orange-500' : 'text-slate-300'}`} />
                  </div>
                </div>
              </button>
              );
            })}
          </div>
        )}

        {/* Help Box */}
        <div className="mt-8 p-4 bg-blue-50 rounded-xl border border-blue-100 flex gap-3">
          <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
             <AlertCircle className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-blue-900 mb-1">
              Not sure what to choose?
            </h3>
            <p className="text-xs text-blue-700 leading-relaxed">
              Select "General Consultation" or use the search bar. Our AI will help match you with the right specialist.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
