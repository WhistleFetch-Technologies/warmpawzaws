import type { FacilityCenterPhotoPayload } from '@/lib/photo-upload-enhanced';

/** Base64 from @capacitor/camera passed to the next gallery upload (avoids File round-trip). */
let pendingCameraPayloads: FacilityCenterPhotoPayload[] | null = null;

export function setPendingCameraUploadPayloads(payloads: FacilityCenterPhotoPayload[]): void {
  pendingCameraPayloads = payloads.length ? payloads : null;
}

export function takePendingCameraUploadPayloads(): FacilityCenterPhotoPayload[] | undefined {
  const p = pendingCameraPayloads;
  pendingCameraPayloads = null;
  return p?.length ? p : undefined;
}
