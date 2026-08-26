import {
  classifyBulkImageCell,
  extractFolderId,
  isDriveFolderUrl,
} from '../bulk-image-cell';

describe('bulk-image-cell', () => {
  it('classifies comma-separated CDN URLs as files', () => {
    const r = classifyBulkImageCell(
      'https://cdn.example/a.jpg, https://cdn.example/b.jpg',
    );
    expect(r).toEqual({
      kind: 'files',
      urls: ['https://cdn.example/a.jpg', 'https://cdn.example/b.jpg'],
    });
  });

  it('classifies Drive file links as files (not folders)', () => {
    const fileUrl = 'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/view';
    const viewUrl = 'https://drive.google.com/uc?export=view&id=1AbCdEfGhIjKlMnOpQrStUvWxYz012345';
    expect(classifyBulkImageCell(fileUrl).kind).toBe('files');
    expect(classifyBulkImageCell(viewUrl).kind).toBe('files');
    expect(isDriveFolderUrl(fileUrl)).toBe(false);
  });

  it('classifies one Drive folder URL as folder', () => {
    const url = 'https://drive.google.com/drive/folders/1CLclvFUacvuzKF5N5WH8fjBTR6MwWH5o';
    const r = classifyBulkImageCell(url);
    expect(r).toEqual({
      kind: 'folder',
      folderId: '1CLclvFUacvuzKF5N5WH8fjBTR6MwWH5o',
    });
  });

  it('normalizes /drive/u/0/folders/ to the same folderId', () => {
    const a = 'https://drive.google.com/drive/folders/1CLclvFUacvuzKF5N5WH8fjBTR6MwWH5o';
    const b = 'https://drive.google.com/drive/u/0/folders/1CLclvFUacvuzKF5N5WH8fjBTR6MwWH5o?usp=sharing';
    expect(extractFolderId(a)).toBe(extractFolderId(b));
    expect(classifyBulkImageCell(`${a}, ${b}`)).toEqual({
      kind: 'folder',
      folderId: '1CLclvFUacvuzKF5N5WH8fjBTR6MwWH5o',
    });
  });

  it('rejects folder mixed with file URL', () => {
    const r = classifyBulkImageCell(
      'https://drive.google.com/drive/folders/1CLclvFUacvuzKF5N5WH8fjBTR6MwWH5o, https://cdn.example/a.jpg',
    );
    expect(r.kind).toBe('invalid');
  });

  it('rejects two different folder ids in one cell', () => {
    const r = classifyBulkImageCell(
      'https://drive.google.com/drive/folders/1AAAAAAAAAAAAAAAAaaaaaaaaaaa, https://drive.google.com/drive/folders/1BBBBBBBBBBBBBBBBBbbbbbbbbbbb',
    );
    expect(r.kind).toBe('invalid');
  });

  it('rejects empty cell', () => {
    expect(classifyBulkImageCell('').kind).toBe('invalid');
    expect(classifyBulkImageCell('  ,  ').kind).toBe('invalid');
  });
});
