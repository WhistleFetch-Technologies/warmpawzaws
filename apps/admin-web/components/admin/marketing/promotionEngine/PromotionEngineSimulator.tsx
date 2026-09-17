'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@warmpawz/ui';
import { evaluatePromoEngine } from '@/lib/promo-engine/api-client';
import { SERVICE_CATEGORIES } from '@/lib/promo-engine/types';

/**
 * Admin rule evaluation simulator — POST /promo-engine/evaluate only (never commit).
 */
export function PromotionEngineSimulator() {
  const [userId, setUserId] = useState('demo-user');
  const [service, setService] = useState('GROOMING');
  const [amount, setAmount] = useState(1500);
  const [groomingVisits, setGroomingVisits] = useState(5);
  const [daysSince, setDaysSince] = useState(45);
  const [vetVisits, setVetVisits] = useState(0);
  const [totalSpend, setTotalSpend] = useState(8000);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Awaited<ReturnType<typeof evaluatePromoEngine>> | null>(
    null
  );

  const run = async () => {
    setBusy(true);
    try {
      const last = new Date(Date.now() - daysSince * 86400000).toISOString();
      const res = await evaluatePromoEngine({
        user_id: userId,
        transaction: {
          type: 'BOOKING',
          service_category: service,
          amount,
        },
        behaviour_override: {
          overall: { completed_orders: groomingVisits + vetVisits, total_spend: totalSpend },
          services: {
            grooming: {
              completed_count: groomingVisits,
              last_completed_at: last,
              total_spend: Math.round(totalSpend * 0.6),
            },
            vet: { completed_count: vetVisits, total_spend: 0 },
          },
        },
      });
      setResult(res);
      toast.success(res.eligible ? 'ELIGIBLE' : 'Not eligible');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Evaluate failed — is Lambda deployed?');
      setResult(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-8 rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Rule evaluation simulator</h3>
          <p className="text-sm text-slate-500">
            Test mode — calls evaluate only. Never credits wallet.
          </p>
        </div>
        <Button type="button" disabled={busy} onClick={() => void run()}>
          Run evaluation
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <div>
            <Label>Customer id</Label>
            <Input value={userId} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUserId(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Grooming visits</Label>
              <Input
                type="number"
                value={groomingVisits}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setGroomingVisits(Number(e.target.value) || 0)
                }
              />
            </div>
            <div>
              <Label>Days since last grooming</Label>
              <Input
                type="number"
                value={daysSince}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setDaysSince(Number(e.target.value) || 0)
                }
              />
            </div>
            <div>
              <Label>Vet visits</Label>
              <Input
                type="number"
                value={vetVisits}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setVetVisits(Number(e.target.value) || 0)
                }
              />
            </div>
            <div>
              <Label>Total spend ₹</Label>
              <Input
                type="number"
                value={totalSpend}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setTotalSpend(Number(e.target.value) || 0)
                }
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Service</Label>
              <Select value={service} onValueChange={setService}>
                <SelectTrigger className="bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SERVICE_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Order value ₹</Label>
              <Input
                type="number"
                value={amount}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setAmount(Number(e.target.value) || 0)
                }
              />
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm">
          {result ? (
            <>
              <p
                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                  result.eligible ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
                }`}
              >
                {result.eligible ? 'ELIGIBLE' : 'NOT ELIGIBLE'}
              </p>
              <ul className="mt-3 space-y-1 text-slate-700">
                <li>Discount: ₹{result.summary.discount}</li>
                <li>Cashback (pending): ₹{result.summary.cashback}</li>
                <li>Payable: ₹{result.summary.payable}</li>
                <li className="text-xs text-slate-500">evaluation_id: {result.evaluation_id}</li>
              </ul>
            </>
          ) : (
            <p className="text-slate-500">Run evaluation to see PASS/FAIL and payable.</p>
          )}
        </div>
      </div>
    </div>
  );
}
