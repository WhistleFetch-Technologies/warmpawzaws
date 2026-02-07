'use client';

import React, { useState, useRef } from 'react';
import { Upload, X, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export interface PhotoUploadWithProgressProps {
  currentPhotoUrl?: string;
  onUploadComplete: (url: string) => void;
  onUploadError?: (error: string) => void;
  uploadFunction: (file: File, onProgress: (progress: number) => void) => Promise<{ success: boolean; publicUrl?: string; error?: string }>;
  maxSizeMB?: number;
  accept?: string;
  className?: string;
  label?: string;
  required?: boolean;
}

export function PhotoUploadWithProgress({
  currentPhotoUrl,
  onUploadComplete,
  onUploadError,
  uploadFunction,
  maxSizeMB = 10,
  accept = 'image/*',
  className = '',
  label = 'Upload Photo',
  required = false,
}: PhotoUploadWithProgressProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [preview, setPreview] = useState<string | null>(currentPhotoUrl || null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size
    const maxSize = maxSizeMB * 1024 * 1024;
    if (file.size > maxSize) {
      const errorMsg = `File is too large. Maximum size is ${maxSizeMB}MB`;
      setError(errorMsg);
      toast.error(errorMsg);
      if (onUploadError) onUploadError(errorMsg);
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      const errorMsg = 'Please select an image file';
      setError(errorMsg);
      toast.error(errorMsg);
      if (onUploadError) onUploadError(errorMsg);
      return;
    }

    // Show preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result as string);
      setError(null);
    };
    reader.readAsDataURL(file);

    // Start upload
    setUploading(true);
    setUploadProgress(0);
    setError(null);

    try {
      const result = await uploadFunction(file, (progress) => {
        setUploadProgress(progress);
      });

      if (result.success && result.publicUrl) {
        setPreview(result.publicUrl);
        onUploadComplete(result.publicUrl);
        toast.success('Photo uploaded successfully!');
        setError(null);
      } else {
        const errorMsg = result.error || 'Upload failed. Please try again.';
        setError(errorMsg);
        toast.error(errorMsg);
        if (onUploadError) onUploadError(errorMsg);
        // Reset preview on error
        setPreview(currentPhotoUrl || null);
      }
    } catch (err: any) {
      const errorMsg = err.message || 'Upload failed. Please try again.';
      setError(errorMsg);
      toast.error(errorMsg);
      if (onUploadError) onUploadError(errorMsg);
      setPreview(currentPhotoUrl || null);
    } finally {
      setUploading(false);
      setUploadProgress(0);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemove = () => {
    setPreview(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    if (currentPhotoUrl) {
      // Call with empty string to indicate removal
      onUploadComplete('');
    }
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-gray-700">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      <div className="relative">
        {/* Photo Preview/Upload Area */}
        <div className="relative w-full aspect-square max-w-[200px] mx-auto">
          {preview ? (
            <div className="relative w-full h-full rounded-lg overflow-hidden border-2 border-gray-200">
              <img
                src={preview}
                alt="Preview"
                className="w-full h-full object-cover"
              />
              {!uploading && (
                <button
                  type="button"
                  onClick={handleRemove}
                  className="absolute top-2 right-2 w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
                  title="Remove photo"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          ) : (
            <label
              className={`flex flex-col items-center justify-center w-full h-full border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                uploading
                  ? 'border-orange-400 bg-orange-50'
                  : error
                  ? 'border-red-300 bg-red-50'
                  : 'border-gray-300 bg-gray-50 hover:border-orange-400 hover:bg-orange-50'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept={accept}
                onChange={handleFileSelect}
                className="hidden"
                disabled={uploading}
              />
              {uploading ? (
                <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
              ) : (
                <Upload className="w-8 h-8 text-gray-400" />
              )}
              <span className="mt-2 text-sm text-gray-600 text-center px-4">
                {uploading ? 'Uploading...' : 'Click to upload photo'}
              </span>
              <span className="mt-1 text-xs text-gray-500">
                Max {maxSizeMB}MB
              </span>
            </label>
          )}
        </div>

        {/* Progress Bar */}
        {uploading && (
          <div className="mt-3 space-y-2">
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div
                className="bg-orange-500 h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-gray-600">
              <span>Uploading... {uploadProgress}%</span>
              {uploadProgress === 100 && (
                <span className="flex items-center gap-1 text-green-600">
                  <CheckCircle2 className="w-3 h-3" />
                  Verifying...
                </span>
              )}
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && !uploading && (
          <div className="mt-2 flex items-center gap-2 text-sm text-red-600 bg-red-50 p-2 rounded">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Success Indicator */}
        {!uploading && !error && preview && preview !== currentPhotoUrl && (
          <div className="mt-2 flex items-center gap-2 text-sm text-green-600">
            <CheckCircle2 className="w-4 h-4" />
            <span>Photo ready</span>
          </div>
        )}
      </div>
    </div>
  );
}
