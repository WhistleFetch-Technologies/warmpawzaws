import {
  isNonProductBillLine,
  parseModelBillJson,
  sanitizeBillLineItems,
  toPersistedBillExtract,
} from '../../endpoints/warmpawz-pay/shared/pet-store-walkin';
import { isWpayBillExtractJobEvent } from '../wpay-bill-extract-invoke';
import { buildBillExtractPrompt, mimeFromBillObject } from '../wpay-bill-extract-gemini';

describe('wpay bill extract', () => {
  it('drops GST, service charge, and round-off lines', () => {
    const items = sanitizeBillLineItems([
      { name: 'Cappuccino', quantity: 2, lineTotal: 280 },
      { name: 'CGST 2.5%', quantity: 1, lineTotal: 12 },
      { name: 'SGST', quantity: 1, lineTotal: 12 },
      { name: 'Service Charge', quantity: 1, lineTotal: 20 },
      { name: 'Round Off', quantity: 1, lineTotal: 0.5 },
      { name: 'Cheesecake', quantity: 1, lineTotal: 207 },
    ]);
    expect(items).toEqual([
      { name: 'Cappuccino', quantity: 2, lineTotal: 280 },
      { name: 'Cheesecake', quantity: 1, lineTotal: 207 },
    ]);
  });

  it('keeps product lines when they do not sum to quoted total', () => {
    const items = sanitizeBillLineItems([
      { name: 'Qube sandwich', quantity: 1, lineTotal: 287 },
      { name: 'Iced tea', quantity: 1, lineTotal: 200 },
    ]);
    const saved = toPersistedBillExtract({
      status: 'ok',
      quotedAmount: 532,
      lineItems: items,
      model: 'gemini-3.8-flash',
    });
    expect(saved.status).toBe('ok');
    expect(saved.quotedAmount).toBe(532);
    expect(saved.extractedSum).toBe(487);
    expect(saved.lineItems).toHaveLength(2);
  });

  it('parses fenced model JSON', () => {
    const parsed = parseModelBillJson('```json\n{"quotedTotal":100,"items":[{"name":"Kibble","quantity":1,"lineTotal":100}]}\n```');
    expect(parsed.quotedTotal).toBe(100);
    expect(sanitizeBillLineItems(parsed.items)[0].name).toBe('Kibble');
  });

  it('classifies tax-like names', () => {
    expect(isNonProductBillLine('GST 5%')).toBe(true);
    expect(isNonProductBillLine('Dog Food')).toBe(false);
  });

  it('accepts only settlementId+imageKey Event payloads', () => {
    expect(
      isWpayBillExtractJobEvent({
        job: 'wpay-bill-extract',
        settlementId: 'set-1',
        imageKey: 'media/vendor/x/wpay-bills/a.webp',
      }),
    ).toBe(true);
    expect(isWpayBillExtractJobEvent({ job: 'wpay-bill-extract', settlementId: 'set-1' })).toBe(false);
  });

  it('asks Gemini for product rows only', () => {
    const prompt = buildBillExtractPrompt(532);
    expect(prompt).toContain('Do not extract GST');
    expect(prompt).toContain('Customer quoted amount (INR): 532');
    expect(prompt).not.toContain('contributes to Grand Total');
  });

  it('defaults stored bills to webp mime', () => {
    expect(mimeFromBillObject({ imageKey: 'media/vendor/x/bill.webp' })).toBe('image/webp');
    expect(mimeFromBillObject({ contentType: 'image/jpeg', imageKey: 'x.webp' })).toBe('image/jpeg');
  });
});
