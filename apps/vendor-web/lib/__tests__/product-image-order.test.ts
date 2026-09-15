import { moveArrayItem } from '../product-image-order';

describe('moveArrayItem', () => {
  it('moves the first item to the middle', () => {
    expect(moveArrayItem(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd']);
  });

  it('moves a middle item to first (cover)', () => {
    expect(moveArrayItem(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b']);
  });

  it('is a no-op at the left end', () => {
    const list = ['a', 'b'];
    expect(moveArrayItem(list, 0, -1)).toBe(list);
    expect(moveArrayItem(list, 0, 0)).toBe(list);
  });

  it('is a no-op at the right end', () => {
    const list = ['a', 'b', 'c'];
    expect(moveArrayItem(list, 2, 3)).toBe(list);
    expect(moveArrayItem(list, 2, 2)).toBe(list);
  });
});
