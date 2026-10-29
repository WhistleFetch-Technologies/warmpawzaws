'use client';

import { Image as ImageIcon, Trash2, Upload } from 'lucide-react';

const VACCINE_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

export function isVaccineCertificateFileValid(file: File): string | null {
  if (!file.type.startsWith('image/') && file.type !== 'application/octet-stream') {
    return 'Please upload an image file';
  }
  if (file.size > VACCINE_IMAGE_MAX_BYTES) {
    return 'Certificate image must be 5MB or less';
  }
  return null;
}

interface VaccinationCertificateFieldProps {
  imageUrl?: string;
  uploading?: boolean;
  disabled?: boolean;
  inputId: string;
  onSelectFile: (file: File) => void;
  onRemove: () => void;
}

export function VaccinationCertificateField({
  imageUrl,
  uploading = false,
  disabled = false,
  inputId,
  onSelectFile,
  onRemove,
}: VaccinationCertificateFieldProps) {
  return (
    <div className="mt-3">
      <p className="mb-1.5 text-xs font-medium text-gray-600">Certificate photo (optional, max 5MB)</p>
      {imageUrl ? (
        <div className="flex items-center gap-3">
          <a
            href={imageUrl}
            target="_blank"
            rel="noreferrer"
            className="h-16 w-16 overflow-hidden rounded-lg border border-gray-200 bg-white"
          >
            <img src={imageUrl} alt="Vaccination certificate" className="h-full w-full object-cover" />
          </a>
          <button
            type="button"
            disabled={disabled || uploading}
            onClick={onRemove}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Remove photo
          </button>
        </div>
      ) : (
        <label
          htmlFor={inputId}
          className={`inline-flex items-center gap-2 rounded-lg border border-dashed border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 ${
            disabled || uploading ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:border-orange-300 hover:bg-orange-50'
          }`}
        >
          {uploading ? <Upload className="h-3.5 w-3.5 animate-pulse" /> : <ImageIcon className="h-3.5 w-3.5" />}
          {uploading ? 'Uploading…' : 'Add photo'}
          <input
            id={inputId}
            type="file"
            accept="image/*"
            className="hidden"
            disabled={disabled || uploading}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (file) onSelectFile(file);
            }}
          />
        </label>
      )}
    </div>
  );
}
