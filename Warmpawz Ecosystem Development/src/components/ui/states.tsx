import React from 'react';
import { Loader2, AlertCircle, Search } from 'lucide-react';
import { Button } from './button';

export function LoadingState({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12">
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
