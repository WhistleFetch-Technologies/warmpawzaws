// Check what files are in the S3 bucket root
const { S3Client, ListObjectsV2Command, GetObjectCommand } = require('@aws-sdk/client-s3');

const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID || 'AKIAQ2X6RFZI3MGZH35D';
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY || '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';
const REGION = process.env.AWS_REGION || 'ap-south-1';
const S3_BUCKET = 'warmpawz-dev-vendor-frontend-ap-south-1';

const s3Client = new S3Client({
  region: REGION,
  credentials: {
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY,
  },
});

async function checkFiles() {
  console.log('🔍 Checking S3 bucket files...\n');

  try {
    // List all files
    let allFiles = [];
    let continuationToken = undefined;
    
    do {
      const response = await s3Client.send(
        new ListObjectsV2Command({
          Bucket: S3_BUCKET,
          ContinuationToken: continuationToken,
        })
      );
      
      if (response.Contents) {
        allFiles = allFiles.concat(response.Contents);
      }
      
      continuationToken = response.NextContinuationToken;
    } while (continuationToken);

    console.log(`📦 Total files in bucket: ${allFiles.length}\n`);

    // Check for critical files
    const criticalFiles = ['index.html', 'runtime-config.js', '_next/static'];
    console.log('🔍 Checking for critical files:');
    
    const rootFiles = allFiles.filter(f => !f.Key.includes('/') || f.Key.split('/').length === 1);
    console.log(`\n📁 Root level files (${rootFiles.length}):`);
    rootFiles.slice(0, 20).forEach(f => {
      console.log(`   - ${f.Key} (${f.Size} bytes)`);
    });

    const hasIndexHtml = allFiles.some(f => f.Key === 'index.html');
    const hasRuntimeConfig = allFiles.some(f => f.Key === 'runtime-config.js');
    const hasNextStatic = allFiles.some(f => f.Key.startsWith('_next/static/'));

    console.log('\n✅ Critical files check:');
    console.log(`   - index.html: ${hasIndexHtml ? '✅ Found' : '❌ MISSING'}`);
    console.log(`   - runtime-config.js: ${hasRuntimeConfig ? '✅ Found' : '❌ MISSING'}`);
    console.log(`   - _next/static/: ${hasNextStatic ? '✅ Found' : '❌ MISSING'}`);

    if (!hasIndexHtml) {
      console.log('\n❌ PROBLEM: index.html is missing! This is why you get Access Denied.');
      console.log('   The CloudFront distribution needs index.html as the default root object.');
    }

    // Check _next directory
    const nextFiles = allFiles.filter(f => f.Key.startsWith('_next/'));
    console.log(`\n📁 _next/ directory files: ${nextFiles.length}`);
    if (nextFiles.length > 0) {
      console.log('   Sample files:');
      nextFiles.slice(0, 5).forEach(f => {
        console.log(`   - ${f.Key}`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkFiles();
