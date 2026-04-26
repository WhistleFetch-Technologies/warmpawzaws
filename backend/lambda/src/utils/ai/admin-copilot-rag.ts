/**
 * Lightweight admin product-doc retrieval (keyword overlap, no embeddings).
 * Caps total injected chars for cost control. Replace with Bedrock KB later if needed.
 */

export type AdminCopilotDocChunk = { id: string; title: string; body: string };

/** Bundled chunks — keep factual and non-secret. */
const CHUNKS: AdminCopilotDocChunk[] = [
  {
    id: 'overview',
    title: 'Admin portal overview',
    body: `Warmpawz admin is a web portal for platform operators. Main areas: Vendors (onboarding approval, listings),
Customers, Service catalog, Settlements and finance, Governance, Integrations, Roles (RBAC), Platform settings (includes AWS/Bedrock JSON).
Use the sidebar to navigate. Vendor pending applications appear under Vendors; proactive toasts may alert when new items arrive.`,
  },
  {
    id: 'vendors-approval',
    title: 'Vendor approvals',
    body: `Pending vendor applications live in vendor onboarding queues (SUBMITTED, PENDING, UNDER_REVIEW).
Admins with admin.vendors can review and approve. Re-verification may appear for previously approved vendors after profile changes.`,
  },
  {
    id: 'rbac',
    title: 'Roles and permissions',
    body: `Admin capabilities are stored as permission strings (e.g. admin.vendors, admin.platform_settings, admin.ai_copilot).
admin.full_access grants all portal sections. Assign permissions via Roles management; users need active user_roles rows.`,
  },
  {
    id: 'ai-copilot',
    title: 'Admin AI copilot',
    body: `The copilot uses AWS Bedrock when enabled in platform settings. It may call read-only tools (counts, safe settings, vendor snapshots).
It does not execute writes or arbitrary SQL. If disabled via admin:settings:ai_copilot or ADMIN_AI_COPILOT_ENABLED=false, chat returns unavailable.`,
  },
];

const MAX_RAG_CHARS = 8000;

function tokenize(s: string): string[] {
  return String(s || '')
    .toLowerCase()
    .split(/[^a-z0-9_]+/g)
    .filter((w) => w.length > 2);
}

function scoreChunk(queryTokens: Set<string>, chunk: AdminCopilotDocChunk): number {
  const text = `${chunk.title}\n${chunk.body}`.toLowerCase();
  let score = 0;
  for (const t of queryTokens) {
    if (text.includes(t)) score += 1;
  }
  return score;
}

/**
 * Returns markdown-ish block for system prompt from pathname + user message.
 */
export function buildAdminCopilotRagContext(pathname: string | undefined, userMessage: string): string {
  const qTokens = new Set([
    ...tokenize(userMessage),
    ...tokenize(pathname || ''),
    ...tokenize((pathname || '').replace(/\//g, ' ')),
  ]);

  const scored = CHUNKS.map((c) => ({ c, s: scoreChunk(qTokens, c) }))
    .sort((a, b) => b.s - a.s)
    .filter((x) => x.s > 0)
    .slice(0, 5);

  const picked = scored.length > 0 ? scored.map((x) => x.c) : CHUNKS.slice(0, 2);

  let out = 'INTERNAL_HELP_EXCERPTS (non-authoritative — prefer TOOL_RESULTS_JSON when present):\n';
  let len = out.length;
  for (const ch of picked) {
    const block = `### ${ch.title}\n${ch.body}\n\n`;
    if (len + block.length > MAX_RAG_CHARS) break;
    out += block;
    len += block.length;
  }
  return out.trimEnd();
}
