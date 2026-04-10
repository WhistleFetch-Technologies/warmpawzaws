'use client';

import { 
  Scissors, Bath, Brush, Hand, Dog, Sparkles, Plus,
  GraduationCap, Home, PawPrint, AlertTriangle, Trophy, Dog as DogLeash,
  Footprints, Bone, Mountain,
  Frown, Volume2, Bomb, Ghost, Shield,
  Hotel, Sun, Star, Pill, Syringe,
  Stethoscope, Heart, Activity, FileText, Eye, Siren, Package
} from 'lucide-react';

/**
 * UNIVERSAL PROBLEM GRID SECTION COMPONENT
 * 
 * Reusable component that displays problem/need grids for any vendor type
 * Automatically adapts labels and icons based on vendor role
 * 
 * DESIGN PHILOSOPHY UPDATE:
 * - Unified Color Palette: Slate (Neutral) + Orange (Brand)
 * - Removed chaotic rainbow colors
 * - consistent card styling
 * - Using 2D Lucide icons instead of emojis for professional look
 */

interface ProblemGridItem {
  id: string;
  name: string;
  icon: string | React.ReactNode;
  bgColor?: string;
  /** When set (e.g. from specialization_master), tints the icon chip like admin catalog. */
  iconBg?: string;
  textColor?: string;
}

interface ProblemGridSectionProps {
  roleId: string;
  roleName: string;
  title: string;
  icon: React.ComponentType<any>;
  problems: ProblemGridItem[];
  onNavigate: (screen: string, data?: any) => void;
}

