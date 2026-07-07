import {
  resolveStorefrontProductOrderBy,
  resolveStorefrontSafeOrderBy,
} from '../products-table-columns';

describe('products-table-columns', () => {
  const fullCols = new Set([
    'id',
    'price',
    'created_at',
    'review_count',
    'rating',
  ]);

  const legacyCols = new Set(['id', 'price', 'created_at']);

  describe('resolveStorefrontSafeOrderBy', () => {
    it('prefers created_at when present', () => {
      expect(resolveStorefrontSafeOrderBy(fullCols)).toBe('p.created_at DESC');
    });

    it('falls back to id when created_at missing', () => {
      expect(resolveStorefrontSafeOrderBy(new Set(['id', 'price']))).toBe('p.id DESC');
    });
  });

  describe('resolveStorefrontProductOrderBy', () => {
    it('popular uses review_count when column exists', () => {
      const sql = resolveStorefrontProductOrderBy('popular', fullCols);
      expect(sql).toContain('review_count');
      expect(sql).toContain('created_at');
    });

    it('popular falls back when review_count missing', () => {
      const sql = resolveStorefrontProductOrderBy('popular', legacyCols);
      expect(sql).not.toContain('review_count');
      expect(sql).toBe('p.created_at DESC');
    });

    it('rating falls back when rating column missing', () => {
      const sql = resolveStorefrontProductOrderBy('rating', legacyCols);
      expect(sql).not.toContain('rating');
      expect(sql).toBe('p.created_at DESC');
    });

    it('price_low uses price ASC', () => {
      expect(resolveStorefrontProductOrderBy('price_low', legacyCols)).toBe('p.price ASC');
    });

    it('price_high uses price DESC', () => {
      expect(resolveStorefrontProductOrderBy('price_high', legacyCols)).toBe('p.price DESC');
    });

    it('newest uses created_at DESC', () => {
      expect(resolveStorefrontProductOrderBy('newest', legacyCols)).toBe('p.created_at DESC');
    });

    it('unknown sort defaults to popular behavior', () => {
      const sql = resolveStorefrontProductOrderBy('unknown', legacyCols);
      expect(sql).toBe('p.created_at DESC');
    });
  });
});
