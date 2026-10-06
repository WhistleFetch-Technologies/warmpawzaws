'use client';

import { useState, type KeyboardEvent } from 'react';
import { Star } from 'lucide-react';
import { cn } from '@/components/ui/utils';

const SIZE_CLASS = {
  sm: 'h-5 w-5',
  md: 'h-7 w-7',
  lg: 'h-9 w-9',
} as const;

export const STAR_RATING_LABELS = ['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent'] as const;

type StarRatingInputProps = {
  value: number;
  onChange: (value: number) => void;
  max?: number;
  size?: keyof typeof SIZE_CLASS;
  disabled?: boolean;
  /** Accessible name for the radio group */
  label?: string;
  className?: string;
};

/** Interactive 1–max star picker (radiogroup; arrow keys supported). */
export function StarRatingInput({
  value,
  onChange,
  max = 5,
  size = 'lg',
  disabled = false,
  label = 'Rating',
  className,
}: StarRatingInputProps) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      onChange(Math.min(max, (value || 0) + 1));
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      onChange(Math.max(1, (value || 1) - 1));
    }
  };

  return (
    <div
      role="radiogroup"
      aria-label={label}
      aria-disabled={disabled || undefined}
      className={cn('flex items-center gap-2', className)}
      onKeyDown={onKeyDown}
      onMouseLeave={() => setHover(0)}
    >
      {Array.from({ length: max }, (_, i) => {
        const star = i + 1;
        const active = star <= shown;
        return (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={value === star}
            aria-label={`${star} star${star > 1 ? 's' : ''}`}
            tabIndex={value === star || (value === 0 && star === 1) ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange(star)}
            onMouseEnter={() => setHover(star)}
            className="rounded-md p-0.5 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF8C42] active:scale-90 disabled:opacity-60"
          >
            <Star
              aria-hidden
              className={cn(
                SIZE_CLASS[size],
                active ? 'fill-amber-400 text-amber-400' : 'fill-transparent text-gray-300'
              )}
            />
          </button>
        );
      })}
    </div>
  );
}
