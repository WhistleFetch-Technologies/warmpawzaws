import { buildResidualSearchText } from '../search-retrieval-text';

const taxonomy = (topMatchedPhrase: string, topHubSlug: string) => ({
  categorySource: 'taxonomy' as const,
  topHubSlug,
  topMatchedPhrase,
});

describe('buildResidualSearchText', () => {
  it('dog doctor → hub browse only (routing phrase)', () => {
    const r = buildResidualSearchText('dog doctor', taxonomy('dog doctor', 'vet'));
    expect(r.searchText).toBe('');
    expect(r.tokens).toEqual([]);
  });

  it('cat doctor → hub browse only (routing phrase)', () => {
    const r = buildResidualSearchText('cat doctor', taxonomy('cat doctor', 'vet'));
    expect(r.searchText).toBe('');
    expect(r.tokens).toEqual([]);
  });

  it('pet clinic → hub browse only', () => {
    const r = buildResidualSearchText('pet clinic', taxonomy('pet clinic', 'vet'));
    expect(r.searchText).toBe('');
  });

  it('pet nutritionist → hub browse only', () => {
    const r = buildResidualSearchText('pet nutritionist', taxonomy('pet nutritionist', 'nutritionist'));
    expect(r.searchText).toBe('');
  });

  it('pet surgery → residual surgery (non-routing phrase)', () => {
    const r = buildResidualSearchText('pet surgery', taxonomy('pet surgery', 'vet'));
    expect(r.searchText).toBe('surgery');
    expect(r.tokens).toEqual(['surgery']);
  });

  it('vet near me → empty search text', () => {
    const r = buildResidualSearchText('vet near me', taxonomy('vet near me', 'vet'));
    expect(r.searchText).toBe('');
    expect(r.tokens).toEqual([]);
  });

  it('dog grooming near me → empty (phrase + intent)', () => {
    const r = buildResidualSearchText('dog grooming near me', taxonomy('dog grooming', 'grooming'));
    expect(r.searchText).toBe('');
    expect(r.tokens).toEqual([]);
  });

  it('dog grooming package → residual package', () => {
    const r = buildResidualSearchText('dog grooming package', taxonomy('dog grooming', 'grooming'));
    expect(r.searchText).toBe('package');
    expect(r.tokens).toEqual(['package']);
  });

  it('dog grooming exact → grooming token (non-routing phrase)', () => {
    const r = buildResidualSearchText('dog grooming', taxonomy('dog grooming', 'grooming'));
    expect(r.searchText).toBe('grooming');
    expect(r.tokens).toEqual(['grooming']);
  });

  it('strips intent tokens from explicit category search', () => {
    const r = buildResidualSearchText('vet near me', {
      categorySource: 'explicit',
      topHubSlug: 'vet',
      topMatchedPhrase: 'vet near me',
    });
    expect(r.searchText).toBe('vet');
    expect(r.tokens).toEqual(['vet']);
  });
});
