import {
  extractPetImageKey,
  collectUploadKeysFromResult,
  keysToAbandon,
} from '@/lib/pet-photo-upload';
import type { PhotoUploadResult } from '@/lib/photo-upload-enhanced';

describe('extractPetImageKey', () => {
  it('returns raw S3 key', () => {
    expect(extractPetImageKey('media/pet/pet_123/avatar_abc.webp')).toBe(
      'media/pet/pet_123/avatar_abc.webp',
    );
  });

  it('extracts key from S3 URL', () => {
    expect(
      extractPetImageKey(
        'https://bucket.s3.ap-south-1.amazonaws.com/media/pet/pet_123/avatar_abc.webp',
      ),
    ).toBe('media/pet/pet_123/avatar_abc.webp');
  });

  it('strips presigned query params', () => {
    expect(
      extractPetImageKey(
        'https://bucket.s3.ap-south-1.amazonaws.com/media/pet/pet_123/avatar_abc.webp?X-Amz-Algorithm=AWS4',
      ),
    ).toBe('media/pet/pet_123/avatar_abc.webp');
  });
});

describe('collectUploadKeysFromResult', () => {
  it('includes display and derived thumb keys', () => {
    const keys = collectUploadKeysFromResult({
      success: true,
      imageKey: 'media/pet/pet_123/avatar_abc.webp',
    });
    expect(keys).toEqual([
      'media/pet/pet_123/avatar_abc.webp',
      'media/pet/pet_123/avatar_abc.thumb.webp',
    ]);
  });

  it('uses explicit thumbKey when provided', () => {
    const keys = collectUploadKeysFromResult({
      success: true,
      imageKey: 'media/pet/pet_123/avatar_abc.webp',
      thumbKey: 'media/pet/pet_123/avatar_abc.thumb.webp',
    } as PhotoUploadResult);
    expect(keys).toHaveLength(2);
  });
});

describe('keysToAbandon', () => {
  it('excludes committed key', () => {
    const pending = [
      'media/pet/pet_1/avatar_old.webp',
      'media/pet/pet_1/avatar_new.webp',
    ];
    const committed = 'media/pet/pet_1/avatar_old.webp';
    expect(keysToAbandon(pending, committed)).toEqual([
      'media/pet/pet_1/avatar_new.webp',
    ]);
  });
});
