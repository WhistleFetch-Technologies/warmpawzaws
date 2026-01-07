'use client';

import React, { Suspense } from 'react';
import CheckInContent from './CheckInContent';

function LoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
    </div>
  );
}

export default function CheckInPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <CheckInContent />
    </Suspense>
  );
}
