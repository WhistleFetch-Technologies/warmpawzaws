'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { EnhancedAddPetModal } from '@/components/customer/EnhancedAddPetModal';
import { goBackOrHome } from '@/lib/go-back-or-replace';

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
      router.replace('/auth');
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
      onBack={() => goBackOrHome(router)}
      onClose={() => goBackOrHome(router)}
      onSuccess={() => {
        router.replace('/');
      }}
    />
  );
}
