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
function useShouldUseAndroidCameraPath(accept: string): boolean {
  const [ok, setOk] = React.useState(false);
  React.useLayoutEffect(() => {
    try {
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
  }, [accept]);
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
    const useAndroidCameraPath = useShouldUseAndroidCameraPath(accept);
    // Priority on Android for IMAGE-only picks: `@capacitor/camera` Base64 path. The Camera
    // plugin returns base64 bytes through the Capacitor bridge directly — no WebView
    // `fetch(content://…)` round-trip, which is what made Capawesome's picked files come back
    // as 0-byte blobs on real devices ("tap Done → photo never appears in gallery"). Capawesome
    // is still used for non-image picks (PDFs, docs) and on non-Android platforms.
    const useCapawesomePath =
      capawesomeAvailable && !capawesomeFailed && !useAndroidCameraPath;

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

    const dispatchPickedFiles = React.useCallback(
      (files: File[]) => {
        if (files.length === 0) return;
        try {
          if (typeof DataTransfer !== 'undefined') {
            const dt = new DataTransfer();
            for (const f of files) {
              dt.items.add(f);
            }
            runChangeWithFiles(dt.files);
            return;
          }
        } catch (dtErr) {
          console.warn('[TouchFilePicker] DataTransfer failed; using file-list fallback.', dtErr);
        }

        console.log(`[TouchFilePicker] Using file-list fallback, count=${files.length}`);
        // Fallback for WebViews where DataTransfer is missing/unreliable.
        const fallback = files as unknown as FileList & File[];
        (fallback as any).item = (index: number) => fallback[index] || null;
        runChangeWithFiles(fallback);
      },
      [runChangeWithFiles]
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
          const { files, rejectedByAccept, conversionFailed } = await pickFilesWithCapawesome({
            accept,
            multiple: !!multiple,
          });
          if (rejectedByAccept) {
            toast.error('Please choose a file that matches the allowed types for this field.');
            return;
          }
          if (conversionFailed) {
            // Android content:// URI returned 0 bytes — previously the picker silently
            // discarded the selection (looks like "tap done, nothing happens"). Tell the
            // user so they can retry or pick from a different gallery source.
            toast.error('Could not read the selected photo. Please try a different photo or tap upload again.');
            return;
          }
          if (files.length === 0) {
            return;
          }
          console.log(
            `[TouchFilePicker] Capawesome picked files=${files.length}`,
            files.map((f) => ({ name: f.name, size: f.size, type: f.type }))
          );
          dispatchPickedFiles(files);
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
                console.log(`[TouchFilePicker] Camera fallback picked files=${files.length}`);
                dispatchPickedFiles(files);
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
          if (files.length > 0) {
            console.log(
              `[TouchFilePicker] Android camera picked files=${files.length}`,
              files.map((f) => ({ name: f.name, size: f.size, type: f.type }))
            );
            dispatchPickedFiles(files);
            return;
          }
          // Camera returned no usable file (user dismissed). Try Capawesome once as a
          // secondary path in case the device's Camera plugin can't drive the gallery.
          if (capawesomeAvailable) {
            console.log('[TouchFilePicker] Camera returned empty; trying Capawesome fallback');
            try {
              const cap = await pickFilesWithCapawesome({ accept, multiple: !!multiple });
              if (cap.rejectedByAccept) {
                toast.error('Please choose a file that matches the allowed types for this field.');
                return;
              }
              if (cap.conversionFailed) {
                toast.error('Could not read the selected photo. Please try a different photo.');
                return;
              }
              if (cap.files.length > 0) {
                console.log(
                  `[TouchFilePicker] Capawesome (fallback) picked files=${cap.files.length}`,
                  cap.files.map((f) => ({ name: f.name, size: f.size, type: f.type }))
                );
                dispatchPickedFiles(cap.files);
                return;
              }
            } catch (capErr) {
              console.warn('[TouchFilePicker] Capawesome fallback also failed.', capErr);
            }
          }
        } catch (err) {
          console.error('[TouchFilePicker] Android Camera pick failed; trying Capawesome fallback.', err);
          if (capawesomeAvailable) {
            try {
              const cap = await pickFilesWithCapawesome({ accept, multiple: !!multiple });
              if (cap.rejectedByAccept) {
                toast.error('Please choose a file that matches the allowed types for this field.');
                return;
              }
              if (cap.conversionFailed) {
                toast.error('Could not read the selected photo. Please try a different photo.');
                return;
              }
              if (cap.files.length > 0) {
                dispatchPickedFiles(cap.files);
                return;
              }
            } catch (capErr) {
              console.error('[TouchFilePicker] Capawesome fallback also failed.', capErr);
            }
          }
          toast.error('Could not open the photo picker. Try again or update the app.');
        } finally {
          picking.current = false;
        }
      },
      [accept, capawesomeAvailable, disabled, dispatchPickedFiles, multiple]
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
