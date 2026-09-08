const resolveUploadBucketForKey = jest.fn();
const lookupDedupEntry = jest.fn();
const insertDedupEntry = jest.fn();
const processImageBuffer = jest.fn();
const putWebpObject = jest.fn();
const attachUrlsToImageDto = jest.fn();
const validateImageBuffer = jest.fn();
const recordImageUploadSuccess = jest.fn();
const recordImageUploadFailed = jest.fn();
const moveKeyToCleanup = jest.fn();

jest.mock('../../../endpoints/constants/helper', () => ({
  resolveUploadBucketForKey: (...args: unknown[]) => resolveUploadBucketForKey(...args),
}));

jest.mock('../image-content-index', () => ({
  lookupDedupEntry: (...args: unknown[]) => lookupDedupEntry(...args),
  insertDedupEntry: (...args: unknown[]) => insertDedupEntry(...args),
  sha256Hex: () => 'abc123hash',
  shouldDedup: () => true,
}));

jest.mock('../image-processor', () => ({
  processImageBuffer: (...args: unknown[]) => processImageBuffer(...args),
}));

jest.mock('../image-repository', () => ({
  putWebpObject: (...args: unknown[]) => putWebpObject(...args),
  getUploadsBucket: () => 'warmpawz-test-uploads',
  moveKeyToCleanup: (...args: unknown[]) => moveKeyToCleanup(...args),
}));

jest.mock('../image-validator', () => ({
  validateImageBuffer: (...args: unknown[]) => validateImageBuffer(...args),
}));

jest.mock('../image-url-builder', () => ({
  attachUrlsToImageDto: (...args: unknown[]) => attachUrlsToImageDto(...args),
}));

jest.mock('../image-metrics', () => ({
  recordImageUploadSuccess: (...args: unknown[]) => recordImageUploadSuccess(...args),
  recordImageUploadFailed: (...args: unknown[]) => recordImageUploadFailed(...args),
}));

jest.mock('../image-key-builder', () => ({
  buildDisplayWebpKey: () => 'products/vendor/new.webp',
  buildThumbWebpKey: () => 'products/vendor/new.thumb.webp',
  buildVendorProfileWebpKey: () => 'profile/vendor.webp',
}));

import { uploadDisplayImage } from '../image-service';

describe('uploadDisplayImage dedup', () => {
  const buffer = Buffer.from('fake-image');

  beforeEach(() => {
    jest.clearAllMocks();
    validateImageBuffer.mockReturnValue({ ok: true, detectedMime: 'image/png' });
    attachUrlsToImageDto.mockImplementation(async (dto: { imageKey: string }) => dto);
    processImageBuffer.mockResolvedValue({
      originalBytes: buffer.length,
      display: { buffer, width: 1, height: 1, byteSize: buffer.length },
      thumb: null,
    });
    putWebpObject.mockResolvedValue(undefined);
    insertDedupEntry.mockResolvedValue(undefined);
    recordImageUploadSuccess.mockResolvedValue(undefined);
  });

  it('reuses a dedup key only when HeadObject finds the object', async () => {
    lookupDedupEntry.mockResolvedValue({ webpKey: 'products/vendor/old.webp', thumbKey: null });
    resolveUploadBucketForKey.mockResolvedValue('warmpawz-test-uploads');

    const result = await uploadDisplayImage({
      buffer,
      declaredContentType: 'image/png',
      assetType: 'product',
      ownerId: 'vendor',
      vendorId: 'vendor',
    });

    expect(result.imageKey).toBe('products/vendor/old.webp');
    expect(processImageBuffer).not.toHaveBeenCalled();
    expect(insertDedupEntry).not.toHaveBeenCalled();
  });

  it('re-uploads and updates the index when the dedup key is missing', async () => {
    lookupDedupEntry.mockResolvedValue({ webpKey: 'products/vendor/dead.webp', thumbKey: null });
    resolveUploadBucketForKey.mockResolvedValue(null);

    const result = await uploadDisplayImage({
      buffer,
      declaredContentType: 'image/png',
      assetType: 'product',
      ownerId: 'vendor',
      vendorId: 'vendor',
    });

    expect(result.imageKey).toBe('products/vendor/new.webp');
    expect(processImageBuffer).toHaveBeenCalled();
    expect(insertDedupEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        sha256: 'abc123hash',
        webpKey: 'products/vendor/new.webp',
      }),
    );
  });
});
