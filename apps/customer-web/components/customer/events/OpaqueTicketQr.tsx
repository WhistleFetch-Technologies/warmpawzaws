'use client';

import { useEffect, useState } from 'react';

/**
 * Renders an opaque ticket token as a QR image.
 * The payload is only the unguessable token — never name, phone, or pet medical data.
 */
export function OpaqueTicketQr({ token, size = 220 }: { token: string; size?: number }) {
  const [src, setSrc] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    const value = String(token || '').trim();
    if (!value) {
      setSrc('');
      return;
    }
    import('qrcode')
      .then((mod) => {
        const toDataURL = (mod.default || mod).toDataURL as (
          text: string,
          opts: { width: number; margin: number; errorCorrectionLevel: string }
        ) => Promise<string>;
        return toDataURL(value, { width: size, margin: 1, errorCorrectionLevel: 'M' });
      })
      .then((url) => {
        if (!cancelled) setSrc(url);
      })
      .catch(() => {
        if (!cancelled) setSrc('');
      });
    return () => {
      cancelled = true;
    };
  }, [token, size]);

  if (!token) return null;

  return (
    <div className="flex flex-col items-center gap-2">
      {src ? (
        <img src={src} alt="Event ticket QR" width={size} height={size} className="rounded-lg border bg-white p-2" />
      ) : (
        <div
          className="flex items-center justify-center rounded-lg border bg-white font-mono text-[10px] text-gray-500"
          style={{ width: size, height: size }}
        >
          Preparing QR…
        </div>
      )}
    </div>
  );
}
