import React from 'react';
import { Skeleton } from './skeleton';
import { cn } from './utils';

/**
 * Skeleton Component Library
 * 
 * Provides consistent loading states across the application.
 * Use these components to show loading placeholders that match
 * the structure of the actual content.
 */

// Base Skeleton (re-exported for convenience)
export { Skeleton };

/**
 * Card Skeleton
 * Loading placeholder for card components
 */
export function CardSkeleton({ className, showImage = true, lines = 3 }: {
  className?: string;
  showImage?: boolean;
  lines?: number;
}) {
  return (
    <div className={cn("bg-white rounded-xl border border-gray-200 overflow-hidden", className)}>
      {showImage && (
        <div className="h-48 bg-gray-200 animate-pulse" />
      )}
      <div className="p-4 space-y-3">
        <Skeleton className="h-6 w-3/4" />
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton
            key={i}
            className={cn(
              "h-4",
              i === lines - 1 ? "w-1/2" : "w-full"
            )}
          />
        ))}
        <div className="flex gap-2 pt-2">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-20" />
        </div>
      </div>
    </div>
  );
}

/**
 * Card Grid Skeleton
 * Loading placeholder for card grids
 */
export function CardGridSkeleton({ 
  count = 6, 
  className,
  showImage = true,
  lines = 3 
}: {
  count?: number;
  className?: string;
  showImage?: boolean;
  lines?: number;
}) {
  return (
    <div className={cn("grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} showImage={showImage} lines={lines} />
      ))}
    </div>
  );
}

/**
 * List Skeleton
 * Loading placeholder for list components
 */
export function ListSkeleton({ 
  count = 5, 
  className,
  showAvatar = true,
  showImage = false 
}: {
  count?: number;
  className?: string;
  showAvatar?: boolean;
  showImage?: boolean;
}) {
  return (
    <div className={cn("space-y-4", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-start gap-4 p-4 bg-white rounded-lg border border-gray-200">
          {showAvatar && (
            <Skeleton className="h-12 w-12 rounded-full flex-shrink-0" />
          )}
          {showImage && (
            <Skeleton className="h-20 w-20 rounded-lg flex-shrink-0" />
          )}
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Table Skeleton
 * Loading placeholder for table components
 */
export function TableSkeleton({ 
  rows = 5, 
  columns = 4,
  className 
}: {
  rows?: number;
  columns?: number;
  className?: string;
}) {
  return (
    <div className={cn("w-full", className)}>
      {/* Header */}
      <div className="grid gap-4 p-4 border-b border-gray-200" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className="h-5 w-full" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div
          key={rowIndex}
          className="grid gap-4 p-4 border-b border-gray-200 last:border-0"
          style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
        >
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton key={colIndex} className="h-4 w-full" />
          ))}
        </div>
      ))}
    </div>
  );
}

/**
 * Form Skeleton
 * Loading placeholder for form components
 */
export function FormSkeleton({ 
  fields = 5, 
  className,
  showSubmit = true 
}: {
  fields?: number;
  className?: string;
  showSubmit?: boolean;
}) {
  return (
    <div className={cn("space-y-6", className)}>
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-full" />
        </div>
      ))}
      {showSubmit && (
        <div className="pt-4">
          <Skeleton className="h-10 w-32" />
        </div>
      )}
    </div>
  );
}

/**
 * Avatar Skeleton
 * Loading placeholder for avatar components
 */
export function AvatarSkeleton({ 
  size = 'md',
  className 
}: {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const sizeClasses = {
    sm: 'h-8 w-8',
    md: 'h-12 w-12',
    lg: 'h-16 w-16',
  };

  return (
    <Skeleton className={cn("rounded-full", sizeClasses[size], className)} />
  );
}

/**
 * Text Skeleton
 * Loading placeholder for text content
 */
export function TextSkeleton({ 
  lines = 3, 
  className,
  lastLineWidth = '3/4' 
}: {
  lines?: number;
  className?: string;
  lastLineWidth?: 'full' | '3/4' | '1/2' | '1/3';
}) {
  const widthClasses = {
    full: 'w-full',
    '3/4': 'w-3/4',
    '1/2': 'w-1/2',
    '1/3': 'w-1/3',
  };

  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn(
            "h-4",
            i === lines - 1 ? widthClasses[lastLineWidth] : "w-full"
          )}
        />
      ))}
    </div>
  );
}

/**
 * Image Skeleton
 * Loading placeholder for image components
 */
export function ImageSkeleton({ 
  aspectRatio = '16/9',
  className 
}: {
  aspectRatio?: '1/1' | '4/3' | '16/9' | '21/9';
  className?: string;
}) {
  const aspectClasses = {
    '1/1': 'aspect-square',
    '4/3': 'aspect-[4/3]',
    '16/9': 'aspect-video',
    '21/9': 'aspect-[21/9]',
  };

  return (
    <Skeleton className={cn("w-full rounded-lg", aspectClasses[aspectRatio], className)} />
  );
}

/**
 * Dashboard Skeleton
 * Loading placeholder for dashboard layouts
 */
export function DashboardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white p-6 rounded-lg border border-gray-200">
            <Skeleton className="h-4 w-24 mb-2" />
            <Skeleton className="h-8 w-32 mb-2" />
            <Skeleton className="h-3 w-20" />
          </div>
        ))}
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <Skeleton className="h-6 w-48 mb-4" />
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <Skeleton className="h-6 w-48 mb-4" />
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Booking Card Skeleton
 * Loading placeholder for booking cards
 */
export function BookingCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("bg-white rounded-xl border border-gray-200 p-6", className)}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
      <div className="space-y-3 mb-4">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-4 w-40" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-4 w-48" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-4 w-36" />
        </div>
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-9 w-24" />
      </div>
    </div>
  );
}

/**
 * Service Card Skeleton
 * Loading placeholder for service cards
 */
export function ServiceCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("bg-white rounded-xl border border-gray-200 overflow-hidden", className)}>
      <Skeleton className="h-48 w-full" />
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <div className="flex items-center gap-2 pt-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-24" />
        </div>
        <Skeleton className="h-10 w-full rounded-lg" />
      </div>
    </div>
  );
}

/**
 * Profile Skeleton
 * Loading placeholder for profile components
 */
export function ProfileSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="flex items-center gap-6">
        <Skeleton className="h-24 w-24 rounded-full" />
        <div className="flex-1 space-y-3">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
          <Skeleton className="h-4 w-40" />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-gray-200">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-24" />
        ))}
      </div>

      {/* Content */}
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Page Skeleton
 * Generic page loading skeleton
 */
export function PageSkeleton({ 
  showHeader = true,
  showContent = true,
  className 
}: {
  showHeader?: boolean;
  showContent?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("space-y-6", className)}>
      {showHeader && (
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
      )}
      {showContent && (
        <div className="space-y-4">
          <Skeleton className="h-64 w-full rounded-lg" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Skeleton className="h-32 w-full rounded-lg" />
            <Skeleton className="h-32 w-full rounded-lg" />
          </div>
        </div>
      )}
    </div>
  );
}

