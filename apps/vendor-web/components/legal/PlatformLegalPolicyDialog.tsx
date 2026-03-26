'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import {
  fetchPlatformPolicyDocument,
  type PlatformPolicyTypeKey,
} from '@/lib/platform-policy-client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export type PlatformPolicyType = PlatformPolicyTypeKey;

interface PlatformLegalPolicyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  policyType: PlatformPolicyType | null;
}

export function PlatformLegalPolicyDialog({
  open,
  onOpenChange,
  policyType,
}: PlatformLegalPolicyDialogProps) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !policyType) return;

    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const result = await fetchPlatformPolicyDocument(
          (path) => apiClient.get(path),
          policyType
        );
        if (cancelled) return;
        if (result.ok) {
          setTitle(result.title);
          setBody(result.content);
          setNotice(result.notice ?? null);
        } else {
          setErr(result.error);
          setTitle('');
          setBody('');
          setNotice(null);
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setErr(e instanceof Error ? e.message : 'Failed to load document');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, policyType]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) {
          setTitle('');
          setBody('');
          setErr(null);
          setNotice(null);
        }
      }}
    >
      <DialogContent className="max-h-[85vh] overflow-y-auto max-w-lg sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{loading ? 'Loading…' : title || 'Legal document'}</DialogTitle>
        </DialogHeader>
        {notice && (
          <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
            {notice}
          </p>
        )}
        {err && <p className="text-sm text-red-600">{err}</p>}
        {!loading && !err && (
          <pre className="whitespace-pre-wrap text-sm text-gray-700 font-sans max-h-[65vh] overflow-y-auto">
            {body}
          </pre>
        )}
      </DialogContent>
    </Dialog>
  );
}
