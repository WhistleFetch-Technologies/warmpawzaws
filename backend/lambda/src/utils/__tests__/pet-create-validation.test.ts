import { validatePetCreatePayload } from '../pet-create-validation';

const validPayload = {
  customerId: '550e8400-e29b-41d4-a716-446655440000',
  name: 'Bruno',
  petType: 'Dog',
  breed: 'Labrador Retriever',
  gender: 'male',
  dob: '2020-06-15',
  photo: 'https://example.com/bruno.jpg',
};

describe('validatePetCreatePayload', () => {
  it('accepts a complete minimal payload', () => {
    expect(validatePetCreatePayload(validPayload)).toEqual({ ok: true });
  });

  it('accepts age instead of dob', () => {
    const { dob, ...rest } = validPayload;
    expect(validatePetCreatePayload({ ...rest, age: 3, ageUnit: 'years' })).toEqual({
      ok: true,
    });
  });

  it('accepts photos array', () => {
    const { photo, ...rest } = validPayload;
    expect(
      validatePetCreatePayload({ ...rest, photos: ['https://example.com/p.jpg'] }),
    ).toEqual({ ok: true });
  });

  it('rejects missing customerId when required', () => {
    const { customerId, ...rest } = validPayload;
    const result = validatePetCreatePayload(rest);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('customerId');
  });

  it('allows missing customerId when requireCustomerId is false', () => {
    const { customerId, ...rest } = validPayload;
    expect(validatePetCreatePayload(rest, { requireCustomerId: false })).toEqual({
      ok: true,
    });
  });

  it('rejects missing name', () => {
    const result = validatePetCreatePayload({ ...validPayload, name: '  ' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('name');
  });

  it('rejects invalid pet type', () => {
    const result = validatePetCreatePayload({ ...validPayload, petType: 'Bird' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('pet type');
  });

  it('rejects missing breed', () => {
    const result = validatePetCreatePayload({ ...validPayload, breed: '' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('Breed');
  });

  it('rejects missing gender', () => {
    const result = validatePetCreatePayload({ ...validPayload, gender: '' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('Gender');
  });

  it('rejects invalid gender', () => {
    const result = validatePetCreatePayload({ ...validPayload, gender: 'unknown' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('Gender');
  });

  it('rejects missing dob and age', () => {
    const { dob, ...rest } = validPayload;
    const result = validatePetCreatePayload(rest);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('Date of birth');
  });

  it('rejects missing photo', () => {
    const { photo, ...rest } = validPayload;
    const result = validatePetCreatePayload(rest);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('photo');
  });

  it('accepts species and type aliases', () => {
    const { petType, ...rest } = validPayload;
    expect(validatePetCreatePayload({ ...rest, species: 'Cat' })).toEqual({ ok: true });
  });
});
