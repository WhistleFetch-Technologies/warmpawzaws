import { mapHomeServiceProfileServices } from '../customer-vendor-services-merge';

describe('mapHomeServiceProfileServices', () => {
  it('maps customer API rows with stable string ids and dedupes', () => {
    const rows = [
      {
        id: 'vs-1',
        serviceName: 'Morning Walk',
        description: '30 min stroll',
        price: 300,
        duration: 30,
      },
      { id: 'vs-1', name: 'Duplicate' },
      {
        service_id: 'cat-9',
        service_name: 'Fallback row',
        custom_price: '150',
        duration_minutes: 45,
      },
    ];

    const mapped = mapHomeServiceProfileServices(rows);
    expect(mapped).toHaveLength(2);
    expect(mapped[0]).toMatchObject({
      id: 'vs-1',
      name: 'Morning Walk',
      description: '30 min stroll',
      price: 300,
      duration: 30,
    });
    expect(mapped[1]!.id).toBe('cat-9');
    expect(mapped[1]!.name).toBe('Fallback row');
    expect(mapped[1]!.price).toBe(150);
    expect(mapped[1]!.duration).toBe(45);
  });

  it('assigns row-N keys when id is missing', () => {
    const mapped = mapHomeServiceProfileServices([{ name: 'Unnamed' }, { name: 'Second' }]);
    expect(mapped[0]!.id).toBe('row-0');
    expect(mapped[1]!.id).toBe('row-1');
  });
});
