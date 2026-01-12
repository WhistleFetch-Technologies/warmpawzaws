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

import { 
  Scissors, Bath, Brush, Hand, Dog, Sparkles, Plus,
  GraduationCap, Home, PawPrint, AlertTriangle, Trophy, Dog as DogLeash,
  Footprints, Bone, Mountain,
  Frown, Volume2, Bomb, Ghost, Shield,
  Hotel, Sun, Star, Pill,
  Stethoscope, Heart, Activity, FileText, Eye, Siren, Package
} from 'lucide-react';

interface ProblemGridItem {
  id: string;
  name: string;
  icon: React.ReactNode;
  // Deprecated specific color props in favor of unified styling, 
  // but kept for backward compatibility if needed, though we will ignore them in render
  bgColor?: string;
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
          return (
            <button
              key={problem.id}
              onClick={() => {
                if (isViewAll) {
                  onNavigate('problem_grid');
                } else {
                  onNavigate('problem_selected', { problemId: problem.id });
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
                <div className={`
                  w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110
                  ${isViewAll ? 'bg-white/50' : 'bg-slate-50 group-hover:bg-orange-50'}
                `}>
                  <div className={isViewAll ? 'text-orange-600' : 'text-slate-600 group-hover:text-orange-600'}>
                    {problem.icon}
                  </div>
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
// PROBLEM GRID DATA FOR ALL VENDOR TYPES
// Unified Warmpawz Theme with Subtle Colors
// ========================================

export const GROOMING_NEEDS = [
  { id: 'full_grooming', name: 'Full Grooming', icon: <Scissors className="w-6 h-6 text-pink-500" /> },
  { id: 'bath_only', name: 'Bath & Brush', icon: <Bath className="w-6 h-6 text-blue-500" /> },
  { id: 'haircut_styling', name: 'Hair Styling', icon: <Brush className="w-6 h-6 text-purple-500" /> },
  { id: 'nail_care', name: 'Nail Care', icon: <Hand className="w-6 h-6 text-rose-500" /> },
  { id: 'deshedding', name: 'De-shedding', icon: <Dog className="w-6 h-6 text-amber-500" /> },
  { id: 'spa_treatment', name: 'Spa & Wellness', icon: <Sparkles className="w-6 h-6 text-cyan-500" /> },
  { id: 'view_all', name: 'View All', icon: <Plus className="w-6 h-6" /> }
];

export const TRAINING_GOALS = [
  { id: 'basic_obedience', name: 'Basic Obedience', icon: <GraduationCap className="w-6 h-6 text-blue-500" /> },
  { id: 'potty_training', name: 'Potty Training', icon: <Home className="w-6 h-6 text-green-500" /> },
  { id: 'socialization', name: 'Socialization', icon: <PawPrint className="w-6 h-6 text-purple-500" /> },
  { id: 'aggression', name: 'Aggression Fix', icon: <AlertTriangle className="w-6 h-6 text-red-500" /> },
  { id: 'advanced_training', name: 'Advanced Skills', icon: <Trophy className="w-6 h-6 text-yellow-500" /> },
  { id: 'leash_training', name: 'Leash Training', icon: <DogLeash className="w-6 h-6 text-teal-500" /> },
  { id: 'view_all', name: 'View All', icon: <Plus className="w-6 h-6" /> }
];

export const WALKING_NEEDS = [
  { id: 'daily_walk', name: 'Daily Walk', icon: <Footprints className="w-6 h-6 text-green-500" /> },
  { id: 'puppy_walk', name: 'Puppy Walking', icon: <Dog className="w-6 h-6 text-amber-500" /> },
  { id: 'senior_walk', name: 'Senior Care', icon: <Bone className="w-6 h-6 text-orange-500" /> },
  { id: 'multiple_dogs', name: 'Multiple Dogs', icon: <DogLeash className="w-6 h-6 text-blue-500" /> },
  { id: 'long_walk', name: 'Adventure Walk', icon: <Mountain className="w-6 h-6 text-emerald-500" /> },
  { id: 'view_all', name: 'View All', icon: <Plus className="w-6 h-6" /> }
];

export const BEHAVIORAL_ISSUES = [
  { id: 'separation_anxiety', name: 'Anxiety & Stress', icon: <Frown className="w-6 h-6 text-purple-500" /> },
  { id: 'barking', name: 'Barking Issues', icon: <Volume2 className="w-6 h-6 text-orange-500" /> },
  { id: 'destructive', name: 'Destructive Habits', icon: <Bomb className="w-6 h-6 text-red-500" /> },
  { id: 'fear_phobia', name: 'Fear Issues', icon: <Ghost className="w-6 h-6 text-indigo-500" /> },
  { id: 'resource_guarding', name: 'Possessive Behavior', icon: <Shield className="w-6 h-6 text-blue-500" /> },
  { id: 'view_all', name: 'View All', icon: <Plus className="w-6 h-6" /> }
];

export const BOARDING_NEEDS = [
  { id: 'short_stay', name: 'Weekend Stay', icon: <Hotel className="w-6 h-6 text-orange-500" /> },
  { id: 'long_stay', name: 'Extended Stay', icon: <Home className="w-6 h-6 text-amber-500" /> },
  { id: 'daycare', name: 'Daily Daycare', icon: <Sun className="w-6 h-6 text-yellow-500" /> },
  { id: 'luxury_boarding', name: 'Luxury Stay', icon: <Star className="w-6 h-6 text-purple-500" /> },
  { id: 'medical_boarding', name: 'Medical Care', icon: <Pill className="w-6 h-6 text-blue-500" /> },
  { id: 'view_all', name: 'View All', icon: <Plus className="w-6 h-6" /> }
];

export const VET_PROBLEMS = [
  { id: 'surgery', name: 'Surgery', icon: <Stethoscope className="w-6 h-6 text-teal-500" /> },
  { id: 'cardiology', name: 'Heart Care', icon: <Heart className="w-6 h-6 text-red-500" /> },
  { id: 'dermatology', name: 'Skin Care', icon: <Activity className="w-6 h-6 text-green-500" /> },
  { id: 'dentistry', name: 'Dental', icon: <FileText className="w-6 h-6 text-blue-500" /> },
  { id: 'ophthalmology', name: 'Eye Care', icon: <Eye className="w-6 h-6 text-cyan-500" /> },
  { id: 'emergency', name: 'Emergency', icon: <Siren className="w-6 h-6 text-red-500" /> },
  { id: 'medicine', name: 'General', icon: <Package className="w-6 h-6 text-purple-500" /> },
  { id: 'view_all', name: '20+ more', icon: <Plus className="w-6 h-6" /> }
];