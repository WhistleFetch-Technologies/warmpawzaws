'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { cn } from '@/components/ui/utils';
import {
  isCapacitorCameraPluginAvailable,
  isImageOnlyFileAccept,
  shouldUseCapawesomeFilePicker,
} from '@/lib/capacitor';
import { pickImageFilesWithCapacitorCamera } from '@/lib/capacitor-camera-pick';
import { pickFilesWithCapawesome } from '@/lib/capacitor-file-pick';
import { Capacitor } from '@capacitor/core';

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

function useShouldUseCapawesomePicker(): boolean {
  const [ok, setOk] = React.useState(false);
  React.useLayoutEffect(() => {
    setOk(shouldUseCapawesomeFilePicker());
  }, []);
  return ok;
}

/** When Capawesome FilePicker is not linked, Android WebView + `<input type="file">` is often broken; use @capacitor/camera for image accepts. */
function useShouldUseAndroidCameraPath(accept: string, useCapawesomePath: boolean): boolean {
  const [ok, setOk] = React.useState(false);
  React.useLayoutEffect(() => {
    try {
      if (useCapawesomePath) {
        setOk(false);
        return;
      }
      if (Capacitor.getPlatform() !== 'android' || !Capacitor.isNativePlatform()) {
        setOk(false);
        return;
      }
      if (!isImageOnlyFileAccept(accept) || !isCapacitorCameraPluginAvailable()) {
        setOk(false);
        return;
      }
      setOk(true);
    } catch {
      setOk(false);
    }
  }, [accept, useCapawesomePath]);
  return ok;
}

function fileInputProps(
  inputId: string | undefined,
  accept: string,
  multiple: boolean | undefined,
  disabled: boolean | undefined,
  name: string | undefined,
  capture: 'environment' | 'user' | undefined,
  setInputRef: (node: HTMLInputElement | null) => void,
  onFileChange: TouchFilePickerProps['onFileChange'],
  inputClassName: string | undefined,
  /** Full-size invisible overlay (browser / fallback). */
  mode: 'overlay' | 'sr-only'
) {
  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const el = e.target;
    onFileChange(e);
    queueMicrotask(() => {
      el.value = '';
    });
  };
  const base = {
    id: inputId,
    ref: setInputRef,
    type: 'file' as const,
    accept,
    multiple,
    disabled,
    name,
    ...(capture ? { capture } : {}),
    onChange,
  };
  if (mode === 'sr-only') {
    return {
      ...base,
      className: 'sr-only',
      tabIndex: -1,
      'aria-hidden': true as const,
    };
  }
  return {
    ...base,
    className: cn(
      'absolute inset-0 z-10 h-full w-full min-h-[44px] cursor-pointer opacity-0 disabled:cursor-not-allowed text-base',
      inputClassName
    ),
    'aria-label': 'Choose file' as const,
  };
}

