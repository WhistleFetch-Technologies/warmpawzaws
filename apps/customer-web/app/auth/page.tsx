'use client';

import { useRouter } from 'next/navigation';
import { CustomerAuthFlow } from '@/components/customer/auth/CustomerAuthFlow';

export default function AuthPage() {
  const router = useRouter();

  return (
    <CustomerAuthFlow
      variant="page"
      onComplete={({ redirectPath }) => {
        router.push(redirectPath);
      }}
    />
  );
}
