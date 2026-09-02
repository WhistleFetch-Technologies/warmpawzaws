'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { EnhancedAddPetModal } from '@/components/customer/EnhancedAddPetModal';
import { requestGuestAuth } from '@/lib/guest-auth-gate';
import { goBackOrHome } from '@/lib/go-back-or-replace';
import { readGuestBookingIntent } from '@/lib/guest-booking-intent';

function readPhoneFromStorage(): string {
  if (typeof window === 'undefined') return '';
  return (
    localStorage.getItem('customerPhone')?.trim() ||
    localStorage.getItem('customer_phone')?.trim() ||
    localStorage.getItem('phone')?.trim() ||
    ''
  );
}

function hasCustomerAuthToken(): boolean {
  if (typeof window === 'undefined') return false;
  let hasToken = !!(localStorage.getItem('authToken') || localStorage.getItem('cognitoAccessToken'));
  if (!hasToken) {
    try {
      const raw = localStorage.getItem('customerCognitoTokens');
      if (raw) {
        const parsed = JSON.parse(raw) as { idToken?: string };
        hasToken = !!parsed?.idToken;
      }
    } catch {
      /* ignore */
    }
  }
  return hasToken;
}

export default function AddPetClient() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const p = readPhoneFromStorage();
    if (!p || !hasCustomerAuthToken()) {
      requestGuestAuth({
        mode: 'signup',
        returnPath: '/add-pet',
        resumeScreen: 'add-pet',
        openAddPet: true,
      });
      return;
    }
    setPhone(p);
    setReady(true);
  }, [router]);

  if (!ready) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-gray-50">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-orange-500" />
      </div>
    );
  }

  return (
    <EnhancedAddPetModal
      variant="fullscreen"
      phone={phone}
      isOpen
      allowSkipPetCreation
      onSkipPetCreation={() => router.replace('/')}
      onBack={() => goBackOrHome(router)}
      onClose={() => goBackOrHome(router)}
      onSuccess={() => {
        const intent = readGuestBookingIntent();
        if (intent?.kind === 'event' && intent.returnPath?.startsWith('/events/')) {
          router.replace(intent.returnPath);
          return;
        }
        router.replace('/');
      }}
    />
  );
}
