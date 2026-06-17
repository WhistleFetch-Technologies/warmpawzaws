import { query, update } from '../../database/rds-connection';
import { updateProductSkuStock } from '../product-sku-service';

jest.mock('../../database/rds-connection', () => ({
  query: jest.fn(),
  update: jest.fn(),
  insert: jest.fn(),
  deleteRows: jest.fn(),
}));

const PRODUCT_ID = '11111111-1111-1111-1111-111111111111';
const VENDOR_ID = '22222222-2222-2222-2222-222222222222';
const SKU_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const SKU_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

describe('updateProductSkuStock', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('updates SKU stock and re-aggregates parent stock', async () => {
    (query as jest.Mock)
      .mockResolvedValueOnce({ rows: [{ id: SKU_A }] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: SKU_A,
            sku: 'vt1',
            option_values: { color: 'red' },
            price: 100,
            stock: 5,
            is_active: true,
            sort_order: 0,
          },
          {
            id: SKU_B,
            sku: 'vt2',
            option_values: { color: 'black' },
            price: 110,
            stock: 7,
            is_active: true,
            sort_order: 1,
          },
        ],
      });

    const result = await updateProductSkuStock(VENDOR_ID, PRODUCT_ID, SKU_A, 5);

    expect(update).toHaveBeenCalledWith(
      'product_skus',
      { id: SKU_A },
      expect.objectContaining({ stock: 5 }),
    );
    expect(update).toHaveBeenCalledWith(
      'products',
      { id: PRODUCT_ID },
      expect.objectContaining({ stock: 12 }),
    );
    expect(result.parent_stock).toBe(12);
    expect(result.sku.id).toBe(SKU_A);
  });

  it('throws when SKU not found', async () => {
    (query as jest.Mock).mockResolvedValueOnce({ rows: [] });

    await expect(
      updateProductSkuStock(VENDOR_ID, PRODUCT_ID, SKU_A, 3),
    ).rejects.toThrow('SKU not found or access denied');
  });
});
