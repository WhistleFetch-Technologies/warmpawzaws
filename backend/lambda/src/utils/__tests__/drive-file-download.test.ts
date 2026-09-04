import {
  downloadDriveFileImage,
  extractDriveFileId,
  parseDriveConfirmToken,
  driveDownloadUrl,
  lh3DriveUrl,
  type DriveBinaryFetch,
} from '../drive-file-download';

const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

describe('drive-file-download', () => {
  it('extracts file ids from Drive URL forms', () => {
    const id = '1AbCdEfGhIjKlMnOpQrStUvWxYz012345';
    expect(extractDriveFileId(id)).toBe(id);
    expect(extractDriveFileId(`https://drive.google.com/uc?export=view&id=${id}`)).toBe(id);
    expect(extractDriveFileId(`https://drive.google.com/file/d/${id}/view`)).toBe(id);
    expect(extractDriveFileId('https://example.com/photo.jpg')).toBeNull();
  });

  it('parses confirm tokens from Drive interstitial HTML', () => {
    expect(parseDriveConfirmToken('<input name="confirm" value="ABCD123">')).toBe('ABCD123');
    expect(parseDriveConfirmToken('href="https://drive.google.com/uc?export=download&confirm=t&id=x"')).toBe('t');
    expect(parseDriveConfirmToken('<html>not a virus page</html>')).toBeNull();
  });

  it('follows confirm-token HTML then returns image bytes', async () => {
    const fileId = '1AbCdEfGhIjKlMnOpQrStUvWxYz012345';
    const fetchFn: DriveBinaryFetch = jest.fn(async (url) => {
      if (url === driveDownloadUrl(fileId)) {
        return {
          status: 200,
          contentType: 'text/html',
          body: Buffer.from('<input name="confirm" value="TOKEN99">'),
          setCookie: ['download_warning_TOKEN99=ok'],
        };
      }
      if (url === driveDownloadUrl(fileId, 'TOKEN99')) {
        return {
          status: 200,
          contentType: 'image/png',
          body: TINY_PNG,
          setCookie: [],
        };
      }
      throw new Error(`unexpected url ${url}`);
    });

    const result = await downloadDriveFileImage(fileId, fetchFn);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.mime).toBe('image/png');
      expect(result.buffer.equals(TINY_PNG)).toBe(true);
    }
  });

  it('falls back to lh3 when download HTML is not an image', async () => {
    const fileId = '1AbCdEfGhIjKlMnOpQrStUvWxYz012345';
    const fetchFn: DriveBinaryFetch = jest.fn(async (url) => {
      if (url.includes('googleusercontent.com')) {
        return { status: 200, contentType: 'image/png', body: TINY_PNG, setCookie: [] };
      }
      return {
        status: 200,
        contentType: 'text/html',
        body: Buffer.from('<html>quota</html>'),
        setCookie: [],
      };
    });
    const result = await downloadDriveFileImage(fileId, fetchFn);
    expect(result.ok).toBe(true);
    expect(fetchFn).toHaveBeenCalledWith(lh3DriveUrl(fileId), undefined);
  });

  it('fails closed on non-image HTML and does not invent a Drive URL', async () => {
    const fileId = '1AbCdEfGhIjKlMnOpQrStUvWxYz012345';
    const fetchFn: DriveBinaryFetch = async () => ({
      status: 200,
      contentType: 'text/html',
      body: Buffer.from('<html>not an image</html>'),
      setCookie: [],
    });
    const result = await downloadDriveFileImage(fileId, fetchFn);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain('Could not download');
    }
    expect(JSON.stringify(result)).not.toContain('uc?export=view');
  });
});
