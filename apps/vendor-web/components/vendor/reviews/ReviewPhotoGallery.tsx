'use client';

import { useCallback, useState } from 'react';
import { X, ImageOff } from 'lucide-react';

interface ReviewPhotoGalleryProps {
  photos: string[];
  /** Compact row for list cards; grid for detail view. */
  variant?: 'row' | 'grid';
  className?: string;
}

function BrokenPhotoPlaceholder({ className }: { className?: string }) {
  return (
    <div
      className={`flex items-center justify-center bg-gray-100 text-gray-400 ${className ?? ''}`}
      aria-hidden
    >
      <ImageOff className="h-5 w-5" />
    </div>
  );
}

function ReviewPhotoThumb({
  src,
  alt,
  className,
  onClick,
}: {
  src: string;
  alt: string;
  className: string;
  onClick?: () => void;
}) {
  const [broken, setBroken] = useState(false);

  if (broken) {
    return <BrokenPhotoPlaceholder className={className} />;
  }

  const image = (
    <img
      src={src}
      alt={alt}
      className={`object-cover ${className}`}
      loading="lazy"
      onError={() => setBroken(true)}
    />
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="block shrink-0 overflow-hidden rounded-lg border border-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-400"
      >
        {image}
      </button>
    );
  }

  return <div className="overflow-hidden rounded-lg border border-gray-100">{image}</div>;
}

export function ReviewPhotoGallery({
  photos,
  variant = 'grid',
  className = '',
}: ReviewPhotoGalleryProps) {
  const urls = (photos ?? []).filter((u) => typeof u === 'string' && u.trim().length > 0);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const closeLightbox = useCallback(() => setLightboxIndex(null), []);

  if (urls.length === 0) {
    return null;
  }

  const thumbClass =
    variant === 'row' ? 'h-16 w-16 sm:h-20 sm:w-20' : 'h-20 w-20 sm:h-24 sm:w-24';
  const containerClass =
    variant === 'row'
      ? 'flex gap-2 overflow-x-auto pb-1'
      : 'grid grid-cols-3 gap-2 sm:grid-cols-4';

  return (
    <>
      <div className={className}>
        <div className={containerClass}>
          {urls.map((src, index) => (
            <ReviewPhotoThumb
              key={`${src}-${index}`}
              src={src}
              alt={`Review photo ${index + 1}`}
              className={thumbClass}
              onClick={() => setLightboxIndex(index)}
            />
          ))}
        </div>
      </div>

      {lightboxIndex !== null && urls[lightboxIndex] ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4"
          role="dialog"
          aria-modal
          aria-label="Review photo preview"
          onClick={closeLightbox}
        >
          <button
            type="button"
            onClick={closeLightbox}
            className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30"
            aria-label="Close preview"
          >
            <X className="h-6 w-6" />
          </button>
          <div className="max-h-[90vh] max-w-full" onClick={(e) => e.stopPropagation()}>
            <img
              src={urls[lightboxIndex]}
              alt={`Review photo ${lightboxIndex + 1}`}
              className="max-h-[90vh] max-w-full object-contain"
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
