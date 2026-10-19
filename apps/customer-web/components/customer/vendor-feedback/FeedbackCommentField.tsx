'use client';

import { useId } from 'react';

type FeedbackCommentFieldProps = {
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
};

export function FeedbackCommentField({
  value,
  onChange,
  maxLength = 500,
  label = 'Tell us more (optional)',
  placeholder = 'Share details of your experience…',
  disabled = false,
}: FeedbackCommentFieldProps) {
  const id = useId();
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-semibold text-gray-900">
        {label}
      </label>
      <div className="relative">
        <textarea
          id={id}
          value={value}
          maxLength={maxLength}
          disabled={disabled}
          rows={3}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value.slice(0, maxLength))}
          className="w-full resize-none rounded-xl border border-gray-200 bg-white px-3 pb-6 pt-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#FF8C42] focus:outline-none focus:ring-2 focus:ring-[#FF8C42]/20 disabled:opacity-60"
        />
        <span className="pointer-events-none absolute bottom-2 right-3 text-xs text-gray-400" aria-live="polite">
          {value.length}/{maxLength}
        </span>
      </div>
    </div>
  );
}
