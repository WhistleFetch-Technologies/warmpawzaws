"use client";

import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Heart, User, Send, Inbox, SendHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { apiClient } from '@/lib/api-client';
import { getResolvedCustomerId, isCustomerDatabaseUuid, persistCustomerDatabaseId } from '@/lib/customer-id-storage';
import { toast } from 'sonner';
import { PresignableImage } from '@/components/shared/PresignableImage';
import { Textarea } from '@/components/ui/textarea';

interface MatingDatingHubProps {
  phone?: string;
  customerPhone?: string;
  customerId?: string;
  petId?: string;
  bookingId?: string;
  orderId?: string;
  cafeId?: string;
  preSelectedVendorId?: string;
  vendorId?: string;
  onBack: () => void;
  onNavigate?: (screen: string, data?: any) => void;
  onSuccess?: (bookingId?: string) => void;
  onComplete?: () => void;
}

type MatchProfile = {
  id: string;
  petName?: string;
  petType?: string;
  breed?: string;
  age?: number | string;
  gender?: string;
  photos?: string[];
  description?: string | null;
  ownerId?: string;
  ownerName?: string;
  location?: string;
  emoji?: string;
};

type MyPet = { id: string; name?: string; species?: string; breed?: string; gender?: string };

export function MatingDatingHub(props: MatingDatingHubProps) {
  const [profiles, setProfiles] = useState<MatchProfile[]>([]);
  const [myPets, setMyPets] = useState<MyPet[]>([]);
  const [received, setReceived] = useState<any[]>([]);
  const [sent, setSent] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterBreed, setFilterBreed] = useState('');
  const [customerId, setCustomerId] = useState<string | null>(() => {
    if (props.customerId && isCustomerDatabaseUuid(props.customerId)) return props.customerId;
    return typeof window !== 'undefined' ? getResolvedCustomerId() : null;
  });
  const [fromPetId, setFromPetId] = useState<string>('');
  const [requestMessage, setRequestMessage] = useState('');
  const [sendingToPetId, setSendingToPetId] = useState<string | null>(null);

  const phone = props.customerPhone || props.phone;

  const resolveCustomerId = useCallback(async () => {
    if (props.customerId && isCustomerDatabaseUuid(props.customerId)) {
      setCustomerId(props.customerId);
      return props.customerId;
    }
    const stored = getResolvedCustomerId();
    if (stored) {
      setCustomerId(stored);
      return stored;
    }
    if (!phone) return null;
    try {
      const res = await apiClient.get<any>(`/customer/profile?phone=${encodeURIComponent(phone)}`);
      const id = res?.profile?.id || res?.id || res?.customer?.id;
      if (id && isCustomerDatabaseUuid(String(id))) {
        const sid = String(id).trim();
        setCustomerId(sid);
        persistCustomerDatabaseId(sid);
        return sid;
      }
    } catch {
      /* profile route may vary; ignore */
    }
    return null;
  }, [phone, props.customerId]);

  const loadMyPets = useCallback(async () => {
    if (!phone) return;
    try {
      const res = await apiClient.get<any>(`/customer/pets?phone=${encodeURIComponent(phone)}`);
      const pets: MyPet[] = res?.pets || [];
      setMyPets(pets);
      setFromPetId((prev) => {
        if (prev && pets.some((p) => p.id === prev)) return prev;
        return pets[0]?.id || '';
      });
    } catch {
      setMyPets([]);
    }
  }, [phone]);

  const loadProfiles = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filterBreed) params.set('breed', filterBreed);
      if (customerId) params.set('customerId', customerId);
      const qs = params.toString();
      const response = await apiClient.get<{ profiles?: MatchProfile[]; success?: boolean }>(
        `/customer/pet-matching${qs ? `?${qs}` : ''}`
      );
      const list = response?.profiles ?? [];
      setProfiles(Array.isArray(list) ? list : []);
    } catch (error: unknown) {
      console.error('Error loading profiles:', error);
      setProfiles([]);
      toast.error('Failed to load pet profiles. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [filterBreed, customerId]);

  const loadRequests = useCallback(async () => {
    if (!customerId) return;
    setLoadingRequests(true);
    try {
      const [recv, snd] = await Promise.all([
        apiClient.get<any>(
          `/customer/pet-matching/requests?customerId=${encodeURIComponent(customerId)}&type=received`
        ),
        apiClient.get<any>(
          `/customer/pet-matching/requests?customerId=${encodeURIComponent(customerId)}&type=sent`
        ),
      ]);
      setReceived(Array.isArray(recv?.requests) ? recv.requests : []);
      setSent(Array.isArray(snd?.requests) ? snd.requests : []);
    } catch {
      setReceived([]);
      setSent([]);
      toast.error('Failed to load match requests.');
    } finally {
      setLoadingRequests(false);
    }
  }, [customerId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const cid = await resolveCustomerId();
      if (cancelled) return;
      if (cid) setCustomerId(cid);
    })();
    return () => {
      cancelled = true;
    };
  }, [resolveCustomerId]);

  useEffect(() => {
    if (phone) loadMyPets();
  }, [phone, loadMyPets]);

  useEffect(() => {
    if (phone) {
      loadProfiles();
    } else {
      setLoading(false);
    }
  }, [phone, loadProfiles]);

  useEffect(() => {
    if (customerId) loadRequests();
  }, [customerId, loadRequests]);

  const filteredProfiles = profiles.filter(
    (profile) =>
      !searchQuery ||
      profile.petName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      profile.breed?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const sendMatchRequest = async (toPetId: string) => {
    if (!fromPetId) {
      toast.error('Add a pet to your profile first, then select it to send a request.');
      return;
    }
    if (!customerId) {
      toast.error('Could not resolve your account. Please sign in again.');
      return;
    }
    setSendingToPetId(toPetId);
    try {
      await apiClient.post('/customer/pet-matching/request', {
        fromPetId,
        toPetId,
        fromCustomerId: customerId,
        message: requestMessage.trim() || undefined,
      });
      toast.success('Match request sent!');
      setRequestMessage('');
      loadRequests();
    } catch (e: any) {
      const msg = e?.message || e?.response?.error || 'Could not send request';
      toast.error(String(msg));
    } finally {
      setSendingToPetId(null);
    }
  };

  const updateRequest = async (requestId: string, action: 'accept' | 'decline') => {
    try {
      await apiClient.put(`/customer/pet-matching/requests/${requestId}`, { action });
      toast.success(action === 'accept' ? 'Request accepted' : 'Request declined');
      loadRequests();
    } catch (e: any) {
      toast.error(e?.message || 'Could not update request');
    }
  };

  if (!phone) {
    return (
      <div className="min-h-screen bg-gray-50 px-4 pb-4 cw-header-safe-top cw-header-safe-x">
        <div className="max-w-md mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <Button variant="ghost" size="icon" onClick={props.onBack} className="rounded-full">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-xl font-semibold">Pet Matching</h1>
          </div>
          <Card className="p-6 text-center">
            <p className="text-gray-600">Please login to access pet matching</p>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="max-w-md mx-auto bg-white min-h-screen">
        <div className="sticky top-0 z-10 border-b border-gray-200 bg-white cw-header-safe-top pb-3 pl-[max(1rem,env(safe-area-inset-left,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))]">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={props.onBack}
              className="h-11 min-h-[44px] min-w-[44px] shrink-0 rounded-full touch-manipulation"
              aria-label="Go back"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-xl font-semibold">Peer to Peer</h1>
          </div>
        </div>

        <div className="p-4 space-y-4">
          <Card className="p-4 bg-gradient-to-br from-pink-50 to-purple-50 border-pink-200">
            <div className="flex items-center gap-3">
              <Heart className="w-8 h-8 text-pink-600" />
              <div>
                <h3 className="font-semibold text-gray-900">Find your pet&apos;s match</h3>
                <p className="text-sm text-gray-600">Browse pets from other owners and send a match request</p>
              </div>
            </div>
          </Card>

          {myPets.length > 0 ? (
            <Card className="p-3 space-y-2">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Your pet (for outgoing requests)</p>
              <select
                className="w-full border rounded-md px-3 py-2 text-sm bg-white"
                value={fromPetId}
                onChange={(e) => setFromPetId(e.target.value)}
              >
                {myPets.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name || 'Pet'} — {p.breed || p.species || 'Pet'}
                  </option>
                ))}
              </select>
              <Textarea
                placeholder="Optional message to include with requests…"
                value={requestMessage}
                onChange={(e) => setRequestMessage(e.target.value)}
                className="min-h-[72px] text-sm"
              />
            </Card>
          ) : (
            <Card className="p-4 border-amber-200 bg-amber-50">
              <p className="text-sm text-amber-900">
                Add a pet from your profile to send match requests. You can still browse other pets below.
              </p>
            </Card>
          )}

          <Tabs defaultValue="discover" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="discover" className="text-xs gap-1">
                <Heart className="w-3.5 h-3.5" /> Discover
              </TabsTrigger>
              <TabsTrigger value="received" className="text-xs gap-1">
                <Inbox className="w-3.5 h-3.5" /> Inbox
              </TabsTrigger>
              <TabsTrigger value="sent" className="text-xs gap-1">
                <SendHorizontal className="w-3.5 h-3.5" /> Sent
              </TabsTrigger>
            </TabsList>

            <TabsContent value="discover" className="space-y-4 mt-4">
              <div className="space-y-3">
                <Input
                  placeholder="Search by name or breed…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full"
                />
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {['All', 'Labrador', 'Golden Retriever', 'German Shepherd', 'Persian', 'Siamese'].map((breed) => (
                    <Button
                      key={breed}
                      type="button"
                      variant={filterBreed === breed ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setFilterBreed(breed === 'All' ? '' : breed)}
                      className={`flex-shrink-0 ${filterBreed === breed ? 'bg-pink-600 text-white' : ''}`}
                    >
                      {breed}
                    </Button>
                  ))}
                </div>
              </div>

              {loading ? (
                <Card className="p-8 text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-4 border-pink-500 border-t-transparent mx-auto mb-4" />
                  <p className="text-gray-600">Loading profiles…</p>
                </Card>
              ) : filteredProfiles.length === 0 ? (
                <Card className="p-8 text-center">
                  <Heart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-600 font-medium mb-2">No pets to show yet</p>
                  <p className="text-sm text-gray-500">
                    Other customers&apos; pets appear here when they add profiles. Try another breed filter or check back
                    later.
                  </p>
                </Card>
              ) : (
                <div className="space-y-3">
                  {filteredProfiles.map((profile) => {
                    const photo = profile.photos?.[0];
                    return (
                      <Card key={profile.id} className="p-4">
                        <div className="flex items-start gap-3">
                          <div className="w-16 h-16 rounded-full overflow-hidden bg-gradient-to-br from-pink-200 to-purple-200 flex items-center justify-center text-2xl flex-shrink-0">
                            {photo ? (
                              <PresignableImage src={photo} alt={profile.petName || 'Pet'} className="w-full h-full object-cover" />
                            ) : (
                              <span>{profile.emoji || '🐾'}</span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div>
                                <h3 className="font-semibold text-gray-900">{profile.petName || 'Pet'}</h3>
                                <p className="text-sm text-gray-600">{profile.breed || 'Mixed'}</p>
                              </div>
                              {profile.age != null && profile.age !== '' && (
                                <Badge variant="outline">{profile.age} yrs</Badge>
                              )}
                            </div>
                            {profile.ownerName && (
                              <div className="flex items-center gap-1 text-sm text-gray-500 mb-1">
                                <User className="w-4 h-4" />
                                {profile.ownerName}
                              </div>
                            )}
                            {profile.location && <p className="text-xs text-gray-500 mb-2">{profile.location}</p>}
                            {profile.description && (
                              <p className="text-xs text-gray-600 mb-3 line-clamp-3">{profile.description}</p>
                            )}
                            <Button
                              type="button"
                              size="sm"
                              className="bg-pink-600 hover:bg-pink-700"
                              disabled={!fromPetId || sendingToPetId === profile.id}
                              onClick={() => sendMatchRequest(profile.id)}
                            >
                              <Send className="w-4 h-4 mr-1" />
                              {sendingToPetId === profile.id ? 'Sending…' : 'Send match request'}
                            </Button>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            <TabsContent value="received" className="mt-4 space-y-3">
              {loadingRequests ? (
                <p className="text-sm text-gray-500 text-center py-6">Loading…</p>
              ) : received.length === 0 ? (
                <Card className="p-6 text-center text-sm text-gray-600">No incoming requests</Card>
              ) : (
                received.map((r) => (
                  <Card key={r.id} className="p-4 space-y-2">
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <p className="font-medium text-gray-900">
                          {r.from_pet_name || 'Pet'} ({r.from_pet_breed || '—'})
                        </p>
                        <p className="text-xs text-gray-500">Wants to connect with {r.to_pet_name || 'your pet'}</p>
                        {r.from_owner_name && (
                          <p className="text-xs text-gray-500 mt-1">From: {r.from_owner_name}</p>
                        )}
                      </div>
                      <Badge variant={r.status === 'pending' ? 'secondary' : 'outline'}>{r.status}</Badge>
                    </div>
                    {r.message && <p className="text-sm text-gray-600 italic">&ldquo;{r.message}&rdquo;</p>}
                    {r.status === 'pending' && (
                      <div className="flex gap-2 pt-2">
                        <Button type="button" size="sm" onClick={() => updateRequest(r.id, 'accept')}>
                          Accept
                        </Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => updateRequest(r.id, 'decline')}>
                          Decline
                        </Button>
                      </div>
                    )}
                  </Card>
                ))
              )}
            </TabsContent>

            <TabsContent value="sent" className="mt-4 space-y-3">
              {loadingRequests ? (
                <p className="text-sm text-gray-500 text-center py-6">Loading…</p>
              ) : sent.length === 0 ? (
                <Card className="p-6 text-center text-sm text-gray-600">No sent requests yet</Card>
              ) : (
                sent.map((r) => (
                  <Card key={r.id} className="p-4 flex items-center justify-between gap-2">
                    <div>
                      <p className="font-medium text-gray-900">
                        To: {r.to_pet_name || 'Pet'} ({r.to_pet_breed || '—'})
                      </p>
                      <p className="text-xs text-gray-500">From your {r.from_pet_name || 'pet'}</p>
                    </div>
                    <Badge variant="outline">{r.status}</Badge>
                  </Card>
                ))
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
