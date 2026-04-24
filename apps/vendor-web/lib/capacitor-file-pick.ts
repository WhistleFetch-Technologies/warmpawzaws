'use client';

import { Capacitor } from '@capacitor/core';
import { FilePicker } from '@capawesome/capacitor-file-picker';

function base64ToFile(base64: string, name: string, mime: string): File {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new File([bytes], name, { type: mime || 'application/octet-stream' });
}

type PickedFromPlugin = Awaited<ReturnType<typeof FilePicker.pickFiles>>['files'][number];

/**
 * Coerce a Capawesome-picked file into a `File` for `FormData` / the rest of the app.
 * Uses `path` + `Capacitor.convertFileSrc` + `fetch` when `blob` is not present (Android/iOS native).
 */
async function pickedToWebFile(
  f: PickedFromPlugin
): Promise<File> {
  if (f.blob && f.blob.size > 0) {
    return new File([f.blob], f.name, { type: f.mimeType || f.blob.type });
  }
  if (f.data && f.data.length > 0) {
    return base64ToFile(f.data, f.name, f.mimeType);
  }
  if (f.path) {
    const webPath = Capacitor.convertFileSrc(f.path);
    const res = await fetch(webPath);
    if (!res.ok) {
      throw new Error(`Could not read picked file: ${f.name} (${res.status})`);
    }
    const blob = await res.blob();
    return new File([blob], f.name, { type: f.mimeType || blob.type || 'application/octet-stream' });
  }
  throw new Error('No data available for the picked file');
}

function fileMatchesAccept(file: File, accept: string | undefined): boolean {
  if (!accept || accept === '' || accept === '*/*') {
    return true;
  }
  const fileType = (file.type || '').toLowerCase();
  const name = file.name.toLowerCase();
  for (const part of accept.split(/,\s*/)) {
    const p = part.trim();
    if (!p) {
      continue;
    }
    if (p === 'image/*') {
      if (fileType.startsWith('image/') || (!fileType && /\.(jpe?g|png|gif|webp|heic|heif)$/i.test(name))) {
        return true;
      }
    } else if (p.endsWith('/*')) {
      const pre = p.slice(0, -1);
      if (fileType.startsWith(pre)) {
        return true;
      }
    } else if (p.startsWith('.')) {
      if (name.endsWith(p.toLowerCase())) {
        return true;
      }
    } else if (p === fileType) {
      return true;
    }
  }
  return false;
}

export type CapawesomePickOptions = {
  accept: string;
  multiple: boolean;
};

export type CapawesomePickResult = {
  files: File[];
  /** Picked file(s) did not match the `accept` string (e.g. PDF when only images were allowed). */
  rejectedByAccept: boolean;
};

/**
 * Open the native file picker.
 * (Capawesome v8) Uses `limit` 0/1, then filters with the HTML `accept` string.
 */
export async function pickFilesWithCapawesome(
  options: CapawesomePickOptions
): Promise<CapawesomePickResult> {
  if (Capacitor.getPlatform() === 'android') {
    try {
      await FilePicker.requestPermissions();
    } catch {
      // Permission may already be granted; plugin is Android-only
    }
  }

  const wantMultiple = options.multiple;

  // v8: when `limit` is set, `types` can be ignored by the plugin. Prefer a broad native sheet,
  // then filter with `fileMatchesAccept` to match the HTML `accept` attribute.
  const result = await FilePicker.pickFiles({
    limit: wantMultiple ? 0 : 1,
    readData: false,
  });

  if (!result.files || result.files.length === 0) {
    return { files: [], rejectedByAccept: false };
  }

  const out: File[] = [];
  for (const f of result.files) {
    const w = await pickedToWebFile(f);
    if (fileMatchesAccept(w, options.accept)) {
      out.push(w);
    }
  }

  return {
    files: out,
    rejectedByAccept: out.length === 0 && result.files.length > 0,
  };
}
