import {
  filterServicesByQuery,
  searchQueryTokens,
} from '../filter-services-by-query';

describe('searchQueryTokens', () => {
  it('splits on whitespace and lowercases', () => {
    expect(searchQueryTokens('  Dental  Cleaning ')).toEqual(['dental', 'cleaning']);
  });

  it('caps token count', () => {
    expect(searchQueryTokens('a b c d e f g h', 6)).toHaveLength(6);
  });

  it('returns empty for blank query', () => {
    expect(searchQueryTokens('   ')).toEqual([]);
  });
});

describe('filterServicesByQuery', () => {
  const services = [
    { id: '1', name: 'Dental Cleaning', description: 'Full oral care for dogs' },
    { id: '2', name: 'Basic Grooming', description: 'Bath and brush' },
    { id: '3', name: 'Vaccination', description: 'Annual dental check included' },
  ];

  it('returns all services when query is empty', () => {
    expect(filterServicesByQuery(services, '')).toHaveLength(3);
    expect(filterServicesByQuery(services, '   ')).toHaveLength(3);
  });

  it('matches a single token in service name', () => {
    expect(filterServicesByQuery(services, 'grooming').map((s) => s.id)).toEqual(['2']);
  });

  it('matches a single token in description only', () => {
    expect(filterServicesByQuery(services, 'oral').map((s) => s.id)).toEqual(['1']);
  });

  it('requires every token to match (AND semantics)', () => {
    expect(filterServicesByQuery(services, 'dental cleaning').map((s) => s.id)).toEqual(['1']);
    expect(filterServicesByQuery(services, 'dental grooming')).toEqual([]);
  });

  it('matches serviceName field used on discovery pages', () => {
    const discovery = [
      { id: 'a', serviceName: 'Home Visit Vet', description: 'At your doorstep' },
    ];
    expect(filterServicesByQuery(discovery, 'home visit')).toHaveLength(1);
  });

  it('matches category and tags when present', () => {
    const withMeta = [
      { id: 'x', name: 'Spa Day', category: 'wellness', tags: ['premium'] },
    ];
    expect(filterServicesByQuery(withMeta, 'wellness')).toHaveLength(1);
    expect(filterServicesByQuery(withMeta, 'premium spa')).toHaveLength(1);
  });
});
