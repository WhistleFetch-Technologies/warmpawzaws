'use client';

import React from 'react';

/**
 * ============================================================================
 * LOADING STATES - Customer App
 * ============================================================================
 * 
 * Unified loading states for consistent UX across the customer application.
 * Uses clean 2D animations that match the Warmpawz design system.
 */

// ============================================================================
// BASE SKELETON COMPONENTS
// ============================================================================

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div className={`animate-pulse bg-gray-200 rounded ${className}`} />
  );
}

export function SkeletonText({ className = '', lines = 1 }: SkeletonProps & { lines?: number }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton 
          key={i} 
          className={`h-4 ${i === lines - 1 ? 'w-3/4' : 'w-full'}`} 
        />
      ))}
    </div>
  );
}

export function SkeletonCircle({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
  };
  
  return <Skeleton className={`${sizeClasses[size]} rounded-full`} />;
}

// ============================================================================
// LOADING SPINNER
// ============================================================================

export function LoadingSpinner({ size = 'md', color = 'orange' }: { size?: 'sm' | 'md' | 'lg'; color?: 'orange' | 'white' | 'gray' }) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  };
  
  const colorClasses = {
    orange: 'text-[#FF8C42]',
    white: 'text-white',
    gray: 'text-gray-400',
  };

  return (
    <svg
      className={`animate-spin ${sizeClasses[size]} ${colorClasses[color]}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

// ============================================================================
// LOADING OVERLAY
// ============================================================================

export function LoadingOverlay({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-50 rounded-xl">
      <div className="flex flex-col items-center gap-3">
        <LoadingSpinner size="lg" />
        <p className="text-sm text-gray-600">{message}</p>
      </div>
    </div>
  );
}

// ============================================================================
// FULL PAGE LOADING
// ============================================================================

export function FullPageLoading({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white">
      <div className="w-16 h-16 mb-4">
        <img src="/logo.webp" alt="Warmpawz" className="w-full h-full object-contain animate-pulse" />
      </div>
      <LoadingSpinner size="lg" />
      <p className="mt-4 text-sm text-gray-500">{message}</p>
    </div>
  );
}

// ============================================================================
// SECTION SKELETONS
// ============================================================================

export function HomeScreenSkeleton() {
  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-6 w-32 mb-2" />
          <Skeleton className="h-4 w-48" />
        </div>
        <SkeletonCircle size="md" />
      </div>

      {/* Search Bar */}
      <Skeleton className="h-12 w-full rounded-xl" />

      {/* Banner */}
      <Skeleton className="h-40 w-full rounded-2xl" />

      {/* Services Grid */}
      <div className="grid grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="text-center">
            <Skeleton className="h-14 w-14 mx-auto mb-2 rounded-xl" />
            <Skeleton className="h-3 w-12 mx-auto" />
          </div>
        ))}
      </div>

      {/* Service Cards */}
      <div className="flex gap-4 overflow-hidden">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex-shrink-0 w-64 bg-gray-50 rounded-2xl p-4">
            <Skeleton className="h-10 w-10 mb-3 rounded-xl" />
            <Skeleton className="h-5 w-32 mb-2" />
            <Skeleton className="h-3 w-24 mb-4" />
            <Skeleton className="h-8 w-24 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function PetProfileSkeleton() {
  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-lg" />
        <Skeleton className="h-6 w-32" />
      </div>

      {/* Pet Tabs */}
      <div className="flex gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-24 rounded-full" />
        ))}
      </div>

      {/* Pet Card */}
      <div className="bg-gray-50 rounded-2xl p-4">
        <Skeleton className="h-48 w-full rounded-xl mb-4" />
        <Skeleton className="h-6 w-32 mb-2" />
        <Skeleton className="h-4 w-24" />
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-gray-50 rounded-xl p-4">
            <Skeleton className="h-4 w-16 mb-2" />
            <Skeleton className="h-6 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function BookingListSkeleton() {
  return (
    <div className="space-y-4 p-6">
      {/* Header */}
      <Skeleton className="h-8 w-40 mb-4" />

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-24 rounded-full" />
        ))}
      </div>

      {/* Booking Cards */}
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="bg-white rounded-2xl p-4 border border-gray-100">
          <div className="flex items-start gap-4">
            <Skeleton className="h-16 w-16 rounded-xl" />
            <div className="flex-1">
              <Skeleton className="h-5 w-40 mb-2" />
              <Skeleton className="h-4 w-32 mb-2" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-8 w-20 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ServiceDetailSkeleton() {
  return (
    <div className="space-y-6 p-6">
      {/* Hero Image */}
      <Skeleton className="h-56 w-full rounded-2xl" />

      {/* Title & Rating */}
      <div>
        <Skeleton className="h-7 w-48 mb-2" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-24" />
        </div>
      </div>

      {/* Description */}
      <SkeletonText lines={3} />

      {/* Price Card */}
      <div className="bg-gray-50 rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-4 w-16 mb-1" />
            <Skeleton className="h-8 w-24" />
          </div>
          <Skeleton className="h-12 w-32 rounded-xl" />
        </div>
      </div>

      {/* Options */}
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}

export default {
  Skeleton,
  SkeletonText,
  SkeletonCircle,
  LoadingSpinner,
  LoadingOverlay,
  FullPageLoading,
  HomeScreenSkeleton,
  PetProfileSkeleton,
  BookingListSkeleton,
  ServiceDetailSkeleton,
};
