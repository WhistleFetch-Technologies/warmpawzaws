// Fix CloudFront Access Denied issue for vendor-web
// This script ensures the S3 bucket policy allows CloudFront OAC to access files

const { S3Client, PutBucketPolicyCommand, GetBucketPolicyCommand } = require('@aws-sdk/client-s3');
const { CloudFrontClient, GetDistributionCommand } = require('@aws-sdk/client-cloudfront');
const { STSClient, GetCallerIdentityCommand } = require('@aws-sdk/client-sts');

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

const stsClient = new STSClient({
  region: REGION,
  credentials: {
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY,
  },
});

async function fixAccess() {
  console.log('🔧 Fixing CloudFront Access Denied for vendor-web...');
  console.log(`   Bucket: ${S3_BUCKET}`);
  console.log(`   Distribution: ${CLOUDFRONT_DIST_ID}`);
  console.log(`   Region: ${REGION}\n`);

  try {
    // Step 1: Get AWS Account ID
    console.log('📋 Step 1: Getting AWS Account ID...');
    const identity = await stsClient.send(new GetCallerIdentityCommand({}));
    const accountId = identity.Account;
    console.log(`   ✅ Account ID: ${accountId}\n`);

    // Step 2: Get CloudFront Distribution to find OAC ID
    console.log('📋 Step 2: Getting CloudFront Distribution configuration...');
    const distResponse = await cloudFrontClient.send(
      new GetDistributionCommand({ Id: CLOUDFRONT_DIST_ID })
    );
    
    const distribution = distResponse.Distribution;
    const origin = distribution.DistributionConfig.Origins.Items[0];
    const oacId = origin.OriginAccessControlId;
    
    if (!oacId) {
      console.error('❌ Error: CloudFront distribution does not have Origin Access Control configured');
      console.error('   The distribution needs to use OAC (Origin Access Control) instead of OAI');
      process.exit(1);
    }
    
    console.log(`   ✅ OAC ID: ${oacId}`);
    console.log(`   ✅ Distribution ARN: ${distribution.ARN}\n`);

    // Step 3: Create/Update S3 bucket policy
    console.log('📋 Step 3: Updating S3 bucket policy to allow CloudFront access...');
    
    const bucketPolicy = {
      Version: '2012-10-17',
      Statement: [
        {
          Sid: 'AllowCloudFrontOAC',
          Effect: 'Allow',
          Principal: {
            Service: 'cloudfront.amazonaws.com',
          },
          Action: 's3:GetObject',
          Resource: `arn:aws:s3:::${S3_BUCKET}/*`,
          Condition: {
            StringEquals: {
              'AWS:SourceArn': distribution.ARN,
            },
          },
        },
      ],
    };

    const putPolicyCommand = new PutBucketPolicyCommand({
      Bucket: S3_BUCKET,
      Policy: JSON.stringify(bucketPolicy),
    });

    await s3Client.send(putPolicyCommand);
    console.log('   ✅ Bucket policy updated successfully\n');

    // Step 4: Verify the policy
    console.log('📋 Step 4: Verifying bucket policy...');
    try {
      const getPolicyCommand = new GetBucketPolicyCommand({ Bucket: S3_BUCKET });
      const policyResponse = await s3Client.send(getPolicyCommand);
      const policy = JSON.parse(policyResponse.Policy);
      console.log('   ✅ Bucket policy verified');
      console.log(`   Policy Statement: ${policy.Statement[0].Sid}`);
      console.log(`   Allows: ${policy.Statement[0].Action}`);
      console.log(`   Resource: ${policy.Statement[0].Resource}\n`);
    } catch (error) {
      console.warn('   ⚠️  Could not verify policy:', error.message);
    }

    // Summary
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║   ✅ ACCESS FIX COMPLETED                                     ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log('📦 Summary:');
    console.log('   ✅ S3 bucket policy updated to allow CloudFront access');
    console.log('   ✅ CloudFront OAC verified');
    console.log('');
    console.log('🌐 Next Steps:');
    console.log('   1. Wait 1-2 minutes for changes to propagate');
    console.log('   2. Clear browser cache or use incognito mode');
    console.log('   3. Try accessing: https://d1s6ykkj381k58.cloudfront.net');
    console.log('   4. If still having issues, invalidate CloudFront cache again');
    console.log('');

  } catch (error) {
    console.error('❌ Error fixing access:', error.message);
    if (error.name === 'NoSuchBucket') {
      console.error('   The S3 bucket does not exist or you don\'t have access to it');
    } else if (error.name === 'NoSuchDistribution') {
      console.error('   The CloudFront distribution does not exist or you don\'t have access to it');
    } else {
      console.error('   Full error:', error);
    }
    process.exit(1);
  }
}

fixAccess();
