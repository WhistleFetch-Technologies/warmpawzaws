import {
  filterSortCapDriveEntries,
  parseDriveFolderEntries,
  type DriveFolderEntry,
} from '../drive-folder-images';
import { PRODUCT_MAX_IMAGES } from '../../services/image/image-types';

describe('drive-folder-images parsing', () => {
  it('parses file/d links with filenames from HTML', () => {
    const html = `
      <a href="https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/view">z-last.JPG</a>
      <a href="https://drive.google.com/file/d/1BcDeFgHiJkLmNoPqRsTuVwXyZa123456/view">a-first.png</a>
      <a href="https://drive.google.com/file/d/1CdEfGhIjKlMnOpQrStUvWxYz01234567/view">notes.txt</a>
    `;
    const entries = parseDriveFolderEntries(html, '1FolderIdIgnoreXXXXXXXXXXXX');
    expect(entries.length).toBeGreaterThanOrEqual(2);
    const { kept, truncated } = filterSortCapDriveEntries(entries);
    expect(truncated).toBe(false);
    expect(kept.map((e) => e.filename.toLowerCase())).toEqual(['a-first.png', 'z-last.jpg']);
    expect(kept.every((e) => !e.filename.toLowerCase().endsWith('.txt'))).toBe(true);
  });

  it('sorts by filename then caps at PRODUCT_MAX_IMAGES without error', () => {
    const entries: DriveFolderEntry[] = [];
    for (let i = 1; i <= 10; i++) {
      const n = String(i).padStart(2, '0');
      entries.push({
        fileId: `1FileIdPadToTwentyChars${n}XXXX`,
        filename: `img-${n}.webp`,
      });
    }
    const { kept, truncated } = filterSortCapDriveEntries(entries);
    expect(truncated).toBe(true);
    expect(kept).toHaveLength(PRODUCT_MAX_IMAGES);
    expect(kept[0].filename).toBe('img-01.webp');
    expect(kept[7].filename).toBe('img-08.webp');
  });

  it('matches image extensions case-insensitively', () => {
    const { kept } = filterSortCapDriveEntries([
      { fileId: '1JpegFileIdTwentyCharsXXX', filename: 'A.JPEG' },
      { fileId: '1PngFileIdTwentyCharsXXXX', filename: 'B.PNG' },
      { fileId: '1GifFileIdTwentyCharsXXXX', filename: 'C.GIF' },
    ]);
    expect(kept).toHaveLength(3);
  });
});
