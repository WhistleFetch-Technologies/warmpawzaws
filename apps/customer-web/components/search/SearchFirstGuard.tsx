/**
 * ============================================================================
 * SEARCH-FIRST FLOW GUARD
 * ============================================================================
 * 
 * Route guard component that enforces search-first flow
 * Redirects to search if no valid search context exists
 * 
 * Date: 2026-01-28
 * Phase: 4 - Task 3
 * ============================================================================
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { hasValidSearchContext, getSearchContext } from '@/lib/search-context';

interface SearchFirstGuardProps {
  children: React.ReactNode;
  redirectTo?: string;
  allowDirectAccess?: boolean; // For admin/internal access
}

export function SearchFirstGuard({
  children,
  redirectTo = '/search',
  allowDirectAccess = false,
}: SearchFirstGuardProps) {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);
  const [isAllowed, setIsAllowed] = useState(false);

  useEffect(() => {
    // Allow direct access if flag is set (for admin/internal use)
    if (allowDirectAccess) {
      setIsAllowed(true);
      setIsChecking(false);
      return;
    }

    // Check for valid search context
    const hasContext = hasValidSearchContext();
    
    if (!hasContext) {
      // No search context - redirect to search
      console.log('[SearchFirstGuard] No search context found, redirecting to search');
      router.push(redirectTo);
      return;
    }

    // Search context exists - allow access
    setIsAllowed(true);
    setIsChecking(false);
  }, [router, redirectTo, allowDirectAccess]);

  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Verifying search context...</p>
        </div>
      </div>
    );
  }

  if (!isAllowed) {
    return null; // Will redirect
  }

  return <>{children}</>;
}

/**
 * Hook to check if booking is allowed
 */
export function useSearchFirstGuard() {
  const router = useRouter();
  const [isAllowed, setIsAllowed] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const hasContext = hasValidSearchContext();
    
    if (!hasContext) {
      router.push('/search');
      return;
    }

    setIsAllowed(true);
    setIsChecking(false);
  }, [router]);

  return { isAllowed, isChecking };
}

