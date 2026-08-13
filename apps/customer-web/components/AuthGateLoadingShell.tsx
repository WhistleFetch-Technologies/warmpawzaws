'use client';

/** Visible shell while auth/session gates redirect — avoids blank `return null` screens. */
export function AuthGateLoadingShell({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
        <p className="text-gray-600">{message}</p>
      </div>
    </div>
  );
}
