'use client';

import Image from 'next/image';
import { Stethoscope } from 'lucide-react';
import { isEmergencyProblemTileLocked } from '@/lib/problem-grid-emergency-lock';
import {
  isVetGroomingProblem,
  isVetViewAllProblem,
  VET_PROBLEM_PET_IMAGES,
} from './constants/vet-hub-assets';

export interface VetProblemGridItem {
  id: string;
  name: string;
  icon: React.ReactNode;
  iconBg?: string;
  comingSoon?: boolean;
}

interface VetProblemGridProps {
  problems: VetProblemGridItem[];
  onNavigate: (screen: string, data?: Record<string, unknown>) => void;
}

export function VetProblemGrid({ problems, onNavigate }: VetProblemGridProps) {
  const visible = problems.filter(
    (p) => !isVetViewAllProblem(p) && !isVetGroomingProblem(p),
  );

  return (
    <div className="mb-6">
      <div className="mb-3 flex items-center gap-2">
        <div className="rounded-lg bg-orange-50 p-1.5">
          <Stethoscope className="h-4 w-4 text-[#FF8C42]" />
        </div>
        <h2 className="text-lg font-bold text-slate-900">Consult by Problem</h2>
      </div>

      <div className="grid grid-cols-5 gap-2 sm:gap-2.5">
        {visible.map((problem, index) => {
          const locked =
            problem.comingSoon === true ||
            isEmergencyProblemTileLocked({ id: problem.id, name: problem.name });
          const image = VET_PROBLEM_PET_IMAGES[index % VET_PROBLEM_PET_IMAGES.length];
          const hasAdminTint = Boolean(problem.iconBg);

          return (
            <button
              key={problem.id}
              type="button"
              disabled={locked}
              onClick={() => {
                if (locked) return;
                onNavigate('problem_selected', {
                  problemId: problem.id,
                  problemTitle: problem.name,
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

                {/* Category icon — top-left, does not cover the pet face */}
                <div
                  className={`absolute left-1 top-1 z-20 flex h-[22px] w-[22px] items-center justify-center rounded-md border border-white/70 shadow-sm sm:h-6 sm:w-6 ${
                    hasAdminTint
                      ? `${problem.iconBg} ${locked ? 'opacity-80' : ''}`
                      : locked
                        ? 'bg-slate-100'
                        : 'bg-white/95'
                  }`}
                >
                  <div className="flex h-3.5 w-3.5 items-center justify-center [&_svg]:!h-3.5 [&_svg]:!w-3.5 [&_svg]:shrink-0">
                    {problem.icon}
                  </div>
                </div>

                {/* Full pet portrait — contain so head + body stay visible */}
                <div className="absolute inset-x-0 bottom-0 top-5 flex items-end justify-center px-0.5 pb-0.5 sm:top-6 sm:px-1 sm:pb-1">
                  <div className="relative h-full w-full">
                    <Image
                      src={image}
                      alt=""
                      fill
                      className={`object-contain object-bottom ${locked ? 'opacity-70 saturate-75' : 'transition-transform duration-300 group-hover:scale-[1.03]'}`}
                      sizes="(max-width: 640px) 18vw, 88px"
                    />
                  </div>
                </div>
              </div>

              <p
                className={`w-full px-0.5 text-center text-[8px] font-medium leading-tight line-clamp-2 sm:text-[9px] ${
                  locked ? 'text-slate-500' : 'text-slate-700 group-hover:text-[#FF8C42]'
                }`}
              >
                {problem.name}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
