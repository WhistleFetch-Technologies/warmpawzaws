'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  Input,
  Label,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@warmpawz/ui';
import { Upload, Link as LinkIcon, X } from 'lucide-react';
import {
  buildBannerPreviewBackground,
} from '@/lib/banner-admin';
import {
  compressBannerImage,
  formatBannerImageSizeLabel,
  isManagedBannerStorageKey,
} from '@/lib/compress-banner-image';
import { fetchBannerImagePreviewUrl } from '@/lib/banner-image-upload';

type BannerImageFieldProps = {
  value: string;
  onChange: (url: string) => void;
  onPendingFileChange?: (file: File | null) => void;
  onPreviewUrlChange?: (url: string) => void;
  gradientFrom?: string;
  gradientTo?: string;
  disabled?: boolean;
};

export function BannerImageField({
  value,
  onChange,
  onPendingFileChange,
  onPreviewUrlChange,
  gradientFrom = '#FF8C42',
  gradientTo = '#FF6B35',
  disabled = false,
}: BannerImageFieldProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewObjectUrlRef = useRef<string | null>(null);
  const [mode, setMode] = useState<'upload' | 'url'>(() =>
    value && !isManagedBannerStorageKey(value) && value.startsWith('http') ? 'url' : 'upload'
  );
  const [compressing, setCompressing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingPreviewUrl, setPendingPreviewUrl] = useState<string | null>(null);
  const [resolvedPreviewUrl, setResolvedPreviewUrl] = useState<string>('');
  const [compressionLabel, setCompressionLabel] = useState<string | null>(null);
  const [originalSizeLabel, setOriginalSizeLabel] = useState<string | null>(null);

  const revokePreviewObjectUrl = () => {
    if (previewObjectUrlRef.current) {
      URL.revokeObjectURL(previewObjectUrlRef.current);
      previewObjectUrlRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      revokePreviewObjectUrl();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function resolvePreview() {
      if (pendingPreviewUrl) {
        setResolvedPreviewUrl(pendingPreviewUrl);
        return;
      }

      const trimmed = value.trim();
      if (!trimmed) {
        setResolvedPreviewUrl('');
        return;
      }

      if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('/')) {
        setResolvedPreviewUrl(trimmed);
        return;
      }

      try {
        const url = await fetchBannerImagePreviewUrl(trimmed);
        if (!cancelled) setResolvedPreviewUrl(url);
      } catch {
        if (!cancelled) setResolvedPreviewUrl('');
      }
    }

    resolvePreview();
    return () => {
      cancelled = true;
    };
  }, [value, pendingPreviewUrl]);

  useEffect(() => {
    onPreviewUrlChange?.(resolvedPreviewUrl);
  }, [resolvedPreviewUrl, onPreviewUrlChange]);

  const handleFileSelect = async (file: File) => {
    setError(null);
    setCompressing(true);
    setOriginalSizeLabel(formatBannerImageSizeLabel(file.size));

    try {
      const compressed = await compressBannerImage(file);
      revokePreviewObjectUrl();
      const objectUrl = URL.createObjectURL(compressed);
      previewObjectUrlRef.current = objectUrl;
      setPendingPreviewUrl(objectUrl);
      setCompressionLabel(formatBannerImageSizeLabel(compressed.size));
      onPendingFileChange?.(compressed);
      onChange('');
      setMode('upload');
    } catch (err: any) {
      setError(err?.message || 'Failed to compress image');
      onPendingFileChange?.(null);
      setPendingPreviewUrl(null);
      setCompressionLabel(null);
      setOriginalSizeLabel(null);
    } finally {
      setCompressing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      void handleFileSelect(file);
    }
  };

  const handleClear = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    revokePreviewObjectUrl();
    setPendingPreviewUrl(null);
    setCompressionLabel(null);
    setOriginalSizeLabel(null);
    setError(null);
    onPendingFileChange?.(null);
    onChange('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const previewBackground = buildBannerPreviewBackground({
    imageUrl: resolvedPreviewUrl,
    gradientFrom,
    gradientTo,
  });

  const hasPreview = Boolean(resolvedPreviewUrl);

  return (
    <div className="space-y-3">
      <Label>Banner background image</Label>

      <Tabs
        value={mode}
        onValueChange={(next: string) => setMode(next as 'upload' | 'url')}
      >
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="upload" disabled={disabled}>
            <Upload className="w-4 h-4 mr-2" />
            Upload from device
          </TabsTrigger>
          <TabsTrigger value="url" disabled={disabled}>
            <LinkIcon className="w-4 h-4 mr-2" />
            Image URL
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="space-y-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleInputChange}
            className="hidden"
            disabled={disabled || compressing}
          />
          <div
            onClick={() => !disabled && !compressing && fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
              disabled || compressing
                ? 'border-gray-200 bg-gray-50 cursor-not-allowed'
                : 'border-gray-300 hover:border-[#FF8C42] cursor-pointer'
            }`}
          >
            {compressing ? (
              <div className="flex flex-col items-center justify-center py-4">
                <div className="animate-spin rounded-full h-8 w-8 border-4 border-[#FF8C42] border-t-transparent mb-2" />
                <p className="text-sm text-gray-600">Compressing image...</p>
              </div>
            ) : hasPreview ? (
              <div className="space-y-3">
                <div
                  className="mx-auto h-32 max-w-full rounded-lg border border-gray-200"
                  style={{ background: previewBackground }}
                />
                {compressionLabel ? (
                  <p className="text-xs text-gray-600">
                    {compressionLabel}
                    {originalSizeLabel ? ` (from ${originalSizeLabel})` : ''}
                  </p>
                ) : null}
                <p className="text-xs text-gray-500">Click to choose a different image</p>
              </div>
            ) : (
              <div className="py-4">
                <Upload className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                <p className="text-sm text-gray-600">Click to upload banner image</p>
                <p className="text-xs text-gray-500 mt-1">JPEG, PNG, or WebP up to 10 MB</p>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="url" className="space-y-3">
          <Input
            type="text"
            value={value}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              onPendingFileChange?.(null);
              setPendingPreviewUrl(null);
              setCompressionLabel(null);
              setOriginalSizeLabel(null);
              revokePreviewObjectUrl();
              onChange(e.target.value);
            }}
            placeholder="https://example.com/banner.jpg"
            disabled={disabled}
          />
          <p className="text-xs text-gray-500">
            Paste an external image URL. Leave empty for gradient-only.
          </p>
        </TabsContent>
      </Tabs>

      {mode === 'url' && hasPreview ? (
        <div
          className="h-32 w-full rounded-lg border border-gray-200"
          style={{ background: previewBackground }}
        />
      ) : null}

      {(hasPreview || value.trim()) && !disabled ? (
        <button
          type="button"
          onClick={handleClear}
          className="inline-flex items-center gap-1 text-sm text-red-600 hover:text-red-700"
        >
          <X className="w-4 h-4" />
          Clear image
        </button>
      ) : null}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <p className="text-xs text-gray-500">
        Uploaded images are compressed to 200 KB or less before save. Leave empty for gradient-only.
      </p>
    </div>
  );
}
