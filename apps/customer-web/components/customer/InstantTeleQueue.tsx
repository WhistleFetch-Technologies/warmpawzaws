'use client';

import { useState, useEffect, useRef } from 'react';
import { apiClient, getApiBaseUrl } from '@/lib/api-client';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Video, Clock, Users, AlertCircle, CheckCircle2, X, User, Dog, Phone, ArrowLeft } from 'lucide-react';

interface Provider {
  staffId?: string;
  providerId?: string; // ✅ FIX: Support both staff and vendor providers
  vendorId?: string;
  providerType?: 'staff' | 'vendor';
  name: string;
  photo?: string;
  role: string;
  experienceYears?: number;
  qualifications?: string;
  businessName?: string;
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
  problemId?: string; // ✅ NEW: Filter by problem/concern
  availableInMinutes?: number; // ✅ NEW: Filter by availability (default: 5 min)
  showHorizontalScroll?: boolean; // ✅ NEW: Show providers in horizontal scroll
  onBack?: () => void; // ✅ NEW: Back button handler
  onQueueJoined?: (queueId: string) => void;
  onAccepted?: (bookingId: string, meetingId?: string) => void;
}

export function InstantTeleQueue({
  customerId,
  petId,
  roleId,
  category,
  serviceId,
  problemId,
  availableInMinutes = 5,
  showHorizontalScroll = false,
  onBack,
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
      // ✅ NEW: Add problem filter
      if (problemId) params.set('problemId', problemId);
      // ✅ NEW: Add availability filter (available in next N minutes)
      if (availableInMinutes) params.set('availableIn', availableInMinutes.toString());

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
      // ✅ FIX: Use providerId or staffId depending on provider type
      const staffIdValue = provider.providerId || provider.staffId;
      
      const response = await apiClient.post<any>('/customer/tele/join-queue', {
        customerId,
        staffId: staffIdValue,
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
    <>
      {/* Header is provided by renderScreenWithLayout wrapper (StandardizedHeader) */}

      {/* ✅ Fixed: Changed from -mt-4 to -mt-6 to prevent overlap, added z-index */}
      <div className="px-4 -mt-6 relative z-10">
        {/* ✅ NEW: Available in N minutes badge */}
        {availableInMinutes && (
          <div className="mb-4 flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-100 text-green-700 rounded-full text-sm font-medium">
              <Clock className="w-4 h-4" />
              Available in next {availableInMinutes} min
            </div>
            <span className="text-xs text-gray-500">
              {providers.length} providers online
            </span>
          </div>
        )}

        {/* ✅ NEW: "One provider will be assigned" message for auto-assign mode */}
        {showHorizontalScroll && providers.length > 0 && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-xl">
            <p className="text-sm text-blue-800">
              <span className="font-semibold">💡 Quick Start:</span> One of these providers will be assigned once you confirm. 
              Or scroll to select a specific provider.
            </p>
          </div>
        )}

        {providers.length === 0 ? (
          <div className="text-center py-16 bg-gray-50 rounded-2xl border border-gray-100">
            <Video className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 font-semibold mb-2">No providers available right now</p>
            <p className="text-sm text-gray-400">Try again later or book a scheduled consultation</p>
            <Button 
              onClick={loadAvailableProviders}
              className="mt-4 bg-[#FF8C42] hover:bg-[#FF7A35] text-white"
            >
              Refresh
            </Button>
          </div>
        ) : showHorizontalScroll ? (
          /* ✅ NEW: Horizontal scroll layout for instant providers */
          <div className="space-y-4">
            <p className="text-sm text-gray-600 mb-2">
              Instantly available providers
            </p>
            
            <div className="flex gap-3 overflow-x-auto pb-4 -mx-1 px-1">
              {providers.map((provider) => {
                const isProviderSelected = selectedProvider?.staffId === provider.staffId || 
                                           selectedProvider?.providerId === (provider as any).providerId;
                
                return (
                  <div
                    key={provider.staffId || (provider as any).providerId}
                    className={`flex-shrink-0 w-40 rounded-2xl border-2 overflow-hidden transition-all cursor-pointer ${
                      isProviderSelected
                        ? 'border-[#FF8C42] bg-orange-50 shadow-lg'
                        : 'border-gray-200 bg-white hover:border-orange-200 hover:shadow-md'
                    }`}
                    onClick={() => {
                      setSelectedProvider(provider);
                      if (provider.services && provider.services.length > 0) {
                        setSelectedServiceId(provider.services[0].id);
                      }
                    }}
                  >
                    <div className="p-3 text-center">
                      {/* Avatar */}
                      {provider.photo ? (
                        <img
                          src={provider.photo}
                          alt={provider.name}
                          className="w-16 h-16 rounded-full object-cover border-2 border-gray-200 mx-auto mb-2"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-orange-100 to-orange-200 flex items-center justify-center mx-auto mb-2">
                          <User className="w-8 h-8 text-[#FF8C42]" />
                        </div>
                      )}
                      
                      <h3 className="font-bold text-gray-900 text-sm truncate">{provider.name}</h3>
                      <p className="text-xs text-gray-500 truncate">{provider.role}</p>
                      
                      {/* Rating */}
                      {provider.rating && (
                        <div className="flex items-center justify-center gap-1 mt-1">
                          <span className="text-yellow-500 text-xs">★</span>
                          <span className="text-xs font-medium">{provider.rating}</span>
                        </div>
                      )}
                      
                      {/* Queue info */}
                      {provider.queueCount > 0 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full text-xs mt-2">
                          <Users className="w-3 h-3" />
                          {provider.queueCount} waiting
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs mt-2">
                          Available now
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Selected provider details */}
            {selectedProvider && selectedServiceId && (
              <div className="bg-orange-50 border-2 border-[#FF8C42] rounded-2xl p-4 space-y-4">
                <div className="flex items-center gap-3">
                  {selectedProvider.photo ? (
                    <img src={selectedProvider.photo} alt={selectedProvider.name} className="w-12 h-12 rounded-full object-cover" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-orange-200 flex items-center justify-center">
                      <User className="w-6 h-6 text-[#FF8C42]" />
                    </div>
                  )}
                  <div>
                    <h3 className="font-bold text-gray-900">{selectedProvider.name}</h3>
                    <p className="text-sm text-gray-500">{selectedProvider.role}</p>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Symptoms/Reason (Optional)
                  </label>
                  <textarea
                    value={symptoms}
                    onChange={(e) => setSymptoms(e.target.value)}
                    placeholder="Brief description..."
                    rows={2}
                    className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#FF8C42]"
                  />
                </div>
                
                <Button
                  onClick={() => joinQueue(selectedProvider)}
                  disabled={joiningQueue}
                  className="w-full bg-[#FF8C42] hover:bg-[#FF7A35] text-white h-12 rounded-xl"
                >
                  {joiningQueue ? 'Joining...' : 'Join Queue & Start Consultation'}
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 mb-2">
              Select a provider and service to join the queue
            </p>
            
            {providers.map((provider) => {
              const isProviderSelected = selectedProvider?.staffId === provider.staffId || 
                                         selectedProvider?.providerId === (provider as any).providerId;
              
              return (
                <div
                  key={provider.staffId || (provider as any).providerId}
                  className={`rounded-2xl border-2 overflow-hidden transition-all cursor-pointer ${
                    isProviderSelected
                      ? 'border-[#FF8C42] bg-orange-50 shadow-lg'
                      : 'border-gray-200 bg-white hover:border-orange-200 hover:shadow-md'
                  }`}
                  onClick={() => {
                    if (!isProviderSelected) {
                      setSelectedProvider(provider);
                      // Auto-select first service
                      if (provider.services && provider.services.length > 0) {
                        setSelectedServiceId(provider.services[0].id);
                      }
                    }
                  }}
                >
                  <div className="p-4">
                    <div className="flex items-start gap-4">
                      {/* Provider Avatar */}
                      {provider.photo ? (
                        <img
                          src={provider.photo}
                          alt={provider.name}
                          className="w-14 h-14 rounded-full object-cover border-2 border-gray-200"
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-orange-100 to-orange-200 flex items-center justify-center flex-shrink-0">
                          <User className="w-7 h-7 text-[#FF8C42]" />
                        </div>
                      )}

                      {/* Provider Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h3 className="font-bold text-gray-900 text-lg">{provider.name}</h3>
                            <p className="text-sm text-gray-500">{provider.role}</p>
                          </div>
                          {isProviderSelected && (
                            <div className="w-6 h-6 rounded-full bg-[#FF8C42] flex items-center justify-center flex-shrink-0">
                              <CheckCircle2 className="w-4 h-4 text-white" />
                            </div>
                          )}
                        </div>

                        {/* Rating */}
                        {provider.rating && (
                          <div className="flex items-center gap-1 mt-1">
                            <span className="text-yellow-500">★</span>
                            <span className="text-sm font-medium">{provider.rating}</span>
                            <span className="text-sm text-gray-400">({provider.reviewCount} reviews)</span>
                          </div>
                        )}

                        {/* Queue Info */}
                        {provider.queueCount > 0 && (
                          <div className="flex items-center gap-3 mt-2 text-xs">
                            <span className="flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full">
                              <Users className="w-3 h-3" />
                              {provider.queueCount} waiting
                            </span>
                            <span className="flex items-center gap-1 text-gray-500">
                              <Clock className="w-3 h-3" />
                              ~{formatTime(provider.estimatedWaitMinutes)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Services - Always visible */}
                    <div className="mt-4">
                      <p className="text-xs font-medium text-gray-500 mb-2">Available Services:</p>
                      <div className="flex flex-wrap gap-2">
                        {provider.services.map((service) => {
                          const isServiceSelected = isProviderSelected && selectedServiceId === service.id;
                          return (
                            <button
                              key={service.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedServiceId(service.id);
                                setSelectedProvider(provider);
                              }}
                              className={`px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                                isServiceSelected
                                  ? 'bg-[#FF8C42] text-white shadow-md'
                                  : 'bg-gray-100 text-gray-700 hover:bg-orange-100 hover:text-[#FF8C42]'
                              }`}
                            >
                              {service.name} - ₹{service.price.toFixed(2)}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Join Queue Form - Expanded when provider + service selected */}
                  {isProviderSelected && selectedServiceId && (
                    <div className="border-t border-orange-200 bg-orange-50/50 p-4 space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Symptoms/Reason (Optional)
                        </label>
                        <textarea
                          value={symptoms}
                          onChange={(e) => setSymptoms(e.target.value)}
                          placeholder="Brief description of why you need consultation..."
                          rows={2}
                          className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#FF8C42] focus:border-transparent"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Urgency Level
                        </label>
                        <div className="flex gap-3">
                          <button
                            onClick={(e) => { e.stopPropagation(); setUrgency('normal'); }}
                            className={`flex-1 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                              urgency === 'normal'
                                ? 'bg-[#FF8C42] text-white shadow-md'
                                : 'bg-white border border-gray-200 text-gray-700 hover:border-[#FF8C42]'
                            }`}
                          >
                            Normal
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setUrgency('urgent'); }}
                            className={`flex-1 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                              urgency === 'urgent'
                                ? 'bg-red-500 text-white shadow-md'
                                : 'bg-white border border-gray-200 text-gray-700 hover:border-red-300'
                            }`}
                          >
                            🚨 Urgent
                          </button>
                        </div>
                      </div>
                      
                      <Button
                        onClick={(e) => { e.stopPropagation(); joinQueue(provider); }}
                        disabled={joiningQueue}
                        className="w-full bg-[#FF8C42] hover:bg-[#FF7A35] text-white h-12 rounded-xl text-base font-semibold shadow-lg"
                      >
                        {joiningQueue ? (
                          <span className="flex items-center gap-2">
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            Joining Queue...
                          </span>
                        ) : (
                          <span className="flex items-center justify-center gap-2">
                            <Video className="w-5 h-5" />
                            Join Queue & Start Consultation
                          </span>
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
