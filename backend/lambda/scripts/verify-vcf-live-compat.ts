/**
 * READ-ONLY: run the real live-writer / evaluator functions over every backfilled profile on an env.
 * Checks: profile parses losslessly, a next Pay Bill bumps exactly F/C/V by +1 and keeps other keys,
 * and engine visit counts (F, C general, C Pay Bill only, V) equal the event log.
 *   cd backend/lambda; $env:ENVIRONMENT='prod'; $env:AWS_PROFILE='cursor-agent'
 *   npx ts-node --transpile-only scripts/verify-vcf-live-compat.ts
 */
/* eslint-disable @typescript-eslint/no-var-requires */
const { query } = require('../../../scripts/rds-data-api-utils-dev');
import { parseVisitProfile, incrementVisitProfile, visitProfileToServicesJson } from '../src/discount-engine/promo-engine/vcf/visit-profile';
import { visitCountForPromo } from '../src/discount-engine/promo-engine/vcf/visit-count';
import { COUNT_CHANNELS, GENERAL_COUNT_CHANNELS, type CountChannel, type VisitProfile } from '../src/discount-engine/promo-engine/vcf/types';

type Row = { user_id: string; services: string };
type Ev = { user_id: string; payload: string };

function flatten(p: VisitProfile): Map<string, number> {
  const out = new Map<string, number>();
  for (const ch of COUNT_CHANNELS) out.set(`F||${ch}`, p.platform[ch].count);
  for (const [id, c] of Object.entries(p.categories)) for (const ch of COUNT_CHANNELS) out.set(`C|${id}|${ch}`, c[ch].count);
  for (const [id, c] of Object.entries(p.vendors)) for (const ch of COUNT_CHANNELS) out.set(`V|${id}|${ch}`, c[ch].count);
  return out;
}

function rawFlatten(vcf: any): Map<string, number> {
  const out = new Map<string, number>();
  for (const ch of COUNT_CHANNELS) out.set(`F||${ch}`, Number(vcf?.platform?.[ch]?.count || 0));
  for (const [id, c] of Object.entries<any>(vcf?.categories || {})) for (const ch of COUNT_CHANNELS) out.set(`C|${id}|${ch}`, Number(c?.[ch]?.count || 0));
  for (const [id, c] of Object.entries<any>(vcf?.vendors || {})) for (const ch of COUNT_CHANNELS) out.set(`V|${id}|${ch}`, Number(c?.[ch]?.count || 0));
  return out;
}

function diff(a: Map<string, number>, b: Map<string, number>): string[] {
  const keys = new Set([...a.keys(), ...b.keys()]);
  return [...keys].filter((k) => (a.get(k) || 0) !== (b.get(k) || 0)).map((k) => `${k}: ${a.get(k) || 0} -> ${b.get(k) || 0}`);
}

async function main() {
  const rows: Row[] = await query(`SELECT user_id, services::text AS services FROM customer_behaviour_profiles WHERE services ? 'vcf'`);
  const events: Ev[] = await query(`
    SELECT e.user_id, e.payload::text AS payload FROM customer_behaviour_events e
    WHERE e.event_type = 'VCF_VISIT' AND NOT EXISTS (
      SELECT 1 FROM customer_behaviour_events r WHERE r.event_type = 'VCF_VISIT_REVERSE'
        AND r.user_id = e.user_id AND r.payload->>'referenceId' = e.payload->>'referenceId')`);

  const evByUser = new Map<string, any[]>();
  for (const e of events) {
    const list = evByUser.get(e.user_id) || [];
    list.push(JSON.parse(e.payload));
    evByUser.set(e.user_id, list);
  }

  const fails: string[] = [];
  let parseOk = 0, incOk = 0, countChecks = 0;

  for (const r of rows) {
    const services = JSON.parse(r.services);
    const profile = parseVisitProfile(services);

    const lossless = diff(rawFlatten(services.vcf), flatten(profile));
    if (lossless.length) fails.push(`parse ${r.user_id}: ${lossless.slice(0, 3).join('; ')}`);
    else parseOk++;

    const evs = evByUser.get(r.user_id) || [];
    const sample = evs.find((e) => e.vendorId && e.categoryId) || evs[0];
    if (sample) {
      const ch = 'paybill' as CountChannel;
      const next = incrementVisitProfile({ profile, channel: ch, vendorId: sample.vendorId, categoryId: sample.categoryId, roleId: sample.roleId });
      const d = diff(flatten(profile), flatten(next));
      const expected = [`F||${ch}`, sample.categoryId ? `C|${sample.categoryId}|${ch}` : null, sample.vendorId ? `V|${sample.vendorId}|${ch}` : null].filter(Boolean) as string[];
      const changedKeys = d.map((x) => x.split(':')[0]).sort();
      const plusOne = d.every((x) => { const [, v] = x.split(': '); const [a, b] = v.split(' -> ').map(Number); return b === a + 1; });
      const merged = visitProfileToServicesJson(services, next);
      const otherKeysKept = Object.keys(services).every((k) => k === 'vcf' || JSON.stringify(merged[k]) === JSON.stringify(services[k]));
      if (JSON.stringify(changedKeys) !== JSON.stringify(expected.sort()) || !plusOne || !otherKeysKept) {
        fails.push(`increment ${r.user_id}: changed=${changedKeys.join(',')} expected=${expected.join(',')} plusOne=${plusOne} keysKept=${otherKeysKept}`);
      } else incOk++;
    }

    const gen = (filter: (e: any) => boolean) => evs.filter((e) => filter(e) && (GENERAL_COUNT_CHANNELS as string[]).includes(e.channel)).length;
    const fCount = visitCountForPromo(profile, { letter: 'F', width: 'general' } as any);
    if (fCount !== gen(() => true)) fails.push(`F count ${r.user_id}: engine ${fCount} vs events ${gen(() => true)}`);
    countChecks++;
    for (const cat of new Set(evs.map((e) => e.categoryId).filter(Boolean))) {
      const c = visitCountForPromo(profile, { letter: 'C', categoryId: cat, width: 'general' } as any);
      const pbOnly = visitCountForPromo(profile, { letter: 'C', categoryId: cat, width: 'specific', channels: ['paybill'] } as any);
      if (c !== gen((e) => e.categoryId === cat)) fails.push(`C count ${r.user_id}/${cat}: engine ${c} vs events ${gen((e) => e.categoryId === cat)}`);
      const pbEv = evs.filter((e) => e.categoryId === cat && e.channel === 'paybill').length;
      if (pbOnly !== pbEv) fails.push(`C paybill ${r.user_id}/${cat}: engine ${pbOnly} vs events ${pbEv}`);
      countChecks += 2;
    }
    for (const vid of new Set(evs.map((e) => e.vendorId).filter(Boolean))) {
      const v = visitCountForPromo(profile, { letter: 'V', vendorId: vid, width: 'general' } as any);
      if (v !== gen((e) => e.vendorId === vid)) fails.push(`V count ${r.user_id}/${vid}: engine ${v} vs events ${gen((e) => e.vendorId === vid)}`);
      countChecks++;
    }
  }

  console.log('RESULT ' + JSON.stringify({ profiles: rows.length, parseLossless: parseOk, incrementExactlyPlusOne: incOk, visitCountChecks: countChecks, failures: fails.length, samples: fails.slice(0, 15) }));
  if (fails.length) process.exitCode = 2;
}

main().catch((e) => {
  console.error('ERR ' + e.message);
  process.exit(1);
});
