'use client';

import { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { problemIconTextColorToBgClass } from '@/lib/problem-grid-icon-bg';
import { DynamicProblemIcon } from '@/lib/problem-grid-dynamic-icon';
import { PROBLEM_GRID_ALIASES_BY_ROLE } from '@/lib/problem-grid-role-aliases';
import { isEmergencyProblemTileLocked } from '@/lib/problem-grid-emergency-lock';

export interface ProblemGridItem {
  id: string;
  name: string;
  icon: React.ReactNode;
  priority?: number;
  iconBg?: string;
  comingSoon?: boolean;
}

const VIEW_ALL_ITEM: ProblemGridItem = {
  id: 'view_all',
  name: 'View All',
  icon: <Plus className="w-6 h-6 text-orange-600" />,
  priority: 999,
};

const ROLE_ALIASES: Record<string, string[]> = Object.fromEntries(
  Object.entries(PROBLEM_GRID_ALIASES_BY_ROLE).map(([k, v]) => [k, [...v]])
) as Record<string, string[]>;

/**
 * Fetches problem grid from specialization_master via GET /public/problem-grid/:roleId
 * (same source as admin). Tries role aliases until a non-empty list is returned.
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
            `/public/problem-grid/${encodeURIComponent(roleId)}`
          );
          if (
            !cancelled &&
            res?.success !== false &&
            Array.isArray(res.problems) &&
            res.problems.length > 0
          ) {
            const sorted = [...res.problems].sort((a: any, b: any) => {
              const ao = a.displayOrder ?? a.display_order ?? 100;
              const bo = b.displayOrder ?? b.display_order ?? 100;
              if (ao !== bo) return Number(ao) - Number(bo);
              const an = (a.displayName || a.name || '').toString();
              const bn = (b.displayName || b.name || '').toString();
              return an.localeCompare(bn);
            });
            const mapped: ProblemGridItem[] = [
              ...sorted.map((p: any) => {
                const iconColor = p.iconColor ?? p.icon_color;
                const iconBg = problemIconTextColorToBgClass(iconColor);
                const id = String(p.id ?? p.problemId ?? p.name);
                return {
                  id,
                  name: (p.displayName || p.name) as string,
                  icon: (
                    <DynamicProblemIcon iconName={p.iconName ?? p.icon_name} iconColor={iconColor} />
                  ),
                  priority: p.displayOrder ?? p.display_order ?? 50,
                  iconBg,
                  comingSoon: isEmergencyProblemTileLocked({
                    id,
                    name: p.name,
                    displayName: p.displayName ?? p.display_name,
                  }),
                };
              }),
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
