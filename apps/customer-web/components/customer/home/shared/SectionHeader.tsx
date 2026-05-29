'use client';

import React, { memo } from 'react';
import { ChevronRight } from 'lucide-react';

export interface SectionHeaderProps {
  title: string;
  /** Optional icon rendered before the title */
  icon?: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

function SectionHeaderComponent({
  title,
  icon,
  actionLabel,
  onAction,
  className = '',
}: SectionHeaderProps) {
  return (
    <div className={`flex items-center gap-3 px-4 mb-2 ${className}`}>
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {icon ? <span className="shrink-0">{icon}</span> : null}
        <h2 className="truncate text-sm font-semibold text-gray-900">{title}</h2>
      </div>
      {actionLabel && onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="shrink-0 text-[11px] font-medium text-[#FF8C42]"
        >
          {actionLabel}
        </button>
      ) : actionLabel ? (
        <span className="shrink-0 text-[11px] font-medium text-[#FF8C42]">{actionLabel}</span>
      ) : null}
    </div>
  );
}

/** Section title row with optional icon and trailing action link. */
export const SectionHeader = memo(SectionHeaderComponent);

export interface SectionHeaderWithChevronProps extends SectionHeaderProps {
  subtitle?: string;
}

function SectionHeaderWithChevronComponent({
  title,
  subtitle,
  onAction,
  className = '',
}: SectionHeaderWithChevronProps) {
  return (
    <button
      type="button"
      onClick={onAction}
      className={`flex w-full items-center justify-between px-4 mb-2 text-left ${className}`}
    >
      <div className="min-w-0">
        <h2 className="truncate text-sm font-semibold text-gray-900">{title}</h2>
        {subtitle ? <p className="truncate text-[11px] text-gray-500">{subtitle}</p> : null}
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" aria-hidden />
    </button>
  );
}

export const SectionHeaderWithChevron = memo(SectionHeaderWithChevronComponent);
