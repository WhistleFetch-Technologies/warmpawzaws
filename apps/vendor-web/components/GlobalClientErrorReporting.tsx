'use client';

import { useEffect } from 'react';
import { registerGlobalVendorErrorHandlers } from '@/lib/client-error-reporting';

export function GlobalClientErrorReporting() {
  useEffect(() => {
    registerGlobalVendorErrorHandlers();
  }, []);
  return null;
}
