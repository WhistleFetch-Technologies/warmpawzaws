'use client';

import * as React from 'react';
import { cn } from '@/components/ui/utils';

export type TouchFilePickerProps = {
  /** Optional id for the file input (use with external `<label htmlFor>`). */
  inputId?: string;
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  capture?: 'environment' | 'user';
  name?: string;
  className?: string;
  /** Inner wrapper for children (default centers content for dashed dropzones). */
  innerClassName?: string;
  /** Merged with the file input; use for `z-` overrides when a modal stacks above siblings. */
  inputClassName?: string;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  children: React.ReactNode;
};

function mergeRefs<T>(node: T | null, refs: Array<React.Ref<T> | undefined>) {
  refs.forEach((r) => {
    if (typeof r === 'function') (r as (n: T | null) => void)(node);
    else if (r && typeof r === 'object' && 'current' in r) (r as React.MutableRefObject<T | null>).current = node;
  });
}

/**
 * Mobile-safe file picker: the native `<input type="file">` receives the tap directly.
 * Programmatic `input.click()` from a parent `onClick` is unreliable on Android Chrome.
 */
export const TouchFilePicker = React.forwardRef<HTMLInputElement, TouchFilePickerProps>(
  function TouchFilePicker(
    {
      inputId,
      accept = '*/*',
      multiple,
      disabled,
      capture,
      name,
      className,
      innerClassName,
      inputClassName,
      onFileChange,
      children,
    },
    ref
  ) {
    const innerRef = React.useRef<HTMLInputElement>(null);
    const setInputRef = React.useCallback(
      (node: HTMLInputElement | null) => {
        innerRef.current = node;
        mergeRefs(node, [ref]);
      },
      [ref]
    );

    return (
      <div className={cn('relative touch-manipulation', className)}>
        <input
          id={inputId}
          ref={setInputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          disabled={disabled}
          name={name}
          {...(capture ? { capture } : {})}
          onChange={(e) => {
            const el = e.target;
            onFileChange(e);
            // Defer reset so async handlers can read `files` / `value` reliably (Android + async uploads).
            queueMicrotask(() => {
              el.value = '';
            });
          }}
          className={cn(
            'absolute inset-0 z-10 h-full w-full min-h-[44px] cursor-pointer opacity-0 disabled:cursor-not-allowed',
            inputClassName
          )}
          aria-label="Choose file"
        />
        <div
          className={cn(
            'pointer-events-none relative z-0 flex h-full w-full min-h-[44px] flex-col items-center justify-center text-center',
            innerClassName
          )}
        >
          {children}
        </div>
      </div>
    );
  }
);
