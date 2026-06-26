import {
  discardAllPendingProductImages,
  registerPendingProductImageKey,
  removePendingProductImageByUrl,
} from '../product-image-upload';

jest.mock('../api-client', () => ({
  apiClient: {
    delete: jest.fn().mockResolvedValue({ success: true }),
  },
}));

const { apiClient } = jest.requireMock('../api-client') as {
  apiClient: { delete: jest.Mock };
};

describe('pending product image session helpers', () => {
  beforeEach(() => {
    apiClient.delete.mockClear();
  });

  it('registerPendingProductImageKey maps display and stable URLs to fileKey', () => {
    const map = new Map<string, string>();
    registerPendingProductImageKey(map, ['https://s3/a.jpg', 'https://s3/a.jpg?sig=1'], 'products/v/k.jpg');
    expect(map.get('https://s3/a.jpg')).toBe('products/v/k.jpg');
    expect(map.get('https://s3/a.jpg?sig=1')).toBe('products/v/k.jpg');
  });

  it('removePendingProductImageByUrl deletes S3 once and clears aliases', async () => {
    const map = new Map<string, string>();
    registerPendingProductImageKey(map, ['u1', 'u2'], 'products/v/1.webp');
    await removePendingProductImageByUrl('vendor-1', map, 'u1');
    expect(apiClient.delete).toHaveBeenCalledTimes(1);
    expect(map.size).toBe(0);
  });

  it('discardAllPendingProductImages deletes unique keys and clears map', async () => {
    const map = new Map<string, string>();
    registerPendingProductImageKey(map, ['a'], 'products/v/1.webp');
    registerPendingProductImageKey(map, ['b'], 'products/v/2.webp');
    await discardAllPendingProductImages('vendor-1', map);
    expect(apiClient.delete).toHaveBeenCalledTimes(2);
    expect(map.size).toBe(0);
  });
});
