jest.mock('../../../endpoints/constants/helper', () => ({
  resolveUploadBucketForKey: jest.fn(),
  presignS3GetForBucketKey: jest.fn(),
}));

jest.mock('../../../utils/s3-media-presign', () => ({
  presignS3GetUrlIfApplicable: jest.fn(async (url: string) => url),
}));

import {
  resolveUploadBucketForKey,
  presignS3GetForBucketKey,
} from '../../../endpoints/constants/helper';
import { urlForImageKey } from '../image-url-builder';

const resolveBucket = resolveUploadBucketForKey as jest.Mock;
const presignForBucket = presignS3GetForBucketKey as jest.Mock;

describe('urlForImageKey', () => {
  beforeEach(() => {
    resolveBucket.mockReset();
    presignForBucket.mockReset();
  });

  it('presigns bare key using bucket from HeadObject probe', async () => {
    const key = 'vendors/v1/profile/photo.jpg';
    resolveBucket.mockResolvedValue('warmpawz-dev-uploads');
    presignForBucket.mockResolvedValue('https://signed.example/warmpawz-dev-uploads/photo.jpg');

    const url = await urlForImageKey(key);

    expect(resolveBucket).toHaveBeenCalledWith(key);
    expect(presignForBucket).toHaveBeenCalledWith('warmpawz-dev-uploads', key, 604800);
    expect(url).toBe('https://signed.example/warmpawz-dev-uploads/photo.jpg');
  });

  it('presigns full S3 URL via presignS3GetUrlIfApplicable host bucket', async () => {
    const hosted =
      'https://warmpawz-dev-uploads.s3.ap-south-1.amazonaws.com/vendors/v1/profile/photo.jpg';
    const url = await urlForImageKey(hosted);
    expect(url).toContain('warmpawz-dev-uploads');
    expect(resolveBucket).not.toHaveBeenCalled();
  });
});
