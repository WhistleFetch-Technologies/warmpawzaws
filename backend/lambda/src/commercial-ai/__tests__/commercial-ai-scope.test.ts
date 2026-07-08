import {
  COMMERCIAL_REFUSAL_MESSAGE,
  isCommercialScopeMessage,
  isOffTopicCommercialRefusal,
} from '../scope';

describe('commercial-ai scope', () => {
  it('accepts commercial topics', () => {
    expect(isCommercialScopeMessage('Explain campaign funding split')).toBe(true);
    expect(isCommercialScopeMessage('Why is this promotion inactive?')).toBe(true);
    expect(isOffTopicCommercialRefusal('Explain campaign health')).toBe(false);
  });

  it('refuses programming and infrastructure', () => {
    expect(isOffTopicCommercialRefusal('Write a terraform module for lambda')).toBe(true);
    expect(isOffTopicCommercialRefusal('Fix my typescript bug')).toBe(true);
  });

  it('refuses general knowledge and weather', () => {
    expect(isOffTopicCommercialRefusal('What is the capital of France?')).toBe(true);
    expect(isOffTopicCommercialRefusal('What is the weather today?')).toBe(true);
  });

  it('allows short commercial greetings', () => {
    expect(isOffTopicCommercialRefusal('hello')).toBe(false);
  });

  it('exports polite commercial-only refusal message', () => {
    expect(COMMERCIAL_REFUSAL_MESSAGE).toMatch(/Commercial Copilot/i);
    expect(COMMERCIAL_REFUSAL_MESSAGE).toMatch(/promotions/i);
  });
});
