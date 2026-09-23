'use client';

import React, { useEffect, useState } from 'react';
import {
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@warmpawz/ui';
import { apiClient } from '@/lib/api-client';
import { useCatalogServiceCategories } from '@/lib/promo-engine/use-catalog-categories';
import { applyVcfToDraft, vcfOrEmpty } from '@/lib/promo-engine/vcf';
import type {
  PromoCountChannel,
  PromoEngineDraft,
  PromoLetter,
  PromoVcfDraft,
  PromoVisitLoop,
} from '@/lib/promo-engine/types';

const LETTERS: Array<{ id: PromoLetter; label: string }> = [
  { id: 'V', label: 'Vendor' },
  { id: 'C', label: 'Category' },
  { id: 'F', label: 'Platform' },
];
const COUNT_CHANNELS: Array<{ id: PromoCountChannel; label: string }> = [
  { id: 'tele', label: 'Tele' },
  { id: 'appointment', label: 'Appointment' },
  { id: 'paybill', label: 'Pay Bill' },
];

type VendorHit = { id: string; business_name?: string; businessName?: string; role_display_name?: string };

function LetterPicker({
  value,
  onChange,
}: {
  value: PromoLetter;
  onChange: (letter: PromoLetter) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {LETTERS.map((row) => (
        <button
          key={row.id}
          type="button"
          className={`rounded-full border px-3 py-1.5 text-sm ${
            value === row.id ? 'border-[#FF8C42] bg-orange-50 text-[#FF8C42]' : 'border-slate-200'
          }`}
          onClick={() => onChange(row.id)}
        >
          {row.label}
        </button>
      ))}
    </div>
  );
}

function VendorSearch({
  value,
  label,
  onPick,
}: {
  value?: string;
  label?: string;
  onPick: (id: string, name: string) => void;
}) {
  const [q, setQ] = useState(label || '');
  const [hits, setHits] = useState<VendorHit[]>([]);
  useEffect(() => {
    const t = window.setTimeout(() => {
      const query = q.trim();
      if (query.length < 2) {
        setHits([]);
        return;
      }
      void apiClient
        .get<{ vendors?: VendorHit[] }>(`/admin/vendors?q=${encodeURIComponent(query)}&limit=20`)
        .then((res) => setHits(Array.isArray(res.vendors) ? res.vendors : []))
        .catch(() => setHits([]));
    }, 250);
    return () => window.clearTimeout(t);
  }, [q]);
  return (
    <div className="space-y-2">
      <Label>Vendor</Label>
      <Input
        value={q}
        placeholder="Search business name"
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQ(e.target.value)}
        className="min-h-11"
      />
      {value ? <p className="text-xs text-slate-500">Selected id {value}</p> : null}
      {hits.length ? (
        <ul className="max-h-40 overflow-y-auto rounded-lg border bg-white text-sm">
          {hits.map((v) => {
            const name = v.business_name || v.businessName || v.id;
            return (
              <li key={v.id}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-slate-50"
                  onClick={() => {
                    onPick(v.id, name);
                    setQ(name);
                    setHits([]);
                  }}
                >
                  <span>{name}</span>
                  <span className="text-xs text-slate-500">{v.role_display_name || ''}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

export function AudienceStep({
  draft,
  onChange,
}: {
  draft: PromoEngineDraft;
  onChange: (next: PromoEngineDraft) => void;
}) {
  const { categories, loading, error } = useCatalogServiceCategories();
  const vcf = vcfOrEmpty(draft);

  const patch = (next: PromoVcfDraft) => onChange(applyVcfToDraft(draft, next));

  const setSourceLetter = (letter: PromoLetter) => {
    patch({
      ...vcf,
      visitSource: {
        ...vcf.visitSource,
        letter,
        vendorId: letter === 'V' ? vcf.visitSource.vendorId : undefined,
        categoryId: letter === 'C' ? vcf.visitSource.categoryId : undefined,
      },
    });
  };
  const setPublishLetter = (letter: PromoLetter) => {
    patch({
      ...vcf,
      publish: {
        ...vcf.publish,
        letter,
        vendorId: letter === 'V' ? vcf.publish.vendorId : undefined,
        categoryId: letter === 'C' ? vcf.publish.categoryId : undefined,
      },
    });
  };

  return (
    <div className="space-y-6">
      <section className="space-y-4 rounded-2xl border bg-white p-5">
        <h3 className="text-base font-semibold">Visit source</h3>
        <p className="text-sm text-slate-500">Whose completed tele, appointment, and Pay Bill visits are counted. Ecommerce never counts.</p>
        <LetterPicker value={vcf.visitSource.letter} onChange={setSourceLetter} />
        {vcf.visitSource.letter === 'V' ? (
          <VendorSearch
            value={vcf.visitSource.vendorId}
            label={vcf.visitSource.vendorName}
            onPick={(id, name) =>
              patch({ ...vcf, visitSource: { ...vcf.visitSource, vendorId: id, vendorName: name } })
            }
          />
        ) : null}
        {vcf.visitSource.letter === 'C' ? (
          <div className="space-y-2">
            <Label>Category</Label>
            <Select
              value={vcf.visitSource.categoryId || ''}
              onValueChange={(id: string) => {
                const row = categories.find((c) => c.id === id);
                patch({
                  ...vcf,
                  visitSource: { ...vcf.visitSource, categoryId: id, categoryName: row?.name },
                });
              }}
            >
              <SelectTrigger className="min-h-11 bg-white">
                <SelectValue placeholder={loading ? 'Loading…' : error || 'Pick a category'} />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
        <div className="space-y-2">
          <Label>Width</Label>
          <Select
            value={vcf.visitSource.width}
            onValueChange={(w: string) =>
              patch({
                ...vcf,
                visitSource: { ...vcf.visitSource, width: w === 'specific' ? 'specific' : 'general' },
              })
            }
          >
            <SelectTrigger className="min-h-11 bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="general">General (tele + appointment + Pay Bill)</SelectItem>
              <SelectItem value="specific">Specific channels</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {vcf.visitSource.width === 'specific' ? (
          <div className="flex flex-wrap gap-2">
            {COUNT_CHANNELS.map((ch) => {
              const on = (vcf.visitSource.channels || []).includes(ch.id);
              return (
                <button
                  key={ch.id}
                  type="button"
                  className={`rounded-full border px-3 py-1.5 text-sm ${
                    on ? 'border-[#FF8C42] bg-orange-50' : 'border-slate-200'
                  }`}
                  onClick={() => {
                    const set = new Set(vcf.visitSource.channels || []);
                    if (set.has(ch.id)) set.delete(ch.id);
                    else set.add(ch.id);
                    patch({ ...vcf, visitSource: { ...vcf.visitSource, channels: Array.from(set) } });
                  }}
                >
                  {ch.label}
                </button>
              );
            })}
          </div>
        ) : null}
      </section>

      <section className="space-y-4 rounded-2xl border bg-white p-5">
        <h3 className="text-base font-semibold">Which visit</h3>
        <Select
          value={vcf.visitLoop.kind}
          onValueChange={(kind: string) => {
            const n = 'n' in vcf.visitLoop ? vcf.visitLoop.n : 1;
            const m = vcf.visitLoop.kind === 'between' ? vcf.visitLoop.m : 5;
            const loop: PromoVisitLoop =
              kind === 'every'
                ? { kind: 'every' }
                : kind === 'every_nth'
                  ? { kind: 'every_nth', n }
                  : kind === 'from_onward'
                    ? { kind: 'from_onward', n }
                    : kind === 'between'
                      ? { kind: 'between', n, m }
                      : { kind: 'visit_number', n };
            patch({ ...vcf, visitLoop: loop });
          }}
        >
          <SelectTrigger className="min-h-11 bg-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="every">Every visit</SelectItem>
            <SelectItem value="visit_number">This visit number</SelectItem>
            <SelectItem value="every_nth">Every Nth visit</SelectItem>
            <SelectItem value="from_onward">From visit N onward</SelectItem>
            <SelectItem value="between">Between N and M</SelectItem>
          </SelectContent>
        </Select>
        {vcf.visitLoop.kind !== 'every' ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>N</Label>
              <Input
                type="number"
                min={1}
                value={'n' in vcf.visitLoop ? vcf.visitLoop.n : 1}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  const n = Math.max(1, Number(e.target.value) || 1);
                  const loop = vcf.visitLoop.kind === 'between'
                    ? { ...vcf.visitLoop, n }
                    : vcf.visitLoop.kind === 'every'
                      ? vcf.visitLoop
                      : { ...vcf.visitLoop, n };
                  patch({ ...vcf, visitLoop: loop });
                }}
                className="min-h-11"
              />
            </div>
            {vcf.visitLoop.kind === 'between' ? (
              <div className="space-y-2">
                <Label>M</Label>
                <Input
                  type="number"
                  min={1}
                  value={vcf.visitLoop.m}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    const current = vcf.visitLoop;
                    if (current.kind !== 'between') return;
                    patch({
                      ...vcf,
                      visitLoop: {
                        kind: 'between',
                        n: current.n,
                        m: Math.max(1, Number(e.target.value) || 1),
                      },
                    });
                  }}
                  className="min-h-11"
                />
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="space-y-4 rounded-2xl border bg-white p-5">
        <h3 className="text-base font-semibold">Publish</h3>
        <p className="text-sm text-slate-500">Who the offer is for. Independent of visit source and redeem.</p>
        <LetterPicker value={vcf.publish.letter} onChange={setPublishLetter} />
        {vcf.publish.letter === 'V' ? (
          <VendorSearch
            value={vcf.publish.vendorId}
            label={vcf.publish.vendorName}
            onPick={(id, name) => patch({ ...vcf, publish: { ...vcf.publish, vendorId: id, vendorName: name } })}
          />
        ) : null}
        {vcf.publish.letter === 'C' ? (
          <div className="space-y-2">
            <Label>Category</Label>
            <Select
              value={vcf.publish.categoryId || ''}
              onValueChange={(id: string) => {
                const row = categories.find((c) => c.id === id);
                patch({ ...vcf, publish: { ...vcf.publish, categoryId: id, categoryName: row?.name } });
              }}
            >
              <SelectTrigger className="min-h-11 bg-white">
                <SelectValue placeholder="Pick a category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
        <div className="space-y-2">
          <Label>Ranking override (optional)</Label>
          <Select
            value={vcf.rankingOverride || 'unset'}
            onValueChange={(v: string) =>
              patch({
                ...vcf,
                rankingOverride:
                  v === 'unset'
                    ? undefined
                    : (v as PromoVcfDraft['rankingOverride']),
              })
            }
          >
            <SelectTrigger className="min-h-11 bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unset">Default — vendor beats category beats platform</SelectItem>
              <SelectItem value="least_platform_loss">Least platform loss</SelectItem>
              <SelectItem value="max_customer_discount">Max customer discount</SelectItem>
              <SelectItem value="max_customer_cashback">Max customer cashback</SelectItem>
              <SelectItem value="max_customer_total_value">Max customer total value</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </section>
    </div>
  );
}
