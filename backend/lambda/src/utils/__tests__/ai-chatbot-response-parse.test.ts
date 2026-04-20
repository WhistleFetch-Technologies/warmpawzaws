import {
  parseChatBedrockCompletion,
  parseSymptomsBedrockCompletion,
  parseBookingAssistBedrockCompletion,
} from '../ai-chatbot-response-parse';

describe('parseChatBedrockCompletion', () => {
  it('parses allowlisted JSON fields and ignores extra keys', () => {
    const raw = `Here is JSON:
{"response":"Hello","intent":"symptoms","confidence":1.5,"suggestedActions":["a","b","c"],"requiresAgent":true,"evil":"DROP"}
more`;
    const p = parseChatBedrockCompletion(raw);
    expect(p.responseText).toBe('Hello');
    expect(p.intent).toBe('symptoms');
    expect(p.confidence).toBe(1);
    expect(p.suggestedActions).toEqual(['a', 'b', 'c']);
    expect(p.requiresAgent).toBe(true);
    expect(p.structured).toBe(true);
  });

  it('maps unknown intent to general', () => {
    const p = parseChatBedrockCompletion('{"response":"x","intent":"haxxor"}');
    expect(p.intent).toBe('general');
  });

  it('falls back to plain text when JSON is malformed', () => {
    const p = parseChatBedrockCompletion('not json {broken');
    expect(p.responseText).toContain('not json');
    expect(p.structured).toBe(false);
  });
});

describe('parseSymptomsBedrockCompletion', () => {
  it('sanitizes urgency and arrays', () => {
    const p = parseSymptomsBedrockCompletion(
      '{"response":"Care","possibleCauses":["x"],"urgency":"immediate","recommendations":["r"],"shouldSeeVet":false,"vetBookingSuggested":false}'
    );
    expect(p.urgency).toBe('immediate');
    expect(p.shouldSeeVet).toBe(false);
    expect(p.vetBookingSuggested).toBe(false);
  });

  it('defaults vetBookingSuggested to false when omitted', () => {
    const p = parseSymptomsBedrockCompletion(
      '{"response":"X","possibleCauses":[],"urgency":"routine","recommendations":["r"]}'
    );
    expect(p.vetBookingSuggested).toBe(false);
  });

  it('sets vetBookingSuggested true only when explicitly true', () => {
    const p = parseSymptomsBedrockCompletion(
      '{"response":"X","urgency":"routine","vetBookingSuggested":true}'
    );
    expect(p.vetBookingSuggested).toBe(true);
  });
});

describe('parseBookingAssistBedrockCompletion', () => {
  it('coerces bad bookingUrl to /book', () => {
    const p = parseBookingAssistBedrockCompletion(
      '{"response":"ok","suggestedServices":[],"serviceType":"vet","nextSteps":[],"bookingUrl":"https://evil.com"}'
    );
    expect(p.bookingUrl).toBe('/book');
  });
});
