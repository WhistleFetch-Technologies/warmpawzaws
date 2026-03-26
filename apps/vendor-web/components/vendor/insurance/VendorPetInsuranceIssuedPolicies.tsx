'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ClipboardList,
  FileText,
  Shield,
  User,
  Heart,
  Calendar,
  CheckCircle2,
  CircleDot,
  AlertCircle,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

export interface IssuedPolicyRow {
  id: string;
  policy_number?: string;
  plan_name?: string;
  customer_name?: string;
  pet_name?: string;
  status?: string;
  start_date?: string;
  end_date?: string;
  premium_amount?: number | string;
  coverage_amount?: number | string;
  deductible?: number | string;
  payment_frequency?: string;
  next_payment_date?: string;
  created_at?: string;
}

function formatMoney(v: number | string | undefined): string {
  if (v === undefined || v === null || v === '') return '—';
  const n = typeof v === 'string' ? parseFloat(v) : v;
  if (Number.isNaN(n)) return String(v);
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

function formatDate(d: string | undefined): string {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return d;
  }
}

function statusBadgeVariant(status: string | undefined): 'default' | 'secondary' | 'destructive' | 'outline' {
  const s = (status || '').toLowerCase();
  if (s === 'active' || s === 'paid') return 'default';
  if (s === 'cancelled' || s === 'expired' || s === 'rejected') return 'destructive';
  return 'secondary';
}

