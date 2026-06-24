'use client';

import { ReferralStoreRedirectShell } from '@/components/referral/ReferralStoreRedirectShell';

interface ReferralRedirectClientProps {
  code?: string;
}

export function ReferralRedirectClient({ code: codeProp }: ReferralRedirectClientProps) {
  return <ReferralStoreRedirectShell code={codeProp} pathPattern={/\/r\/([^/?]+)/} />;
}
