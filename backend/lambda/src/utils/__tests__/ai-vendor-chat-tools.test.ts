import {
  parseVendorToolRequestsFromCompletion,
  vendorChatMayTriggerToolPass,
  vendorChatMayTriggerDataAgent,
  vendorChatMayTriggerBookingRevenueTool,
  formatVendorToolResultsForPrompt,
  executeVendorToolRequestsWithQuery,
} from '../ai/ai-vendor-chat-tools-core';

describe('vendorChatMayTriggerToolPass', () => {
  it('returns false for generic greeting', () => {
    expect(vendorChatMayTriggerToolPass('hi')).toBe(false);
    expect(vendorChatMayTriggerToolPass('how do I add a service')).toBe(false);
  });

  it('returns true for instant tele wording', () => {
    expect(vendorChatMayTriggerToolPass('Is my instant tele on?')).toBe(true);
    expect(vendorChatMayTriggerToolPass('instant tele availability')).toBe(true);
  });

  it('returns true for tele + on/off style questions', () => {
    expect(vendorChatMayTriggerToolPass('Is tele queue enabled for me')).toBe(true);
  });

  it('returns true for month earnings / revenue questions', () => {
    expect(vendorChatMayTriggerToolPass('how much money did I make this month')).toBe(true);
    expect(vendorChatMayTriggerBookingRevenueTool('how much money did I make this month')).toBe(true);
    expect(vendorChatMayTriggerBookingRevenueTool('earnings this month')).toBe(true);
    expect(vendorChatMayTriggerBookingRevenueTool('revenue last month')).toBe(true);
  });

  it('does not treat tele-only questions as booking revenue', () => {
    expect(vendorChatMayTriggerBookingRevenueTool('Is my instant tele on?')).toBe(false);
    expect(vendorChatMayTriggerToolPass('Is my instant tele on?')).toBe(true);
  });
});

describe('vendorChatMayTriggerDataAgent', () => {
  it('returns false for trivial greetings', () => {
    expect(vendorChatMayTriggerDataAgent('hi')).toBe(false);
    expect(vendorChatMayTriggerDataAgent('hello')).toBe(false);
  });

  it('returns true for questions and discovery-style wording', () => {
    expect(vendorChatMayTriggerDataAgent('Why am I not showing in customer search?')).toBe(true);
    expect(vendorChatMayTriggerDataAgent('What is wrong with my services?')).toBe(true);
    expect(vendorChatMayTriggerDataAgent('List my last bookings')).toBe(true);
  });
});

describe('parseVendorToolRequestsFromCompletion', () => {
  it('parses allowlisted tools and ignores unknown', () => {
    const raw = `Here is JSON:
{"toolRequests":[{"name":"get_vendor_tele_flags","args":{}},{"name":"evil_tool","args":{}}]}`;
    const p = parseVendorToolRequestsFromCompletion(raw);
    expect(p).toEqual([{ name: 'get_vendor_tele_flags', args: {} }]);
  });

  it('parses get_vendor_booking_revenue_month with period', () => {
    const raw = JSON.stringify({
      toolRequests: [{ name: 'get_vendor_booking_revenue_month', args: { period: 'previous_month' } }],
    });
    expect(parseVendorToolRequestsFromCompletion(raw)).toEqual([
      { name: 'get_vendor_booking_revenue_month', args: { period: 'previous_month' } },
    ]);
  });

  it('parses get_vendor_recent_bookings and get_vendor_services_snapshot', () => {
    const raw = JSON.stringify({
      toolRequests: [
        { name: 'get_vendor_recent_bookings', args: { limit: 3 } },
        { name: 'get_vendor_services_snapshot', args: {} },
      ],
    });
    expect(parseVendorToolRequestsFromCompletion(raw)).toEqual([
      { name: 'get_vendor_recent_bookings', args: { limit: 3 } },
      { name: 'get_vendor_services_snapshot', args: {} },
    ]);
  });

  it('returns empty for missing toolRequests', () => {
    expect(parseVendorToolRequestsFromCompletion('{"foo":1}')).toEqual([]);
  });

  it('caps at max tools', () => {
    const raw = JSON.stringify({
      toolRequests: [
        { name: 'get_vendor_tele_flags', args: {} },
        { name: 'get_vendor_tele_flags', args: {} },
        { name: 'get_vendor_tele_flags', args: {} },
      ],
    });
    expect(parseVendorToolRequestsFromCompletion(raw).length).toBeLessThanOrEqual(2);
  });
});

describe('formatVendorToolResultsForPrompt', () => {
  it('returns empty object when no results', () => {
    expect(formatVendorToolResultsForPrompt({})).toBe('');
  });

  it('embeds JSON string', () => {
    const s = formatVendorToolResultsForPrompt({ get_vendor_tele_flags: { availableForInstantTele: true } });
    expect(s).toContain('TOOL_RESULTS_JSON');
    expect(s).toContain('"availableForInstantTele":true');
  });
});

describe('executeVendorToolRequestsWithQuery', () => {
  it('returns tele flag from injected query', async () => {
    const runQuery = jest.fn().mockResolvedValue({ rows: [{ available_for_instant_tele: true }] });
    const out = await executeVendorToolRequestsWithQuery(
      'vid-1',
      [{ name: 'get_vendor_tele_flags', args: {} }],
      runQuery
    );
    expect(runQuery).toHaveBeenCalled();
    expect(out.get_vendor_tele_flags).toMatchObject({
      availableForInstantTele: true,
      source: 'vendors.available_for_instant_tele',
    });
  });

  it('returns booking revenue month summary from injected query', async () => {
    const runQuery = jest.fn().mockResolvedValue({ rows: [{ completed_booking_count: 3, gross_total: '12500.50' }] });
    const out = await executeVendorToolRequestsWithQuery(
      'vid-1',
      [{ name: 'get_vendor_booking_revenue_month', args: { period: 'current_month' } }],
      runQuery
    );
    expect(runQuery).toHaveBeenCalled();
    expect(out.get_vendor_booking_revenue_month).toMatchObject({
      period: 'current_month',
      completedBookingsCount: 3,
      grossBookingTotalInr: 12500.5,
      currency: 'INR',
    });
  });

  it('returns recent bookings from injected query', async () => {
    const runQuery = jest.fn().mockResolvedValue({
      rows: [{ id: 'b1', service_type: 'vet', status: 'completed', booking_date: '2026-01-01', created_at: '2026-01-02', total_amount: '100' }],
    });
    const out = await executeVendorToolRequestsWithQuery(
      'vid-1',
      [{ name: 'get_vendor_recent_bookings', args: { limit: 2 } }],
      runQuery
    );
    expect(out.get_vendor_recent_bookings).toMatchObject({
      limit: 2,
      source: 'bookings',
    });
    expect((out.get_vendor_recent_bookings as { bookings: unknown[] }).bookings).toHaveLength(1);
  });

  it('returns services snapshot from injected query', async () => {
    const runQuery = jest.fn().mockResolvedValue({
      rows: [
        {
          id: 's1',
          service_name: 'Consult',
          service_style: 'tele',
          category: 'vet',
          is_enabled: true,
          publish_status: 'published',
          unit_price: 500,
        },
      ],
    });
    const out = await executeVendorToolRequestsWithQuery(
      'vid-1',
      [{ name: 'get_vendor_services_snapshot', args: {} }],
      runQuery
    );
    expect(out.get_vendor_services_snapshot).toMatchObject({ source: 'vendor_services' });
    expect((out.get_vendor_services_snapshot as { services: { name: string }[] }).services[0].name).toBe('Consult');
  });
});
