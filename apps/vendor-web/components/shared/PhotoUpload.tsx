'use client';

/**
 * Shared Photo Upload Component
 * 
 * Reusable photo upload component for both solo providers and staff
 * Features:
 * - Large photo display (128x128px minimum)
 * - Drag-and-drop support
 * - Image preview
 * - Upload progress
 * - Error handling with retry
 * - Validation (size, type)
 */

import React, { useRef, useState } from 'react';
import { Camera, Upload, X, Loader2, AlertCircle } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/components/ui/utils';
import { toast } from 'sonner';
import { TouchFilePicker } from '@/components/shared/TouchFilePicker';
import { fileMatchesAccept } from '@/lib/capacitor-file-pick';

interface PhotoUploadProps {
  photoUrl?: string;
  onUpload: (file: File) => Promise<{ success: boolean; photo_url?: string }>;
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  required?: boolean;
  maxSizeMB?: number;
  accept?: string;
  className?: string;
  disabled?: boolean;
}

const SIZE_CLASSES = {
  sm: 'w-24 h-24',
  md: 'w-32 h-32',
  lg: 'w-40 h-40',
};

export function PhotoUpload({
  photoUrl,
  onUpload,
  size = 'md',
  label = 'Profile Photo',
  required = false,
  maxSizeMB = 5,
  accept = 'image/*',
  className = '',
  disabled = false,
}: PhotoUploadProps) {
  const overlayFileRef = useRef<HTMLInputElement>(null);
  const mainFileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(photoUrl || null);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ✅ Update preview when photoUrl prop changes (e.g., after loading profile)
  React.useEffect(() => {
    if (photoUrl) {
      setPreview(photoUrl);
    }
  }, [photoUrl]);

  const handleFileSelect = async (file: File) => {
    setError(null);

    // Validate file type (extension fallback when MIME is empty or octet-stream — common on Android)
    if (!fileMatchesAccept(file, accept)) {
      setError('Please select an image file');
      toast.error('Invalid file type. Please select an image.');
      return;
    }

    // Validate file size
    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > maxSizeMB) {
      setError(`File size must be less than ${maxSizeMB}MB`);
      toast.error(`Photo must be less than ${maxSizeMB}MB`);
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Upload file
    try {
      setUploading(true);
      const result = await onUpload(file);
      
      if (result.success && result.photo_url) {
        setPreview(result.photo_url);
        toast.success('Photo uploaded successfully');
      } else {
        throw new Error('Upload failed');
      }
    } catch (err: any) {
      console.error('Error uploading photo:', err);
      setError(err.message || 'Failed to upload photo');
      toast.error(err.message || 'Failed to upload photo');
      // Reset preview on error
      setPreview(photoUrl || null);
    } finally {
      setUploading(false);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (disabled) return;

    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const clearFileInputs = () => {
    if (overlayFileRef.current) overlayFileRef.current.value = '';
    if (mainFileRef.current) mainFileRef.current.value = '';
  };

  const handleRemove = () => {
    setPreview(null);
    setError(null);
    clearFileInputs();
  };

  return (
    <div className={className}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      <div className="flex items-start gap-4">
        {/* Photo Display */}
        <div
          className={`relative ${SIZE_CLASSES[size]} rounded-2xl overflow-hidden border-2 ${
            error
              ? 'border-red-300 bg-red-50'
              : dragActive
              ? 'border-blue-400 bg-blue-50'
              : 'border-gray-200 bg-gradient-to-br from-gray-100 to-gray-200'
          } transition-all`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          {preview ? (
            <>
              <img
                src={preview}
                alt="Profile"
                className="w-full h-full object-cover"
              />
              {!disabled && (
                <button
                  type="button"
                  onClick={handleRemove}
                  className="absolute top-1 right-1 z-20 bg-red-500 text-white p-1 rounded-full hover:bg-red-600 transition-colors"
                  title="Remove photo"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Camera className="w-8 h-8 text-gray-400" />
            </div>
          )}

          {/* Upload Overlay */}
          {!disabled && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors hover:bg-black/10">
              <TouchFilePicker
                ref={overlayFileRef}
                onFileChange={handleFileInputChange}
                accept={accept}
                disabled={uploading || disabled}
                className="absolute bottom-2 right-2 h-9 w-9 rounded-full"
                innerClassName="items-center justify-center rounded-full bg-blue-500 text-white"
              >
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Camera className="h-4 w-4" />
                )}
              </TouchFilePicker>
            </div>
          )}

          {/* Drag Overlay */}
          {dragActive && !disabled && (
            <div className="absolute inset-0 bg-blue-500/20 flex items-center justify-center">
              <div className="text-center">
                <Upload className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                <p className="text-sm font-medium text-blue-700">Drop image here</p>
              </div>
            </div>
          )}
        </div>

        {/* Upload Controls */}
        <div className="flex-1">
          <div className="space-y-2">
            <TouchFilePicker
              ref={mainFileRef}
              onFileChange={handleFileInputChange}
              accept={accept}
              disabled={uploading || disabled}
              className="w-full min-h-[2.5rem] rounded-md"
              innerClassName="flex w-full min-h-[2.5rem] items-center justify-center"
            >
              <span
                className={cn(
                  buttonVariants({ variant: 'outline', size: 'sm' }),
                  'w-full',
                  (uploading || disabled) && 'opacity-50'
                )}
              >
                {uploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : preview ? (
                  <>
                    <Camera className="mr-2 h-4 w-4" />
                    Change Photo
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Upload Photo
                  </>
                )}
              </span>
            </TouchFilePicker>

            <p className="text-xs text-gray-500">
              Drag and drop an image here, or click to select
            </p>
            <p className="text-xs text-gray-400">
              Max size: {maxSizeMB}MB • JPG, PNG, or GIF
            </p>

            {error && (
              <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 p-2 rounded">
                <AlertCircle className="w-4 h-4" />
                <span>{error}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
