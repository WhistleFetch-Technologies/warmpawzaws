import { validateAbandonPetUploadInput } from '../abandon-pet-upload.service';

describe('validateAbandonPetUploadInput', () => {
  const validTempId = 'pet_1738123456789';
  const validKey = `media/pet/${validTempId}/avatar_abc123.webp`;
  const validThumbKey = `media/pet/${validTempId}/avatar_abc123.thumb.webp`;

  it('accepts valid temp pet id and avatar keys', () => {
    expect(
      validateAbandonPetUploadInput({
        tempPetId: validTempId,
        imageKeys: [validKey, validThumbKey],
      }),
    ).toBeNull();
  });

  it('rejects real pet UUID as tempPetId', () => {
    expect(
      validateAbandonPetUploadInput({
        tempPetId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        imageKeys: [validKey],
      }),
    ).toMatch(/temp id/i);
  });

  it('rejects keys outside temp pet folder', () => {
    expect(
      validateAbandonPetUploadInput({
        tempPetId: validTempId,
        imageKeys: ['media/pet/other_pet/avatar_abc.webp'],
      }),
    ).toMatch(/Invalid imageKey/);
  });

  it('rejects keys under UUID pet folder', () => {
    expect(
      validateAbandonPetUploadInput({
        tempPetId: validTempId,
        imageKeys: ['media/pet/a1b2c3d4-e5f6-7890-abcd-ef1234567890/avatar_abc.webp'],
      }),
    ).toMatch(/Invalid imageKey/);
  });

  it('rejects empty imageKeys', () => {
    expect(
      validateAbandonPetUploadInput({
        tempPetId: validTempId,
        imageKeys: [],
      }),
    ).toMatch(/non-empty array/);
  });
});
