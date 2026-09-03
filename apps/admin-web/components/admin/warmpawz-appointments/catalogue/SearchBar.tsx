'use client';

import React from 'react';

import { Input } from '@warmpawz/ui';
import { Search } from 'lucide-react';

export interface SearchBarProps {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly placeholder?: string;
  readonly disabled?: boolean;
  readonly className?: string;
}

export function SearchBar({
  value,
  onChange,
  placeholder = 'Search…',
  disabled = false,
  className = '',
}: SearchBarProps) {
  return (
    <div className={`relative max-w-sm ${className}`}>
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
      <Input
        value={value}
        onChange={(event: React.ChangeEvent<HTMLInputElement>) => onChange(event.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="pl-9 bg-white"
        aria-label={placeholder}
      />
    </div>
  );
}
