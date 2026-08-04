import {
  deletePetProfilePhotoAssets,
  isAllowedPetProfilePhotoKey,
} from '../delete-pet-profile-photo.service';
import { deleteObjectKey, listObjectKeysUnderPrefix } from '../image-repository';

jest.mock('../image-repository', () => ({
  deleteObjectKey: jest.fn(),
  listObjectKeysUnderPrefix: jest.fn(),
}));

const mockDeleteObjectKey = deleteObjectKey as jest.MockedFunction<typeof deleteObjectKey>;
const mockListPrefix = listObjectKeysUnderPrefix as jest.MockedFunction<
  typeof listObjectKeysUnderPrefix
>;

const PET_UUID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const OTHER_UUID = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';

describe('isAllowedPetProfilePhotoKey', () => {
  it('accepts avatar keys under the pet UUID folder', () => {
    const key = `media/pet/${PET_UUID}/avatar_abc123.webp`;
    expect(isAllowedPetProfilePhotoKey(key, PET_UUID)).toBe(true);
    expect(
      isAllowedPetProfilePhotoKey(
        `media/pet/${PET_UUID}/avatar_abc123.thumb.webp`,
        PET_UUID,
      ),
    ).toBe(true);
  });

  it('rejects keys under another pet folder', () => {
    const key = `media/pet/${OTHER_UUID}/avatar_abc123.webp`;
    expect(isAllowedPetProfilePhotoKey(key, PET_UUID)).toBe(false);
  });

  it('accepts legacy temp folder keys from profile URL', () => {
    expect(
      isAllowedPetProfilePhotoKey(
        'media/pet/pet_1738123456789/avatar_abc123.webp',
        PET_UUID,
      ),
    ).toBe(true);
  });

  it('rejects non-avatar paths', () => {
    expect(isAllowedPetProfilePhotoKey('media/pet/foo/other.webp', PET_UUID)).toBe(false);
  });
});

describe('deletePetProfilePhotoAssets', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDeleteObjectKey.mockResolvedValue(undefined);
    mockListPrefix.mockResolvedValue([]);
  });

  it('no-ops for invalid pet id', async () => {
    const result = await deletePetProfilePhotoAssets('pet_123', 'http://x');
    expect(result).toEqual({ deleted: 0, failed: 0 });
    expect(mockDeleteObjectKey).not.toHaveBeenCalled();
  });

  it('no-ops when profile photo url is null', async () => {
    const result = await deletePetProfilePhotoAssets(PET_UUID, null);
    expect(result).toEqual({ deleted: 0, failed: 0 });
    expect(mockDeleteObjectKey).not.toHaveBeenCalled();
  });

  it('deletes display and thumb from profile photo url', async () => {
    const displayKey = `media/pet/${PET_UUID}/avatar_abc123.webp`;
    const url = `https://bucket.s3.ap-south-1.amazonaws.com/${displayKey}`;

    const result = await deletePetProfilePhotoAssets(PET_UUID, url);

    expect(mockDeleteObjectKey).toHaveBeenCalledTimes(2);
    expect(mockDeleteObjectKey).toHaveBeenCalledWith(displayKey);
    expect(mockDeleteObjectKey).toHaveBeenCalledWith(
      `media/pet/${PET_UUID}/avatar_abc123.thumb.webp`,
    );
    expect(result.deleted).toBe(2);
    expect(result.failed).toBe(0);
  });

  it('deletes legacy temp path keys from profile photo url only', async () => {
    const legacyKey = 'media/pet/pet_1738123456789/avatar_legacy.webp';
    const result = await deletePetProfilePhotoAssets(PET_UUID, legacyKey);

    expect(mockDeleteObjectKey).toHaveBeenCalledWith(legacyKey);
    expect(mockDeleteObjectKey).toHaveBeenCalledWith(
      'media/pet/pet_1738123456789/avatar_legacy.thumb.webp',
    );
    expect(result.deleted).toBe(2);
  });

  it('includes prefix-listed avatar keys for the pet UUID folder', async () => {
    const prefixKey = `media/pet/${PET_UUID}/avatar_fromprefix.webp`;
    mockListPrefix.mockResolvedValue([
      prefixKey,
      `media/pet/${PET_UUID}/avatar_fromprefix.thumb.webp`,
      `media/pet/${PET_UUID}/notes.txt`,
    ]);

    const result = await deletePetProfilePhotoAssets(PET_UUID, null);

    expect(mockListPrefix).toHaveBeenCalledWith(`media/pet/${PET_UUID}/`);
    expect(mockDeleteObjectKey).toHaveBeenCalledWith(prefixKey);
    expect(mockDeleteObjectKey).toHaveBeenCalledWith(
      `media/pet/${PET_UUID}/avatar_fromprefix.thumb.webp`,
    );
    expect(result.deleted).toBe(2);
  });

  it('counts failed deletes without throwing', async () => {
    mockDeleteObjectKey.mockRejectedValueOnce(new Error('s3 error'));
    const displayKey = `media/pet/${PET_UUID}/avatar_fail.webp`;

    const result = await deletePetProfilePhotoAssets(PET_UUID, displayKey);

    expect(result.failed).toBeGreaterThan(0);
  });
});
