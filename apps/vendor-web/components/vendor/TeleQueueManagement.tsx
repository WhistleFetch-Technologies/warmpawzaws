'use client';

/**
 * ============================================================================
 * TELE QUEUE MANAGEMENT - Vendor Side
 * ============================================================================
 * 
 * Allows vendors to view and manage their instant tele consultation queue.
 * - View waiting customers
 * - Accept customers (creates booking with pending_payment)
 * - Skip/remove customers
 * - Real-time updates via SSE
 * 
 * Date: 2026-03-03
 * ============================================================================
 */

import { useState, useEffect, useRef } from 'react';
import { Users, Clock, CheckCircle2, X, AlertCircle, Phone, Video, User, Dog } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { apiClient, getApiBaseUrl } from '@/lib/api-client';
import { toast } from 'sonner';

interface QueueEntry {
  id: string;
  position: number;
  customer: {
    id: string;
    name: string;
    phone: string;
    photo?: string;
  };
  pet: {
    id: string;
    name: string;
    type: string;
    breed?: string;
    age?: number;
  };
  service: {
    id: string;
    name: string;
    price: number;
    durationMinutes: number;
  };
  symptoms?: string;
  urgency: 'normal' | 'urgent';
  notes?: string;
  waitingSince: string;
  expiresAt: string;
  timeInQueue: number; // minutes
}

interface TeleQueueManagementProps {
  vendorId: string;
  onCustomerAccepted?: (bookingId: string, meetingId?: string) => void;
  onBack?: () => void;
}

