'use client';

import { CachedImage } from '@/components/shared/CachedImage';
import { GraduationCap, PawPrint } from 'lucide-react';
import { isEmergencyProblemTileLocked } from '@/lib/problem-grid-emergency-lock';
import {
  TRAINING_GOAL_CARDS,
  isTrainingViewAllProblem,
  resolveTrainingGoalDisplay,
} from './constants/training-hub-assets';

export interface TrainingGoalGridItem {
  id: string;
  name: string;
  icon: React.ReactNode;
  iconBg?: string;
  comingSoon?: boolean;
}

interface TrainingGoalGridProps {
  problems: TrainingGoalGridItem[];
  onNavigate: (screen: string, data?: Record<string, unknown>) => void;
}

/** Static hub tiles when API returns nothing (no View All tile). */
function staticGoalItems(): TrainingGoalGridItem[] {
  return TRAINING_GOAL_CARDS.map((card) => {
    const Icon = card.Icon;
    return {
      id: card.id,
      name: card.name,
      icon: <Icon className={`h-4 w-4 ${card.iconColor}`} />,
      iconBg: card.iconBg,
    };
  });
}

export function TrainingGoalGrid({ problems, onNavigate }: TrainingGoalGridProps) {
  const fromApi = problems.filter((p) => !isTrainingViewAllProblem(p));
  const visible = fromApi.length > 0 ? fromApi : staticGoalItems();

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <div className="rounded-lg bg-orange-50 p-1.5">
          <GraduationCap className="h-4 w-4 text-[#FF8C42]" />
        </div>
        <h2 className="text-lg font-bold text-slate-900">What&apos;s your goal?</h2>
        <PawPrint className="h-3.5 w-3.5 text-[#FF8C42]" aria-hidden />
      </div>

      <div className="grid grid-cols-4 gap-2.5 sm:gap-3">
        {visible.map((problem, index) => {
          const locked =
            problem.comingSoon === true ||
            isEmergencyProblemTileLocked({ id: problem.id, name: problem.name });
          const { image, label, iconDef } = resolveTrainingGoalDisplay(problem, index);
          const iconBg = problem.iconBg ?? iconDef?.iconBg;
          const hasAdminTint = Boolean(iconBg);
          const iconNode =
            problem.icon ??
            (iconDef ? (
              <iconDef.Icon className={`h-4 w-4 ${iconDef.iconColor}`} />
            ) : null);

          return (
            <button
              key={problem.id}
              type="button"
              disabled={locked}
              onClick={() => {
                if (locked) return;
                onNavigate('problem_selected', {
                  problemId: problem.id,
                  problemTitle: label,
                });
              }}
              className={`group flex flex-col items-center gap-1.5 ${locked ? 'cursor-not-allowed' : ''}`}
            >
              <div
                className={`relative aspect-square w-full overflow-hidden rounded-2xl border bg-gradient-to-b from-slate-50/80 to-white shadow-sm transition-all duration-200 ${
                  locked
                    ? 'border-slate-100'
                    : 'border-slate-100 hover:-translate-y-0.5 hover:border-orange-200 hover:shadow-md'
                }`}
              >
                {locked && (
                  <span className="absolute right-1 top-1 z-20 rounded-md border border-slate-200 bg-white/95 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wide text-slate-500 shadow-sm">
                    Soon
                  </span>
                )}

                <div
                  className={`absolute left-1 top-1 z-20 flex h-[26px] w-[26px] items-center justify-center rounded-full border border-white/70 shadow-sm sm:h-7 sm:w-7 ${
                    hasAdminTint
                      ? `${iconBg} ${locked ? 'opacity-80' : ''}`
                      : locked
                        ? 'bg-slate-100'
                        : 'bg-white/95'
                  }`}
                >
                  <div className="flex h-4 w-4 items-center justify-center [&_svg]:!h-4 [&_svg]:!w-4 [&_svg]:shrink-0">
                    {iconNode}
                  </div>
                </div>

                <div className="absolute inset-x-0 bottom-0 top-6 flex items-end justify-center px-0.5 pb-0.5 sm:top-7 sm:px-1 sm:pb-1">
                  <div className="relative h-full w-full">
                    <CachedImage
                      src={image}
                      alt=""
                      fill
                      className={`object-contain object-bottom ${locked ? 'opacity-70 saturate-75' : 'transition-transform duration-300 group-hover:scale-[1.03]'}`}
                      sizes="(max-width: 640px) 22vw, 100px"
                    />
                  </div>
                </div>
              </div>

              <p
                className={`w-full px-0.5 text-center text-[9px] font-medium leading-tight line-clamp-2 sm:text-[10px] ${
                  locked ? 'text-slate-500' : 'text-slate-700 group-hover:text-[#FF8C42]'
                }`}
              >
                {label}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
