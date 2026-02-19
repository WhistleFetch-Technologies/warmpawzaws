// Diagnose Access Denied issue for vendor-web
const { S3Client, GetBucketPolicyCommand, GetBucketPublicAccessBlockCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const { CloudFrontClient, GetDistributionCommand } = require('@aws-sdk/client-cloudfront');

const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID || 'AKIAQ2X6RFZI3MGZH35D';
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY || '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';
const REGION = process.env.AWS_REGION || 'ap-south-1';
const S3_BUCKET = 'warmpawz-dev-vendor-frontend-ap-south-1';
const CLOUDFRONT_DIST_ID = 'E95171GX1I6HN';

const s3Client = new S3Client({
  region: REGION,
  credentials: {
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY,
  },
});

const cloudFrontClient = new CloudFrontClient({
  region: REGION,
  credentials: {
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY,
  },
});

async function diagnose() {
  console.log('🔍 Diagnosing Access Denied issue...\n');

  try {
    // 1. Check bucket policy
    console.log('📋 1. Checking S3 bucket policy...');
    try {
      const policyResponse = await s3Client.send(new GetBucketPolicyCommand({ Bucket: S3_BUCKET }));
      const policy = JSON.parse(policyResponse.Policy);
      console.log('   ✅ Bucket policy exists');
      console.log('   Policy:', JSON.stringify(policy, null, 2));
    } catch (error) {
      if (error.name === 'NoSuchBucketPolicy') {
        console.log('   ❌ No bucket policy found - this is the problem!');
      } else {
        console.log('   ⚠️  Error reading policy:', error.message);
      }
    }
    console.log('');

    // 2. Check public access block
    console.log('📋 2. Checking S3 bucket public access block...');
    try {
      const publicAccessResponse = await s3Client.send(
        new GetBucketPublicAccessBlockCommand({ Bucket: S3_BUCKET })
      );
      const block = publicAccessResponse.PublicAccessBlockConfiguration;
      console.log('   Public Access Block Configuration:');
      console.log('   - BlockPublicAcls:', block.BlockPublicAcls);
      console.log('   - BlockPublicPolicy:', block.BlockPublicPolicy);
      console.log('   - IgnorePublicAcls:', block.IgnorePublicAcls);
      console.log('   - RestrictPublicBuckets:', block.RestrictPublicBuckets);
    } catch (error) {
      console.log('   ⚠️  Error reading public access block:', error.message);
    }
    console.log('');

    // 3. Check if files exist in bucket
    console.log('📋 3. Checking if files exist in bucket...');
    try {
      const listResponse = await s3Client.send(
        new ListObjectsV2Command({ Bucket: S3_BUCKET, MaxKeys: 5 })
      );
      if (listResponse.Contents && listResponse.Contents.length > 0) {
        console.log(`   ✅ Found ${listResponse.Contents.length} files (showing first 5):`);
        listResponse.Contents.forEach((obj, idx) => {
          console.log(`   ${idx + 1}. ${obj.Key} (${obj.Size} bytes)`);
        });
      } else {
        console.log('   ⚠️  No files found in bucket');
      }
    } catch (error) {
      console.log('   ❌ Error listing objects:', error.message);
    }
    console.log('');

    // 4. Check CloudFront distribution
    console.log('📋 4. Checking CloudFront distribution...');
    try {
      const distResponse = await cloudFrontClient.send(
        new GetDistributionCommand({ Id: CLOUDFRONT_DIST_ID })
      );
      const dist = distResponse.Distribution;
      const origin = dist.DistributionConfig.Origins.Items[0];
      
      console.log('   ✅ Distribution found');
      console.log('   - Status:', dist.Status);
      console.log('   - Enabled:', dist.DistributionConfig.Enabled);
      console.log('   - Origin Domain:', origin.DomainName);
      console.log('   - Origin Access Control ID:', origin.OriginAccessControlId || 'NONE (This is a problem!)');
      console.log('   - Origin Access Identity:', origin.S3OriginConfig?.OriginAccessIdentity || 'NONE');
      
      if (!origin.OriginAccessControlId && !origin.S3OriginConfig?.OriginAccessIdentity) {
        console.log('   ❌ PROBLEM: No OAC or OAI configured!');
      }
    } catch (error) {
      console.log('   ❌ Error reading distribution:', error.message);
    }
    console.log('');

    // 5. Recommendations
    console.log('💡 Recommendations:');
    console.log('   1. Ensure bucket policy allows CloudFront service principal');
    console.log('   2. Ensure CloudFront distribution uses Origin Access Control (OAC)');
    console.log('   3. Ensure public access is blocked (for security)');
    console.log('   4. Verify files are actually uploaded to the bucket');
    console.log('');

  } catch (error) {
    console.error('❌ Diagnostic error:', error.message);
    console.error('   Full error:', error);
  }
}

diagnose();
