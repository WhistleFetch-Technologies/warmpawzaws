'use client';

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
 */

interface ProblemGridItem {
  id: string;
  name: string;
  icon: string;
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
                  w-10 h-10 rounded-xl flex items-center justify-center text-xl transition-transform group-hover:scale-110
                  ${isViewAll ? 'bg-white/50' : 'bg-slate-50 group-hover:bg-orange-50'}
                `}>
                  {problem.icon}
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
// Unified Warmpawz Theme
// ========================================

export const GROOMING_NEEDS = [
  { id: 'full_grooming', name: 'Full Grooming', icon: '✂️' },
  { id: 'bath_only', name: 'Bath & Brush', icon: '🛁' },
  { id: 'haircut_styling', name: 'Hair Styling', icon: '💇' },
  { id: 'nail_care', name: 'Nail Care', icon: '💅' },
  { id: 'deshedding', name: 'De-shedding', icon: '🐕' },
  { id: 'spa_treatment', name: 'Spa & Wellness', icon: '💆' },
  { id: 'view_all', name: 'View All', icon: '➕' }
];

export const TRAINING_GOALS = [
  { id: 'basic_obedience', name: 'Basic Obedience', icon: '🎓' },
  { id: 'potty_training', name: 'Potty Training', icon: '🏠' },
  { id: 'socialization', name: 'Socialization', icon: '🐾' },
  { id: 'aggression', name: 'Aggression Fix', icon: '⚠️' },
  { id: 'advanced_training', name: 'Advanced Skills', icon: '🏆' },
  { id: 'leash_training', name: 'Leash Training', icon: '🦮' },
  { id: 'view_all', name: 'View All', icon: '➕' }
];

export const WALKING_NEEDS = [
  { id: 'daily_walk', name: 'Daily Walk', icon: '🚶' },
  { id: 'puppy_walk', name: 'Puppy Walking', icon: '🐶' },
  { id: 'senior_walk', name: 'Senior Care', icon: '🦴' },
  { id: 'multiple_dogs', name: 'Multiple Dogs', icon: '🐕‍🦺' },
  { id: 'long_walk', name: 'Adventure Walk', icon: '⛰️' },
  { id: 'view_all', name: 'View All', icon: '➕' }
];

export const BEHAVIORAL_ISSUES = [
  { id: 'separation_anxiety', name: 'Anxiety & Stress', icon: '😰' },
  { id: 'barking', name: 'Barking Issues', icon: '📢' },
  { id: 'destructive', name: 'Destructive Habits', icon: '💥' },
  { id: 'fear_phobia', name: 'Fear Issues', icon: '😨' },
  { id: 'resource_guarding', name: 'Possessive Behavior', icon: '🛡️' },
  { id: 'view_all', name: 'View All', icon: '➕' }
];

export const BOARDING_NEEDS = [
  { id: 'short_stay', name: 'Weekend Stay', icon: '🏨' },
  { id: 'long_stay', name: 'Extended Stay', icon: '🏡' },
  { id: 'daycare', name: 'Daily Daycare', icon: '☀️' },
  { id: 'luxury_boarding', name: 'Luxury Stay', icon: '⭐' },
  { id: 'medical_boarding', name: 'Medical Care', icon: '💊' },
  { id: 'view_all', name: 'View All', icon: '➕' }
];

export const VET_PROBLEMS = [
  { id: 'surgery', name: 'Surgery', icon: '🔪' },
  { id: 'cardiology', name: 'Heart Care', icon: '❤️' },
  { id: 'dermatology', name: 'Skin Care', icon: '🦴' },
  { id: 'dentistry', name: 'Dental', icon: '🦷' },
  { id: 'ophthalmology', name: 'Eye Care', icon: '👁️' },
  { id: 'emergency', name: 'Emergency', icon: '🚨' },
  { id: 'medicine', name: 'General', icon: '💊' },
  { id: 'view_all', name: '20+ more', icon: '➕' }
];
