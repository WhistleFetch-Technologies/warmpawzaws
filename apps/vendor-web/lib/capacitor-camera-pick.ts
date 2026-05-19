'use client';

import {
  Camera,
  CameraResultType,
  CameraSource,
} from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import { isImageOnlyFileAccept } from '@/lib/capacitor';
import { fileMatchesAccept } from '@/lib/capacitor-file-pick';

function assertCameraPlugin(): void {
  if (typeof window === 'undefined' || !Capacitor.isPluginAvailable('Camera')) {
    throw new Error('Camera plugin is not available in this build. Add @capacitor/camera and run `npx cap sync`.');
  }
}

function normalizeImageMime(format: string | undefined): string {
  const f = (format || 'jpeg').toLowerCase();
  if (f === 'jpg' || f === 'jpeg') return 'image/jpeg';
  if (f === 'png') return 'image/png';
  if (f === 'gif') return 'image/gif';
  if (f === 'webp') return 'image/webp';
  return `image/${f}`;
}

/**
 * Read a Capacitor Camera image (gallery or capture) into a `File` for `FormData`.
 * Tries several WebView URLs; avoids trusting a single `fetch(webPath)` which can be empty on Android.
 */
async function capacitorImageToFile(
  sources: {
    webPath?: string;
    path?: string;
    uri?: string;
    base64String?: string;
    dataUrl?: string;
    format?: string;
  },
  fileName: string
): Promise<File> {
  const mime = normalizeImageMime(sources.format);

  if (sources.base64String) {
    const binary = atob(sources.base64String);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new File([bytes], fileName, { type: mime });
  }

  if (sources.dataUrl) {
    const res = await fetch(sources.dataUrl);
    if (!res.ok) {
      throw new Error(`Could not read image (${res.status})`);
    }
    const blob = await res.blob();
    if (blob.size === 0) {
      throw new Error('Image data was empty');
    }
    return new File([blob], fileName, { type: blob.type || mime });
  }

  const candidates: string[] = [];
  const add = (u: string | undefined) => {
    if (u && !candidates.includes(u)) {
      candidates.push(u);
    }
  };

  const maybeConvert = (p: string | undefined) => {
    if (!p) return;
    if (/^https?:|^blob:|^data:/i.test(p)) {
      add(p);
      return;
    }
    const trimmed = p.replace(/^file:\/\//, '');
    add(Capacitor.convertFileSrc(trimmed));
    add(p);
  };

  if (sources.webPath) {
    if (/^https?:|^blob:|^data:/i.test(sources.webPath)) {
      add(sources.webPath);
    } else {
      maybeConvert(sources.webPath);
    }
  }
  maybeConvert(sources.path);
  maybeConvert(sources.uri);

  let lastErr: unknown;
  for (const url of candidates) {
    try {
      const res = await fetch(url);
      if (!res.ok) {
        continue;
      }
      const blob = await res.blob();
      if (blob.size > 0) {
        return new File([blob], fileName, { type: blob.type || mime });
      }
    } catch (e) {
      lastErr = e;
    }
  }

  throw new Error(lastErr instanceof Error ? lastErr.message : 'Could not read image data from device');
}

async function readGetPhotoToFile(photo: {
  webPath?: string;
  path?: string;
  base64String?: string;
  dataUrl?: string;
  format: string;
}): Promise<File> {
  const ext = (photo.format || 'jpeg').replace(/jpeg/i, 'jpg');
  const name = `capture-${Date.now()}.${ext}`;
  return capacitorImageToFile(
    {
      webPath: photo.webPath,
      path: photo.path,
      base64String: photo.base64String,
      dataUrl: photo.dataUrl,
      format: photo.format,
    },
    name
  );
}

/**
 * Picks one image on Android (Capacitor) using `Camera.getPhoto({ resultType: Base64 })`.
 *
 * This is the most reliable Android path because base64 bytes are read by the native plugin
 * directly from `MediaStore` and handed to JS through the Capacitor bridge — there is no
 * WebView `fetch(content://…)` / `convertFileSrc` round-trip. That round-trip is the path
 * that has been returning 0-byte blobs on a lot of devices/galleries and is what made the
 * vendor "Add photo" silently fail.
 *
 * Returns at most one file regardless of `options.multiple`. The caller can re-invoke for
 * additional photos — gallery UI already supports incremental adds and this is the only way
 * to guarantee Android byte fidelity without adding `@capacitor/filesystem`.
 */
export type CapacitorCameraPickResult = {
  files: File[];
  rejectedByAccept: boolean;
  /** Base64 payloads for API JSON upload (same order as files). */
  payloads?: { base64: string; fileName: string; mimeType: string }[];
};

async function ensureCameraPhotoPermissions(): Promise<void> {
  try {
    const current = await Camera.checkPermissions();
    const needCamera = current.camera === 'prompt' || current.camera === 'denied';
    const needPhotos = current.photos === 'prompt' || current.photos === 'denied';
    if (needCamera || needPhotos) {
      const result = await Camera.requestPermissions({
        permissions: ['camera', 'photos'],
      });
      if (result.camera === 'denied' && result.photos === 'denied') {
        throw new Error('Camera and photo library permission is required to upload images');
      }
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes('permission')) {
      throw e;
    }
    console.warn('[CameraPick] Permission check failed (continuing):', e);
  }
}

export async function pickImageFilesWithCapacitorCamera(options: {
  accept: string;
  multiple: boolean;
}): Promise<CapacitorCameraPickResult> {
  assertCameraPlugin();
  if (!isImageOnlyFileAccept(options.accept)) {
    return { files: [], rejectedByAccept: false };
  }

  await ensureCameraPhotoPermissions();

  const out: File[] = [];
  const payloads: { base64: string; fileName: string; mimeType: string }[] = [];

  // Prefer Prompt (camera or gallery) with Base64 so "Save/Done" on the native sheet always
  // returns bytes through the bridge — not a 0-byte WebView fetch of content:// URIs.
  let photo;
  try {
    photo = await Camera.getPhoto({
      quality: 90,
      allowEditing: false,
      resultType: CameraResultType.Base64,
      source: CameraSource.Prompt,
      correctOrientation: true,
    });
  } catch (primaryErr) {
    console.warn('[CameraPick] CameraSource.Prompt failed, retrying with Photos', primaryErr);
    photo = await Camera.getPhoto({
      quality: 90,
      allowEditing: false,
      resultType: CameraResultType.Base64,
      source: CameraSource.Photos,
      correctOrientation: true,
    });
  }

  if (photo?.base64String) {
    const ext = (photo.format || 'jpeg').replace(/jpeg/i, 'jpg');
    const name = `image-${Date.now()}.${ext}`;
    const mime = normalizeImageMime(photo.format || 'jpeg');
    payloads.push({
      base64: photo.base64String,
      fileName: name,
      mimeType: mime,
    });
    out.push(
      await capacitorImageToFile(
        { base64String: photo.base64String, format: photo.format || 'jpeg' },
        name
      )
    );
  } else if (photo) {
    // Defensive: if a future plugin version drops base64String, try the remaining URL fields.
    const fmt = photo.format || 'jpeg';
    const ext = fmt.replace(/jpeg/i, 'jpg');
    const name = `image-${Date.now()}.${ext}`;
    out.push(
      await capacitorImageToFile(
        {
          webPath: (photo as any).webPath,
          path: (photo as any).path,
          dataUrl: (photo as any).dataUrl,
          format: fmt,
        },
        name
      )
    );
  }

  const matched: File[] = [];
  const matchedPayloads: typeof payloads = [];
  for (let i = 0; i < out.length; i++) {
    const f = out[i];
    if (f.size > 0 && fileMatchesAccept(f, options.accept)) {
      matched.push(f);
      if (payloads[i]) {
        matchedPayloads.push(payloads[i]);
      }
    }
  }
  return {
    files: matched,
    payloads: matchedPayloads.length === matched.length ? matchedPayloads : undefined,
    rejectedByAccept: matched.length === 0 && out.length > 0,
  };
}
