'use client';

import { useState, useEffect, useRef } from 'react';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Video, Clock, Users, AlertCircle, CheckCircle2, X, User, Dog, Phone } from 'lucide-react';

interface Provider {
  staffId: string;
  name: string;
  photo?: string;
  role: string;
  experienceYears?: number;
  rating?: string;
  reviewCount: number;
  queueCount: number;
  estimatedWaitMinutes: number;
  services: Array<{
    id: string;
    name: string;
    price: number;
    duration: number;
  }>;
}

interface QueueStatus {
  id: string;
  position: number;
  aheadInQueue: number;
  status: 'waiting' | 'accepted' | 'expired' | 'cancelled' | 'skipped' | 'provider_offline';
  expiresAt: string;
  estimatedWaitMinutes: number;
  service: {
    name: string;
    price: number;
    durationMinutes: number;
  };
  staff: {
    id: string;
    name: string;
    photo?: string;
  };
  bookingId?: string;
  meetingId?: string;
}

interface InstantTeleQueueProps {
  customerId: string;
  petId: string;
  roleId?: string;
  category?: string;
  serviceId?: string;
  onQueueJoined?: (queueId: string) => void;
  onAccepted?: (bookingId: string, meetingId?: string) => void;
}

export function InstantTeleQueue({
  customerId,
  petId,
  roleId,
  category,
  serviceId,
  onQueueJoined,
  onAccepted,
}: InstantTeleQueueProps) {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);
  const [queueStatus, setQueueStatus] = useState<QueueStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [joiningQueue, setJoiningQueue] = useState(false);
  const [symptoms, setSymptoms] = useState('');
  const [urgency, setUrgency] = useState<'normal' | 'urgent'>('normal');
  const [notes, setNotes] = useState('');
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(serviceId || null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const [showProviderList, setShowProviderList] = useState(true);

  // Get API base URL
  const getApiBaseUrl = () => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('api_base_url') || process.env.NEXT_PUBLIC_API_URL || '';
    }
    return process.env.NEXT_PUBLIC_API_URL || '';
  };

  useEffect(() => {
    loadAvailableProviders();

    // Check if user has active queue entry
    // This would be loaded from a persisted state or API
    const activeQueueId = localStorage.getItem('activeTeleQueueId');
    if (activeQueueId) {
      loadQueueStatus(activeQueueId);
    }

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [roleId, category, serviceId]);

  const loadAvailableProviders = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (roleId) params.set('roleId', roleId);
      if (category) params.set('category', category);
      if (serviceId) params.set('serviceId', serviceId);

      const response = await apiClient.get<any>(
        `/customer/tele/available-providers?${params.toString()}`
      );

      if (response.success) {
        setProviders(response.providers || []);
        if (response.providers && response.providers.length === 0) {
          toast.info('No providers are currently available for instant consultations');
        }
      }
    } catch (error: any) {
      console.error('Error loading providers:', error);
      toast.error('Failed to load available providers');
    } finally {
      setLoading(false);
    }
  };

  const loadQueueStatus = async (queueId: string) => {
    try {
      const response = await apiClient.get<any>(`/customer/tele/queue-status/${queueId}`);
      if (response.success) {
        setQueueStatus(response.queueEntry);
        setShowProviderList(false);
        
        // If accepted, notify parent
        if (response.queueEntry.status === 'accepted' && response.queueEntry.bookingId) {
          onAccepted?.(response.queueEntry.bookingId, response.queueEntry.meetingId);
        }
        
        // Set up SSE stream for real-time updates
        setupQueueStream(queueId);
      }
    } catch (error: any) {
      console.error('Error loading queue status:', error);
    }
  };

  const setupQueueStream = (queueId: string) => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const apiBase = getApiBaseUrl();
    const sseUrl = `${apiBase}/customer/tele/queue-stream/${queueId}`;

    try {
      const eventSource = new EventSource(sseUrl);
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        console.log('[TeleQueue] SSE connection opened');
      };

      eventSource.addEventListener('queue_update', (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          if (data.queueEntry) {
            setQueueStatus(data.queueEntry);
          }
        } catch (error) {
          console.error('[TeleQueue] Failed to parse queue update:', error);
        }
      });

      eventSource.addEventListener('accepted', (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          toast.success('Your consultation has been accepted! Preparing video call...');
          setQueueStatus(prev => prev ? { ...prev, status: 'accepted', bookingId: data.bookingId } : null);
          onAccepted?.(data.bookingId, data.meetingId);
          
          // Close stream after acceptance
          setTimeout(() => {
            if (eventSourceRef.current) {
              eventSourceRef.current.close();
            }
          }, 2000);
        } catch (error) {
          console.error('[TeleQueue] Failed to parse acceptance:', error);
        }
      });

      eventSource.addEventListener('ended', (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          toast.error(data.message || 'Queue entry ended');
          setQueueStatus(null);
          localStorage.removeItem('activeTeleQueueId');
          setShowProviderList(true);
        } catch (error) {
          console.error('[TeleQueue] Failed to parse ended event:', error);
        }
      });

      eventSource.onerror = (error) => {
        console.error('[TeleQueue] SSE error:', error);
      };
    } catch (error) {
      console.error('[TeleQueue] Failed to create SSE connection:', error);
    }
  };

  const joinQueue = async (provider: Provider) => {
    if (!selectedServiceId) {
      toast.error('Please select a service first');
      return;
    }

    setJoiningQueue(true);
    try {
      const response = await apiClient.post<any>('/customer/tele/join-queue', {
        customerId,
        staffId: provider.staffId,
        petId,
        serviceId: selectedServiceId,
        symptoms: symptoms.trim() || undefined,
        urgency,
        notes: notes.trim() || undefined,
      });

      if (response.success) {
        if (response.alreadyInQueue) {
          toast.info('You are already in queue for this provider');
          loadQueueStatus(response.queueEntry.id);
        } else {
          toast.success(response.message || 'You have joined the queue!');
          localStorage.setItem('activeTeleQueueId', response.queueEntry.id);
          loadQueueStatus(response.queueEntry.id);
          onQueueJoined?.(response.queueEntry.id);
        }
      } else {
        throw new Error(response.error || 'Failed to join queue');
      }
    } catch (error: any) {
      console.error('Error joining queue:', error);
      
      if (error.providerOffline) {
        toast.error('Provider is no longer available. Please select another provider.');
        loadAvailableProviders();
      } else if (error.queueFull) {
        toast.error('Queue is full. Please try again later.');
      } else {
        toast.error(error.message || 'Failed to join queue');
      }
    } finally {
      setJoiningQueue(false);
    }
  };

  const leaveQueue = async () => {
    if (!queueStatus) return;

    try {
      await apiClient.delete(`/customer/tele/leave-queue/${queueStatus.id}`);
      toast.success('You have left the queue');
      setQueueStatus(null);
      localStorage.removeItem('activeTeleQueueId');
      setShowProviderList(true);
      
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    } catch (error: any) {
      console.error('Error leaving queue:', error);
      toast.error('Failed to leave queue');
    }
  };

  const formatTime = (minutes: number) => {
    if (minutes < 60) {
      return `${minutes} minutes`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins > 0 ? `${mins}m` : ''}`;
  };

  // Show queue status if in queue
  if (queueStatus && !showProviderList) {
    return (
      <Card className="p-6">
        <div className="space-y-4">
          {/* Queue Status Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Waiting in Queue
                </h3>
                <p className="text-sm text-gray-500">
                  {queueStatus.staff.name} - {queueStatus.service.name}
                </p>
              </div>
            </div>
            <Button
              onClick={leaveQueue}
              variant="outline"
              size="sm"
              className="text-red-600 border-red-200 hover:bg-red-50"
            >
              <X className="w-4 h-4 mr-2" />
              Leave Queue
            </Button>
          </div>

          {/* Queue Position */}
          {queueStatus.status === 'waiting' && (
            <>
              <div className="bg-blue-50 rounded-lg p-6 text-center">
                <div className="text-4xl font-bold text-blue-600 mb-2">
                  #{queueStatus.position}
                </div>
                <p className="text-sm text-gray-600 mb-4">
                  {queueStatus.aheadInQueue === 0
                    ? "You're next!"
                    : `${queueStatus.aheadInQueue} ${queueStatus.aheadInQueue === 1 ? 'person' : 'people'} ahead of you`}
                </p>
                <div className="flex items-center justify-center gap-2 text-gray-600">
                  <Clock className="w-4 h-4" />
                  <span className="text-sm">
                    Estimated wait: {formatTime(queueStatus.estimatedWaitMinutes)}
                  </span>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                  <AlertCircle className="w-4 h-4" />
                  <span className="font-medium">What happens next?</span>
                </div>
                <ul className="text-sm text-gray-600 space-y-1 ml-6 list-disc">
                  <li>You'll be notified when the provider accepts your request</li>
                  <li>The video call will start automatically</li>
                  <li>You can leave the queue anytime before acceptance</li>
                </ul>
              </div>
            </>
          )}

          {/* Accepted Status */}
          {queueStatus.status === 'accepted' && (
            <div className="bg-green-50 rounded-lg p-6 text-center border-2 border-green-200">
              <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto mb-3" />
              <h4 className="text-lg font-semibold text-green-900 mb-2">
                Consultation Accepted!
              </h4>
              <p className="text-sm text-green-700 mb-4">
                {queueStatus.staff.name} has accepted your request. Preparing video call...
              </p>
              {queueStatus.bookingId && (
                <Button
                  onClick={() => onAccepted?.(queueStatus.bookingId!, queueStatus.meetingId)}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  <Video className="w-4 h-4 mr-2" />
                  Start Video Call
                </Button>
              )}
            </div>
          )}

          {/* Error States */}
          {queueStatus.status === 'expired' && (
            <div className="bg-yellow-50 rounded-lg p-6 text-center border-2 border-yellow-200">
              <AlertCircle className="w-12 h-12 text-yellow-600 mx-auto mb-3" />
              <h4 className="text-lg font-semibold text-yellow-900 mb-2">
                Queue Entry Expired
              </h4>
              <p className="text-sm text-yellow-700 mb-4">
                Your queue entry has expired. Please join again to get in line.
              </p>
              <Button
                onClick={() => {
                  setQueueStatus(null);
                  setShowProviderList(true);
                }}
                variant="outline"
              >
                Select Provider Again
              </Button>
            </div>
          )}

          {queueStatus.status === 'provider_offline' && (
            <div className="bg-gray-50 rounded-lg p-6 text-center border-2 border-gray-200">
              <AlertCircle className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <h4 className="text-lg font-semibold text-gray-900 mb-2">
                Provider Went Offline
              </h4>
              <p className="text-sm text-gray-700 mb-4">
                The provider is no longer available. Please select another provider.
              </p>
              <Button
                onClick={() => {
                  setQueueStatus(null);
                  setShowProviderList(true);
                  loadAvailableProviders();
                }}
                variant="outline"
              >
                Select Another Provider
              </Button>
            </div>
          )}
        </div>
      </Card>
    );
  }

  // Show provider selection
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
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
            <Video className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Instant Tele Consultation
            </h2>
            <p className="text-sm text-gray-500">
              Connect with available providers instantly via video call
            </p>
          </div>
        </div>

        {providers.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg">
            <Video className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-500 font-medium mb-1">
              No providers available right now
            </p>
            <p className="text-sm text-gray-400">
              Try again later or book a scheduled consultation
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {providers.map((provider) => (
              <div
                key={provider.staffId}
                className={`p-4 rounded-lg border-2 ${
                  selectedProvider?.staffId === provider.staffId
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 bg-white'
                }`}
              >
                <div className="flex items-start gap-4">
                  {/* Provider Avatar */}
                  {provider.photo ? (
                    <img
                      src={provider.photo}
                      alt={provider.name}
                      className="w-16 h-16 rounded-full object-cover border-2 border-gray-200"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center">
                      <User className="w-8 h-8 text-blue-600" />
                    </div>
                  )}

                  {/* Provider Info */}
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="font-semibold text-gray-900">{provider.name}</h3>
                        <p className="text-sm text-gray-500">{provider.role}</p>
                      </div>
                      <div className="text-right">
                        {provider.rating && (
                          <div className="flex items-center gap-1 text-sm">
                            <span className="font-medium">{provider.rating}</span>
                            <span className="text-gray-400">
                              ({provider.reviewCount} reviews)
                            </span>
                          </div>
                        )}
                        {provider.queueCount > 0 && (
                          <Badge variant="secondary" className="mt-1 bg-yellow-100 text-yellow-700">
                            {provider.queueCount} in queue
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Services */}
                    <div className="mb-3">
                      <p className="text-xs text-gray-500 mb-2">Available Services:</p>
                      <div className="flex flex-wrap gap-2">
                        {provider.services.map((service) => (
                          <button
                            key={service.id}
                            onClick={() => {
                              setSelectedServiceId(service.id);
                              setSelectedProvider(provider);
                            }}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
                              selectedProvider?.staffId === provider.staffId &&
                              selectedServiceId === service.id
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            {service.name} - ₹{service.price}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Queue Info */}
                    {provider.queueCount > 0 && (
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {provider.queueCount} waiting
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Est. wait: {formatTime(provider.estimatedWaitMinutes)}
                        </span>
                      </div>
                    )}

                    {/* Join Queue Form */}
                    {selectedProvider?.staffId === provider.staffId && selectedServiceId && (
                      <div className="mt-4 pt-4 border-t border-gray-200 space-y-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Symptoms/Reason (Optional)
                          </label>
                          <textarea
                            value={symptoms}
                            onChange={(e) => setSymptoms(e.target.value)}
                            placeholder="Brief description of why you need consultation..."
                            rows={2}
                            className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Urgency
                          </label>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setUrgency('normal')}
                              className={`px-4 py-2 rounded-lg text-sm font-medium ${
                                urgency === 'normal'
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-gray-100 text-gray-700'
                              }`}
                            >
                              Normal
                            </button>
                            <button
                              onClick={() => setUrgency('urgent')}
                              className={`px-4 py-2 rounded-lg text-sm font-medium ${
                                urgency === 'urgent'
                                  ? 'bg-red-600 text-white'
                                  : 'bg-gray-100 text-gray-700'
                              }`}
                            >
                              Urgent
                            </button>
                          </div>
                        </div>
                        <Button
                          onClick={() => joinQueue(provider)}
                          disabled={joiningQueue}
                          className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                        >
                          {joiningQueue ? (
                            'Joining Queue...'
                          ) : (
                            <>
                              <Users className="w-4 h-4 mr-2" />
                              Join Queue
                            </>
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
