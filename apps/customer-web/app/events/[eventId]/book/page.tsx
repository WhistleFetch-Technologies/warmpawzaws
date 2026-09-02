'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { BookingPetSelection, type BookingPet } from '@/components/customer/shared/BookingPetSelection';
import { useCustomerNavigation } from '@/lib/navigation/use-customer-navigation';
import {
  hasAuthenticatedCustomerSession,
  requestGuestAuthForEventBook,
} from '@/lib/guest-auth-gate';
import { persistGuestBookingIntentForAuth } from '@/lib/guest-booking-intent';
import { openStandardRazorpayCheckout } from '@/lib/razorpay/open-standard-razorpay-checkout';

type PrefillPet = BookingPet & {
  declarations?: { vaccinated: boolean | null; social: boolean | null; trained: boolean | null };
};

export default function EventBookPage() {
  const params = useParams<{ eventId: string }>();
  const eventId = String(params.eventId || '');
  const nav = useCustomerNavigation();
  const [event, setEvent] = useState<any>(null);
  const [pets, setPets] = useState<PrefillPet[]>([]);
  const [ticketQuantity, setTicketQuantity] = useState(1);
  const [selectedPetIds, setSelectedPetIds] = useState<string[]>([]);
  const [declarations, setDeclarations] = useState<
    Record<string, { vaccinated: boolean; social: boolean; trained: boolean }>
  >({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!eventId) return;
    if (!hasAuthenticatedCustomerSession()) {
      requestGuestAuthForEventBook({ eventId });
      return;
    }
    apiClient.get<any>(`/events/${eventId}`).then((res) => setEvent(res.event || res));
    apiClient.get<any>('/events/pets/prefill').then((res) => {
      const next = (res.pets || []) as PrefillPet[];
      setPets(next);
      const nextDecl: Record<string, { vaccinated: boolean; social: boolean; trained: boolean }> = {};
      for (const pet of next) {
        nextDecl[pet.id] = {
          vaccinated: pet.declarations?.vaccinated === true,
          social: pet.declarations?.social === true,
          trained: pet.declarations?.trained === true,
        };
      }
      setDeclarations(nextDecl);
    });
  }, [eventId]);

  const fee = Number(event?.registration_fee || 0);
  const canSubmit = selectedPetIds.length === ticketQuantity && selectedPetIds.length > 0;

  const selectedPets = useMemo(
    () => pets.filter((pet) => selectedPetIds.includes(pet.id)),
    [pets, selectedPetIds]
  );

  const togglePet = (pet: BookingPet) => {
    setSelectedPetIds((prev) => {
      if (prev.includes(pet.id)) return prev.filter((id) => id !== pet.id);
      if (prev.length >= ticketQuantity) return prev;
      return [...prev, pet.id];
    });
  };

  const startPayment = async (registrationId: string) => {
    const created = await apiClient.post<any>(`/events/registrations/${registrationId}/payment`, {});
    if (created.alreadyPaid) {
      nav.goToEventRegistration(registrationId);
      return;
    }
    await openStandardRazorpayCheckout({
      key: created.razorpayKeyId || process.env.NEXT_PUBLIC_RAZORPAY_KEY || '',
      amountPaise: Math.round(Number(created.amount || fee * ticketQuantity) * 100),
      description: `Event tickets for ${event?.title || event?.name || 'Warmpawz Event'}`,
      order_id: created.razorpayOrderId,
      handler: async (response: any) => {
        await apiClient.post(`/events/registrations/${registrationId}/payment/verify`, {
          razorpay_order_id: response.razorpay_order_id,
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_signature: response.razorpay_signature,
        });
        nav.goToEventRegistration(registrationId);
      },
      onPaymentFailed: (err) => setError(err.message || 'Payment failed'),
    });
  };

  const handleSubmit = async () => {
    if (!canSubmit) {
      setError(`Select ${ticketQuantity} different pets — one per ticket`);
      return;
    }
    try {
      setSubmitting(true);
      setError(null);
      const res = await apiClient.post<any>(`/events/${eventId}/register`, {
        ticketQuantity,
        tickets: selectedPetIds.map((petId) => ({
          petId,
          declarations: declarations[petId] || { vaccinated: false, social: false, trained: false },
        })),
      });
      const registrationId = res.registration?.id;
      if (!registrationId) throw new Error('Registration failed');
      if (res.registration?.requires_payment) {
        await startPayment(registrationId);
        return;
      }
      nav.goToEventRegistration(registrationId);
    } catch (err: any) {
      setError(err.message || 'Could not complete booking');
    } finally {
      setSubmitting(false);
    }
  };

  if (!event) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-orange-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50">
      <div className="mx-auto max-w-3xl p-6">
        <button type="button" onClick={() => nav.goToEventDetail(eventId)} className="text-sm text-orange-600">
          ← Event details
        </button>
        <h1 className="mt-4 text-2xl font-bold text-gray-900">Book {event.title || event.name}</h1>
        <p className="mt-1 text-sm text-gray-500">One unique pet per ticket. Existing pets are reused.</p>

        <div className="mt-6 rounded-2xl bg-white p-5">
          <label className="text-sm font-medium text-gray-700">Ticket quantity</label>
          <input
            type="number"
            min={1}
            max={Math.max(1, pets.length || 1)}
            value={ticketQuantity}
            onChange={(e) => {
              const next = Math.max(1, parseInt(e.target.value || '1', 10));
              setTicketQuantity(next);
              setSelectedPetIds((prev) => prev.slice(0, next));
            }}
            className="mt-2 w-24 rounded-lg border px-3 py-2"
          />
          {fee > 0 ? <p className="mt-2 text-sm text-orange-600">₹{fee * ticketQuantity} total</p> : null}
        </div>

        <div className="mt-4 rounded-2xl bg-white p-5">
          <BookingPetSelection
            pets={pets}
            allowMultiple
            selectedPetIds={selectedPetIds}
            onTogglePet={togglePet}
            onSelectPet={togglePet}
            onAddPet={() => {
              persistGuestBookingIntentForAuth({
                kind: 'event',
                requiresPet: true,
                returnPath: `/events/${eventId}/book`,
                funnelStarted: 'booking',
              });
              window.location.assign('/add-pet');
            }}
            title="Assign pets"
            subtitle={`Select ${ticketQuantity} different pets`}
            guestAuthContext={{
              kind: 'event',
              requiresPet: true,
              returnPath: `/events/${eventId}/book`,
            }}
          />
        </div>

        {selectedPets.map((pet) => (
          <div key={pet.id} className="mt-4 rounded-2xl bg-white p-5">
            <p className="font-medium text-gray-900">Declarations for {pet.name}</p>
            {(['vaccinated', 'social', 'trained'] as const).map((key) => (
              <label key={key} className="mt-2 flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={Boolean(declarations[pet.id]?.[key])}
                  onChange={(e) =>
                    setDeclarations((prev) => ({
                      ...prev,
                      [pet.id]: { ...(prev[pet.id] || { vaccinated: false, social: false, trained: false }), [key]: e.target.checked },
                    }))
                  }
                />
                {key === 'vaccinated' ? 'Vaccinated' : key === 'social' ? 'Social' : 'Trained'}
              </label>
            ))}
          </div>
        ))}

        {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

        <button
          type="button"
          disabled={!canSubmit || submitting}
          onClick={handleSubmit}
          className="mt-6 w-full rounded-lg bg-orange-500 py-3 font-medium text-white disabled:bg-gray-300"
        >
          {submitting ? 'Booking…' : fee > 0 ? 'Confirm & pay' : 'Confirm booking'}
        </button>
      </div>
    </div>
  );
}
