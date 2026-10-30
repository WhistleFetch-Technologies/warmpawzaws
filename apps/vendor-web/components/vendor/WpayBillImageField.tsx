'use client';

import { useState } from 'react';
import { postMultipartFormWithXhr } from '@/lib/api-client';
import { TouchFilePicker } from '@/components/shared/TouchFilePicker';

const MAX_BILL_BYTES = 5 * 1024 * 1024;

type Props = {
  vendorId: string;
  settlementId: string;
  billImageStatus?: 'missing' | 'uploaded';
  billVerified?: boolean;
  onUploaded?: () => void;
};

export function WpayBillImageField({
  vendorId,
  settlementId,
  billImageStatus,
  billVerified,
  onUploaded,
}: Props) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pickFile = (file: File | null) => {
    if (billVerified) return;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setError(null);
    if (!file) {
      setPendingFile(null);
      setPreviewUrl(null);
      return;
    }
    if (file.size > MAX_BILL_BYTES) {
      setError('Bill image must be 5MB or less');
      setPendingFile(null);
      setPreviewUrl(null);
      return;
    }
    setPendingFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const confirmUpload = async () => {
    if (billVerified || !pendingFile) return;
    setSaving(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('file', pendingFile);
      await postMultipartFormWithXhr(
        `/vendor/${vendorId}/warmpawz-pay/settlements/${settlementId}/bill-image`,
        form,
      );
      pickFile(null);
      onUploaded?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not upload bill');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-2 rounded-lg border border-orange-100 bg-orange-50/50 p-2 space-y-2">
      <p className="text-[11px] font-medium text-orange-800">
        {billVerified
          ? 'Bill verified by admin'
          : billImageStatus === 'uploaded'
            ? 'Bill uploaded — waiting for admin verify'
            : 'Take a photo or upload the store bill'}
      </p>
      {!billVerified && previewUrl ? (
        <img src={previewUrl} alt="Bill preview" className="max-h-40 w-full rounded-md object-contain bg-white" />
      ) : null}
      {error ? <p className="text-[11px] text-red-600">{error}</p> : null}
      {billVerified ? null : (
        <div className="flex flex-wrap gap-2">
          <TouchFilePicker
            accept="image/*"
            disabled={saving}
            onFileChange={(event) => pickFile(event.target.files?.[0] ?? null)}
          >
            <span className="inline-flex h-9 items-center rounded-lg bg-white px-3 text-xs font-medium text-orange-800 border border-orange-200">
              {pendingFile || billImageStatus === 'uploaded' ? 'Retake' : 'Take photo or upload'}
            </span>
          </TouchFilePicker>
          {pendingFile ? (
            <button
              type="button"
              disabled={saving}
              onClick={() => void confirmUpload()}
              className="h-9 rounded-lg bg-[#FF8C42] px-3 text-xs font-semibold text-white disabled:opacity-60"
            >
              {saving ? 'Uploading…' : 'Confirm'}
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}
