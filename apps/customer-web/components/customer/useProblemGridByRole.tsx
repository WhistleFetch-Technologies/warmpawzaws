'use client';

import { useState, useEffect } from 'react';
import * as LucideIcons from 'lucide-react';
import { Package, Plus } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

export interface ProblemGridItem {
  id: string;
  name: string;
  icon: React.ReactNode;
  priority?: number;
}

const VIEW_ALL_ITEM: ProblemGridItem = {
  id: 'view_all',
  name: 'View All',
  icon: <Plus className="w-6 h-6 text-orange-600" />,
  priority: 999,
};

function DynamicProblemIcon({ iconName, iconColor }: { iconName?: string; iconColor?: string }) {
  if (!iconName || !(LucideIcons as any)[iconName]) {
    return <Package className="w-6 h-6 text-gray-500" />;
  }
  const Icon = (LucideIcons as any)[iconName];
  return <Icon className={`w-6 h-6 ${iconColor || 'text-gray-600'}`} />;
}

const ROLE_ALIASES: Record<string, string[]> = {
  vet: ['veterinarian', 'vet_solo', 'vet_clinic', 'vet_center', 'pet_clinic'],
  groomer: ['groomer', 'groomer_solo', 'groomer_center', 'pet_groomer'],
  trainer: ['trainer', 'trainer_solo', 'trainer_center', 'pet_trainer'],
  walker: ['walker', 'pet_walker', 'walker_solo'],
  boarding: ['boarding', 'pet_boarder', 'pet_boarding', 'boarding_solo', 'boarding_center'],
  behaviorist: ['behaviourist', 'behaviorist', 'pet_behaviorist', 'behaviourist_solo'],
  nutritionist: ['nutritionist', 'nutritionist_solo', 'nutritionist_center', 'pet_nutritionist'],
};

/**
 * Fetches problem grid items from specialization_master for a role.
 * Tries role aliases until API returns non-empty list. Returns [] on failure.
 */
export function useProblemGridByRole(roleKey: keyof typeof ROLE_ALIASES): ProblemGridItem[] {
  const [problems, setProblems] = useState<ProblemGridItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    const aliases = ROLE_ALIASES[roleKey] || [roleKey];

    (async () => {
      for (const roleId of aliases) {
        if (cancelled) return;
        try {
          const res = await apiClient.get<{ success?: boolean; problems?: any[] }>(
            `/public/problem-grid/${roleId}`
          );
          if (
            !cancelled &&
            res?.success &&
            Array.isArray(res.problems) &&
            res.problems.length > 0
          ) {
            const mapped: ProblemGridItem[] = [
              ...res.problems.map((p: any) => ({
                id: p.id || p.problemId,
                name: p.displayName || p.name,
                icon: <DynamicProblemIcon iconName={p.iconName} iconColor={p.iconColor} />,
                priority: p.displayOrder ?? 50,
              })),
              VIEW_ALL_ITEM,
            ];
            setProblems(mapped);
            return;
          }
        } catch (_) {
          continue;
        }
      }
      if (!cancelled) setProblems([]);
    })();

    return () => {
      cancelled = true;
    };
  }, [roleKey]);

  return problems;
}