export function VendorPetInsuranceIssuedPolicies({ vendorId }: { vendorId: string }) {
  const router = useRouter();
  const [policies, setPolicies] = useState<IssuedPolicyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<IssuedPolicyRow | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const primary = await apiClient
        .get<{ policies?: IssuedPolicyRow[]; success?: boolean }>(`/insurance/policies/vendor/${vendorId}`)
        .catch(() => null);
      let list = primary?.policies;
      if (!list?.length) {
        const alt = await apiClient
          .get<{ policies?: IssuedPolicyRow[] }>(`/vendor/${vendorId}/insurance/policies`)
          .catch(() => ({ policies: [] }));
        list = alt.policies || [];
      }
      setPolicies(Array.isArray(list) ? list : []);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'Could not load policies');
      setPolicies([]);
    } finally {
      setLoading(false);
    }
  }, [vendorId]);

  useEffect(() => {
    load();
  }, [load]);

  const consentItems = [
    'Platform privacy policy and data processing — acknowledged at enrollment.',
    'Product / plan wording, exclusions, and waiting periods — shown before purchase.',
    'Pet health declaration and KYC-style checks — completed where required by your process.',
    'Cooling-off / free-look rules — follow your regulator and plan terms; platform surfaces purchase timestamps for audit.',
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <button
              type="button"
              onClick={() => router.back()}
              className="flex items-center gap-2 px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition mb-3"
            >
              <ArrowLeft className="w-5 h-5" />
              Back
            </button>
            <h1 className="text-2xl font-bold text-gray-900">Issued policies</h1>
            <p className="text-sm text-gray-500 mt-1">
              Track customer policies on your plans, status, and consent-related checkpoints
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => router.push('/insurance/plans')}>
              <FileText className="w-4 h-4 mr-2" />
              Plans &amp; products
            </Button>
            <Button variant="outline" onClick={() => router.push('/insurance/claims')}>
              <ClipboardList className="w-4 h-4 mr-2" />
              Claims
            </Button>
            <Button className="bg-orange-500 hover:bg-orange-600" onClick={() => load()} disabled={loading}>
              Refresh
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-3">
            {loading ? (
              <div className="flex justify-center py-20">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500" />
              </div>
            ) : policies.length === 0 ? (
              <Card className="p-10 text-center border-dashed">
                <Shield className="w-14 h-14 text-gray-300 mx-auto mb-4" />
                <h2 className="text-lg font-semibold text-gray-900 mb-2">No issued policies yet</h2>
                <p className="text-sm text-gray-600 max-w-md mx-auto mb-6">
                  When customers buy a plan you publish, their policies appear here for tracking, consent context, and
                  handoff to claims.
                </p>
                <Button className="bg-orange-500 hover:bg-orange-600" onClick={() => router.push('/insurance/plans')}>
                  Create or publish a plan
                </Button>
              </Card>
            ) : (
              policies.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelected(p)}
                  className={`w-full text-left rounded-xl border p-4 transition hover:border-orange-300 hover:bg-orange-50/40 ${
                    selected?.id === p.id ? 'border-orange-400 bg-orange-50/60 ring-1 ring-orange-200' : 'border-gray-200 bg-white'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="font-mono text-sm text-gray-800">{p.policy_number || p.id}</div>
                      <div className="font-medium text-gray-900 mt-0.5">{p.plan_name || 'Plan'}</div>
                      <div className="text-xs text-gray-500 mt-1 flex flex-wrap gap-x-3 gap-y-1">
                        {p.customer_name && (
                          <span className="inline-flex items-center gap-1">
                            <User className="w-3 h-3" /> {p.customer_name}
                          </span>
                        )}
                        {p.pet_name && (
                          <span className="inline-flex items-center gap-1">
                            <Heart className="w-3 h-3" /> {p.pet_name}
                          </span>
                        )}
                      </div>
                    </div>
                    <Badge variant={statusBadgeVariant(p.status)}>{p.status || 'unknown'}</Badge>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-4 text-xs text-gray-600">
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {formatDate(p.start_date)} – {formatDate(p.end_date)}
                    </span>
                    <span>Premium {formatMoney(p.premium_amount)}</span>
                    {p.coverage_amount != null && <span>Coverage {formatMoney(p.coverage_amount)}</span>}
                  </div>
                </button>
              ))
            )}
          </div>

          <div className="space-y-4">
            <Card className="p-4 border-indigo-100 bg-indigo-50/40">
              <h3 className="text-sm font-semibold text-indigo-900 flex items-center gap-2 mb-3">
                <Shield className="w-4 h-4" />
                Consent &amp; disclosures
              </h3>
              <ul className="text-xs text-indigo-950/80 space-y-2 list-disc pl-4">
                {consentItems.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              <p className="text-[11px] text-indigo-800/70 mt-3">
                Use this checklist with your compliance team. The app records purchase time and policy status; attach
                documents in your internal tools where required.
              </p>
            </Card>

            {selected && (
              <Card className="p-4 border-gray-200">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Policy detail &amp; track</h3>
                <dl className="text-xs space-y-2 text-gray-700">
                  <div className="flex justify-between gap-2">
                    <dt className="text-gray-500">Number</dt>
                    <dd className="font-mono text-right">{selected.policy_number || selected.id}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-gray-500">Plan</dt>
                    <dd className="text-right">{selected.plan_name || '—'}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-gray-500">Customer</dt>
                    <dd className="text-right">{selected.customer_name || '—'}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-gray-500">Pet</dt>
                    <dd className="text-right">{selected.pet_name || '—'}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-gray-500">Premium</dt>
                    <dd className="text-right">{formatMoney(selected.premium_amount)}</dd>
                  </div>
                  {selected.payment_frequency && (
                    <div className="flex justify-between gap-2">
                      <dt className="text-gray-500">Billing</dt>
                      <dd className="text-right">{selected.payment_frequency}</dd>
                    </div>
                  )}
                  {selected.next_payment_date && (
                    <div className="flex justify-between gap-2">
                      <dt className="text-gray-500">Next payment</dt>
                      <dd className="text-right">{formatDate(selected.next_payment_date)}</dd>
                    </div>
                  )}
                </dl>

                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-xs font-medium text-gray-700 mb-2">Lifecycle</p>
                  <PolicyTrack status={selected.status} createdAt={selected.created_at} />
                </div>

                {(selected.status || '').toLowerCase().includes('pending') && (
                  <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-100 p-2 text-xs text-amber-900">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>
                      Pending step — confirm documents and customer consent are complete before treating this policy as
                      fully active.
                    </span>
                  </div>
                )}
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function PolicyTrack({ status, createdAt }: { status?: string; createdAt?: string }) {
  const s = (status || '').toLowerCase();
  const issuedDone = true;
  const reviewDone = s !== 'pending_documents' && s !== 'pending' && s !== '';
  const activeDone = s === 'active' || s === 'paid';

  return (
    <div className="space-y-2">
      <TrackStep
        label="Issued / recorded"
        done={issuedDone}
        sub={createdAt ? formatDate(createdAt) : undefined}
      />
      <TrackStep label="Review & documents" done={reviewDone} sub={reviewDone ? 'Requirements cleared or not applicable' : 'Awaiting documents / verification'} />
      <TrackStep label="Active coverage" done={activeDone} sub={activeDone ? 'Policy in force' : 'Not active yet'} />
    </div>
  );
}

function TrackStep({ label, done, sub }: { label: string; done: boolean; sub?: string }) {
  return (
    <div className="flex gap-2 items-start">
      {done ? (
        <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
      ) : (
        <CircleDot className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
      )}
      <div>
        <div className={`text-xs font-medium ${done ? 'text-gray-900' : 'text-gray-500'}`}>{label}</div>
        {sub && <div className="text-[11px] text-gray-500">{sub}</div>}
      </div>
    </div>
  );
}
