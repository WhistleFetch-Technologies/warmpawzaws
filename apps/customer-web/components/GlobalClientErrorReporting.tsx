'use client';

import { useEffect } from 'react';
import { registerGlobalClientErrorHandlers } from '@/lib/client-error-reporting';

/** Registers Allyticas reporting for uncaught JS errors and unhandled promise rejections. */
export function GlobalClientErrorReporting() {
  useEffect(() => {
    registerGlobalClientErrorHandlers();
  }, []);
  return null;
}
