'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  resolveServiceStyleLaunch,
  shouldBlockServiceStyleNavigation,
  serviceStyleLaunchBlockMessage,
} from '@/lib/customer-service-style-launch';

export function useServiceStyleLaunchGate(
  phone: string,
  serviceId: string,
  serviceStyle: string,
  options?: { notify?: boolean }
) {
  const [ready, setReady] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [blockMessage, setBlockMessage] = useState('');
  const notify = options?.notify !== false;

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    setBlocked(false);
    setBlockMessage('');

    (async () => {
      const { status } = await resolveServiceStyleLaunch(phone, serviceId, serviceStyle);
      if (cancelled) return;
      if (shouldBlockServiceStyleNavigation(status)) {
        const msg = serviceStyleLaunchBlockMessage(status);
        setBlocked(true);
        setBlockMessage(msg);
        if (notify) toast.info(msg);
      }
      setReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [phone, serviceId, serviceStyle, notify]);

  return { ready, blocked, blockMessage, loading: !ready };
}
