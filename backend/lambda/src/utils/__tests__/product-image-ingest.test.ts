import { EventEmitter } from 'events';

const uploadDisplayImage = jest.fn();

jest.mock('../../services/image', () => ({
  uploadDisplayImage: (...args: unknown[]) => uploadDisplayImage(...args),
}));

// 1x1 red pixel PNG — small enough to be a realistic "fetched" image body.
const TINY_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

type FakeResponse = EventEmitter & { statusCode?: number; headers: Record<string, string>; resume: jest.Mock };
type FakeRequest = EventEmitter & { destroy: jest.Mock };

function fakeResponse(props: { statusCode?: number; headers: Record<string, string> }): FakeResponse {
  return Object.assign(new EventEmitter(), { resume: jest.fn(), ...props });
}

function mockHttpsGetOnce(build: (respond: (res: FakeResponse) => void, req: FakeRequest) => void) {
  const https = require('https');
  (https.get as jest.Mock).mockImplementationOnce((_url: string, _opts: unknown, cb: (res: FakeResponse) => void) => {
    const req: FakeRequest = Object.assign(new EventEmitter(), { destroy: jest.fn() });
    build((res) => cb(res), req);
    return req;
  });
}

jest.mock('https', () => ({ get: jest.fn() }));
jest.mock('http', () => ({ get: jest.fn() }));

import { ingestExternalProductImageUrl } from '../product-image-ingest';

describe('product-image-ingest', () => {
  const vendorId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('no-ops on an already-managed S3 URL without touching the network', async () => {
    const url = `https://warmpawz-dev-uploads.s3.ap-south-1.amazonaws.com/products/${vendorId}/existing.jpg`;
    const result = await ingestExternalProductImageUrl(vendorId, url);
    expect(result).toBe(url);
    expect(uploadDisplayImage).not.toHaveBeenCalled();
  });

  it('passes through empty and non-http(s) values unchanged', async () => {
    expect(await ingestExternalProductImageUrl(vendorId, '')).toBe('');
    expect(await ingestExternalProductImageUrl(vendorId, 'blob:abc')).toBe('blob:abc');
  });

  it('falls back to the original URL when the source cannot be fetched', async () => {
    const url = 'https://drive.google.com/uc?export=view&id=broken';
    mockHttpsGetOnce((respond, req) => {
      process.nextTick(() => req.emit('error', new Error('socket hang up')));
    });

    const result = await ingestExternalProductImageUrl(vendorId, url);
    expect(result).toBe(url);
    expect(uploadDisplayImage).not.toHaveBeenCalled();
  });

  it('falls back to the original URL on a non-2xx response', async () => {
    const url = 'https://drive.google.com/uc?export=view&id=ratelimited';
    mockHttpsGetOnce((respond) => {
      const res = fakeResponse({ statusCode: 429, headers: { 'content-type': 'text/html' } });
      process.nextTick(() => {
        respond(res);
        res.emit('data', Buffer.from('<html>rate limited</html>'));
        res.emit('end');
      });
    });

    const result = await ingestExternalProductImageUrl(vendorId, url);
    expect(result).toBe(url);
    expect(uploadDisplayImage).not.toHaveBeenCalled();
  });

  it('downloads and re-hosts a reachable external image via ImageService', async () => {
    const url = 'https://example.com/original.png';
    const imageKey = `products/${vendorId}/mirrored.webp`;
    uploadDisplayImage.mockResolvedValueOnce({
      imageKey,
      url: `https://cdn.example.com/${imageKey}`,
    });

    mockHttpsGetOnce((respond) => {
      const res = fakeResponse({ statusCode: 200, headers: { 'content-type': 'image/png' } });
      process.nextTick(() => {
        respond(res);
        res.emit('data', Buffer.from(TINY_PNG_BASE64, 'base64'));
        res.emit('end');
      });
    });

    const result = await ingestExternalProductImageUrl(vendorId, url);

    expect(result).toBe(imageKey);
    expect(uploadDisplayImage).toHaveBeenCalledTimes(1);
    const [input] = uploadDisplayImage.mock.calls[0];
    expect(input.vendorId).toBe(vendorId);
    expect(input.assetType).toBe('product');
    expect(Buffer.isBuffer(input.buffer)).toBe(true);
  });

  it('follows a redirect before downloading', async () => {
    const url = 'https://drive.google.com/uc?export=view&id=redirected';
    const finalUrl = 'https://redirected.example.com/final.png';
    const imageKey = `products/${vendorId}/mirrored2.webp`;
    uploadDisplayImage.mockResolvedValueOnce({ imageKey, url: imageKey });

    const https = require('https');
    (https.get as jest.Mock)
      .mockImplementationOnce((_u: string, _o: unknown, cb: (res: FakeResponse) => void) => {
        const req: FakeRequest = Object.assign(new EventEmitter(), { destroy: jest.fn() });
        const res = fakeResponse({ statusCode: 302, headers: { location: finalUrl } });
        process.nextTick(() => cb(res));
        return req;
      })
      .mockImplementationOnce((_u: string, _o: unknown, cb: (res: FakeResponse) => void) => {
        const req: FakeRequest = Object.assign(new EventEmitter(), { destroy: jest.fn() });
        const res = fakeResponse({ statusCode: 200, headers: { 'content-type': 'image/png' } });
        process.nextTick(() => {
          cb(res);
          res.emit('data', Buffer.from(TINY_PNG_BASE64, 'base64'));
          res.emit('end');
        });
        return req;
      });

    const result = await ingestExternalProductImageUrl(vendorId, url);
    expect(result).toBe(imageKey);
    expect(https.get).toHaveBeenCalledTimes(2);
  });
});
