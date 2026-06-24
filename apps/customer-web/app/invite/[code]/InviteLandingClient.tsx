'use client';

import { ReferralStoreRedirectShell } from '@/components/referral/ReferralStoreRedirectShell';

interface InviteLandingClientProps {
  code?: string;
}

/** Legacy /invite/CODE links — same store redirect as /r/CODE. */
export function InviteLandingClient({ code: codeProp }: InviteLandingClientProps) {
  return <ReferralStoreRedirectShell code={codeProp} pathPattern={/\/invite\/([^/?]+)/} />;
}
