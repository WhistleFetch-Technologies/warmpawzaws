import { getAnonymousIdStorageKey, getOrCreateAnonymousId } from '../anonymous-id';

describe('anonymous-id', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('creates and persists a stable id', () => {
    const a = getOrCreateAnonymousId();
    const b = getOrCreateAnonymousId();
    expect(a).toBe(b);
    expect(localStorage.getItem(getAnonymousIdStorageKey())).toBe(a);
  });
});
