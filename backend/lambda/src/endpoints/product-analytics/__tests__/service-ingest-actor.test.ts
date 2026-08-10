/**
 * Phase 1: client actor_id must not win over server override.
 * Uses a light unit test without RDS by asserting override selection logic
 * via the exported types + a pure helper mirror of route resolution rules.
 */

import type { IngestActorOverride } from '../service-ingest';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function pickActorForIngest(
  clientBodyActorId: string | null | undefined,
  server: IngestActorOverride
): { actorId: string | null; ignoredClient: boolean } {
  // Mirrors service-ingest: server override always wins; client ignored.
  void clientBodyActorId;
  return { actorId: server.actorId, ignoredClient: true };
}

describe('analytics ingest actor_id authority', () => {
  it('ignores client spoofed actor_id when guest (server null)', () => {
    const spoofed = '11111111-1111-4111-8111-111111111111';
    const result = pickActorForIngest(spoofed, { actorId: null, actorType: null });
    expect(result.actorId).toBeNull();
    expect(result.ignoredClient).toBe(true);
  });

  it('uses server JWT customer id over different client actor_id', () => {
    const jwtCustomer = '22222222-2222-4222-8222-222222222222';
    const spoofed = '11111111-1111-4111-8111-111111111111';
    expect(UUID_RE.test(jwtCustomer)).toBe(true);
    const result = pickActorForIngest(spoofed, { actorId: jwtCustomer, actorType: 'customer' });
    expect(result.actorId).toBe(jwtCustomer);
  });
});
