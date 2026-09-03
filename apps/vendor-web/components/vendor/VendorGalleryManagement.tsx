'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';
import { Camera, Image as ImageIcon, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { VendorHeader } from '@/components/vendor/VendorHeader';
import { Button } from '@/components/ui/button';
import { TouchFilePicker } from '@/components/shared/TouchFilePicker';
import { fileMatchesAccept } from '@/lib/capacitor-file-pick';
import {
  resolveFacilityGalleryVendorId,
  uploadFacilityCenterPhotos,
} from '@/lib/photo-upload-enhanced';
import { takePendingCameraUploadPayloads } from '@/lib/camera-upload-bridge';
import { sanitizeDisplayImageUrl } from '@/lib/sanitize-display-image-url';

interface VendorGalleryManagementProps {
  vendorId: string;
  onBack?: () => void;
}

const MAX_PHOTOS = 20;
const MAX_FILE_MB = 25;

export function VendorGalleryManagement({ vendorId, onBack }: VendorGalleryManagementProps) {
  const effectiveVendorId = resolveFacilityGalleryVendorId(vendorId);
  const [loading, setLoading] = useState(true);
  const [photos, setPhotos] = useState<string[]>([]);
  /** Same UX as before: empty state → "Get started" reveals the center photo manager */
  const [galleryStarted, setGalleryStarted] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingIndex, setDeletingIndex] = useState<number | null>(null);

  const loadPhotos = useCallback(async (): Promise<number> => {
    const facilityData = (await apiClient.get(`/vendor/${effectiveVendorId}/facility`)) as {
      success?: boolean;
      facility?: { photos?: string[] };
    };
    const list = facilityData?.success && facilityData?.facility?.photos ? facilityData.facility.photos : [];
    const cleaned = Array.isArray(list)
      ? list.map((u) => sanitizeDisplayImageUrl(u)).filter((u): u is string => Boolean(u))
      : [];
    setPhotos(cleaned);
    return cleaned.length;
  }, [effectiveVendorId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const count = await loadPhotos();
        if (!cancelled && count > 0) setGalleryStarted(true);
      } catch (error) {
        console.error('[GALLERY] Load facility failed:', error);
        if (!cancelled) toast.error('Failed to load center photos');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [effectiveVendorId, loadPhotos]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';

    // Helpful Android diagnostics: name/size/type are the three things that confirm bytes survived
    // the Capawesome pick → File conversion. An entry with size 0 is the #1 cause of
    // "upload returns success but gallery stays empty".
    if (files.length === 0) {
      toast.error('No photo was selected. Allow camera/photos permission for Warmpawz Vendor in Settings.');
      return;
    }

    console.log(
      '[GALLERY] Picked files:',
      files.map((f) => ({ name: f.name, size: f.size, type: f.type }))
    );

    const valid = files.filter((file) => {
      // Use same rules as @capacitor/camera + Capawesome: Android often yields application/octet-stream
      // or empty MIME; match by extension for image/* (see fileMatchesAccept).
      if (!fileMatchesAccept(file, 'image/*')) {
        toast.error(`${file.name} is not an image`);
        return false;
      }
      if (file.size === 0) {
        toast.error(`${file.name || 'Selected photo'} is empty. Please try a different photo or reopen the picker.`);
        return false;
      }
      if (file.size > MAX_FILE_MB * 1024 * 1024) {
        toast.error(`${file.name} is too large (max ${MAX_FILE_MB}MB)`);
        return false;
      }
      return true;
    });

    if (valid.length === 0) return;

    if (photos.length + valid.length > MAX_PHOTOS) {
      toast.error(`You can have at most ${MAX_PHOTOS} center photos`);
      return;
    }

    setUploading(true);
    const beforeCount = photos.length;
    const cameraPayloads = takePendingCameraUploadPayloads();
    if (!cameraPayloads?.length && valid.some((f) => f.size === 0)) {
      toast.error('Photo could not be read on this device. Update the app or allow Photos permission.');
      return;
    }
    try {
      const result = await uploadFacilityCenterPhotos(effectiveVendorId, valid, {
        payloads: cameraPayloads,
        maxRetries: 3,
        onProgress:
          (cameraPayloads?.length || valid.length) === 1
            ? (pct) => console.log(`[GALLERY] Upload progress: ${pct}%`)
            : undefined,
      });
      console.log('[GALLERY] Upload response:', {
        uploadedCount: result.uploadedCount,
        displayUrls: result.displayUrls?.length,
        vendorId: result.vendorId,
        fileSizes: valid.map((f) => f.size),
      });

      if (result.displayUrls?.length) {
        const displayable = result.displayUrls
          .map((u) => sanitizeDisplayImageUrl(u))
          .filter((u): u is string => Boolean(u));
        setPhotos((prev) => [...prev, ...displayable]);
        const stored = result.uploadedCount ?? result.displayUrls.length;
        toast.success(stored === 1 ? 'Photo uploaded' : `${stored} photos uploaded`);
        return;
      }

      const newCount = await loadPhotos();
      if (newCount <= beforeCount && (result.uploadedCount ?? 0) > 0) {
        await new Promise((r) => setTimeout(r, 800));
        const retryCount = await loadPhotos();
        if (retryCount > beforeCount) {
          toast.success(
            result.uploadedCount === 1 ? 'Photo uploaded' : `${result.uploadedCount} photos uploaded`
          );
          return;
        }
      }
      if (newCount <= beforeCount) {
        throw new Error('Upload finished but the gallery did not update. Please retry.');
      }
      const stored = result.uploadedCount ?? newCount - beforeCount;
      toast.success(stored === 1 ? 'Photo uploaded' : `${stored} photos uploaded`);
    } catch (err: unknown) {
      console.error('[GALLERY] Upload failed:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to upload photos');
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = async (index: number) => {
    const next = photos.filter((_, i) => i !== index);
    setDeletingIndex(index);
    try {
      const res = (await apiClient.put(`/vendor/facility/${effectiveVendorId}`, { photos: next })) as {
        success?: boolean;
        error?: string;
      };
      if (res?.error || res?.success === false) {
        throw new Error(res?.error || 'Failed to remove photo');
      }
      toast.success('Photo removed');
      await loadPhotos();
    } catch (err: unknown) {
      console.error('[GALLERY] Remove failed:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to remove photo');
      await loadPhotos();
    } finally {
      setDeletingIndex(null);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 vendor-app-column">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-[#FF8C42]" />
      </div>
    );
  }

  const showManager = galleryStarted || photos.length > 0;

  return (
    <div className="vendor-page-shell bg-gray-50">
      <div className="vendor-app-column min-h-screen bg-white">
        <VendorHeader
          tone="brand"
          title="Gallery Management"
          subtitle="Center photos for your listing (up to 10)"
          showBack={Boolean(onBack)}
          onBack={onBack}
        />
        <div className="p-4">
          {!showManager ? (
            <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
              <Camera className="mx-auto mb-4 h-16 w-16 text-gray-300" />
              <h3 className="mb-2 text-lg font-semibold text-gray-800">Center photos</h3>
              <p className="mb-4 text-gray-500">
                Add up to {MAX_PHOTOS} photos of your center. They appear in discovery and your facility details — same
                as the center photo option that was in Profile.
              </p>
              <Button
                type="button"
                className="bg-[#FF8C42] px-6 font-medium text-white hover:bg-orange-600"
                onClick={() => setGalleryStarted(true)}
              >
                <Plus className="mr-2 inline h-4 w-4" />
                Get started
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="rounded-xl border border-gray-200 bg-white p-6">
                <h3 className="mb-1 font-bold text-gray-900">Center photos</h3>
                <p className="mb-4 text-sm text-gray-600">
                  Up to {MAX_PHOTOS} images, max {MAX_FILE_MB}MB each. Uploads are saved to your facility immediately.
                </p>

                {photos.length === 0 && !uploading && (
                  <p className="mb-4 text-center text-sm text-gray-500">No photos yet. Add some below.</p>
                )}

                <div className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-3">
                  {photos.map((photo, idx) => (
                    <div key={`${idx}-${photo.slice(0, 48)}`} className="relative aspect-video overflow-hidden rounded-lg bg-gray-100">
                      <img
                        src={photo}
                        alt={`Center ${idx + 1}`}
                        className="h-full w-full object-cover"
                        loading="lazy"
                        onError={(e) => {
                          (e.currentTarget.parentElement as HTMLElement | null)?.classList.add('hidden');
                        }}
                      />
                      <button
                        type="button"
                        disabled={deletingIndex !== null}
                        onClick={() => removePhoto(idx)}
                        className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-red-500 text-sm text-white hover:bg-red-600 disabled:opacity-50"
                        aria-label="Remove photo"
                      >
                        {deletingIndex === idx ? (
                          <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  ))}
                </div>

                {photos.length < MAX_PHOTOS && (
                  <TouchFilePicker
                    onFileChange={handleFileSelect}
                    accept="image/*"
                    multiple
                    disabled={uploading}
                    className="flex flex-col items-center justify-center gap-2 overflow-hidden rounded-lg border-2 border-dashed border-gray-300 p-6 transition-colors hover:bg-gray-50"
                    innerClassName="flex w-full flex-col items-center justify-center gap-2 text-center"
                  >
                    <ImageIcon className="h-8 w-8 text-gray-400" />
                    <span className="text-sm text-gray-600">
                      {uploading ? 'Uploading…' : `Add photos (${photos.length}/${MAX_PHOTOS})`}
                    </span>
                  </TouchFilePicker>
                )}

                {photos.length >= MAX_PHOTOS && (
                  <p className="text-center text-sm text-gray-500">Maximum of {MAX_PHOTOS} photos reached. Remove one to add more.</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default VendorGalleryManagement;