export function ProblemGridSection({ 
  roleId, 
  roleName,
  title,
  icon: Icon,
  problems,
  onNavigate 
}: ProblemGridSectionProps) {
  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-orange-50 rounded-lg">
            <Icon className="w-4 h-4 text-[#FF8C42]" />
          </div>
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        </div>
        <button 
          onClick={() => onNavigate('problem_grid')}
          className="text-sm text-[#FF8C42] font-medium hover:text-[#FF7029] transition-colors"
        >
          View All
        </button>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {problems.map((problem) => {
          const isViewAll = problem.id === 'view_all';
          const hasAdminTint = Boolean(problem.iconBg) && !isViewAll;
          return (
            <button
              key={problem.id}
              onClick={() => {
                console.log('🔵 [ProblemGridSection] Problem clicked:', problem.id, isViewAll);
                if (isViewAll) {
                  console.log('🔵 [ProblemGridSection] Navigating to problem_grid');
                  onNavigate('problem_grid');
                } else {
                  console.log('🔵 [ProblemGridSection] Navigating to problem_selected:', problem.id);
                  onNavigate('problem_selected', { problemId: problem.id, problemTitle: problem.name });
                }
              }}
              className="group relative flex flex-col items-center"
            >
              <div className={`
                w-full aspect-square rounded-2xl border transition-all duration-200 flex flex-col items-center justify-center gap-2 p-2
                ${isViewAll 
                  ? 'bg-orange-50 border-orange-100 text-orange-700 hover:bg-orange-100' 
                  : 'bg-white border-slate-100 text-slate-600 hover:border-orange-200 hover:shadow-md hover:-translate-y-0.5'
                }
              `}>
                <div
                  className={`
                  w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110
                  ${
                    isViewAll
                      ? 'bg-white/50'
                      : hasAdminTint
                        ? `${problem.iconBg} group-hover:opacity-90`
                        : 'bg-slate-50 group-hover:bg-orange-50'
                  }
                `}
                >
                  {typeof problem.icon === 'string' ? (
                    <span className="text-xl">{problem.icon}</span>
                  ) : (
                    <div
                      className={
                        hasAdminTint ? '' : 'text-slate-600 group-hover:text-orange-600'
                      }
                    >
                      {problem.icon}
                    </div>
                  )}
                </div>
                <p className={`
                  text-[10px] font-medium text-center leading-tight line-clamp-2
                  ${isViewAll ? 'text-orange-700' : 'text-slate-600 group-hover:text-orange-700'}
                `}>
                  {problem.name}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ========================================
// PROBLEM GRID DATA FOR ALL VENDOR TYPES (FALLBACK ONLY)
// Primary source: specialization_master via GET /public/problem-grid and /public/problem-grid/:roleId.
// These constants are used only when the API returns no data (e.g. offline or empty config).
// Admin-created specializations (e.g. "Hair Trimming") appear when show_in_problem_grid or show_in_services_dashboard is true.
// ========================================

/**
 * GROOMING NEEDS - Fallback when API returns empty. Priority: Lower number = shown first.
 */
export const GROOMING_NEEDS = [
  // Essential/Daily (shown first)
  { id: 'bath_only', name: 'Bath & Brush', icon: <Bath className="w-6 h-6 text-blue-500" />, priority: 1 },
  { id: 'full_grooming', name: 'Full Grooming', icon: <Scissors className="w-6 h-6 text-orange-500" />, priority: 2 },
  { id: 'nail_care', name: 'Nail Care', icon: <Hand className="w-6 h-6 text-purple-500" />, priority: 3 },
  // Regular Maintenance
  { id: 'haircut_styling', name: 'Hair Styling', icon: <Brush className="w-6 h-6 text-pink-500" />, priority: 21 },
  { id: 'deshedding', name: 'De-shedding', icon: <Dog className="w-6 h-6 text-amber-500" />, priority: 22 },
  // Specialty/Luxury
  { id: 'spa_treatment', name: 'Spa & Wellness', icon: <Sparkles className="w-6 h-6 text-rose-500" />, priority: 41 },
  { id: 'view_all', name: 'View All', icon: <Plus className="w-6 h-6" />, priority: 999 }
];

/**
 * TRAINING GOALS - Ordered by fundamental importance
 * Basic obedience first, specialized training last
 * Priority: Lower number = shown first
 */
export const TRAINING_GOALS = [
  // Essential Training (shown first)
  { id: 'basic_obedience', name: 'Basic Obedience', icon: <GraduationCap className="w-6 h-6 text-purple-500" />, priority: 1 },
  { id: 'potty_training', name: 'Potty Training', icon: <Home className="w-6 h-6 text-green-500" />, priority: 2 },
  { id: 'leash_training', name: 'Leash Training', icon: <DogLeash className="w-6 h-6 text-indigo-500" />, priority: 3 },
  // Socialization
  { id: 'socialization', name: 'Socialization', icon: <PawPrint className="w-6 h-6 text-blue-500" />, priority: 21 },
  // Advanced/Specialty
  { id: 'advanced_training', name: 'Advanced Skills', icon: <Trophy className="w-6 h-6 text-amber-500" />, priority: 41 },
  { id: 'aggression', name: 'Aggression Fix', icon: <AlertTriangle className="w-6 h-6 text-red-500" />, priority: 42 },
  { id: 'view_all', name: 'View All', icon: <Plus className="w-6 h-6" />, priority: 999 }
];

/**
 * WALKING NEEDS - Ordered by daily usage
 * Regular daily walks first, adventure walks last
 * Priority: Lower number = shown first
 */
export const WALKING_NEEDS = [
  // Daily Essentials (shown first)
  { id: 'daily_walk', name: 'Daily Walk', icon: <Footprints className="w-6 h-6 text-green-500" />, priority: 1 },
  { id: 'puppy_walk', name: 'Puppy Walking', icon: <Dog className="w-6 h-6 text-blue-500" />, priority: 2 },
  // Regular Needs
  { id: 'multiple_dogs', name: 'Multiple Dogs', icon: <DogLeash className="w-6 h-6 text-indigo-500" />, priority: 21 },
  { id: 'senior_walk', name: 'Senior Care', icon: <Bone className="w-6 h-6 text-amber-500" />, priority: 22 },
  // Special Occasions
  { id: 'long_walk', name: 'Adventure Walk', icon: <Mountain className="w-6 h-6 text-emerald-500" />, priority: 41 },
  { id: 'view_all', name: 'View All', icon: <Plus className="w-6 h-6" />, priority: 999 }
];

/**
 * BEHAVIORAL ISSUES - Ordered by common occurrence
 * Most common issues first, complex behaviors last
 * Priority: Lower number = shown first
 */
export const BEHAVIORAL_ISSUES = [
  // Common Issues (shown first)
  { id: 'separation_anxiety', name: 'Anxiety & Stress', icon: <Frown className="w-6 h-6 text-yellow-500" />, priority: 1 },
  { id: 'barking', name: 'Barking Issues', icon: <Volume2 className="w-6 h-6 text-orange-500" />, priority: 2 },
  // Regular Issues
  { id: 'fear_phobia', name: 'Fear Issues', icon: <Ghost className="w-6 h-6 text-indigo-500" />, priority: 21 },
  // Complex Issues
  { id: 'destructive', name: 'Destructive Habits', icon: <Bomb className="w-6 h-6 text-red-500" />, priority: 41 },
  { id: 'resource_guarding', name: 'Possessive Behavior', icon: <Shield className="w-6 h-6 text-blue-500" />, priority: 42 },
  { id: 'view_all', name: 'View All', icon: <Plus className="w-6 h-6" />, priority: 999 }
];

/**
 * BOARDING NEEDS - Ordered by frequency of use
 * Daycare/short stays first, specialty boarding last
 * Priority: Lower number = shown first
 */
export const BOARDING_NEEDS = [
  // Common Needs (shown first)
  { id: 'daycare', name: 'Daily Daycare', icon: <Sun className="w-6 h-6 text-yellow-500" />, priority: 1 },
  { id: 'short_stay', name: 'Weekend Stay', icon: <Hotel className="w-6 h-6 text-orange-500" />, priority: 2 },
  // Extended Care
  { id: 'long_stay', name: 'Extended Stay', icon: <Home className="w-6 h-6 text-amber-500" />, priority: 21 },
  // Specialty
  { id: 'luxury_boarding', name: 'Luxury Stay', icon: <Star className="w-6 h-6 text-purple-500" />, priority: 41 },
  { id: 'medical_boarding', name: 'Medical Care', icon: <Pill className="w-6 h-6 text-blue-500" />, priority: 42 },
  { id: 'view_all', name: 'View All', icon: <Plus className="w-6 h-6" />, priority: 999 }
];

/**
 * VET PROBLEMS - Ordered by frequency of need
 * General/preventive care first, surgery/emergency last
 * Priority: Lower number = shown first (daily use → specialty)
 */
export const VET_PROBLEMS = [
  // Daily/Preventive Care (shown first)
  { id: 'medicine', name: 'General', icon: <Package className="w-6 h-6 text-purple-500" />, priority: 1 },
  { id: 'vaccination', name: 'Vaccination', icon: <Pill className="w-6 h-6 text-blue-500" />, priority: 2 },
  // Common Health Issues
  { id: 'dermatology', name: 'Skin Care', icon: <Activity className="w-6 h-6 text-green-500" />, priority: 21 },
  { id: 'dentistry', name: 'Dental', icon: <FileText className="w-6 h-6 text-blue-500" />, priority: 22 },
  { id: 'ophthalmology', name: 'Eye Care', icon: <Eye className="w-6 h-6 text-cyan-500" />, priority: 23 },
  // Specialty Care
  { id: 'cardiology', name: 'Heart Care', icon: <Heart className="w-6 h-6 text-red-500" />, priority: 41 },
  // Rare/Emergency (shown last - rarely needed)
  { id: 'surgery', name: 'Surgery', icon: <Stethoscope className="w-6 h-6 text-teal-500" />, priority: 61 },
  { id: 'emergency', name: 'Emergency', icon: <Siren className="w-6 h-6 text-red-500" />, priority: 62 },
  { id: 'view_all', name: '20+ more', icon: <Plus className="w-6 h-6" />, priority: 999 }
];

/**
 * NUTRITIONIST NEEDS - Ordered by daily relevance
 * General diet planning first, medical diets last
 * Priority: Lower number = shown first
 */
export const NUTRITIONIST_NEEDS = [
  // Daily Needs (shown first)
  { id: 'diet_plan', name: 'Diet Planning', icon: <FileText className="w-6 h-6 text-green-500" />, priority: 1 },
  { id: 'puppy_nutrition', name: 'Puppy Diet', icon: <Dog className="w-6 h-6 text-blue-500" />, priority: 2 },
  { id: 'senior_nutrition', name: 'Senior Diet', icon: <Heart className="w-6 h-6 text-purple-500" />, priority: 3 },
  // Health-Related
  { id: 'weight_management', name: 'Weight Loss', icon: <Activity className="w-6 h-6 text-orange-500" />, priority: 21 },
  { id: 'allergies', name: 'Food Allergies', icon: <AlertTriangle className="w-6 h-6 text-red-500" />, priority: 22 },
  // Specialty
  { id: 'special_diet', name: 'Medical Diet', icon: <Pill className="w-6 h-6 text-teal-500" />, priority: 41 },
  { id: 'view_all', name: 'View All', icon: <Plus className="w-6 h-6" />, priority: 999 }
];
