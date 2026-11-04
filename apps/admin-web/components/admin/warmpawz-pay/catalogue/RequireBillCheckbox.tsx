'use client';

import React from 'react';

export interface RequireBillCheckboxProps {
  readonly checked: boolean;
  readonly disabled?: boolean;
  readonly vendorId: string;
  readonly onChange: (next: boolean) => void;
}

export function RequireBillCheckbox({
  checked,
  disabled = false,
  vendorId,
  onChange,
}: RequireBillCheckboxProps) {
  const id = `require-bill-${vendorId}`;
  return (
    <label htmlFor={id} className="flex max-w-xs cursor-pointer items-start gap-2">
      <input
        id={id}
        type="checkbox"
        className="mt-0.5 h-4 w-4 rounded border-gray-300 text-[#FF8C42] focus:ring-[#FF8C42]"
        checked={checked}
        disabled={disabled}
        onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
          onChange(event.target.checked)
        }
      />
      <span className="text-sm text-gray-800">
        <span className="font-medium">Require bill</span>
        <span className="mt-0.5 block text-xs font-normal text-gray-500">
          Vendor uploads bill; admin verifies before settle.
        </span>
      </span>
    </label>
  );
}
