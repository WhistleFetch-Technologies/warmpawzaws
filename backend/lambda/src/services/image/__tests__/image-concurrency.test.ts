import { mapWithConcurrency } from '../image-concurrency';

describe('mapWithConcurrency', () => {
  it('maps all items with concurrency limit', async () => {
    const order: number[] = [];
    const out = await mapWithConcurrency([1, 2, 3, 4], 2, async (n) => {
      order.push(n);
      return n * 2;
    });
    expect(out).toEqual([2, 4, 6, 8]);
    expect(order).toHaveLength(4);
  });
});
