/**
 * Refresh support ticket attachment URLs for private S3 buckets (presigned GET).
 */

import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { presignS3GetUrlIfApplicable, stripS3PresignQueryFromUrl } from '../../utils/s3-media-presign';

const s3Client = new S3Client({ region: process.env.AWS_REGION || 'ap-south-1' });
const BUCKET_NAME =
  process.env.S3_UPLOADS_BUCKET || process.env.S3_BUCKET_NAME || 'warmpawz-dev-uploads';

async function presignFileKey(fileKey: string, fallbackUrl?: string): Promise<string | null> {
  const key = fileKey.trim();
  if (!key) return null;

  if (fallbackUrl) {
    const stripped = stripS3PresignQueryFromUrl(fallbackUrl);
    try {
      const u = new URL(stripped);
      const match = u.hostname.match(/^([^.]+)\.s3[./]/);
      if (match) {
        return await getSignedUrl(
          s3Client,
          new GetObjectCommand({ Bucket: match[1], Key: key }),
          { expiresIn: 604800 }
        );
      }
    } catch {
      /* fall through */
    }
  }

  try {
    return await getSignedUrl(
      s3Client,
      new GetObjectCommand({ Bucket: BUCKET_NAME, Key: key }),
      { expiresIn: 604800 }
    );
  } catch (err) {
    console.warn('[support-attachments] presign fileKey failed:', key, err);
    return null;
  }
}

async function presignAttachmentRaw(raw: unknown): Promise<Record<string, unknown> | null> {
  if (!raw || typeof raw !== 'object') return null;
  const att = { ...(raw as Record<string, unknown>) };
  const fileKey = typeof att.fileKey === 'string' ? att.fileKey.trim() : '';
  const rawUrl = String(att.displayUrl || att.url || '');

  let freshUrl: string | null = null;
  if (fileKey) {
    freshUrl = await presignFileKey(fileKey, rawUrl);
  }
  if (!freshUrl && rawUrl) {
    const stripped = stripS3PresignQueryFromUrl(rawUrl);
    freshUrl = (await presignS3GetUrlIfApplicable(stripped)) || stripped || null;
  }
  if (!freshUrl) return null;

  att.url = freshUrl;
  att.displayUrl = freshUrl;
  return att;
}

/** Re-presign attachments and response_attachments in ticket metadata for admin/customer UIs. */
export async function enrichSupportTicketMetadataAttachments(
  metadata: unknown
): Promise<Record<string, unknown> | undefined> {
  if (metadata == null || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return undefined;
  }

  const meta = { ...(metadata as Record<string, unknown>) };
  let changed = false;

  if (Array.isArray(meta.attachments)) {
    const next = (
      await Promise.all(meta.attachments.map((item) => presignAttachmentRaw(item)))
    ).filter(Boolean) as Record<string, unknown>[];
    if (next.length) {
      meta.attachments = next;
      changed = true;
    }
  }

  const responseAttachments = meta.response_attachments;
  if (
    responseAttachments &&
    typeof responseAttachments === 'object' &&
    !Array.isArray(responseAttachments)
  ) {
    const map = { ...(responseAttachments as Record<string, unknown>) };
    for (const [responseId, list] of Object.entries(map)) {
      if (!Array.isArray(list)) continue;
      const next = (
        await Promise.all(list.map((item) => presignAttachmentRaw(item)))
      ).filter(Boolean) as Record<string, unknown>[];
      if (next.length) {
        map[responseId] = next;
        changed = true;
      }
    }
    meta.response_attachments = map;
  }

  return changed ? meta : (metadata as Record<string, unknown>);
}
