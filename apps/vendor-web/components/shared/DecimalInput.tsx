'use client';

import * as React from 'react';
import { filterDecimalInput } from '@/lib/input-formatters';

export type DecimalInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'type' | 'inputMode' | 'onChange' | 'value'
> & {
  value: string;
  onChange: (value: string) => void;
  maxDecimals?: number;
};

export function DecimalInput({
  value,
  onChange,
  maxDecimals = 2,
  onWheel,
  autoComplete = 'off',
  ...rest
}: DecimalInputProps) {
  return (
    <input
      {...rest}
      type="text"
      inputMode="decimal"
      autoComplete={autoComplete}
      value={value}
      onChange={(e) => onChange(filterDecimalInput(e.target.value, maxDecimals))}
      onWheel={(e) => {
        e.currentTarget.blur();
        onWheel?.(e);
      }}
    />
  );
}
