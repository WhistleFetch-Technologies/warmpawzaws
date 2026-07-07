import { EventEmitter } from 'events';

const uploadProductImageBufferToS3 = jest.fn();

jest.mock('../product-s3-image', () => {
  const actual = jest.requireActual('../product-s3-image');
  return {
    ...actual,
    uploadProductImageBufferToS3: (...args: unknown[]) => uploadProductImageBufferToS3(...args),
  };
});

// Jimp v1 uses dynamic import() internally for format plugins, which Jest's
// CJS test runner can't execute without extra experimental flags. That's a
// test-tooling limitation only — Node (and esbuild's CJS Lambda bundle) both
// support dynamic import() natively at runtime, verified manually against the
// real package. Here we stub Jimp with a minimal fake so these tests can
// focus on the fetch/redirect/fallback logic that IS specific to this module.
jest.mock('jimp', () => ({
  Jimp: {
    fromBuffer: jest.fn(async (input: Buffer) => ({
      bitmap: { width: 10, height: 10 },
      scaleToFit: jest.fn(),
      getBuffer: jest.fn(async () => Buffer.from(`compressed:${input.length}`)),
    })),
  },
  JimpMime: { jpeg: 'image/jpeg' },
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
    expect(uploadProductImageBufferToS3).not.toHaveBeenCalled();
  });

  it('passes through empty and non-http(s) values unchanged', async () => {
    expect(await ingestExternalProductImageUrl(vendorId, '')).toBe('');
    expect(await ingestExternalProductImageUrl(vendorId, 'blob:abc')).toBe('blob:abc');
  });

  it('falls back to the original URL when the source cannot be fetched', async () => {
    const url = 'https://drive.google.com/uc?export=view&id=broken';
    mockHttpsGetOnce((respond, req) => {
      // Simulate a network-level failure (e.g. unreachable/rate-limited host).
      process.nextTick(() => req.emit('error', new Error('socket hang up')));
    });

    const result = await ingestExternalProductImageUrl(vendorId, url);
    expect(result).toBe(url);
    expect(uploadProductImageBufferToS3).not.toHaveBeenCalled();
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
    expect(uploadProductImageBufferToS3).not.toHaveBeenCalled();
  });

  it('downloads, compresses, and re-hosts a reachable external image to S3', async () => {
    const url = 'https://example.com/original.png';
    const hostedUrl = `https://warmpawz-dev-uploads.s3.ap-south-1.amazonaws.com/products/${vendorId}/mirrored.jpg`;
    uploadProductImageBufferToS3.mockResolvedValueOnce(hostedUrl);

    mockHttpsGetOnce((respond) => {
      const res = fakeResponse({ statusCode: 200, headers: { 'content-type': 'image/png' } });
      process.nextTick(() => {
        respond(res);
        res.emit('data', Buffer.from(TINY_PNG_BASE64, 'base64'));
        res.emit('end');
      });
    });

    const result = await ingestExternalProductImageUrl(vendorId, url);

    expect(result).toBe(hostedUrl);
    expect(uploadProductImageBufferToS3).toHaveBeenCalledTimes(1);
    const [calledVendorId, buffer, contentType, ext] = uploadProductImageBufferToS3.mock.calls[0];
    expect(calledVendorId).toBe(vendorId);
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(contentType).toBe('image/jpeg');
    expect(ext).toBe('jpg');
  });

  it('follows a redirect before downloading', async () => {
    const url = 'https://drive.google.com/uc?export=view&id=redirected';
    const finalUrl = 'https://redirected.example.com/final.png';
    const hostedUrl = `https://warmpawz-dev-uploads.s3.ap-south-1.amazonaws.com/products/${vendorId}/mirrored2.jpg`;
    uploadProductImageBufferToS3.mockResolvedValueOnce(hostedUrl);

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
    expect(result).toBe(hostedUrl);
    expect(https.get).toHaveBeenCalledTimes(2);
  });
});
