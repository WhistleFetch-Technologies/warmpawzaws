'use client';

import { useEffect, useState } from 'react';

type Policy = {
  version: number;
  maxServiceRadiusKm: number;
  zoneABoundaryKm: number;
  runtimeSignals?: {
    festivalActive?: boolean;
    rainActive?: boolean;
  };
  zones: {
    zoneA: { minOrderInr: number; maxOrderInr: number | null; deliveryFeeInr: number }[];
    zoneB: { minOrderInr: number; maxOrderInr: number | null; deliveryFeeInr: number }[];
  };
  surges: {
    weekendInr: number;
    festivalMinInr: number;
    festivalMaxInr: number;
    rainMinInr: number;
    rainMaxInr: number;
    priorityNote?: string;
  };
  content: {
    coverageSummary: string;
    zoneADescription?: string;
    zoneBDescription?: string;
    surgeIntro?: string;
    rulesFreeDelivery: string[];
    rulesBeyond5Km: string[];
    rulesBeyond8Km: string[];
    importantNotes: string[];
  };
};

function apiBase(): string {
  return (
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    process.env.API_GATEWAY_URL ||
    'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com'
  ).replace(/\/+$/, '');
}

export default function DeliveryFeesHelpPage() {
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${apiBase()}/customer/delivery-fee-policy`);
        const j = await res.json();
        if (!cancelled && j.success && j.policy) {
          setPolicy(j.policy as Policy);
        } else if (!cancelled) {
          setErr(j.error || 'Could not load policy');
        }
      } catch (e: unknown) {
        if (!cancelled) setErr(e instanceof Error ? e.message : 'Failed to load');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (err) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-10">
        <p className="text-red-600">{err}</p>
      </main>
    );
  }

  if (!policy) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-10">
        <p className="text-gray-600">Loading delivery information…</p>
      </main>
    );
  }

  const fmtRange = (min: number, max: number | null) => {
    if (max === null) return `₹${min} & above`;
    if (min === 0) return `Below ₹${max}`;
    return `₹${min} – below ₹${max}`;
  };

  return (
    <main className="max-w-3xl mx-auto px-4 py-10 space-y-10 text-gray-800">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Delivery fee & coverage</h1>
        <p className="mt-2 text-gray-600">{policy.content.coverageSummary}</p>
        {(policy.runtimeSignals?.festivalActive || policy.runtimeSignals?.rainActive) && (
          <div
            className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
            role="status"
          >
            <p className="font-medium">Surge pricing is on right now</p>
            <ul className="mt-1 list-disc pl-5">
              {policy.runtimeSignals?.festivalActive && (
                <li>Festival surcharge may apply to delivery (see amounts below).</li>
              )}
              {policy.runtimeSignals?.rainActive && (
                <li>Rain surcharge may apply to delivery (see amounts below).</li>
              )}
            </ul>
          </div>
        )}
      </header>

      <section>
        <h2 className="text-lg font-semibold">Delivery charges — Zone A (up to {policy.zoneABoundaryKm} KM)</h2>
        {policy.content.zoneADescription && (
          <p className="text-sm text-gray-600 mt-1">{policy.content.zoneADescription}</p>
        )}
        <table className="mt-3 w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-3 border-b">Order value</th>
              <th className="text-left p-3 border-b">Delivery fee</th>
            </tr>
          </thead>
          <tbody>
            {policy.zones.zoneA.map((row, i) => (
              <tr key={i} className="border-b border-gray-100">
                <td className="p-3">{fmtRange(row.minOrderInr, row.maxOrderInr)}</td>
                <td className="p-3">{row.deliveryFeeInr === 0 ? 'FREE' : `₹${row.deliveryFeeInr}`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Zone B (beyond {policy.zoneABoundaryKm} KM up to {policy.maxServiceRadiusKm} KM)</h2>
        {policy.content.zoneBDescription && (
          <p className="text-sm text-gray-600 mt-1">{policy.content.zoneBDescription}</p>
        )}
        <table className="mt-3 w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-3 border-b">Order value</th>
              <th className="text-left p-3 border-b">Delivery fee</th>
            </tr>
          </thead>
          <tbody>
            {policy.zones.zoneB.map((row, i) => (
              <tr key={i} className="border-b border-gray-100">
                <td className="p-3">{fmtRange(row.minOrderInr, row.maxOrderInr)}</td>
                <td className="p-3">{row.deliveryFeeInr === 0 ? 'FREE' : `₹${row.deliveryFeeInr}`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Additional surge charges</h2>
        <p className="text-sm text-gray-600 mt-1">{policy.content.surgeIntro}</p>
        <ul className="mt-2 list-disc pl-5 text-sm space-y-1">
          <li>Weekend surge: ₹{policy.surges.weekendInr}</li>
          <li>
            Festival surge: ₹{policy.surges.festivalMinInr}–{policy.surges.festivalMaxInr}
          </li>
          <li>
            Rain surge: ₹{policy.surges.rainMinInr}–{policy.surges.rainMaxInr}
          </li>
          {policy.surges.priorityNote && <li>{policy.surges.priorityNote}</li>}
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Free delivery eligibility</h2>
        <ul className="mt-2 list-disc pl-5 text-sm space-y-1">
          {policy.content.rulesFreeDelivery.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Orders beyond 5 KM</h2>
        <ul className="mt-2 list-disc pl-5 text-sm space-y-1">
          {policy.content.rulesBeyond5Km.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Orders beyond 8 KM</h2>
        <ul className="mt-2 list-disc pl-5 text-sm space-y-1">
          {policy.content.rulesBeyond8Km.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Important notes</h2>
        <ul className="mt-2 list-disc pl-5 text-sm space-y-1">
          {policy.content.importantNotes.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ul>
      </section>
    </main>
  );
}
