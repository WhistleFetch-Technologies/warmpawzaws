'use client';

import {
  Camera,
  CameraResultType,
  CameraSource,
  MediaType,
  MediaTypeSelection,
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
 * Picks one or more images on Android (Capacitor) when HTML `<input type="file">` is unreliable in WebView.
 * Prefers `chooseFromGallery` (Camera 8+); falls back to deprecated `pickImages` / `getPhoto` on failure.
 */
export async function pickImageFilesWithCapacitorCamera(options: {
  accept: string;
  multiple: boolean;
}): Promise<{ files: File[]; rejectedByAccept: boolean }> {
  assertCameraPlugin();
  if (!isImageOnlyFileAccept(options.accept)) {
    return { files: [], rejectedByAccept: false };
  }

  const out: File[] = [];

  if (options.multiple) {
    try {
      const { results } = await Camera.chooseFromGallery({
        mediaType: MediaTypeSelection.Photo,
        allowMultipleSelection: true,
        limit: 0,
        quality: 90,
        correctOrientation: true,
      });
      if (!results?.length) {
        return { files: [], rejectedByAccept: false };
      }
      for (let i = 0; i < results.length; i++) {
        const r = results[i];
        if (r.type !== MediaType.Photo) {
          continue;
        }
        const fmt = r.metadata?.format || 'jpeg';
        const ext = fmt.replace(/jpeg/i, 'jpg');
        const name = `image-${i}-${Date.now()}.${ext}`;
        out.push(
          await capacitorImageToFile(
            { webPath: r.webPath, uri: r.uri, format: fmt },
            name
          )
        );
      }
    } catch {
      try {
        const { photos } = await Camera.pickImages({ quality: 90, limit: 0, correctOrientation: true });
        if (!photos?.length) {
          return { files: [], rejectedByAccept: false };
        }
        for (let i = 0; i < photos.length; i++) {
          const p = photos[i];
          const ext = (p.format || 'jpeg').replace(/jpeg/i, 'jpg');
          const name = `image-${i}-${Date.now()}.${ext}`;
          out.push(await capacitorImageToFile({ webPath: p.webPath, path: p.path, format: p.format }, name));
        }
      } catch {
        const photo = await Camera.getPhoto({
          quality: 90,
          allowEditing: false,
          resultType: CameraResultType.Uri,
          source: CameraSource.Prompt,
        });
        out.push(await readGetPhotoToFile(photo));
      }
    }
  } else {
    const photo = await Camera.getPhoto({
      quality: 90,
      allowEditing: false,
      resultType: CameraResultType.Uri,
      source: CameraSource.Prompt,
    });
    out.push(await readGetPhotoToFile(photo));
  }

  const matched: File[] = [];
  for (const f of out) {
    if (fileMatchesAccept(f, options.accept)) {
      matched.push(f);
    }
  }
  return {
    files: matched,
    rejectedByAccept: matched.length === 0 && out.length > 0,
  };
}