/**
 * Mobile-safe file picker: `<label>` + full-size `<input type="file">` so Android Chrome / WebView
 * get a real activation target (better than synthetic `click()` alone).
 * When Capawesome FilePicker is linked, uses it first; on failure tries @capacitor/camera (Android images) then the HTML path.
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

    const capawesomeAvailable = useShouldUseCapawesomePicker();
    const [capawesomeFailed, setCapawesomeFailed] = React.useState(false);
    const useCapawesomePath = capawesomeAvailable && !capawesomeFailed;
    const useAndroidCameraPath = useShouldUseAndroidCameraPath(accept, useCapawesomePath);

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
          console.error('[TouchFilePicker] Capawesome file pick failed.', err);
          if (
            Capacitor.getPlatform() === 'android' &&
            Capacitor.isNativePlatform() &&
            isImageOnlyFileAccept(accept) &&
            isCapacitorCameraPluginAvailable()
          ) {
            try {
              const { files, rejectedByAccept: rej } = await pickImageFilesWithCapacitorCamera({
                accept,
                multiple: !!multiple,
              });
              if (rej) {
                toast.error('Please choose a file that matches the allowed types for this field.');
                return;
              }
              if (files.length > 0) {
                const dt = new DataTransfer();
                for (const f of files) {
                  dt.items.add(f);
                }
                runChangeWithFiles(dt.files);
                return;
              }
            } catch (camErr) {
              console.error('[TouchFilePicker] Android Camera fallback also failed.', camErr);
            }
          }
          setCapawesomeFailed(true);
          toast.error('Please tap upload again to choose a file.');
        } finally {
          picking.current = false;
        }
      },
      [accept, disabled, multiple, runChangeWithFiles]
    );

    const handleAndroidCameraPick = React.useCallback(
      async (e: React.MouseEvent | React.KeyboardEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (disabled || picking.current) {
          return;
        }
        picking.current = true;
        try {
          const { files, rejectedByAccept } = await pickImageFilesWithCapacitorCamera({
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
          console.error('[TouchFilePicker] Android Camera pick failed; falling back to file input if possible.', err);
          toast.error('Could not open the photo picker. Try again or update the app.');
        } finally {
          picking.current = false;
        }
      },
      [accept, disabled, multiple, runChangeWithFiles]
    );

    const visual = (
      <div
        className={cn(
          'pointer-events-none relative z-0 flex h-full w-full min-h-[44px] flex-col items-center justify-center text-center',
          innerClassName
        )}
      >
        {children}
      </div>
    );

    /** HTML `<input type="file">` path: label association helps Android open the system picker reliably. */
    const htmlPicker = disabled ? (
      <div
        className={cn(
          'relative touch-manipulation cursor-not-allowed opacity-50',
          className
        )}
      >
        <input
          {...fileInputProps(
            inputId,
            accept,
            multiple,
            disabled,
            name,
            capture,
            setInputRef,
            onFileChange,
            inputClassName,
            'overlay'
          )}
          disabled
        />
        {visual}
      </div>
    ) : (
      <label
        className={cn(
          'relative block touch-manipulation',
          !disabled && 'cursor-pointer',
          className
        )}
      >
        <input
          {...fileInputProps(
            inputId,
            accept,
            multiple,
            disabled,
            name,
            capture,
            setInputRef,
            onFileChange,
            inputClassName,
            'overlay'
          )}
        />
        {visual}
      </label>
    );

    if (useCapawesomePath) {
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
            {...fileInputProps(
              inputId,
              accept,
              multiple,
              disabled,
              name,
              capture,
              setInputRef,
              onFileChange,
              inputClassName,
              'sr-only'
            )}
          />
          <div
            role="button"
            tabIndex={disabled ? -1 : 0}
            className="relative z-10 flex h-full w-full min-h-[44px] flex-col items-center justify-center text-center outline-none focus-visible:ring-2 focus-visible:ring-[#FF8C42] focus-visible:ring-offset-2"
            onClick={disabled ? undefined : handleCapacitorPick}
            onKeyDown={
              disabled
                ? undefined
                : (ev) => {
                    if (ev.key === 'Enter' || ev.key === ' ') {
                      ev.preventDefault();
                      void handleCapacitorPick(ev);
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

    if (useAndroidCameraPath) {
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
            {...fileInputProps(
              inputId,
              accept,
              multiple,
              disabled,
              name,
              capture,
              setInputRef,
              onFileChange,
              inputClassName,
              'sr-only'
            )}
          />
          <div
            role="button"
            tabIndex={disabled ? -1 : 0}
            className="relative z-10 flex h-full w-full min-h-[44px] flex-col items-center justify-center text-center outline-none focus-visible:ring-2 focus-visible:ring-[#FF8C42] focus-visible:ring-offset-2"
            onClick={disabled ? undefined : handleAndroidCameraPick}
            onKeyDown={
              disabled
                ? undefined
                : (ev) => {
                    if (ev.key === 'Enter' || ev.key === ' ') {
                      ev.preventDefault();
                      void handleAndroidCameraPick(ev);
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

    return htmlPicker;
  }
);
