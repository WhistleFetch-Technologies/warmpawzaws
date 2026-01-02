import React from 'react';
import { Loader2, AlertCircle, Search } from 'lucide-react';
import { Button } from './button';
import { Skeleton } from './skeleton';
import { FormSkeleton, ListSkeleton, CardSkeleton, TableSkeleton } from './skeletons';

export type LoadingStateVariant = 'spinner' | 'form' | 'list' | 'card' | 'table';

interface LoadingStateProps {
  message?: string;
  variant?: LoadingStateVariant;
  className?: string;
  // Skeleton-specific props
  fields?: number; // for form
  count?: number; // for list/card
  rows?: number; // for table
  columns?: number; // for table
}

export function LoadingState({ 
  message = 'Loading...', 
  variant = 'spinner',
  className = '',
  fields = 5,
  count = 5,
  rows = 5,
  columns = 4
}: LoadingStateProps) {
  // Spinner variant (default, backward compatible)
  if (variant === 'spinner') {
    return (
      <div className={`flex flex-col items-center justify-center py-12 ${className}`}>
        <Loader2 className="h-12 w-12 animate-spin text-blue-500" />
        <p className="mt-4 text-gray-600 font-medium">{message}</p>
      </div>
    );
  }

  // Form skeleton variant
  if (variant === 'form') {
    return (
      <div className={className}>
        <FormSkeleton fields={fields} showSubmit={true} />
      </div>
    );
  }

  // List skeleton variant
  if (variant === 'list') {
    return (
      <div className={className}>
        <ListSkeleton count={count} />
      </div>
    );
  }

  // Card skeleton variant
  if (variant === 'card') {
    return (
      <div className={className}>
        <CardSkeleton />
      </div>
    );
  }

  // Table skeleton variant
  if (variant === 'table') {
    return (
      <div className={className}>
        <TableSkeleton rows={rows} columns={columns} />
      </div>
    );
  }

  // Fallback to spinner
  return (
    <div className={`flex flex-col items-center justify-center py-12 ${className}`}>
      <Loader2 className="h-12 w-12 animate-spin text-blue-500" />
      <p className="mt-4 text-gray-600 font-medium">{message}</p>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-lg mb-4 flex flex-col items-center text-center">
      <AlertCircle className="h-8 w-8 mb-2 text-red-500" />
      <p className="font-medium mb-2">{message}</p>
      {onRetry && (
        <Button
          onClick={onRetry}
          variant="outline"
          className="mt-2 border-red-300 text-red-700 hover:bg-red-100"
        >
          Try Again
        </Button>
      )}
    </div>
  );
}

export function EmptyState({ message, action }: { message: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
      <div className="bg-gray-100 p-4 rounded-full mb-4">
        <Search className="h-8 w-8 text-gray-400" />
      </div>
      <p className="text-gray-600 font-medium mb-4 max-w-md">{message}</p>
      {action}
    </div>
  );
}
