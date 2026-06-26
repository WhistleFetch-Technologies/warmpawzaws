import { query } from '../../database/rds-connection';
import { loadProductSkus } from '../product-sku-service';
import {
  productHasVariantSkus,
  resolveEcommerceOrderLine,
} from '../product-sku-order';

jest.mock('../../database/rds-connection', () => ({
  query: jest.fn(),
}));

jest.mock('../product-sku-service', () => ({
  loadProductSkus: jest.fn(),
}));

const PRODUCT_ID = '11111111-1111-1111-1111-111111111111';
const SKU_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

describe('productHasVariantSkus', () => {
  it('returns true when any active SKU has option_values', () => {
    expect(
      productHasVariantSkus([
        { id: '1', option_values: { size: 'M' }, price: 100, stock: 1, is_active: true },
        { id: '2', option_values: {}, price: 100, stock: 1, is_active: true },
      ] as any),
    ).toBe(true);
  });

  it('returns false for simple products with empty option_values', () => {
    expect(
      productHasVariantSkus([
        { id: '1', option_values: {}, price: 100, stock: 1, is_active: true },
      ] as any),
    ).toBe(false);
  });
});

describe('resolveEcommerceOrderLine', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('resolves a valid variant SKU by id', async () => {
    (query as jest.Mock)
      .mockResolvedValueOnce({
        rows: [
          {
            id: PRODUCT_ID,
            name: 'Dog Food',
            price: 399,
            vendor_id: 'vendor-1',
            hsn_code: '1234',
            gst_rate: 5,
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: SKU_ID,
            sku: 'DF-M',
            option_values: { size: 'M' },
            price: 450,
            compare_at_price: 500,
            stock: 10,
            images: [],
            is_active: true,
          },
        ],
      });
    (loadProductSkus as jest.Mock).mockResolvedValue([
      {
        id: SKU_ID,
        sku: 'DF-M',
        option_values: { size: 'M' },
        price: 450,
        stock: 10,
        is_active: true,
      },
    ]);

    const line = await resolveEcommerceOrderLine({
      product_id: PRODUCT_ID,
      product_sku_id: SKU_ID,
      quantity: 2,
    });

    expect(line?.unit_price).toBe(450);
    expect(line?.product_sku_id).toBe(SKU_ID);
    expect(line?.total).toBe(900);
  });

  it('throws when multi-variant product has invalid selection', async () => {
    (query as jest.Mock).mockResolvedValueOnce({
      rows: [
        {
          id: PRODUCT_ID,
          name: 'Dog Food',
          price: 399,
          vendor_id: 'vendor-1',
        },
      ],
    });
    (loadProductSkus as jest.Mock).mockResolvedValue([
      {
        id: SKU_ID,
        option_values: { size: 'M' },
        price: 450,
        stock: 10,
        is_active: true,
      },
    ]);

    await expect(
      resolveEcommerceOrderLine({
        product_id: PRODUCT_ID,
        selected_variations: { size: 'XL' },
        quantity: 1,
      }),
    ).rejects.toThrow(/Variant is not available for Dog Food/);
  });

  it('allows simple product without SKU using parent price', async () => {
    (query as jest.Mock).mockResolvedValueOnce({
      rows: [
        {
          id: PRODUCT_ID,
          name: 'Simple Toy',
          price: 199,
          vendor_id: 'vendor-1',
        },
      ],
    });
    (loadProductSkus as jest.Mock).mockResolvedValue([
      {
        id: SKU_ID,
        option_values: {},
        price: 199,
        stock: 5,
        is_active: true,
      },
    ]);

    const line = await resolveEcommerceOrderLine({
      product_id: PRODUCT_ID,
      quantity: 1,
    });

    expect(line?.unit_price).toBe(199);
    expect(line?.product_sku_id).toBeNull();
  });
});
