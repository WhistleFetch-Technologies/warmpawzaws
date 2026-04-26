import {
  adminCopilotMayTriggerDataAgent,
  filterAdminCopilotToolRequestsByPermissions,
  parseAdminCopilotToolRequestsFromCompletion,
  toolRequestAllowedForPermissions,
} from '../ai/admin-ai-copilot-tools-core';

describe('admin-ai-copilot-tools-core', () => {
  it('parses toolRequests from JSON', () => {
    const raw = '{"toolRequests":[{"name":"get_pending_vendor_applications_summary","args":{}}]}';
    const req = parseAdminCopilotToolRequestsFromCompletion(raw);
    expect(req).toHaveLength(1);
    expect(req[0].name).toBe('get_pending_vendor_applications_summary');
  });

  it('rejects unknown tool names', () => {
    const raw = '{"toolRequests":[{"name":"drop_database","args":{}}]}';
    expect(parseAdminCopilotToolRequestsFromCompletion(raw)).toHaveLength(0);
  });

  it('toolRequestAllowedForPermissions enforces vendor vs platform', () => {
    const vendorOnly = ['admin.vendors'];
    expect(
      toolRequestAllowedForPermissions(
        { name: 'get_pending_vendor_applications_summary', args: {} },
        vendorOnly
      )
    ).toBe(true);
    expect(
      toolRequestAllowedForPermissions({ name: 'get_platform_setting_json_safe', args: { key: 'x' } }, vendorOnly)
    ).toBe(false);

    const platformOnly = ['admin.platform_settings'];
    expect(
      toolRequestAllowedForPermissions(
        { name: 'get_platform_setting_json_safe', args: { key: 'admin:settings:ai_copilot' } },
        platformOnly
      )
    ).toBe(true);
    expect(
      toolRequestAllowedForPermissions({ name: 'get_vendor_public_snapshot', args: {} }, platformOnly)
    ).toBe(false);
  });

  it('filterAdminCopilotToolRequestsByPermissions drops disallowed', () => {
    const reqs = parseAdminCopilotToolRequestsFromCompletion(
      '{"toolRequests":[' +
        '{"name":"get_pending_vendor_applications_summary","args":{}},' +
        '{"name":"get_platform_setting_json_safe","args":{"key":"admin:settings:ai_copilot"}}' +
        ']}'
    );
    const filtered = filterAdminCopilotToolRequestsByPermissions(reqs, ['admin.vendors']);
    expect(filtered.map((r) => r.name)).toEqual(['get_pending_vendor_applications_summary']);
  });

  it('adminCopilotMayTriggerDataAgent is false for tiny greetings', () => {
    expect(adminCopilotMayTriggerDataAgent('hi')).toBe(false);
  });

  it('adminCopilotMayTriggerDataAgent is true for vendor questions', () => {
    expect(adminCopilotMayTriggerDataAgent('How many pending vendor applications?')).toBe(true);
  });
});