export function TeleQueueManagement({ vendorId, onCustomerAccepted, onBack }: TeleQueueManagementProps) {
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const loadQueue = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<any>(`/vendor/${vendorId}/tele-queue`);
      if (response.success) {
        setQueue(response.queue || []);
      }
    } catch (error: any) {
      console.error('Error loading queue:', error);
      toast.error('Failed to load queue');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQueue();

    // Set up SSE stream for real-time updates
    const apiBase = getApiBaseUrl();
    const sseUrl = `${apiBase}/vendor/${vendorId}/tele-queue-stream`;

    try {
      const eventSource = new EventSource(sseUrl);
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        console.log('[VendorQueue] SSE connection opened');
      };

      eventSource.addEventListener('queue_update', (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          if (data.queue) {
            setQueue(data.queue);
          }
        } catch (error) {
          console.error('[VendorQueue] Failed to parse queue update:', error);
        }
      });

      eventSource.onerror = (error) => {
        console.error('[VendorQueue] SSE error:', error);
      };
    } catch (error) {
      console.error('[VendorQueue] Failed to create SSE connection:', error);
    }

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [vendorId]);

  const handleAccept = async (queueId: string) => {
    setAccepting(queueId);
    try {
      const response = await apiClient.post<any>(`/vendor/${vendorId}/tele-queue/${queueId}/accept`);
      if (response.success) {
        toast.success('Customer accepted! Booking created. Waiting for payment...');
        onCustomerAccepted?.(response.booking?.id, response.meetingId);
        loadQueue(); // Refresh queue
      } else {
        throw new Error(response.error || 'Failed to accept customer');
      }
    } catch (error: any) {
      console.error('Error accepting customer:', error);
      toast.error(error.message || 'Failed to accept customer');
    } finally {
      setAccepting(null);
    }
  };

  const handleSkip = async (queueId: string, removeFromQueue: boolean = false) => {
    try {
      const response = await apiClient.post<any>(`/vendor/${vendorId}/tele-queue/${queueId}/skip`, {
        reason: 'Skipped by vendor',
        removeFromQueue,
      });
      if (response.success) {
        toast.success(response.message || 'Customer skipped');
        loadQueue();
      }
    } catch (error: any) {
      console.error('Error skipping customer:', error);
      toast.error('Failed to skip customer');
    }
  };

  const formatTime = (minutes: number) => {
    if (minutes < 60) {
      return `${minutes}m`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins > 0 ? `${mins}m` : ''}`;
  };

  if (loading && queue.length === 0) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#FF8C42] mx-auto mb-4" />
          <p className="text-gray-600">Loading queue...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-[#FF8C42] text-white p-4">
        <div className="flex items-center gap-4">
          {onBack && (
            <button onClick={onBack} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
              <X className="w-5 h-5" />
            </button>
          )}
          <div className="flex-1">
            <h1 className="text-xl font-bold">Tele Consultation Queue</h1>
            <p className="text-sm text-white/90">
              {queue.length === 0 ? 'No customers waiting' : `${queue.length} customer${queue.length === 1 ? '' : 's'} waiting`}
            </p>
          </div>
          <button
            onClick={loadQueue}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            title="Refresh"
          >
            <Clock className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Queue List */}
      <div className="p-4 space-y-4">
        {queue.length === 0 ? (
          <Card className="p-8 text-center">
            <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No customers in queue</h3>
            <p className="text-gray-500 text-sm">Customers will appear here when they join the instant tele queue.</p>
          </Card>
        ) : (
          queue.map((entry) => (
            <Card key={entry.id} className="p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start gap-4">
                {/* Customer Photo */}
                <div className="flex-shrink-0">
                  {entry.customer.photo ? (
                    <img
                      src={entry.customer.photo}
                      alt={entry.customer.name}
                      className="w-14 h-14 rounded-full object-cover border-2 border-gray-200"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-orange-100 to-orange-200 flex items-center justify-center border-2 border-gray-200">
                      <User className="w-7 h-7 text-[#FF8C42]" />
                    </div>
                  )}
                </div>

                {/* Customer Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <h3 className="font-bold text-gray-900 text-lg">{entry.customer.name}</h3>
                      <p className="text-sm text-gray-500 flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {entry.customer.phone}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {entry.urgency === 'urgent' && (
                        <Badge variant="destructive" className="text-xs">
                          🚨 Urgent
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-xs">
                        #{entry.position}
                      </Badge>
                    </div>
                  </div>

                  {/* Pet Info */}
                  <div className="flex items-center gap-2 mb-2 text-sm text-gray-600">
                    <Dog className="w-4 h-4" />
                    <span className="font-medium">{entry.pet.name}</span>
                    <span className="text-gray-400">•</span>
                    <span>{entry.pet.type}</span>
                    {entry.pet.breed && (
                      <>
                        <span className="text-gray-400">•</span>
                        <span>{entry.pet.breed}</span>
                      </>
                    )}
                  </div>

                  {/* Service Info */}
                  <div className="mb-2">
                    <p className="text-sm font-medium text-gray-900">{entry.service.name}</p>
                    <p className="text-xs text-gray-500">
                      ₹{entry.service.price} • {entry.service.durationMinutes} minutes
                    </p>
                  </div>

                  {/* Symptoms */}
                  {entry.symptoms && (
                    <div className="mb-2 p-2 bg-gray-50 rounded-lg">
                      <p className="text-xs font-medium text-gray-700 mb-1">Symptoms:</p>
                      <p className="text-xs text-gray-600">{entry.symptoms}</p>
                    </div>
                  )}

                  {/* Waiting Time */}
                  <div className="flex items-center gap-4 text-xs text-gray-500 mb-3">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Waiting: {formatTime(entry.timeInQueue)}
                    </span>
                    <span>Joined: {new Date(entry.waitingSince).toLocaleTimeString()}</span>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleAccept(entry.id)}
                      disabled={accepting === entry.id}
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                    >
                      {accepting === entry.id ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                          Accepting...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4 mr-2" />
                          Accept & Create Booking
                        </>
                      )}
                    </Button>
                    <Button
                      onClick={() => handleSkip(entry.id, true)}
                      variant="outline"
                      className="text-red-600 border-red-200 hover:bg-red-50"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
