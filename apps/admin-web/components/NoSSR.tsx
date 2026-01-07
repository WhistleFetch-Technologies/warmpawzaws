'use client';

import { useEffect, useState } from 'react';

/**
 * NoSSR - Prevents component from rendering during static generation
 * Use this to wrap components that use client-side features (context, localStorage, etc.)
 */
export function NoSSR({ children }: { children: React.ReactNode }) {
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  if (!hasMounted) {
    return null;
  }

  return <>{children}</>;
}

