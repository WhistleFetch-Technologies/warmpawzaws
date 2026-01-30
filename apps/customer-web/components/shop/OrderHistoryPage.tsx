"use client";

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

interface OrderHistoryPageProps {
  onBack?: () => void;
  onNavigate?: (path: string) => void;
}

export function OrderHistoryPage({ onBack, onNavigate }: OrderHistoryPageProps = {}) {
  const router = useRouter();

  useEffect(() => {
    // Redirect to the actual orders page
    router.push('/orders');
  }, [router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50">
      <div className="bg-gradient-to-r from-[#FF8C42] via-[#FF7A35] to-[#FF6B35] text-white px-4 py-4 rounded-b-2xl shadow-md">
        <div className="flex items-center gap-3">
          {onBack && (
            <Button variant="ghost" size="icon" onClick={onBack} className="rounded-full text-white hover:bg-white/20" aria-label="Go back">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          )}
          <h1 className="text-xl font-bold text-white">Order History</h1>
        </div>
      </div>
      <div className="p-6">
        <p className="text-gray-600">Redirecting to orders page...</p>
      </div>
    </div>
  );
}

