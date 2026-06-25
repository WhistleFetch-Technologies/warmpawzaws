'use client';

import * as React from 'react';
import { filterIntegerInput } from '@/lib/input-formatters';

export type IntegerInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'type' | 'inputMode' | 'onChange' | 'value'
> & {
  value: string;
  onChange: (value: string) => void;
};

export function IntegerInput({ value, onChange, onWheel, ...rest }: IntegerInputProps) {
  return (
    <input
      {...rest}
      type="text"
      inputMode="numeric"
      value={value}
      onChange={(e) => onChange(filterIntegerInput(e.target.value))}
      onWheel={(e) => {
        e.currentTarget.blur();
        onWheel?.(e);
      }}
    />
  );
}
