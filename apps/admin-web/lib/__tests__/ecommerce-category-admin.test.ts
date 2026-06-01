import {
  mapApiCategoryToForm,
  mapFormCategoryToApiPayload,
  mapFormCategoriesToPutBody,
} from '../ecommerce-category-admin';

describe('ecommerce-category-admin', () => {
  it('maps API row to form fields', () => {
    const form = mapApiCategoryToForm({
      id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      name: 'Pet Food',
      description: 'Kibble',
      display_order: 2,
      is_active: false,
      image_url: 'https://bucket.s3.amazonaws.com/ecommerce/categories/food.png',
    });

    expect(form.id).toBe('a1b2c3d4-e5f6-7890-abcd-ef1234567890');
    expect(form.name).toBe('Pet Food');
    expect(form.order).toBe(2);
    expect(form.enabled).toBe(false);
    expect(form.imageUrl).toContain('food.png');
    expect(form.slug).toBe('pet-food');
  });

  it('maps form to API payload for PUT', () => {
    const payload = mapFormCategoryToApiPayload({
      id: 'cat_123',
      name: 'Treats',
      slug: 'treats',
      order: 3,
      enabled: true,
      imageUrl: 'https://example.com/treats.jpg',
    });

    expect(payload.name).toBe('Treats');
    expect(payload.display_order).toBe(3);
    expect(payload.is_active).toBe(true);
    expect(payload.image_url).toBe('https://example.com/treats.jpg');
  });

  it('wraps categories array for bulk PUT', () => {
    const body = mapFormCategoriesToPutBody([
      {
        id: 'uuid-1',
        name: 'Toys',
        slug: 'toys',
        order: 1,
        enabled: true,
      },
    ]);
    expect(body.categories).toHaveLength(1);
    expect(body.categories[0].name).toBe('Toys');
  });
});
