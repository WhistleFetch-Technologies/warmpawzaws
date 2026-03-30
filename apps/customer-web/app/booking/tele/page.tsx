'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { InstantTeleQueue } from '@/components/customer/InstantTele/InstantTeleQueue';
import { UniversalPaymentPage } from '@/components/customer/payment/UniversalPaymentPage';
import { apiClient } from '@/lib/api-client';
import { goBackOrHome } from '@/lib/go-back-or-replace';

type DirectPayContext = {
  vendorId: string;
  vendorName: string;
  serviceId: string;
  serviceName: string;
  price: number;
  duration: number;
};

type TelePet = { id: string; name: string };

function normalizeTelePets(res: any): TelePet[] {
  const raw = res?.pets;
  if (!Array.isArray(raw)) return [];
  return raw.map((x: any) => ({
    id: String(x.id ?? ''),
    name: typeof x.name === 'string' && x.name.trim() ? x.name.trim() : 'Unnamed',
  })).filter((p: TelePet) => p.id);
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** URL or env fallback: both IDs must be UUIDs (vendor_services.id + vendors.id). */
function buildStaticDirectPayContext(
  explicitServiceId: string | undefined,
  preferredVendorId: string | undefined,
  defaults?: Partial<Pick<DirectPayContext, 'serviceName' | 'vendorName' | 'price' | 'duration'>>
): DirectPayContext | null {
  const vid = preferredVendorId?.trim();
  const sid = explicitServiceId?.trim();
  if (!vid || !sid || !UUID_REGEX.test(vid) || !UUID_REGEX.test(sid)) return null;
  return {
    vendorId: vid,
    vendorName: defaults?.vendorName ?? 'Vet',
    serviceId: sid,
    serviceName: defaults?.serviceName ?? 'Tele Consultation',
    price: defaults?.price ?? 499,
    duration: defaults?.duration ?? 15,
  };
}

function readEnvTeleInstantFallback(): DirectPayContext | null {
  if (typeof process === 'undefined') return null;
  const v = process.env.NEXT_PUBLIC_TELE_INSTANT_FALLBACK_VENDOR_ID?.trim();
  const s = process.env.NEXT_PUBLIC_TELE_INSTANT_FALLBACK_SERVICE_ID?.trim();
  return buildStaticDirectPayContext(s, v);
}

function isTeleServiceRow(x: { serviceStyle?: string; service_style?: string }) {
  const st = x.serviceStyle || x.service_style;
  return st === 'tele' || st === 'online' || st === 'video_consultation';
}

async function fetchDefaultInstantTelePayContext(
  explicitServiceId: string | undefined,
  preferredVendorId: string | undefined
): Promise<DirectPayContext | null> {
  const nowRes = await apiClient.get<any>('/customer/tele/available-now');
  const vendors = nowRes?.vendors || [];
  if (vendors.length === 0) return null;

  const v = preferredVendorId
    ? vendors.find((x: { vendorId: string }) => x.vendorId === preferredVendorId) || vendors[0]
    : vendors[0];

  const svcRes = await apiClient.get<any>(`/customer/vendor/${v.vendorId}/services?serviceStyle=tele`);
  let list = svcRes?.services || svcRes?.tele?.services || [];
  if (Array.isArray(svcRes) && svcRes.length) list = svcRes;
  let services = Array.isArray(list) ? list : [];

  if (services.length === 0) {
    const allRes = await apiClient.get<any>(`/customer/vendor/${v.vendorId}/services`);
    let allList = allRes?.services || allRes?.tele?.services || [];
    if (Array.isArray(allRes) && allRes.length) allList = allRes;
    const all = Array.isArray(allList) ? allList : [];
    services = all.filter(isTeleServiceRow);
  }

  if (services.length === 0) return null;

  let s = services[0];
  if (explicitServiceId) {
    const found = services.find(
      (x: { id?: string; service_id?: string }) =>
        x.id === explicitServiceId || x.service_id === explicitServiceId
    );
    if (found) s = found;
  }

  const serviceUuid = String(s.id || s.service_id || '');
  if (!serviceUuid) return null;

  return {
    vendorId: v.vendorId,
    vendorName: v.vendorName || 'Vet',
    serviceId: serviceUuid,
    serviceName: s.name || s.service_name || 'Tele Consultation',
    price: Number(s.price ?? s.custom_price ?? 499),
    duration: Number(s.duration ?? s.custom_duration ?? s.duration_minutes ?? 15),
  };
}

function TeleConsultationContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [pets, setPets] = useState<TelePet[]>([]);
  const [selectedPet, setSelectedPet] = useState<TelePet | null>(null);
  const [customerPhone, setCustomerPhone] = useState('');
  const [loading, setLoading] = useState(true);
  const [directPayContext, setDirectPayContext] = useState<DirectPayContext | null>(null);
  const [resolvingPhone, setResolvingPhone] = useState(false);

  const roleId = searchParams.get('roleId') || 'veterinarian';
  const category = searchParams.get('category') || 'vet';
  const serviceId = searchParams.get('serviceId') || undefined;
  const service = searchParams.get('service');
  const mode = searchParams.get('mode');
  const autoPay = searchParams.get('autoPay');
  const teleServiceQuery = service === 'tele';
  const vendorIdParam = searchParams.get('vendorId') || undefined;

  /** Matches `/booking/tele?service=tele&mode=instant&autoPay=true` (string query values). */
  const isTeleInstantAutoPayRoute =
    service === 'tele' && mode === 'instant' && autoPay === 'true';

  const searchKey = searchParams.toString();
  const wantsAutoPay = isTeleInstantAutoPayRoute;
  const petIdFromUrl = useMemo(() => {
    const v = new URLSearchParams(searchKey).get('petId')?.trim();
    return v || null;
  }, [searchKey]);

  const urlStaticPayContext = useMemo(
    () => buildStaticDirectPayContext(serviceId, vendorIdParam),
    [serviceId, vendorIdParam]
  );
  const envStaticPayContext = useMemo(() => readEnvTeleInstantFallback(), []);
  const baseDirectPayContext = useMemo(
    () => directPayContext ?? urlStaticPayContext ?? envStaticPayContext,
    [directPayContext, urlStaticPayContext, envStaticPayContext]
  );

  const offerNameQ = searchParams.get('offerName') ?? '';
  const priceQ = searchParams.get('price');
  const descQ = searchParams.get('desc') ?? '';

  /** When present, overrides payment display and charge amount; does not replace vendor/service IDs from API. */
  const offerFromUrl = useMemo(() => {
    const name = offerNameQ.trim();
    if (!name || priceQ == null || priceQ === '') return null;
    const price = Number(priceQ);
    if (!Number.isFinite(price) || price < 0) return null;
    const d = descQ.trim();
    return { offerName: name, price, desc: d ? d : undefined };
  }, [offerNameQ, priceQ, descQ]);

  const effectiveDirectPay = useMemo(() => {
    if (!baseDirectPayContext) return null;
    if (!offerFromUrl) return baseDirectPayContext;
    return {
      ...baseDirectPayContext,
      serviceName: offerFromUrl.offerName,
      price: offerFromUrl.price,
    };
  }, [baseDirectPayContext, offerFromUrl]);

  useEffect(() => {
    console.log('[booking/tele] params debug:', {
      raw: searchKey,
      service,
      mode,
      autoPay,
      isTeleInstantAutoPayRoute,
      directPayContext,
      urlStaticPayContext: !!urlStaticPayContext,
      envStaticPayContext: !!envStaticPayContext,
      offerFromUrl: !!offerFromUrl,
      effectiveDirectPay: !!effectiveDirectPay,
    });
  }, [
    searchKey,
    service,
    mode,
    autoPay,
    isTeleInstantAutoPayRoute,
    directPayContext,
    urlStaticPayContext,
    envStaticPayContext,
    offerFromUrl,
    effectiveDirectPay,
  ]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const phone = localStorage.getItem('customerPhone') || '';
    if (phone) setCustomerPhone(phone);

    const customerSession = localStorage.getItem('customer_session') || localStorage.getItem('customerData');

    if (customerSession) {
      try {
        const customer = typeof customerSession === 'string' ? JSON.parse(customerSession) : customerSession;
        setCustomerId(customer.id || customer.customerId);
        const phoneFromProfile =
          customer.phone || customer.mobile || customer.customerPhone || localStorage.getItem('customerPhone');
        if (phoneFromProfile && !phone) setCustomerPhone(String(phoneFromProfile));
      } catch {
        const phoneStore = localStorage.getItem('customer_phone');
        if (phoneStore) loadCustomerByPhone(phoneStore);
      }
    } else {
      const phoneStore = localStorage.getItem('customer_phone');
      if (phoneStore) {
        loadCustomerByPhone(phoneStore);
      } else {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!customerId) return;
    let cancelled = false;
    setLoading(true);
    setPets([]);
    setSelectedPet(null);
    (async () => {
      try {
        const response = await apiClient.get<any>(`/customer/${customerId}/pets`);
        const list = normalizeTelePets(response);
        if (cancelled) return;
        setPets(list);
        if (petIdFromUrl) {
          const found = list.find((p) => p.id === petIdFromUrl);
          setSelectedPet(found ?? { id: petIdFromUrl, name: 'Unnamed' });
        } else if (list.length > 0) {
          setSelectedPet(list[0]);
        } else {
          setSelectedPet(null);
        }
      } catch (error) {
        console.error('Error loading pets:', error);
        if (!cancelled) {
          setPets([]);
          setSelectedPet(
            petIdFromUrl ? { id: petIdFromUrl, name: 'Unnamed' } : null
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [customerId, petIdFromUrl]);

  useEffect(() => {
    if (!customerId || customerPhone) return;
    let cancelled = false;
    setResolvingPhone(true);
    (async () => {
      try {
        const r = await apiClient.get<any>(`/customer/profile/${customerId}`);
        const profile = r?.profile || r;
        const phone = profile?.phone || profile?.mobile || profile?.customerPhone;
        if (!cancelled && phone) setCustomerPhone(String(phone));
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setResolvingPhone(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [customerId, customerPhone]);

  useEffect(() => {
    if (!wantsAutoPay || !customerId || !customerPhone) {
      if (wantsAutoPay) {
        console.log('[booking/tele] direct pay waiting for session', {
          customerId: !!customerId,
          petId: !!selectedPet?.id,
          customerPhone: !!customerPhone,
        });
      }
      return;
    }

    let cancelled = false;
    (async () => {
      console.log('[booking/tele] fetching direct pay context (available-now + vendor services)');
      try {
        const ctx = await fetchDefaultInstantTelePayContext(serviceId, vendorIdParam);
        if (cancelled) return;
        if (ctx) {
          setDirectPayContext(ctx);
        } else {
          console.warn(
            '[booking/tele] direct pay API returned no context; continuing with URL/env fallback if set'
          );
        }
      } catch (e: unknown) {
        if (!cancelled) {
          console.error('[booking/tele] direct pay context fetch failed:', e);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [wantsAutoPay, customerId, customerPhone, serviceId, vendorIdParam]);

  const loadCustomerByPhone = async (phone: string) => {
    try {
      setCustomerPhone(phone);
      const response = await apiClient.get<any>(`/customer/profile?phone=${encodeURIComponent(phone)}`);
      const customerIdFromResponse = response.profile?.id || response.id || response.customerId;
      if (customerIdFromResponse) {
        setCustomerId(customerIdFromResponse);
      }
    } catch (error) {
      console.error('Error loading customer:', error);
      setLoading(false);
    }
  };

  const showBootstrapSpinner = loading || (wantsAutoPay && resolvingPhone);

  if (showBootstrapSpinner) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42] mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!customerId || !customerPhone) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6 text-center">
          <h2 className="text-xl font-semibold mb-2">Setup Required</h2>
          <p className="text-gray-600 mb-4">
            {!customerId ? 'Please login first' : 'Phone number required'}
          </p>
          <button
            onClick={() => router.push(!customerId ? '/auth' : '/profile')}
            className="px-4 py-2 bg-[#FF8C42] text-white rounded-lg hover:bg-[#FF7A29]"
          >
            {!customerId ? 'Login' : 'Update profile'}
          </button>
        </div>
      </div>
    );
  }

  if (isTeleInstantAutoPayRoute && wantsAutoPay && !effectiveDirectPay) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42] mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Instant auto-pay: no queue / vet-booking screens — payment once session is ready (API refines context in background)
  if (isTeleInstantAutoPayRoute && wantsAutoPay && effectiveDirectPay) {
    console.log('[booking/tele] isTeleInstantAutoPayRoute → UniversalPaymentPage', {
      service,
      mode,
      autoPay,
      directPayContext,
      effectiveDirectPay,
    });
    const svc = effectiveDirectPay;
    return (
      <div className="min-h-screen bg-gray-50">
        <UniversalPaymentPage
            type="booking"
            flowType="tele-instant"
            vendorId={svc.vendorId}
            vendorName={svc.vendorName}
            serviceId={svc.serviceId}
            serviceName={svc.serviceName}
            serviceDescription={offerFromUrl?.desc}
            serviceStyle="tele"
            category="vet"
            baseAmount={svc.price}
            duration={svc.duration}
            petId={selectedPet?.id}
            petName={selectedPet?.name}
            petSwitcherPets={pets}
            onPetSwitcherChange={setSelectedPet}
            customerPhone={customerPhone}
            customerId={customerId}
            selectedServices={[
              {
                id: svc.serviceId,
                serviceId: svc.serviceId,
                name: svc.serviceName,
                price: svc.price,
                duration: svc.duration,
                serviceStyle: 'tele',
              },
            ]}
            onBack={() => goBackOrHome(router)}
            onSuccess={(bookingId, _orderId, _otp, meta) => {
              const queryParams = new URLSearchParams();
              if (customerId) queryParams.set('customerId', customerId);
              const qs = queryParams.toString();
              const videoUrl = `/video/${bookingId}${qs ? `?${qs}` : ''}`;
              if (meta?.isInstantTele) {
                router.push(videoUrl);
                return;
              }
              router.push(videoUrl);
            }}
          />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <button
          type="button"
          onClick={() => goBackOrHome(router)}
          className="mb-4 text-gray-600 hover:text-gray-800 flex items-center gap-2"
        >
          ← Back
        </button>

        <InstantTeleQueue
          customerId={customerId}
          petId={selectedPet?.id ?? null}
          roleId={roleId}
          category={category}
          serviceId={serviceId}
          teleServiceQuery={teleServiceQuery}
          onQueueJoined={(queueId) => {
            console.log('Joined queue:', queueId);
          }}
          onAccepted={(bookingId, meetingId) => {
            const queryParams = new URLSearchParams();
            if (meetingId) {
              queryParams.set('meetingId', meetingId);
            }
            if (customerId) {
              queryParams.set('customerId', customerId);
            }
            const queryString = queryParams.toString();
            const videoUrl = `/video/${bookingId}${queryString ? `?${queryString}` : ''}`;
            router.push(videoUrl);
          }}
        />
      </div>
    </div>
  );
}

export default function TeleConsultationPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42] mx-auto mb-4"></div>
            <p className="text-gray-600">Loading...</p>
          </div>
        </div>
      }
    >
      <TeleConsultationContent />
    </Suspense>
  );
}
