export function extractS3KeyFromUrl(url: string | null | undefined): string | null {
    if (!url) return null;

    try {
        // If it's already an S3 key (no https://), return as-is
        if (!url.includes('https://') && !url.includes('http://')) {
            return url.trim();
        }

        // Extract from presigned URL or full S3 URL
        const urlObj = new URL(url);
        const pathname = urlObj.pathname;

        // Remove leading slash
        const s3Key = pathname.substring(1);

        if (s3Key && s3Key.length > 0) {
            return s3Key;
        }

        // Fallback: try regex extraction
        const s3Match = url.match(/s3[.-]?[a-z0-9-]+\.amazonaws\.com\/([^?]+)/i);
        if (s3Match && s3Match[1]) {
            return decodeURIComponent(s3Match[1]);
        }

        // Try extracting from path pattern
        const vendorsMatch = url.match(/vendors\/[^?]+/i);
        if (vendorsMatch && vendorsMatch[0]) {
            return vendorsMatch[0].trim();
        }

        console.warn(`[EXTRACT-S3-KEY] Could not extract key from URL: ${url?.substring(0, 150)}`);
    } catch (regexError) {
        console.error(`[EXTRACT-S3-KEY] Error in URL extraction:`, regexError);
        return null;
    }

    return null;
}


/** Buckets that may hold vendor/product uploads (dev legacy + current user-uploads). */
export function uploadBucketCandidates(): string[] {
    const seen = new Set<string>();
    const add = (name?: string | null) => {
        const t = name?.trim();
        if (t) seen.add(t);
    };
    add(process.env.S3_UPLOADS_BUCKET);
    add(process.env.S3_BUCKET_NAME);
    add('warmpawz-dev-uploads');
    add('warmpawz-dev-user-uploads-057442119249');
    add(process.env.S3_STORAGE_BUCKET);
    return [...seen];
}

/** In-process cache for HeadObject bucket resolution (Lambda lifetime). */
const uploadBucketForKeyCache = new Map<string, string | null>();

/** Find which upload bucket contains `key` (HeadObject probe). */
export async function resolveUploadBucketForKey(s3Key: string): Promise<string | null> {
    const key = String(s3Key || '').trim().replace(/^\/+/, '');
    if (!key) return null;

    if (uploadBucketForKeyCache.has(key)) {
        return uploadBucketForKeyCache.get(key) ?? null;
    }

    const { S3Client, HeadObjectCommand } = await import('@aws-sdk/client-s3');
    const s3Client = new S3Client({ region: process.env.AWS_REGION || 'ap-south-1' });

    let resolved: string | null = null;
    for (const bucket of uploadBucketCandidates()) {
        try {
            await s3Client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
            resolved = bucket;
            break;
        } catch (headError: unknown) {
            const err = headError as { name?: string; $metadata?: { httpStatusCode?: number } };
            if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
                continue;
            }
            console.warn(`[resolveUploadBucketForKey] HeadObject failed bucket=${bucket} key=${key}:`, err);
        }
    }
    uploadBucketForKeyCache.set(key, resolved);
    return resolved;
}

/** Presign GET for a key in a known bucket. */
export async function presignS3GetForBucketKey(
    bucket: string,
    s3Key: string,
    expiresIn = 604800,
): Promise<string | null> {
    const key = String(s3Key || '').trim().replace(/^\/+/, '');
    if (!bucket?.trim() || !key) return null;

    const { S3Client, GetObjectCommand } = await import('@aws-sdk/client-s3');
    const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
    const s3Client = new S3Client({ region: process.env.AWS_REGION || 'ap-south-1' });

    const signedUrl = await getSignedUrl(
        s3Client,
        new GetObjectCommand({ Bucket: bucket.trim(), Key: key }),
        { expiresIn },
    );
    return signedUrl?.startsWith('https://') ? signedUrl : null;
}

export async function regeneratePresignedUrl(s3KeyOrUrl: string | null | undefined): Promise<string | null> {
    if (!s3KeyOrUrl) return null;

    try {
        const raw = String(s3KeyOrUrl).trim();
        if (/^https?:\/\//i.test(raw)) {
            const { presignS3GetUrlIfApplicable } = await import('../../utils/s3-media-presign');
            const fromHosted = await presignS3GetUrlIfApplicable(raw);
            if (fromHosted && typeof fromHosted === 'string' && fromHosted.startsWith('https://')) {
                return fromHosted;
            }
        }

        const s3Key = extractS3KeyFromUrl(raw);
        if (!s3Key) {
            console.warn(`[PRESIGNED-URL] Could not extract S3 key from URL: ${raw.substring(0, 100)}`);
            return null;
        }

        console.log(`[PRESIGNED-URL] Regenerating URL for S3 key: ${s3Key}`);

        const resolvedBucket = await resolveUploadBucketForKey(s3Key);
        if (!resolvedBucket) {
            console.error(`[PRESIGNED-URL] Object not found in any upload bucket: ${s3Key}`);
            return null;
        }

        console.log(`[PRESIGNED-URL] Object exists in S3 bucket ${resolvedBucket}: ${s3Key}`);

        const signedUrl = await presignS3GetForBucketKey(resolvedBucket, s3Key);
        if (!signedUrl) {
            console.error(`[PRESIGNED-URL] Invalid presigned URL generated for ${s3Key}`);
            return null;
        }

        console.log(`[PRESIGNED-URL] Successfully regenerated URL for ${s3Key}`);
        return signedUrl;
    } catch (error: any) {
        console.error(`[PRESIGNED-URL] Error regenerating URL:`, {
            message: error.message,
            s3KeyOrUrl: s3KeyOrUrl?.substring(0, 100),
        });
        return null;
    }
}