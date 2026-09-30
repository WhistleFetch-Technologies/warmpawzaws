'use client';

import React from 'react';
import {
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@warmpawz/ui';
import type { CatalogServiceCategory } from '@/lib/promo-engine/catalog-categories';
import { useCatalogServiceCategories } from '@/lib/promo-engine/use-catalog-categories';
import {
  applyVcfToDraft,
  audienceScopeEntries,
  normalizeScopeMulti,
  syncRedeemAfterAudience,
  vcfOrEmpty,
  withScopeList,
} from '@/lib/promo-engine/vcf';
import type {
  PromoAudienceScope,
  PromoCountChannel,
  PromoEngineDraft,
  PromoLetter,
  PromoVcfDraft,
  PromoVisitLoop,
} from '@/lib/promo-engine/types';
import { CategoryMultiChips } from './CategoryMultiChips';
import { VendorMultiPicker } from './VendorMultiPicker';

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

function ScopeListPicker<T extends PromoAudienceScope>({
  scope,
  noun,
  categories,
  loading,
  error,
  onChange,
}: {
  scope: T;
  noun: string;
  categories: CatalogServiceCategory[];
  loading: boolean;
  error: string | null;
  onChange: (next: T) => void;
}) {
  if (scope.letter !== 'V' && scope.letter !== 'C') return null;
  const letter = scope.letter;
  const { ids, names } = audienceScopeEntries(scope, letter);
  const set = (nextIds: string[], nextNames: string[]) =>
    onChange(withScopeList(scope, letter, { ids: nextIds, names: nextNames }));
  if (letter === 'V') {
    return <VendorMultiPicker label={`Vendors ${noun}`} ids={ids} names={names} onChange={set} />;
  }
  return (
    <CategoryMultiChips
      label={`Categories ${noun}`}
      categories={categories}
      loading={loading}
      error={error}
      ids={ids}
      names={names}
      onChange={set}
    />
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

  const patch = (next: PromoVcfDraft) =>
    onChange(applyVcfToDraft(draft, syncRedeemAfterAudience(next)));

  const setSourceLetter = (letter: PromoLetter) => {
    patch({
      ...vcf,
      visitSource: { ...normalizeScopeMulti({ ...vcf.visitSource, letter }), countMode: 'pooled' },
    });
  };
  const setPublishLetter = (letter: PromoLetter) => {
    patch({ ...vcf, publish: normalizeScopeMulti({ ...vcf.publish, letter }) });
  };
  const sourceLetter = vcf.visitSource.letter;
  const sourceEntries =
    sourceLetter === 'V' || sourceLetter === 'C'
      ? audienceScopeEntries(vcf.visitSource, sourceLetter)
      : { ids: [], names: [] };
  const canCopySource =
    vcf.publish.letter === sourceLetter && sourceLetter !== 'F' && sourceEntries.ids.length > 0;
  const copySourceToPublish = () => {
    if (sourceLetter !== 'V' && sourceLetter !== 'C') return;
    patch({ ...vcf, publish: withScopeList(vcf.publish, sourceLetter, sourceEntries) });
  };

  return (
    <div className="space-y-6">
      <section className="space-y-4 rounded-2xl border bg-white p-5">
        <h3 className="text-base font-semibold">Visit source</h3>
        <p className="text-sm text-slate-500">Whose completed tele, appointment, and Pay Bill visits are counted. Ecommerce never counts.</p>
        <LetterPicker value={vcf.visitSource.letter} onChange={setSourceLetter} />
        <ScopeListPicker
          scope={vcf.visitSource}
          noun="whose visits count"
          categories={categories}
          loading={loading}
          error={error}
          onChange={(visitSource) => patch({ ...vcf, visitSource: { ...visitSource, countMode: 'pooled' } })}
        />
        {sourceLetter !== 'F' ? (
          <p className="text-xs text-slate-500">
            Visits across all selected are counted together. A customer&apos;s 1st visit to any of them
            uses up the &quot;1st visit&quot;.
          </p>
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
        {canCopySource ? (
          <button
            type="button"
            className="rounded-full border border-slate-200 px-3 py-1.5 text-sm hover:border-[#FF8C42]"
            onClick={copySourceToPublish}
          >
            Same as visit source
          </button>
        ) : null}
        <ScopeListPicker
          scope={vcf.publish}
          noun="where the offer applies"
          categories={categories}
          loading={loading}
          error={error}
          onChange={(publish) => patch({ ...vcf, publish })}
        />
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
