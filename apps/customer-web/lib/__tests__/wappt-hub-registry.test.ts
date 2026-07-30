import {
  buildWapptHubTile,
  getWapptHubConfig,
  listWapptHubCategories,
  normalizeWapptHubCategory,
} from '../wappt-hub-registry';

describe('wappt-hub-registry', () => {
  it('resolves all supported hub categories', () => {
    const hubs = listWapptHubCategories();
    expect(hubs).toEqual(
      expect.arrayContaining(['vet', 'grooming', 'training', 'behaviorist', 'walker', 'boarding', 'sitting', 'nutrition']),
    );
    for (const hub of hubs) {
      const config = getWapptHubConfig(hub);
      expect(config?.bookingScreen).toBeTruthy();
      expect(config?.roleId).toBeTruthy();
      expect(config?.wapptTileId).toBeTruthy();
    }
  });

  it('maps sitting aliases to pet-sitter booking screen', () => {
    expect(normalizeWapptHubCategory('pet_sitter')).toBe('sitting');
    expect(getWapptHubConfig('sitting')?.bookingScreen).toBe('pet-sitter-booking');
  });

  it('builds Book Appointment tile when category is known', () => {
    const tile = buildWapptHubTile('walker');
    expect(tile?.name).toBe('Book Appointment');
    expect(tile?.id).toBe('wappt_walker');
  });

  it('maps behaviorist aliases to behaviorist hub', () => {
    expect(normalizeWapptHubCategory('pet_behaviorist')).toBe('behaviorist');
    expect(getWapptHubConfig('behaviorist')?.bookingScreen).toBe('training-booking');
    expect(buildWapptHubTile('behaviorist')?.id).toBe('wappt_behaviorist');
  });
});
