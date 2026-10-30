/**
 * Gemini 3.8 Flash bill extract — same payload as the local probe:
 * text prompt first, then image bytes (not a URL). No responseMimeType.
 * Product lines only: name, quantity, lineTotal. GST is not requested or saved.
 */

import {
  parseModelBillJson,
  sanitizeBillLineItems,
  type WpayBillLineItem,
} from '../endpoints/warmpawz-pay/shared/pet-store-walkin';

export const WPAY_BILL_EXTRACT_MODEL = 'gemini-3.8-flash';

const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${WPAY_BILL_EXTRACT_MODEL}:generateContent`;
const GEMINI_TIMEOUT_MS = 110_000;

let cachedSecretKey: string | null | undefined;

export async function resolveGeminiApiKey(): Promise<string> {
  const fromEnv = String(process.env.GEMINI_API_KEY || '').trim();
  if (fromEnv) return fromEnv;
  if (cachedSecretKey !== undefined) return cachedSecretKey || '';
  try {
    const { getSecret } = await import('./aws/secrets-manager');
    cachedSecretKey = String((await getSecret('gemini-api-key')) || '').trim();
  } catch {
    cachedSecretKey = '';
  }
  return cachedSecretKey;
}

export function buildBillExtractPrompt(quotedTotal: number): string {
  return `You extract sold product line items from one Indian retail bill photo.
Return JSON only. No markdown. No commentary.

Instructions:
- Read the attached bill image.
- Extract only sold product/item rows: name, quantity, and line amount.
- Do not extract GST, CGST, SGST, IGST, CESS, service charge, round off, subtotal, or grand total as items.
- Do not extract store name, address, GSTIN, phone, cashier, date, or payment method as items.
- quantity is the printed Qty. Use 1 when the product line has no qty.
- lineTotal is the printed Amount for that product line, in INR.
- Product line totals may sum to less than the customer quoted amount because tax and charges are omitted on purpose.
- If a product name wraps across two lines, join it into one name.

Few-shot example of the JSON you must return (different bill, shape only):
{"quotedTotal":120,"items":[{"name":"Dog Food 1kg","quantity":2,"lineTotal":100},{"name":"Chew Toy","quantity":1,"lineTotal":20}]}

Output JSON schema (required):
{
  "quotedTotal": number,
  "items": [
    { "name": string, "quantity": number, "lineTotal": number }
  ]
}

Customer quoted amount (INR): ${quotedTotal}`;
}

export function mimeFromBillObject(opts: { contentType?: string | null; imageKey: string }): string {
  const declared = String(opts.contentType || '').trim().toLowerCase();
  if (declared.startsWith('image/')) return declared;
  const key = opts.imageKey.toLowerCase();
  if (key.endsWith('.png')) return 'image/png';
  if (key.endsWith('.jpg') || key.endsWith('.jpeg')) return 'image/jpeg';
  return 'image/webp';
}

export async function callGeminiBillExtract(opts: {
  quotedAmount: number;
  imageBytes: Buffer;
  mimeType: string;
}): Promise<WpayBillLineItem[]> {
  const apiKey = await resolveGeminiApiKey();
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  const body = {
    contents: [
      {
        role: 'user',
        parts: [
          { text: buildBillExtractPrompt(opts.quotedAmount) },
          {
            inlineData: {
              mimeType: opts.mimeType,
              data: opts.imageBytes.toString('base64'),
            },
          },
        ],
      },
    ],
    generationConfig: {
      thinkingConfig: { thinkingLevel: 'low' },
    },
  };

  const res = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
  });

  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(`Gemini HTTP ${res.status}`);
  }

  const candidate = Array.isArray(json.candidates) ? (json.candidates[0] as Record<string, unknown>) : null;
  const content = candidate?.content && typeof candidate.content === 'object'
    ? (candidate.content as Record<string, unknown>)
    : null;
  const parts = Array.isArray(content?.parts) ? content.parts : [];
  const rawText = parts
    .map((part) => (part && typeof part === 'object' ? String((part as { text?: unknown }).text || '') : ''))
    .filter(Boolean)
    .join('\n');

  const parsed = parseModelBillJson(rawText);
  return sanitizeBillLineItems(parsed.items);
}
