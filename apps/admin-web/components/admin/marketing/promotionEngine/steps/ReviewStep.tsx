'use client';

import type { PromoEngineDraft, PromoRangeLimits } from '@/lib/promo-engine/types';
import {
  describeRangeBenefits,
  rangeBoundsLabel,
  rangeTitle,
  sortedRanges,
} from '@/lib/promo-engine/ranges';
import {
  describeBenefits,
  describeConditionGroup,
  describeRedeemScope,
} from '@/lib/promo-engine/plain-language';
import { describeAudienceScope } from '@/lib/promo-engine/vcf';
import { PromotionEngineStatusBadge } from '../PromotionEngineStatusBadge';

function describeRangeLimits(limits: PromoRangeLimits): string {
  return (
    [
      limits.budgetLimit != null ? `₹${limits.budgetLimit} budget` : null,
      limits.dailyLimit != null ? `${limits.dailyLimit} / day` : null,
      limits.campaignLimit != null ? `${limits.campaignLimit} total` : null,
      limits.perUser != null ? `${limits.perUser} / customer` : null,
    ]
      .filter(Boolean)
      .join(' · ') || 'Promotion limits only'
  );
}

export function ReviewStep({ draft }: { draft: PromoEngineDraft }) {
  const { basics } = draft;
  const ranges = sortedRanges(draft.ranges);
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <p className="font-medium text-slate-800">Review & activate</p>
        <PromotionEngineStatusBadge status={draft.status} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <ReviewBlock
          title="VISIT / PUBLISH / REDEEM"
          body={
            draft.vcf
              ? `Visit ${describeAudienceScope(draft.vcf.visitSource)}${draft.vcf.visitSource.letter !== 'F' ? ' pooled' : ''} ${draft.vcf.visitSource.width}${draft.vcf.visitSource.width === 'specific' ? ` (${(draft.vcf.visitSource.channels || []).join(',')})` : ''} · ${draft.vcf.visitLoop.kind} · Publish ${describeAudienceScope(draft.vcf.publish)}${draft.vcf.publish.channels?.length ? ` on ${draft.vcf.publish.channels.join(',')}` : ''} · Redeem ${draft.vcf.redeem?.letter || '—'} ${(draft.vcf.redeem?.channels || []).join(',')}`
              : describeConditionGroup(draft.conditionJson)
          }
        />
        <ReviewBlock
          title="THEN"
          body={
            ranges.length
              ? `${ranges.length} bill range${ranges.length === 1 ? '' : 's'} (see below)`
              : describeBenefits(draft.benefitJson)
          }
        />
        <ReviewBlock title="REDEEM" body={describeRedeemScope(draft.benefitJson)} />
        <ReviewBlock
          title="STACK"
          body={`${basics.stackingPolicy.replace(/_/g, ' ')} · priority ${basics.priority}`}
        />
        <ReviewBlock
          title="LIMITS"
          body={
            [
              draft.limits?.perUser != null ? `${draft.limits.perUser} / user` : null,
              draft.limits?.perTransaction != null ? `${draft.limits.perTransaction} / txn` : null,
              draft.limits?.dailyLimit != null ? `${draft.limits.dailyLimit} / day` : null,
              draft.limits?.campaignLimit != null ? `${draft.limits.campaignLimit} campaign` : null,
              draft.limits?.budgetLimit != null ? `₹${draft.limits.budgetLimit} budget` : null,
            ]
              .filter(Boolean)
              .join(' · ') || 'No usage or budget caps'
          }
        />
        <ReviewBlock
          title="CUSTOMER MESSAGE"
          body={
            Object.values(draft.customerCopy ?? {}).some((v) => v?.trim())
              ? `Custom: ${Object.entries(draft.customerCopy ?? {})
                  .filter(([, v]) => v?.trim())
                  .map(([k]) => k)
                  .join(', ')}`
              : 'Default wording'
          }
        />
        <ReviewBlock
          title="FUNDING"
          body={
            basics.fundingType === 'SHARED'
              ? `SHARED ${basics.fundingSplit.warmpawzPercent}/${basics.fundingSplit.vendorPercent}`
              : basics.fundingType
          }
        />
      </div>

      {ranges.length ? (
        <div className="overflow-x-auto rounded-xl border bg-white">
          <table className="w-full min-w-[40rem] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2 font-semibold">Range</th>
                <th className="px-3 py-2 font-semibold">Bill</th>
                <th className="px-3 py-2 font-semibold">Benefit</th>
                <th className="px-3 py-2 font-semibold">Limits</th>
                <th className="px-3 py-2 font-semibold">Message</th>
              </tr>
            </thead>
            <tbody>
              {ranges.map((r, i) => (
                <tr key={r.key} className={`border-t ${r.active ? '' : 'text-slate-400'}`}>
                  <td className="px-3 py-2">
                    {rangeTitle(r, i)}
                    {r.active ? '' : ' (off)'}
                  </td>
                  <td className="px-3 py-2">{rangeBoundsLabel(r)}</td>
                  <td className="px-3 py-2">{describeRangeBenefits(r.benefitJson)}</td>
                  <td className="px-3 py-2">{describeRangeLimits(r.limits)}</td>
                  <td className="px-3 py-2">
                    {Object.values(r.customerCopy ?? {}).some((v) => v?.trim()) ? 'Custom' : 'Promotion wording'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <div className="rounded-xl border border-[#FF8C42]/30 bg-orange-50/50 p-4 text-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#FF8C42]">Engine model</p>
        <p className="mt-2">
          <strong>IF</strong> {describeConditionGroup(draft.conditionJson)}
        </p>
        <p className="mt-1">
          <strong>THEN</strong>{' '}
          {ranges.length
            ? ranges.map((r) => `${rangeBoundsLabel(r)}: ${describeRangeBenefits(r.benefitJson)}`).join(' | ')
            : describeBenefits(draft.benefitJson)}
        </p>
        <p className="mt-2 text-xs text-slate-500">
          {basics.name || 'Untitled'} · {basics.startAt || 'no start'} → {basics.endAt || 'no end'}
        </p>
      </div>
    </div>
  );
}

function ReviewBlock({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border bg-slate-50 p-3 text-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      <p className="mt-1 text-slate-800">{body}</p>
    </div>
  );
}
