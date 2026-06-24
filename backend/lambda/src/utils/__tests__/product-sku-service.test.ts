import { query, update, insert, deleteRows } from '../../database/rds-connection';
import { updateProductSkuStock, syncProductSkus } from '../product-sku-service';

jest.mock('../../database/rds-connection', () => ({
  query: jest.fn(),
  update: jest.fn(),
  insert: jest.fn(),
  deleteRows: jest.fn(),
}));

jest.mock('../product-sku-images', () => ({
  processProductImagesForS3Storage: jest.fn(async (urls: string[]) => urls),
  stripPresignFromProductImagesJsonb: jest.fn((urls: string[]) => urls),
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

describe('syncProductSkus', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('preserves existing SKU code on update when input.sku is empty', async () => {
    (query as jest.Mock)
      .mockResolvedValueOnce({
        rows: [
          {
            id: SKU_A,
            sku: 'WP-EXISTING-SKU',
            option_values: { size: 'M' },
            price: 200,
            compare_at_price: 250,
            stock: 4,
            images: [],
            is_active: true,
            sort_order: 0,
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ id: SKU_A }] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: SKU_A,
            sku: 'WP-EXISTING-SKU',
            option_values: { size: 'M' },
            price: 200,
            compare_at_price: 250,
            stock: 6,
            images: [],
            is_active: true,
            sort_order: 0,
          },
        ],
      });

    await syncProductSkus(
      VENDOR_ID,
      PRODUCT_ID,
      [
        {
          id: SKU_A,
          option_values: { size: 'M' },
          stock: 6,
          sku: null,
        },
      ],
      { price: 200, compare_at_price: 250 },
    );

    expect(update).toHaveBeenCalledWith(
      'product_skus',
      { id: SKU_A },
      expect.objectContaining({ sku: 'WP-EXISTING-SKU', stock: 6 }),
    );
    expect(insert).not.toHaveBeenCalled();
  });

  it('sets parent products.price from default SKU not minimum SKU', async () => {
    const syncedRows = [
      {
        id: SKU_A,
        sku: 'WP-A',
        option_values: { size: 'L' },
        price: 150,
        compare_at_price: 200,
        stock: 2,
        images: ['https://example.com/l.jpg'],
        is_active: true,
        sort_order: 0,
      },
      {
        id: SKU_B,
        sku: 'WP-B',
        option_values: { size: 'S' },
        price: 100,
        compare_at_price: 200,
        stock: 3,
        images: [],
        is_active: true,
        sort_order: 1,
      },
    ];

    (query as jest.Mock)
      .mockResolvedValueOnce({ rows: syncedRows })
      .mockResolvedValueOnce({ rows: syncedRows });

    await syncProductSkus(
      VENDOR_ID,
      PRODUCT_ID,
      [
        { id: SKU_A, option_values: { size: 'L' }, price: 150, stock: 2, images: ['https://example.com/l.jpg'] },
        { id: SKU_B, option_values: { size: 'S' }, price: 100, stock: 3, images: [] },
      ],
      { price: 100, compare_at_price: 200 },
    );

    expect(update).toHaveBeenCalledWith(
      'products',
      { id: PRODUCT_ID },
      expect.objectContaining({ price: 150, stock: 5 }),
    );
  });

  it('no-ops when skuInputs empty and no existing SKUs (does not zero parent stock)', async () => {
    (query as jest.Mock).mockResolvedValueOnce({ rows: [] });

    const result = await syncProductSkus(VENDOR_ID, PRODUCT_ID, [], {
      price: 450,
      compare_at_price: 500,
    });

    expect(result).toEqual([]);
    expect(update).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
    expect(deleteRows).not.toHaveBeenCalled();
  });
});
