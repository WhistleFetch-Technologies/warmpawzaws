import { expandBulkRowImages } from '../expand-bulk-row-images';
import { createDriveFolderListCache, type DriveFolderListResult } from '../drive-folder-images';

const VENDOR = 'vendor-test-uuid';

function folderUrl(id: string, withUserPath = false): string {
  return withUserPath
    ? `https://drive.google.com/drive/u/0/folders/${id}`
    : `https://drive.google.com/drive/folders/${id}`;
}

describe('expandBulkRowImages', () => {
  it('leaves comma-separated file URLs unchanged and does not call Drive', async () => {
    let calls = 0;
    const rows = [
      {
        rowNum: 1,
        name: 'Product A',
        brand: 'Brand',
        category: 'Pet Clothing',
        images: 'https://cdn.example/a.jpg, https://cdn.example/b.jpg',
      },
    ];
    const result = await expandBulkRowImages(VENDOR, rows, {
      listFolder: async () => {
        calls++;
        return { ok: false, message: 'should not run' };
      },
    });
    expect(calls).toBe(0);
    expect(result.errors).toHaveLength(0);
    expect(rows[0].images).toBe('https://cdn.example/a.jpg, https://cdn.example/b.jpg');
  });

  it('expands one folder onto that row', async () => {
    const folderId = '1FolderAAAAAAAAAAAAAAAAaaaa';
    const rows = [
      {
        rowNum: 1,
        name: 'T-Shirt Blue',
        brand: 'FurryBae',
        category: 'Pet Clothing',
        product_group_id: 'grp-tee',
        images: folderUrl(folderId),
      },
    ];
    const result = await expandBulkRowImages(VENDOR, rows, {
      listFolder: async (id) => {
        expect(id).toBe(folderId);
        return {
          ok: true,
          urls: [
            `https://drive.google.com/uc?export=view&id=1File1`,
            `https://drive.google.com/uc?export=view&id=1File2`,
          ],
          truncated: false,
        };
      },
    });
    expect(result.errors).toHaveLength(0);
    expect(rows[0].images).toContain('uc?export=view&id=1File1');
    expect(String(rows[0].images).split(',').length).toBe(2);
  });

  it('allows same parent with different folders A/B/C', async () => {
    const ids = ['1FolderAaaaaaaaaaaaaaaaaaaa', '1FolderBbbbbbbbbbbbbbbbbbb', '1FolderCcccccccccccccccccc'];
    const rows = ids.map((folderId, i) => ({
      rowNum: i + 1,
      name: 'T-Shirt Blue',
      brand: 'FurryBae',
      category: 'Pet Clothing',
      product_group_id: 'grp-tee',
      variant_attr_1: 'Size',
      variant_value_1: ['Small', 'Medium', 'Large'][i],
      images: folderUrl(folderId),
    }));
    const seen = new Set<string>();
    const result = await expandBulkRowImages(VENDOR, rows, {
      listFolder: async (id) => {
        seen.add(id);
        return {
          ok: true,
          urls: [`https://drive.google.com/uc?export=view&id=${id}-img`],
          truncated: false,
        };
      },
    });
    expect(result.errors).toHaveLength(0);
    expect(seen.size).toBe(3);
    expect(rows[0].images).toContain('1FolderA');
    expect(rows[1].images).toContain('1FolderB');
    expect(rows[2].images).toContain('1FolderC');
  });

  it('fetches same folderId once when reused on same parent', async () => {
    const folderId = '1SharedFolderSameParentXXXX';
    let calls = 0;
    const cache = createDriveFolderListCache();
    const listFolder = async (id: string, c: typeof cache): Promise<DriveFolderListResult> => {
      const existing = c.get(id);
      if (existing) return existing;
      const p = (async () => {
        calls++;
        return {
          ok: true as const,
          urls: [`https://drive.google.com/uc?export=view&id=shared1`],
          truncated: false,
        };
      })();
      c.set(id, p);
      return p;
    };
    const rows = [1, 2, 3].map((n) => ({
      rowNum: n,
      name: 'T-Shirt Blue',
      brand: 'FurryBae',
      category: 'Pet Clothing',
      product_group_id: 'grp-tee',
      images: n === 2 ? folderUrl(folderId, true) : folderUrl(folderId),
    }));
    const result = await expandBulkRowImages(VENDOR, rows, { cache, listFolder });
    expect(result.errors).toHaveLength(0);
    expect(calls).toBe(1);
    expect(rows.every((r) => String(r.images).includes('shared1'))).toBe(true);
  });

  it('rejects cross-parent shared folder before fetch', async () => {
    const folderId = '1CatalogFolderSharedXXXXXX';
    let calls = 0;
    const rows = [
      {
        rowNum: 1,
        name: 'T-Shirt Blue',
        brand: 'FurryBae',
        category: 'Pet Clothing',
        product_group_id: 'grp-tee',
        images: folderUrl(folderId),
      },
      {
        rowNum: 2,
        name: 'Blue Hoodie',
        brand: 'FurryBae',
        category: 'Pet Clothing',
        product_group_id: 'grp-hoodie',
        images: folderUrl(folderId, true),
      },
    ];
    const result = await expandBulkRowImages(VENDOR, rows, {
      listFolder: async () => {
        calls++;
        return { ok: true, urls: ['https://x'], truncated: false };
      },
    });
    expect(calls).toBe(0);
    expect(result.errors).toHaveLength(2);
    expect(result.errors.every((e) => e.message.includes('more than one product'))).toBe(true);
    expect(rows[0].images).toContain('/folders/');
  });

  it('is idempotent when images are already file URLs', async () => {
    let calls = 0;
    const rows = [
      {
        rowNum: 1,
        name: 'P',
        brand: 'B',
        category: 'Pet Clothing',
        images: 'https://drive.google.com/uc?export=view&id=already',
      },
    ];
    await expandBulkRowImages(VENDOR, rows, {
      listFolder: async () => {
        calls++;
        return { ok: false, message: 'no' };
      },
    });
    await expandBulkRowImages(VENDOR, rows, {
      listFolder: async () => {
        calls++;
        return { ok: false, message: 'no' };
      },
    });
    expect(calls).toBe(0);
  });

  it('fails only the bad folder row and continues others', async () => {
    const rows = [
      {
        rowNum: 1,
        name: 'A',
        brand: 'B',
        category: 'Pet Clothing',
        product_group_id: 'g1',
        images: folderUrl('1BadFolderPrivateXXXXXXXXX'),
      },
      {
        rowNum: 2,
        name: 'C',
        brand: 'B',
        category: 'Pet Clothing',
        product_group_id: 'g2',
        images: 'https://cdn.example/ok.jpg',
      },
      {
        rowNum: 3,
        name: 'D',
        brand: 'B',
        category: 'Pet Clothing',
        product_group_id: 'g3',
        images: folderUrl('1GoodFolderYYYYYYYYYYYYYYY'),
      },
    ];
    const result = await expandBulkRowImages(VENDOR, rows, {
      listFolder: async (id) => {
        if (id.startsWith('1Bad')) {
          return { ok: false, message: 'Could not read images from this Drive folder.' };
        }
        return {
          ok: true,
          urls: [`https://drive.google.com/uc?export=view&id=ok`],
          truncated: false,
        };
      },
    });
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].row).toBe(1);
    expect(rows[1].images).toBe('https://cdn.example/ok.jpg');
    expect(rows[2].images).toContain('uc?export=view');
  });

  it('emits truncation warning when folder has more than 8 images', async () => {
    const rows = [
      {
        rowNum: 1,
        name: 'P',
        brand: 'B',
        category: 'Pet Clothing',
        images: folderUrl('1ManyImagesFolderXXXXXXXXX'),
      },
    ];
    const result = await expandBulkRowImages(VENDOR, rows, {
      listFolder: async () => ({
        ok: true,
        urls: Array.from({ length: 8 }, (_, i) => `https://drive.google.com/uc?export=view&id=f${i}`),
        truncated: true,
      }),
    });
    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].message).toMatch(/first 8/i);
  });
});
