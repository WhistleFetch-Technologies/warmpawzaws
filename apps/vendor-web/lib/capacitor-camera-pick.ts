'use client';

import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import { isImageOnlyFileAccept } from '@/lib/capacitor';
import { fileMatchesAccept } from '@/lib/capacitor-file-pick';

function assertCameraPlugin(): void {
  if (typeof window === 'undefined' || !Capacitor.isPluginAvailable('Camera')) {
    throw new Error('Camera plugin is not available in this build. Add @capacitor/camera and run `npx cap sync`.');
  }
}

async function readGetPhotoToFile(photo: {
  webPath?: string;
  path?: string;
  base64String?: string;
  format: string;
}): Promise<File> {
  if (photo.base64String) {
    const binary = atob(photo.base64String);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const type = `image/${photo.format || 'jpeg'}`;
    return new File([bytes], `capture-${Date.now()}.jpg`, { type });
  }
  const raw = photo.webPath || photo.path;
  if (raw) {
    const src =
      raw.startsWith('http') || raw.startsWith('blob:') || raw.startsWith('data:') ? raw : Capacitor.convertFileSrc(raw);
    const res = await fetch(src);
    if (!res.ok) {
      throw new Error(`Could not read image (${res.status})`);
    }
    const blob = await res.blob();
    return new File([blob], `capture-${Date.now()}.jpg`, { type: blob.type || `image/${photo.format || 'jpeg'}` });
  }
  throw new Error('No image data from Camera');
}

/**
 * Picks one or more images on Android (Capacitor) when HTML `<input type="file">` is unreliable in WebView.
 * Uses `getPhoto` (single) or `pickImages` (multi). iOS / desktop are expected to use the regular file input.
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
      const { photos } = await Camera.pickImages({ quality: 90, limit: 0, correctOrientation: true });
      if (!photos?.length) {
        return { files: [], rejectedByAccept: false };
      }
      for (let i = 0; i < photos.length; i++) {
        const p = photos[i];
        const ext = (p.format || 'jpeg').replace(/jpeg/i, 'jpg');
        const name = `image-${i}-${Date.now()}.${ext}`;
        const web = p.webPath || (p.path ? Capacitor.convertFileSrc(p.path) : null);
        if (web) {
          const res = await fetch(web);
          const blob = await res.blob();
          out.push(new File([blob], name, { type: blob.type || 'image/jpeg' }));
        }
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
