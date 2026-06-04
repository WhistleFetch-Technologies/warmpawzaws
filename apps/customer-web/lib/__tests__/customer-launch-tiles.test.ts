import {
  mapLaunchServiceIdToAllServicesTileScreen,
  mapLaunchServiceIdToCustomerHomeScreen,
} from '@warmpawz/service-launch-mappings';
import {
  buildCustomerLaunchTiles,
  findMatchingTileForLaunchId,
} from '../customer-launch-tiles';
import type { QuickServiceTile } from '@/components/customer/home/types';

const Icon = () => null;

const basePool: QuickServiceTile[] = [
  {
    icon: Icon,
    label: 'Vet Care',
    color: 'bg-blue-100',
    screen: 'vet',
    categoryId: 'vet',
  },
  {
    icon: Icon,
    label: 'Lab Test',
    color: 'bg-teal-100',
    screen: 'lab-diagnostics',
    categoryId: 'lab-diagnostics',
  },
  {
    icon: Icon,
    label: 'Insurance',
    color: 'bg-cyan-100',
    screen: 'insurance',
    categoryId: 'insurance',
  },
];

describe('launch ID alias mappings', () => {
  it('maps emergency and walking to home screens', () => {
    expect(mapLaunchServiceIdToCustomerHomeScreen('emergency')).toBe('ambulance');
    expect(mapLaunchServiceIdToCustomerHomeScreen('walking')).toBe('walker');
  });

  it('maps diagnostics to lab-diagnostics tile screen for All Services', () => {
    expect(mapLaunchServiceIdToAllServicesTileScreen('diagnostics')).toBe('lab-diagnostics');
    expect(mapLaunchServiceIdToCustomerHomeScreen('diagnostics')).toBe('vet');
  });
});

describe('findMatchingTileForLaunchId', () => {
  it('matches diagnostics to lab-diagnostics tile', () => {
    const tile = findMatchingTileForLaunchId('diagnostics', basePool, {
      preferTileScreen: 'lab-diagnostics',
    });
    expect(tile?.screen).toBe('lab-diagnostics');
  });

  it('matches emergency launch id to ambulance tile when present', () => {
    const pool: QuickServiceTile[] = [
      ...basePool,
      {
        icon: Icon,
        label: 'Ambulance',
        color: 'bg-red-100',
        screen: 'ambulance',
        categoryId: 'ambulance',
      },
    ];
    const tile = findMatchingTileForLaunchId('emergency', pool);
    expect(tile?.screen).toBe('ambulance');
  });
});

describe('buildCustomerLaunchTiles', () => {
  it('synthesizes a tile when launch catalog entry has no pool match', () => {
    const tiles = buildCustomerLaunchTiles({
      tilePool: basePool,
      catalog: [
        { serviceId: 'physio-therapy', displayName: 'Physio Therapy', effectiveStatus: 'launched' },
      ],
      dedupeByLaunchServiceId: true,
    });
    expect(tiles).toHaveLength(1);
    expect(tiles[0].label).toBe('Physio Therapy');
    expect(tiles[0].screen).toBe('vet');
  });

  it('shows diagnostics and vet as separate tiles when dedupeByLaunchServiceId', () => {
    const tiles = buildCustomerLaunchTiles({
      tilePool: basePool,
      catalog: [
        { serviceId: 'vet', effectiveStatus: 'launched' },
        { serviceId: 'diagnostics', effectiveStatus: 'launched' },
      ],
      dedupeByLaunchServiceId: true,
    });
    expect(tiles.map((t) => t.screen).sort()).toEqual(['lab-diagnostics', 'vet']);
  });

  it('includes hidden catalog entries as coming soon when requested', () => {
    const tiles = buildCustomerLaunchTiles({
      tilePool: basePool,
      catalog: [
        { serviceId: 'breeder', displayName: 'Breeder', effectiveStatus: 'hidden' },
        { serviceId: 'vet', effectiveStatus: 'launched' },
      ],
      includeHiddenAsComingSoon: true,
      dedupeByLaunchServiceId: true,
    });
    expect(tiles).toHaveLength(2);
    const breeder = tiles.find((t) => t.label === 'Breeder');
    expect(breeder?.isComingSoon).toBe(true);
  });

  it('omits hidden entries on home-style build', () => {
    const tiles = buildCustomerLaunchTiles({
      tilePool: basePool,
      catalog: [
        { serviceId: 'breeder', effectiveStatus: 'hidden' },
        { serviceId: 'vet', effectiveStatus: 'launched' },
      ],
      includeHiddenAsComingSoon: false,
      dedupeByLaunchServiceId: false,
    });
    expect(tiles).toHaveLength(1);
    expect(tiles[0].screen).toBe('vet');
  });
});
