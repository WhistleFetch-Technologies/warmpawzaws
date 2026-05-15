'use client';

import { Suspense, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import PrescriptionDocument, {
  transformPrescriptionData,
} from '@/components/customer/PrescriptionDocument';
import { getApiBaseUrl } from '@/lib/api-client';

function PrescriptionPublicViewInner() {
  const params = useParams();
  const searchParams = useSearchParams();
  const prescriptionId = params.id as string;
  const exp = searchParams.get('exp');
  const sig = searchParams.get('sig');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [apiRow, setApiRow] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (!prescriptionId || !exp || !sig) {
      setError('This link is missing required parameters. Ask your vet to share the prescription again.');
      setLoading(false);
      return;
    }

    const base = getApiBaseUrl().replace(/\/+$/, '');
    const url = `${base}/prescriptions/share/${encodeURIComponent(prescriptionId)}?${new URLSearchParams({
      exp,
      sig,
    })}`;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(url, { method: 'GET', credentials: 'omit' });
        const json = (await res.json()) as { success?: boolean; prescription?: Record<string, unknown>; error?: string };
        if (cancelled) return;
        if (!res.ok || !json.success || !json.prescription) {
          setError(json.error || 'This link is invalid or has expired.');
          return;
        }
        setApiRow(json.prescription);
      } catch {
        if (!cancelled) setError('Could not load the prescription. Check your connection and try again.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [prescriptionId, exp, sig]);

  if (loading) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-slate-50 p-6">
        <div className="h-10 w-10 border-2 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
        <p className="mt-4 text-sm text-slate-600">Loading prescription…</p>
      </div>
    );
  }

  if (error || !apiRow) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-slate-50 p-6 text-center">
        <h1 className="text-lg font-semibold text-slate-800 mb-2">Unable to open prescription</h1>
        <p className="text-slate-600 max-w-md mb-6">{error || 'Something went wrong.'}</p>
        <Link href="/" className="text-emerald-700 font-medium hover:underline">
          Go to Warmpawz home
        </Link>
      </div>
    );
  }

  return (
    <PrescriptionDocument
      prescription={transformPrescriptionData(apiRow)}
      onClose={() => {
        if (typeof window !== 'undefined') window.location.assign('/');
      }}
    />
  );
}

export function PrescriptionPublicViewClient() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[100dvh] flex items-center justify-center bg-slate-50">
          <div className="h-10 w-10 border-2 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
        </div>
      }
    >
      <PrescriptionPublicViewInner />
    </Suspense>
  );
}
