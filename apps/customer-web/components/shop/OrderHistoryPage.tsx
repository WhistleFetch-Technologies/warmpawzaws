"use client";

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

interface OrderHistoryPageProps {
  onNavigate?: (path: string) => void;
}

export function OrderHistoryPage({ onNavigate }: OrderHistoryPageProps = {}) {
  const router = useRouter();

  useEffect(() => {
    // Redirect to the actual orders page
    router.push('/orders');
  }, [router]);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Order History</h1>
      <p className="text-gray-500">Redirecting to orders page...</p>
    </div>
  );
}

