import { buildAdminCopilotRagContext } from '../ai/admin-copilot-rag';

describe('admin-copilot-rag', () => {
  it('returns non-empty context for vendor path', () => {
    const ctx = buildAdminCopilotRagContext('/vendors', 'approval queue');
    expect(ctx).toContain('INTERNAL_HELP_EXCERPTS');
    expect(ctx.toLowerCase()).toContain('vendor');
  });
});
