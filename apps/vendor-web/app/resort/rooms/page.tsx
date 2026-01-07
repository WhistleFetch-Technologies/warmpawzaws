'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { ArrowLeft, Plus, Edit2, Trash2, BedDouble } from 'lucide-react';
import { BoardingRoomManager } from '@/components/vendor/BoardingRoomManager';

export default function ResortRoomsPage() {
  const router = useRouter();
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const id = localStorage.getItem('vendorId');
    if (!id) {
      router.push('/');
      return;
    }
    setVendorId(id);
    setLoading(false);
  }, [router]);

  if (loading || !vendorId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <BoardingRoomManager
        vendorId={vendorId}
        vendorName="Resort"
        onBack={() => router.back()}
      />
    </div>
  );
}

