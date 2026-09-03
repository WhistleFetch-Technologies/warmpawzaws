jest.mock('../image-resolve', () => ({
  resolveImageForContext: jest.fn(),
}));

jest.mock('../../../utils/s3-media-presign', () => ({
  presignS3GetUrlIfApplicable: jest.fn(async (url: string) => url),
  stripS3PresignQueryFromUrl: jest.fn((url: string) => url),
}));

jest.mock('../../../endpoints/constants/helper', () => ({
  regeneratePresignedUrl: jest.fn(async () => null),
}));

jest.mock('../image-migrator-persist', () => ({
  persistMigratedImageKey: jest.fn(),
}));

import { resolveImageForContext } from '../image-resolve';
import {
  resolveCustomerPhotoForDisplay,
  resolvePetPhotoForDisplay,
} from '../resolve-entity-profile-photo';

const mockResolve = resolveImageForContext as jest.MockedFunction<typeof resolveImageForContext>;

describe('resolve-entity-profile-photo', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockResolve.mockResolvedValue({
      imageKey: 'media/pet/pet-1/avatar_abc.webp',
      url: 'https://cdn.example/media/pet/pet-1/avatar_abc.webp',
      thumbUrl: null,
      displayUrl: 'https://cdn.example/media/pet/pet-1/avatar_abc.webp',
      width: 100,
      height: 100,
      thumbWidth: null,
      thumbHeight: null,
    });
  });

  it('resolvePetPhotoForDisplay persists to pets.profile_photo_url only', async () => {
    const legacyKey = 'media/pet/pet-uuid-1/avatar_old.jpeg';
    await resolvePetPhotoForDisplay(legacyKey, 'pet-uuid-1');

    expect(mockResolve).toHaveBeenCalledTimes(1);
    expect(mockResolve).toHaveBeenCalledWith(
      legacyKey,
      expect.objectContaining({
        assetType: 'pet',
        ownerId: 'pet-uuid-1',
        persist: {
          kind: 'scalar',
          table: 'pets',
          column: 'profile_photo_url',
          idColumn: 'id',
          id: 'pet-uuid-1',
        },
      }),
    );
  });

  it('resolveCustomerPhotoForDisplay persists to customers.profile_photo_url only', async () => {
    const legacyKey = 'media/customer/cust-1/profile_old.jpeg';
    await resolveCustomerPhotoForDisplay(legacyKey, 'cust-uuid-1');

    expect(mockResolve).toHaveBeenCalledTimes(1);
    expect(mockResolve).toHaveBeenCalledWith(
      legacyKey,
      expect.objectContaining({
        assetType: 'profile',
        ownerId: 'cust-uuid-1',
        persist: {
          kind: 'scalar',
          table: 'customers',
          column: 'profile_photo_url',
          idColumn: 'id',
          id: 'cust-uuid-1',
        },
      }),
    );
  });

  it('profile GET pet path must not use customer persist target', async () => {
    const customerId = 'customer-aaa';
    const petId = 'pet-bbb';
    const petLegacy = 'media/pet/pet-bbb/avatar_legacy.jpeg';

    await resolvePetPhotoForDisplay(petLegacy, petId);

    const petOpts = mockResolve.mock.calls[0][1];
    expect(petOpts.persist?.kind).toBe('scalar');
    if (petOpts.persist?.kind === 'scalar') {
      expect(petOpts.persist.table).toBe('pets');
      expect(petOpts.persist.id).toBe(petId);
      expect(petOpts.persist.id).not.toBe(customerId);
    }

    mockResolve.mockClear();
    await resolveCustomerPhotoForDisplay('media/customer/x/profile.jpeg', customerId);
    const custOpts = mockResolve.mock.calls[0][1];
    if (custOpts.persist?.kind === 'scalar') {
      expect(custOpts.persist.table).toBe('customers');
      expect(custOpts.persist.id).toBe(customerId);
    }
  });
});
