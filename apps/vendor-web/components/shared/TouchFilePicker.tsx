'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { cn } from '@/components/ui/utils';
import { isCapacitorNativeApp } from '@/lib/capacitor';
import { pickFilesWithCapawesome } from '@/lib/capacitor-file-pick';

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

function useCapacitorNativeFilePicker(): boolean {
  const [native, setNative] = React.useState(false);
  React.useLayoutEffect(() => {
    setNative(isCapacitorNativeApp());
  }, []);
  return native;
}

/**
 * Mobile-safe file picker: the native `<input type="file">` receives the tap directly in browsers.
 * In **Capacitor** (Android WebView in particular), the HTML file input is unreliable; we use
 * `@capawesome/capacitor-file-picker` and forward the result to the same `onFileChange` API.
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

    const useCapacitorFilePicker = useCapacitorNativeFilePicker();
    const picking = React.useRef(false);

    const runChangeWithFiles = React.useCallback(
      (fileList: FileList) => {
        const el = innerRef.current;
        onFileChange({
          target: { files: fileList, value: '' } as EventTarget & HTMLInputElement,
          currentTarget: (el || ({ value: '' } as HTMLInputElement)),
        } as React.ChangeEvent<HTMLInputElement>);
        if (el) {
          queueMicrotask(() => {
            el.value = '';
          });
        }
      },
      [onFileChange]
    );

    const handleCapacitorPick = React.useCallback(
      async (e: React.MouseEvent | React.KeyboardEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (disabled || picking.current) {
          return;
        }
        picking.current = true;
        try {
          const { files, rejectedByAccept } = await pickFilesWithCapawesome({
            accept,
            multiple: !!multiple,
          });
          if (rejectedByAccept) {
            toast.error('Please choose a file that matches the allowed types for this field.');
            return;
          }
          if (files.length === 0) {
            return;
          }
          const dt = new DataTransfer();
          for (const f of files) {
            dt.items.add(f);
          }
          runChangeWithFiles(dt.files);
        } catch (err) {
          console.error('[TouchFilePicker] Capacitor file pick failed, falling back to input.click()', err);
          toast.error('Could not open the file chooser. Trying again…');
          try {
            innerRef.current?.click();
          } catch (clickErr) {
            console.error(clickErr);
            toast.error('File upload is not available. Please try again or update the app.');
          }
        } finally {
          picking.current = false;
        }
      },
      [accept, disabled, multiple, runChangeWithFiles]
    );

    if (useCapacitorFilePicker) {
      return (
        <div
          className={cn(
            'relative touch-manipulation',
            !disabled && 'cursor-pointer',
            disabled && 'cursor-not-allowed opacity-50',
            className
          )}
        >
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
              queueMicrotask(() => {
                el.value = '';
              });
            }}
            className="sr-only"
            tabIndex={-1}
            aria-hidden
          />
          <div
            role="button"
            tabIndex={disabled ? -1 : 0}
            className="relative z-10 flex h-full w-full min-h-[44px] flex-col items-center justify-center text-center outline-none focus-visible:ring-2 focus-visible:ring-[#FF8C42] focus-visible:ring-offset-2"
            onClick={disabled ? undefined : handleCapacitorPick}
            onKeyDown={
              disabled
                ? undefined
                : (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      void handleCapacitorPick(e);
                    }
                  }
            }
            aria-label="Choose file"
          >
            <div
              className={cn(
                'pointer-events-none flex h-full w-full min-h-[44px] flex-col items-center justify-center text-center',
                innerClassName
              )}
            >
              {children}
            </div>
          </div>
        </div>
      );
    }

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
