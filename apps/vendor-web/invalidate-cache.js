const { CloudFrontClient, CreateInvalidationCommand } = require('@aws-sdk/client-cloudfront');

const client = new CloudFrontClient({
  region: 'ap-south-1',
  credentials: {
    accessKeyId: 'AKIAQ2X6RFZI3MGZH35D',
    secretAccessKey: '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',
  },
});

async function invalidate() {
  try {
    const result = await client.send(new CreateInvalidationCommand({
      DistributionId: 'E95171GX1I6HN',
      InvalidationBatch: {
        Paths: { Quantity: 1, Items: ['/*'] },
        CallerReference: `fix-${Date.now()}`,
      },
    }));
    console.log('✅ Cache invalidated:', result.Invalidation.Id);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

invalidate();
