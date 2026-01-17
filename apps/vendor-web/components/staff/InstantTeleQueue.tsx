'use client';

import { useState, useEffect, useRef } from 'react';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Video, Users, Clock, Phone, CheckCircle2, XCircle, AlertCircle, User, Dog } from 'lucide-react';

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
    name: string;
    price: number;
  };
  symptoms?: string;
  urgency: 'normal' | 'urgent';
  notes?: string;
  waitingSince: string;
  timeInQueue: number;
}

interface InstantTeleQueueProps {
  staffId: string;
}

export function InstantTeleQueue({ staffId }: InstantTeleQueueProps) {
  const [isAvailable, setIsAvailable] = useState(false);
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingAvailability, setTogglingAvailability] = useState(false);
  const [acceptingQueueId, setAcceptingQueueId] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Get API base URL
  const getApiBaseUrl = () => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('api_base_url') || process.env.NEXT_PUBLIC_API_URL || '';
    }
    return process.env.NEXT_PUBLIC_API_URL || '';
  };

  // Load initial availability status
  useEffect(() => {
    loadAvailability();
    loadQueue();

    // Set up SSE stream for real-time queue updates
    setupQueueStream();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [staffId]);

  const loadAvailability = async () => {
    try {
      const response = await apiClient.get<any>(`/staff/${staffId}/tele-availability`);
      if (response.success) {
        setIsAvailable(response.isAvailable);
      }
    } catch (error: any) {
      console.error('Error loading availability:', error);
      toast.error('Failed to load availability status');
    } finally {
      setLoading(false);
    }
  };

  const loadQueue = async () => {
    try {
      const response = await apiClient.get<any>(`/staff/${staffId}/tele-queue`);
      if (response.success) {
        setQueue(response.queue || []);
      }
    } catch (error: any) {
      console.error('Error loading queue:', error);
    }
  };

  const setupQueueStream = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const apiBase = getApiBaseUrl();
    const sseUrl = `${apiBase}/staff/${staffId}/tele-queue-stream`;

    try {
      const eventSource = new EventSource(sseUrl);
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        console.log('[TeleQueue] SSE connection opened');
      };

      eventSource.addEventListener('queue_update', (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          if (data.queue) {
            setQueue(data.queue);
          }
        } catch (error) {
          console.error('[TeleQueue] Failed to parse queue update:', error);
        }
      });

      eventSource.onerror = (error) => {
        console.error('[TeleQueue] SSE error:', error);
        // Attempt reconnection after delay
        setTimeout(() => {
          if (eventSourceRef.current?.readyState === EventSource.CLOSED) {
            setupQueueStream();
          }
        }, 5000);
      };
    } catch (error) {
      console.error('[TeleQueue] Failed to create SSE connection:', error);
    }
  };

  const toggleAvailability = async () => {
    setTogglingAvailability(true);
    try {
      const newStatus = !isAvailable;
      const response = await apiClient.put<any>(`/staff/${staffId}/tele-availability`, {
        isAvailable: newStatus,
      });

      if (response.success) {
        setIsAvailable(newStatus);
        toast.success(
          newStatus
            ? 'You are now available for instant tele consultations'
            : 'You are now offline'
        );
        
        // Reload queue if going online
        if (newStatus) {
          loadQueue();
        } else {
          setQueue([]);
        }
      } else {
        throw new Error(response.error || 'Failed to update availability');
      }
    } catch (error: any) {
      console.error('Error toggling availability:', error);
      
      if (error.requiresVerification) {
        toast.error('Mobile verification required to go live for instant consultations');
      } else if (error.noTeleServices) {
        toast.error('Please enable tele services for this staff member first');
      } else {
        toast.error(error.message || 'Failed to update availability');
      }
    } finally {
      setTogglingAvailability(false);
    }
  };

  const acceptCustomer = async (queueId: string) => {
    setAcceptingQueueId(queueId);
    try {
      const response = await apiClient.post<any>(`/staff/${staffId}/tele-queue/${queueId}/accept`);

      if (response.success) {
        toast.success('Customer accepted! Booking created. Ready to start video call.');
        
        // Remove from queue
        setQueue(prev => prev.filter(q => q.id !== queueId));
        
        // Optionally navigate to video call or booking page
        // router.push(`/bookings/${response.booking.id}`);
      } else {
        throw new Error(response.error || 'Failed to accept customer');
      }
    } catch (error: any) {
      console.error('Error accepting customer:', error);
      toast.error(error.message || 'Failed to accept customer');
    } finally {
      setAcceptingQueueId(null);
    }
  };

  const skipCustomer = async (queueId: string, removeFromQueue: boolean = false) => {
    try {
      const response = await apiClient.post<any>(`/staff/${staffId}/tele-queue/${queueId}/skip`, {
        reason: 'Skipped by provider',
        removeFromQueue,
      });

      if (response.success) {
        if (removeFromQueue) {
          setQueue(prev => prev.filter(q => q.id !== queueId));
          toast.success('Customer removed from queue');
        } else {
          loadQueue(); // Reload to get updated positions
          toast.success('Customer moved to end of queue');
        }
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
    return `${hours}h ${mins}m`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="h-24 bg-gray-200 rounded"></div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Availability Toggle */}
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
              isAvailable ? 'bg-green-100' : 'bg-gray-100'
            }`}>
              <Video className={`w-6 h-6 ${isAvailable ? 'text-green-600' : 'text-gray-400'}`} />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                Instant Tele Consultation
              </h3>
              <p className="text-sm text-gray-500">
                {isAvailable 
                  ? 'You are available for instant video consultations'
                  : 'Toggle to start accepting instant consultations'}
              </p>
            </div>
          </div>
          <Button
            onClick={toggleAvailability}
            disabled={togglingAvailability}
            className={`${
              isAvailable
                ? 'bg-green-600 hover:bg-green-700'
                : 'bg-gray-600 hover:bg-gray-700'
            } text-white`}
          >
            {togglingAvailability ? (
              'Updating...'
            ) : isAvailable ? (
              <>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Available Now
              </>
            ) : (
              <>
                <XCircle className="w-4 h-4 mr-2" />
                Go Offline
              </>
            )}
          </Button>
        </div>
      </Card>

      {/* Queue List */}
      {isAvailable && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Users className="w-5 h-5" />
              Waiting Queue ({queue.length})
            </h3>
            {queue.length > 0 && (
              <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                {queue.length} {queue.length === 1 ? 'customer' : 'customers'} waiting
              </Badge>
            )}
          </div>

          {queue.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <Users className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No customers in queue</p>
              <p className="text-sm text-gray-400 mt-1">
                Customers will appear here when they request instant consultations
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {queue.map((entry) => (
                <div
                  key={entry.id}
                  className={`p-4 rounded-lg border-2 ${
                    entry.urgency === 'urgent'
                      ? 'border-red-200 bg-red-50'
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <Badge
                          variant="outline"
                          className="bg-white font-mono text-sm"
                        >
                          #{entry.position}
                        </Badge>
                        {entry.urgency === 'urgent' && (
                          <Badge variant="destructive" className="bg-red-600">
                            <AlertCircle className="w-3 h-3 mr-1" />
                            Urgent
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-4 mb-3">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-gray-400" />
                          <span className="font-medium text-gray-900">
                            {entry.customer.name}
                          </span>
                          <a
                            href={`tel:${entry.customer.phone}`}
                            className="text-blue-600 hover:text-blue-700"
                          >
                            <Phone className="w-4 h-4" />
                          </a>
                        </div>
                        <div className="flex items-center gap-2">
                          <Dog className="w-4 h-4 text-gray-400" />
                          <span className="text-sm text-gray-600">
                            {entry.pet.name} ({entry.pet.type})
                          </span>
                        </div>
                      </div>

                      <div className="space-y-1 text-sm text-gray-600">
                        <div>
                          <span className="font-medium">Service:</span>{' '}
                          {entry.service.name} - ₹{entry.service.price}
                        </div>
                        {entry.symptoms && (
                          <div>
                            <span className="font-medium">Symptoms:</span>{' '}
                            {entry.symptoms}
                          </div>
                        )}
                        {entry.notes && (
                          <div>
                            <span className="font-medium">Notes:</span> {entry.notes}
                          </div>
                        )}
                        <div className="flex items-center gap-4 text-xs text-gray-500 mt-2">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Waiting {formatTime(entry.timeInQueue)}
                          </span>
                          <span>Since {formatDate(entry.waitingSince)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 ml-4">
                      <Button
                        onClick={() => acceptCustomer(entry.id)}
                        disabled={acceptingQueueId === entry.id}
                        className="bg-green-600 hover:bg-green-700 text-white"
                        size="sm"
                      >
                        {acceptingQueueId === entry.id ? (
                          'Accepting...'
                        ) : (
                          <>
                            <CheckCircle2 className="w-4 h-4 mr-1" />
                            Accept
                          </>
                        )}
                      </Button>
                      <Button
                        onClick={() => skipCustomer(entry.id, false)}
                        variant="outline"
                        size="sm"
                        className="text-gray-600"
                      >
                        Skip
                      </Button>
                      <Button
                        onClick={() => skipCustomer(entry.id, true)}
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:text-red-700"
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {!isAvailable && queue.length === 0 && (
        <Card className="p-6 bg-blue-50 border-blue-200">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
            <div>
              <h4 className="font-medium text-blue-900 mb-1">
                Go Live to Accept Instant Consultations
              </h4>
              <p className="text-sm text-blue-700">
                Toggle "Available Now" above to start accepting instant tele consultations.
                Customers will join your queue and you can accept them when ready.
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
