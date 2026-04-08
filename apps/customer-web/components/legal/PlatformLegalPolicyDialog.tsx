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
      <DialogContent className="max-h-[85vh] max-w-lg overflow-hidden sm:max-w-2xl bg-white p-6 pt-14 pb-6">
        <div className="flex max-h-[calc(85vh-5rem)] flex-col gap-4 overflow-y-auto">
          <DialogHeader className="shrink-0">
            <DialogTitle className="pr-8 text-gray-900">
              {loading ? 'Loading…' : title || 'Legal document'}
            </DialogTitle>
          </DialogHeader>
          {notice && (
            <p className="shrink-0 text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
              {notice}
            </p>
          )}
          {err && <p className="shrink-0 text-sm text-red-600">{err}</p>}
          {!loading && !err && (
            <pre className="min-h-0 flex-1 whitespace-pre-wrap rounded-md bg-white text-sm text-gray-800 font-sans">
              {body}
            </pre>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
