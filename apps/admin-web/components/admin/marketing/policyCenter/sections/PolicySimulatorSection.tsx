'use client';

import { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Label,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Button,
  Badge,
  Switch,
} from '@warmpawz/ui';
import { Play, Check, X } from 'lucide-react';
import { simulatePolicy } from '@/lib/discount-policy/discount-policy-api';
import { POLICY_DOMAIN_OPTIONS } from '@/lib/discount-policy/option-registry';
import {
  DEFAULT_SIMULATOR_SCENARIO,
  simulatePolicyLocally,
  type PolicySimulationResult,
  type SimulatorOfferInput,
} from '@/lib/discount-policy/policy-simulator-local';
import { ComingSoonPanel } from '../shared/ApiPendingBanner';
import type { DiscountPolicyBundle } from '@/lib/discount-policy/types';

const OFFER_LABELS: Record<string, string> = {
  VENDOR_PROMOTION: 'Vendor Promotion',
  PLATFORM_PROMOTION: 'Platform Promotion',
  VENDOR_COUPON: 'Vendor Coupon',
  PLATFORM_COUPON: 'Platform Coupon',
};

function formatCurrency(n: number): string {
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

export function PolicySimulatorSection({ draft }: { draft: DiscountPolicyBundle }) {
  const [servicePrice, setServicePrice] = useState(String(DEFAULT_SIMULATOR_SCENARIO.servicePrice));
  const [domain, setDomain] = useState('SERVICE');
  const [offers, setOffers] = useState<SimulatorOfferInput[]>(DEFAULT_SIMULATOR_SCENARIO.offers);
  const [result, setResult] = useState<PolicySimulationResult | unknown>(null);
  const [usedLocal, setUsedLocal] = useState(false);
  const [loading, setLoading] = useState(false);

  const patchOffer = (index: number, patch: Partial<SimulatorOfferInput>) => {
    setOffers((prev) => prev.map((o, i) => (i === index ? { ...o, ...patch } : o)));
  };

  const run = async () => {
    setLoading(true);
    setUsedLocal(false);
    setResult(null);
    try {
      const input = {
        servicePrice: Number(servicePrice),
        domain,
        offers,
        bundle: draft,
      };
      const res = await simulatePolicy(input);
      if (res) {
        setResult(res);
      } else {
        setUsedLocal(true);
        setResult(
          simulatePolicyLocally(draft, {
            servicePrice: Number(servicePrice),
            domain,
            offers,
          })
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const localResult = result as PolicySimulationResult | null;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Policy simulator</CardTitle>
          <CardDescription>
            Preview eligible offers, winning offer, and funding split using current draft policy.
            Uses backend resolver when available; otherwise runs a local preview.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="sim-amount">Service price (₹)</Label>
              <Input
                id="sim-amount"
                type="number"
                min={0}
                value={servicePrice}
                onChange={(e) => setServicePrice(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sim-domain">Domain</Label>
              <Select value={domain} onValueChange={setDomain}>
                <SelectTrigger id="sim-domain" className="bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {POLICY_DOMAIN_OPTIONS.map((d) => (
                    <SelectItem key={d.value} value={d.value}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium text-slate-700">Sample offers</p>
            <div className="space-y-2">
              {offers.map((offer, index) => (
                <div
                  key={offer.offerType}
                  className="grid gap-3 rounded-lg border p-3 sm:grid-cols-[1fr_auto_auto_auto]"
                >
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={offer.enabled}
                      onCheckedChange={(enabled) => patchOffer(index, { enabled })}
                    />
                    <span className="text-sm font-medium">
                      {OFFER_LABELS[offer.offerType] ?? offer.offerType}
                    </span>
                  </div>
                  <Select
                    value={offer.discountType}
                    onValueChange={(v) =>
                      patchOffer(index, { discountType: v as 'PERCENT' | 'FIXED' })
                    }
                  >
                    <SelectTrigger className="bg-white w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PERCENT">Percent</SelectItem>
                      <SelectItem value="FIXED">Fixed ₹</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    min={0}
                    className="w-24"
                    value={offer.value}
                    onChange={(e) => patchOffer(index, { value: Number(e.target.value) })}
                  />
                </div>
              ))}
            </div>
          </div>

          <Button type="button" onClick={() => void run()} disabled={loading}>
            <Play className="mr-1.5 h-4 w-4" aria-hidden />
            {loading ? 'Running…' : 'Run simulation'}
          </Button>
        </CardContent>
      </Card>

      {usedLocal ? (
        <ComingSoonPanel
          title="Local preview mode"
          description="POST /admin/discount-policy/simulate is not available. Showing local preview aligned with business rules — settlement uses backend when API ships."
          apiPath="POST /admin/discount-policy/simulate"
        />
      ) : null}

      {localResult && 'eligibleOffers' in localResult ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Eligible offers</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {localResult.eligibleOffers.map((o) => (
                <div key={o.offerType} className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-emerald-600" aria-hidden />
                  <span>{o.label}</span>
                  <Badge variant="outline" className="ml-auto">
                    {formatCurrency(o.discountAmount)} off
                  </Badge>
                </div>
              ))}
              {!localResult.eligibleOffers.length ? (
                <p className="text-sm text-slate-500">No eligible offers for this scenario.</p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Winning offer</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {localResult.winningOffer ? (
                <>
                  <p className="text-lg font-semibold text-slate-900">
                    {localResult.winningOffer.label}
                  </p>
                  <p className="text-sm text-slate-600">
                    <strong>Reason:</strong> {localResult.reason}
                  </p>
                  {localResult.ignoredOffers.length ? (
                    <div className="border-t pt-3">
                      <p className="mb-2 text-xs font-medium uppercase text-slate-500">
                        All others ignored
                      </p>
                      {localResult.ignoredOffers.map((o) => (
                        <div key={o.offerType} className="flex items-center gap-2 text-sm text-slate-600">
                          <X className="h-3.5 w-3.5" aria-hidden />
                          {o.label}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </>
              ) : (
                <p className="text-sm text-slate-500">No winning offer.</p>
              )}
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Financial preview</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ['Customer pays', formatCurrency(localResult.customerPays)],
                ['Total savings', formatCurrency(localResult.totalSavings)],
                ['Vendor funds', formatCurrency(localResult.vendorFunds)],
                ['Platform funds', formatCurrency(localResult.platformFunds)],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-lg border bg-slate-50/50 p-3">
                  <p className="text-xs font-medium uppercase text-slate-500">{label}</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">{value}</p>
                </div>
              ))}
              <div className="sm:col-span-2 lg:col-span-4 rounded-lg border border-dashed p-3 text-sm text-slate-600">
                <strong>Settlement preview:</strong> {localResult.settlementPreview}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : result ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Simulation result</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="overflow-x-auto rounded-lg bg-slate-900 p-4 text-xs text-slate-100">
              {JSON.stringify(result, null, 2)}
            </pre>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
