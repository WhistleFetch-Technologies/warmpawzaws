/**
 * CloudWatch metrics and structured compression logs for image processing.
 */

import { CloudWatchClient, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch';
import type { AssetType } from './image-types';

const NAMESPACE = process.env.IMAGE_METRICS_NAMESPACE || 'Warmpawz/ImageProcessing';

let cwClient: CloudWatchClient | null = null;

function getClient(): CloudWatchClient {
  if (!cwClient) {
    cwClient = new CloudWatchClient({ region: process.env.AWS_REGION || 'ap-south-1' });
  }
  return cwClient;
}

async function putMetric(
  name: string,
  value: number,
  unit: 'Count' | 'Bytes' | 'Milliseconds' | 'Percent',
  dimensions?: Record<string, string>,
): Promise<void> {
  if (process.env.IMAGE_METRICS_DISABLED === 'true') return;
  try {
    await getClient().send(
      new PutMetricDataCommand({
        Namespace: NAMESPACE,
        MetricData: [
          {
            MetricName: name,
            Value: value,
            Unit: unit,
            Dimensions: dimensions
              ? Object.entries(dimensions).map(([Name, Value]) => ({ Name, Value }))
              : undefined,
          },
        ],
      }),
    );
  } catch (err: unknown) {
    console.warn('[image-metrics] PutMetricData failed:', (err as Error)?.message || err);
  }
}

export async function recordImageUploadSuccess(
  assetType: AssetType,
  opts: {
    originalBytes: number;
    finalBytes: number;
    processingMs: number;
    dedupHit?: boolean;
  },
): Promise<void> {
  const ratio =
    opts.originalBytes > 0
      ? Math.round((1 - opts.finalBytes / opts.originalBytes) * 1000) / 10
      : 0;

  console.log(
    JSON.stringify({
      event: 'image.upload.success',
      assetType,
      originalBytes: opts.originalBytes,
      finalBytes: opts.finalBytes,
      compressionRatioPercent: ratio,
      processingMs: opts.processingMs,
      dedupHit: Boolean(opts.dedupHit),
    }),
  );

  const dims = { AssetType: assetType };
  await Promise.all([
    putMetric('image.upload.success', 1, 'Count', dims),
    putMetric('image.webp.size', opts.finalBytes, 'Bytes', dims),
    putMetric('image.compression.ratio', ratio, 'Percent', dims),
    putMetric('image.processing.ms', opts.processingMs, 'Milliseconds', dims),
  ]);
}

export async function recordImageUploadFailed(
  assetType: AssetType,
  reason: string,
): Promise<void> {
  console.log(
    JSON.stringify({
      event: 'image.upload.failed',
      assetType,
      reason,
    }),
  );
  await putMetric('image.upload.failed', 1, 'Count', {
    AssetType: assetType,
    Reason: reason.slice(0, 64),
  });
}
