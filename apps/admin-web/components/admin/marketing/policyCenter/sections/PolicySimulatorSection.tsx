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
} from '@warmpawz/ui';
import { Play } from 'lucide-react';
import { simulatePolicy } from '@/lib/discount-policy/discount-policy-api';
import { POLICY_DOMAIN_OPTIONS } from '@/lib/discount-policy/option-registry';
import { ComingSoonPanel } from '../shared/ApiPendingBanner';

export function PolicySimulatorSection() {
  const [bookingAmount, setBookingAmount] = useState('1000');
  const [domain, setDomain] = useState('SERVICE');
  const [result, setResult] = useState<unknown>(null);
  const [apiUnavailable, setApiUnavailable] = useState(false);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    setApiUnavailable(false);
    setResult(null);
    try {
      const res = await simulatePolicy({
        bookingAmount: Number(bookingAmount),
        domain,
      });
      if (!res) {
        setApiUnavailable(true);
      } else {
        setResult(res);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Policy simulator</CardTitle>
          <CardDescription>
            Dry-run resolver output from the backend — UI never simulates discounts locally.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="sim-amount">Booking amount (₹)</Label>
              <Input
                id="sim-amount"
                type="number"
                min={0}
                value={bookingAmount}
                onChange={(e) => setBookingAmount(e.target.value)}
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

          <Button type="button" onClick={() => void run()} disabled={loading}>
            <Play className="mr-1.5 h-4 w-4" aria-hidden />
            {loading ? 'Running…' : 'Run simulation'}
          </Button>
        </CardContent>
      </Card>

      {apiUnavailable ? (
        <ComingSoonPanel
          title="Simulator coming soon"
          description="POST /admin/discount-policy/simulate will invoke the unified resolver in dry-run mode. Expected priority, stack, funding, settlement, and savings are computed server-side only."
          apiPath="POST /admin/discount-policy/simulate"
        />
      ) : null}

      {result ? (
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
