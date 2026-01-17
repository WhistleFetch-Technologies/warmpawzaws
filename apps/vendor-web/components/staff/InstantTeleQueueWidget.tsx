'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Video, Users } from 'lucide-react';

interface InstantTeleQueueWidgetProps {
  staffId: string;
}

export function InstantTeleQueueWidget({ staffId }: InstantTeleQueueWidgetProps) {
  const router = useRouter();
  const [isAvailable, setIsAvailable] = useState(false);
  const [queueCount, setQueueCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStatus();
    const interval = setInterval(loadStatus, 10000); // Refresh every 10 seconds
    return () => clearInterval(interval);
  }, [staffId]);

  const loadStatus = async () => {
    try {
      const response = await apiClient.get<any>(`/staff/${staffId}/tele-availability`);
      if (response.success) {
        setIsAvailable(response.isAvailable);
        setQueueCount(response.queueCount || 0);
      }
    } catch (error) {
      console.error('Error loading tele status:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return null;
  }

  return (
    <Card className="p-4 bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-200">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
            isAvailable ? 'bg-green-100' : 'bg-gray-100'
          }`}>
            <Video className={`w-5 h-5 ${isAvailable ? 'text-green-600' : 'text-gray-400'}`} />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Instant Tele Consultation</h3>
            <p className="text-sm text-gray-600">
              {isAvailable 
                ? `${queueCount} ${queueCount === 1 ? 'customer' : 'customers'} waiting`
                : 'Currently offline'}
            </p>
          </div>
        </div>
        <Button
          onClick={() => router.push('/staff/instant-tele')}
          variant="outline"
          size="sm"
        >
          Manage Queue
        </Button>
      </div>
    </Card>
  );
}
