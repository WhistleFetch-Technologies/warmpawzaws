'use client';

import * as LucideIcons from 'lucide-react';
import { Package } from 'lucide-react';

const warnedInvalidIcons = new Set<string>();

export function resolveLucideIconName(raw?: string): string | undefined {
  if (!raw || typeof raw !== 'string') return undefined;
  const t = raw.trim();
  if (!t) return undefined;
  if ((LucideIcons as any)[t]) return t;
  const pascal = t.charAt(0).toUpperCase() + t.slice(1);
  if ((LucideIcons as any)[pascal]) return pascal;
  return undefined;
}

export function DynamicProblemIcon({
  iconName,
  iconColor,
}: {
  iconName?: string;
  iconColor?: string;
}) {
  const resolved = resolveLucideIconName(iconName);
  if (!resolved) {
    if (
      process.env.NODE_ENV === 'development' &&
      iconName?.trim() &&
      !warnedInvalidIcons.has(iconName)
    ) {
      warnedInvalidIcons.add(iconName);
      console.warn('[DynamicProblemIcon] Missing or invalid Lucide iconName:', iconName);
    }
    return <Package className="w-6 h-6 text-gray-500" />;
  }
  const Icon = (LucideIcons as any)[resolved];
  return <Icon className={`w-6 h-6 ${iconColor || 'text-gray-600'}`} />;
}
