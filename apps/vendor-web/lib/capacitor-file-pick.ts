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

function pluginFileHasReadablePayload(f: PickedFromPlugin): boolean {
  return Boolean((f.blob && f.blob.size > 0) || (f.data && f.data.length > 0) || f.path);
}

/**
 * Coerce a Capawesome-picked file into a `File` for `FormData` / the rest of the app.
 * Uses `path` + `Capacitor.convertFileSrc` + `fetch` when `blob` is not present (Android/iOS native).
 *
 * IMPORTANT: throws when bytes are unavailable or zero-length so the caller can retry with
 * `readData=true` (which forces the plugin to return base64). Previously a 0-byte blob from
 * `convertFileSrc(content://…)` was silently wrapped in a `File` and shipped to the server,
 * which is the main reason "upload succeeds but nothing appears in the gallery" on Android.
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
    if (blob.size === 0) {
      throw new Error(`Picked file is empty (0 bytes): ${f.name}`);
    }
    return new File([blob], f.name, { type: f.mimeType || blob.type || 'application/octet-stream' });
  }
  throw new Error('No data available for the picked file');
}

/** Exported for @capacitor/camera path so picks match the same `accept` rules as Capawesome. */
export function fileMatchesAccept(file: File, accept: string | undefined): boolean {
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
  /**
   * Native picker returned entries but every one of them produced 0 bytes / unreadable
   * data. The UI should toast a clear error instead of silently doing nothing — this is
   * the Android content:// URI failure mode that previously looked like "tap done and
   * the upload just disappears".
   */
  conversionFailed?: boolean;
};

/**
 * Open the native file picker.
 * (Capawesome v8) Uses `limit` 0/1, then filters with the HTML `accept` string.
 */
async function pickOnce(
  wantMultiple: boolean,
  readData: boolean
): Promise<Awaited<ReturnType<typeof FilePicker.pickFiles>>> {
  return FilePicker.pickFiles({
    limit: wantMultiple ? 0 : 1,
    readData,
  });
}

/**
 * Re-read a single picked entry's bytes WITHOUT re-opening the native picker. Used when
 * `pickedToWebFile` produces 0 bytes (Android content://) — we call `FilePicker.readFile`
 * to ask the plugin for the base64 payload directly. Returns null when the plugin doesn't
 * expose `readFile` (older versions) or the path can't be resolved.
 */
async function readPickedEntryBytes(f: PickedFromPlugin): Promise<File | null> {
  if (!f.path) return null;
  const anyPicker = FilePicker as unknown as {
    readFile?: (opts: { path: string }) => Promise<{ data: string }>;
  };
  if (typeof anyPicker.readFile !== 'function') return null;
  try {
    const res = await anyPicker.readFile({ path: f.path });
    if (!res?.data) return null;
    return base64ToFile(res.data, f.name, f.mimeType);
  } catch (e) {
    console.warn('[CapawesomePick] readFile fallback failed', f.name, e);
    return null;
  }
}

export async function pickFilesWithCapawesome(
  options: CapawesomePickOptions
): Promise<CapawesomePickResult> {
  const isAndroid = Capacitor.getPlatform() === 'android';
  if (isAndroid) {
    try {
      const status = await FilePicker.checkPermissions();
      const needRead =
        status.readExternalStorage === 'prompt' || status.readExternalStorage === 'denied';
      if (needRead) {
        await FilePicker.requestPermissions({ permissions: ['readExternalStorage'] });
      } else {
        await FilePicker.requestPermissions();
      }
    } catch {
      // Permission may already be granted; plugin is Android-only
    }
  }

  const wantMultiple = options.multiple;

  // On Android, force `readData: true` on the FIRST pick. Reading bytes via
  // `convertFileSrc(content://…)` + `fetch` returns 0 bytes on a lot of devices/galleries,
  // and re-prompting the user with a second picker (the previous fallback) is what made
  // "tap done and nothing happens" the user-facing symptom. Asking the plugin for base64
  // up front avoids the silent-empty case without re-opening the UI.
  let result: Awaited<ReturnType<typeof FilePicker.pickFiles>>;
  try {
    result = await pickOnce(wantMultiple, isAndroid);
  } catch (firstErr) {
    if (!isAndroid && !wantMultiple) {
      try {
        result = await pickOnce(wantMultiple, true);
      } catch {
        throw firstErr;
      }
    } else {
      throw firstErr;
    }
  }

  if (!result.files || result.files.length === 0) {
    return { files: [], rejectedByAccept: false };
  }

  console.log(
    `[CapawesomePick] Pick result: count=${result.files.length}, platform=${Capacitor.getPlatform()}`
  );

  const out: File[] = [];
  for (const f of result.files) {
    let webFile: File | null = null;
    try {
      webFile = await pickedToWebFile(f);
      if (webFile.size === 0) {
        webFile = null;
        throw new Error(`Picked file is empty (0 bytes): ${f.name}`);
      }
    } catch (convErr) {
      console.warn('[CapawesomePick] Primary conversion failed for entry', f.name, convErr);
      // Quiet fallback: ask the plugin for the bytes by path — no native picker re-prompt.
      const reread = await readPickedEntryBytes(f);
      if (reread && reread.size > 0) {
        console.log(`[CapawesomePick] Recovered ${f.name} via readFile (${reread.size} bytes)`);
        webFile = reread;
      }
    }
    if (webFile && webFile.size > 0 && fileMatchesAccept(webFile, options.accept)) {
      out.push(webFile);
    }
  }

  if (out.length === 0) {
    const rejectedByAccept = result.files.length > 0;
    // Discriminate: did the native picker return entries we just couldn't read, or did
    // every entry fail the `accept` filter? The caller toasts different messages.
    let conversionFailed = false;
    for (const f of result.files) {
      const mime = (f.mimeType || '').toLowerCase();
      const name = (f.name || '').toLowerCase();
      const looksImage =
        mime.startsWith('image/') || /\.(jpe?g|png|gif|webp|heic|heif)$/i.test(name);
      if (looksImage) {
        conversionFailed = true;
        break;
      }
    }
    return {
      files: [],
      rejectedByAccept: rejectedByAccept && !conversionFailed,
      conversionFailed,
    };
  }

  return {
    files: out,
    rejectedByAccept: false,
  };
}
