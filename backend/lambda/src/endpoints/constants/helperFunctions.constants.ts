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


export async function regeneratePresignedUrl(s3KeyOrUrl: string | null | undefined): Promise<string | null> {
    if (!s3KeyOrUrl) return null;

    try {
        const s3Key = extractS3KeyFromUrl(s3KeyOrUrl);
        if (!s3Key) {
            console.warn(`[PRESIGNED-URL] Could not extract S3 key from URL: ${s3KeyOrUrl?.substring(0, 100)}`);
            return null;
        }

        console.log(`[PRESIGNED-URL] Regenerating URL for S3 key: ${s3Key}`);

        const { S3Client, GetObjectCommand, HeadObjectCommand } = await import('@aws-sdk/client-s3');
        const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
        const s3Client = new S3Client({ region: process.env.AWS_REGION || 'ap-south-1' });
        const BUCKET_NAME = process.env.S3_UPLOADS_BUCKET || 'warmpawz-dev-uploads';

        // Verify object exists before generating presigned URL
        try {
            const headCommand = new HeadObjectCommand({
                Bucket: BUCKET_NAME,
                Key: s3Key,
            });
            await s3Client.send(headCommand);
            console.log(`[PRESIGNED-URL] Object exists in S3: ${s3Key}`);
        } catch (headError: any) {
            if (headError.name === 'NotFound' || headError.$metadata?.httpStatusCode === 404) {
                console.error(`[PRESIGNED-URL] Object not found in S3: ${s3Key}`);
                return null;
            }
            console.warn(`[PRESIGNED-URL] Error checking object existence for ${s3Key}:`, headError?.message);
        }

        const signedUrl = await getSignedUrl(
            s3Client,
            new GetObjectCommand({
                Bucket: BUCKET_NAME,
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