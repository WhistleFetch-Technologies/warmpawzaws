/**
 * Classify a bulk product Image cell as file URLs vs one Drive folder.
 * Folder expansion happens elsewhere; this module is sync and network-free.
 */

const FOLDER_PATH_RE =
  /drive\.google\.com\/drive\/(?:u\/\d+\/)?folders\/([A-Za-z0-9_-]{10,})/i;

export type BulkImageCell =
  | { kind: 'files'; urls: string[] }
  | { kind: 'folder'; folderId: string }
  | { kind: 'invalid'; message: string };

/** True only for Drive folder share links (not /file/d/ or uc?export=view). */
export function isDriveFolderUrl(url: string): boolean {
  return FOLDER_PATH_RE.test(String(url ?? '').trim());
}

/** Extract normalized folder id; null if not a folder URL. */
export function extractFolderId(url: string): string | null {
  const m = String(url ?? '')
    .trim()
    .match(FOLDER_PATH_RE);
  return m ? m[1] : null;
}

function splitImageTokens(raw: unknown): string[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) {
    return [...new Set(raw.map((u) => String(u ?? '').trim()).filter(Boolean))];
  }
  return [
    ...new Set(
      String(raw)
        .split(/[,\n]/)
        .map((u) => u.trim())
        .filter(Boolean),
    ),
  ];
}

/**
 * Classify Image cell contents before validation / Drive listing.
 * - Comma-separated file URLs (incl. Drive /file/d/ and uc?export=view) → files
 * - Exactly one unique folderId (any URL form) → folder
 * - Mixed folder+files or multiple folderIds → invalid
 */
export function classifyBulkImageCell(raw: unknown): BulkImageCell {
  const tokens = splitImageTokens(raw);
  if (tokens.length === 0) {
    return { kind: 'invalid', message: 'At least one product image is required' };
  }

  const folderIds: string[] = [];
  const fileUrls: string[] = [];

  for (const token of tokens) {
    const folderId = extractFolderId(token);
    if (folderId) {
      folderIds.push(folderId);
      continue;
    }
    if (/^https?:\/\//i.test(token)) {
      fileUrls.push(token);
      continue;
    }
    return {
      kind: 'invalid',
      message: 'Image must be an http(s) URL (1000×1000 px recommended)',
    };
  }

  const uniqueFolderIds = [...new Set(folderIds)];

  if (uniqueFolderIds.length === 1 && fileUrls.length === 0) {
    return { kind: 'folder', folderId: uniqueFolderIds[0] };
  }

  if (uniqueFolderIds.length === 0 && fileUrls.length === tokens.length) {
    return { kind: 'files', urls: fileUrls };
  }

  if (uniqueFolderIds.length > 0 && fileUrls.length > 0) {
    return {
      kind: 'invalid',
      message:
        'Use either comma-separated image file URLs, or one Drive folder per product row — not both in the same cell',
    };
  }

  if (uniqueFolderIds.length > 1) {
    return {
      kind: 'invalid',
      message: 'Only one Drive folder is allowed per row (or comma-separated file URLs)',
    };
  }

  return {
    kind: 'invalid',
    message: 'Image must be an http(s) URL (1000×1000 px recommended)',
  };
}
