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


function uploadBucketCandidates(): string[] {
    const seen = new Set<string>();
    const add = (name?: string | null) => {
        const t = name?.trim();
        if (t) seen.add(t);
    };
    add(process.env.S3_UPLOADS_BUCKET);
    add(process.env.S3_BUCKET_NAME);
    add('warmpawz-dev-uploads');
    add(process.env.S3_STORAGE_BUCKET);
    return [...seen];
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

        const { S3Client, GetObjectCommand, HeadObjectCommand } = await import('@aws-sdk/client-s3');
        const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
        const s3Client = new S3Client({ region: process.env.AWS_REGION || 'ap-south-1' });

        let resolvedBucket: string | null = null;
        for (const bucket of uploadBucketCandidates()) {
            try {
                await s3Client.send(
                    new HeadObjectCommand({
                        Bucket: bucket,
                        Key: s3Key,
                    })
                );
                resolvedBucket = bucket;
                console.log(`[PRESIGNED-URL] Object exists in S3 bucket ${bucket}: ${s3Key}`);
                break;
            } catch (headError: any) {
                if (headError.name === 'NotFound' || headError.$metadata?.httpStatusCode === 404) {
                    continue;
                }
                console.warn(
                    `[PRESIGNED-URL] Error checking object in ${bucket} for ${s3Key}:`,
                    headError?.message
                );
            }
        }

        if (!resolvedBucket) {
            console.error(`[PRESIGNED-URL] Object not found in any upload bucket: ${s3Key}`);
            return null;
        }

        const signedUrl = await getSignedUrl(
            s3Client,
            new GetObjectCommand({
                Bucket: resolvedBucket,
                Key: s3Key,
            }),
            { expiresIn: 604800 } // 7 days
        );

        if (!signedUrl || typeof signedUrl !== 'string' || !signedUrl.startsWith('https://')) {
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