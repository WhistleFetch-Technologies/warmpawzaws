jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn(async (_client: unknown, command: { input?: { Bucket?: string; Key?: string } }) => {
    const bucket = command.input?.Bucket ?? 'unknown';
    const key = command.input?.Key ?? 'unknown';
    return `https://${bucket}.s3.ap-south-1.amazonaws.com/${key}?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Signature=fresh`;
  }),
}));

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({})),
  GetObjectCommand: jest.fn().mockImplementation((input: { Bucket: string; Key: string }) => ({ input })),
}));

import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { presignS3GetUrlIfApplicable } from '../s3-media-presign';

describe('presignS3GetUrlIfApplicable', () => {
  beforeEach(() => {
    (getSignedUrl as jest.Mock).mockClear();
  });

  it('re-signs expired virtual-hosted S3 URLs', async () => {
    const expired =
      'https://warmpawz-dev-uploads.s3.ap-south-1.amazonaws.com/vendors/abc/facility/old.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=expired&X-Amz-Expires=1';
    const out = await presignS3GetUrlIfApplicable(expired);
    expect(getSignedUrl).toHaveBeenCalled();
    expect(out).toContain('X-Amz-Signature=fresh');
    expect(out).toContain('vendors/abc/facility/old.jpg');
    expect(out).not.toContain('X-Amz-Credential=expired');
  });

  it('leaves non-S3 https URLs unchanged', async () => {
    const ext = 'https://cdn.example.com/photo.jpg';
    expect(await presignS3GetUrlIfApplicable(ext)).toBe(ext);
    expect(getSignedUrl).not.toHaveBeenCalled();
  });

  it('leaves data URLs unchanged', async () => {
    const data = 'data:image/png;base64,aaa';
    expect(await presignS3GetUrlIfApplicable(data)).toBe(data);
  });
});
