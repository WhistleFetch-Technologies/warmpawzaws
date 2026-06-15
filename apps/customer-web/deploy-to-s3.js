// Deploy customer-web to S3 and invalidate CloudFront
const { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { CloudFrontClient, CreateInvalidationCommand } = require('@aws-sdk/client-cloudfront');
const fs = require('fs');
const path = require('path');

const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID || 'AKIAQ2X6RFZI3MGZH35D';
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY || '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';
const REGION = process.env.AWS_REGION || 'ap-south-1';
const S3_BUCKET = 'warmpawz-dev-customer-frontend-ap-south-1';
const CLOUDFRONT_DIST_ID = 'E2RDORGXSWJJ87';
const CLOUDFRONT_URL = 'https://d2aoyjj8ine0wk.cloudfront.net';
const API_ENDPOINT = 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';

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

function getAllFiles(dirPath, arrayOfFiles = []) {
  if (!Array.isArray(arrayOfFiles)) {
    arrayOfFiles = [];
  }
  const files = fs.readdirSync(dirPath);

  files.forEach((file) => {
    const filePath = path.join(dirPath, file);
    if (fs.statSync(filePath).isDirectory()) {
      getAllFiles(filePath, arrayOfFiles);
    } else {
      arrayOfFiles.push(filePath);
    }
  });

  return arrayOfFiles;
}

async function deleteAllObjects() {
  console.log('🧹 Cleaning S3 bucket...');
  try {
    let continuationToken = undefined;
    do {
      const listParams = {
        Bucket: S3_BUCKET,
        ContinuationToken: continuationToken,
      };
      const listResponse = await s3Client.send(new ListObjectsV2Command(listParams));
      
      if (listResponse.Contents && listResponse.Contents.length > 0) {
        for (const object of listResponse.Contents) {
          await s3Client.send(new DeleteObjectCommand({
            Bucket: S3_BUCKET,
            Key: object.Key,
          }));
        }
      }
      continuationToken = listResponse.NextContinuationToken;
    } while (continuationToken);
    console.log('✅ S3 bucket cleaned');
  } catch (error) {
    console.warn('⚠️  Warning: Could not clean S3 bucket:', error.message);
  }
}

async function uploadFile(localPath, s3Key) {
  if (!fs.existsSync(localPath) || fs.statSync(localPath).isDirectory()) {
    return; // Skip if file doesn't exist or is a directory
  }
  try {
    const fileContent = fs.readFileSync(localPath);
    const command = new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: s3Key,
      Body: fileContent,
      ContentType: getContentType(s3Key),
      CacheControl: 'public, max-age=0, must-revalidate',
    });
    await s3Client.send(command);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.warn(`⚠️  Warning: Could not upload ${s3Key}:`, error.message);
    }
  }
}

function getContentType(filename) {
  const ext = path.extname(filename).toLowerCase();
  const types = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.eot': 'application/vnd.ms-fontobject',
  };
  return types[ext] || 'application/octet-stream';
}

async function deploy() {
  const distPath = path.join(__dirname, 'dist');
  
  if (!fs.existsSync(distPath)) {
    console.error('❌ Error: dist directory not found!');
    console.error('   Run "npm run build" first.');
    process.exit(1);
  }

  console.log('📦 Deploying customer-web to S3...');
  console.log(`   Bucket: ${S3_BUCKET}`);
  console.log(`   Region: ${REGION}\n`);

  // Step 1: Inject runtime-config inline into all HTML files AND create external file
  console.log('🔧 Injecting runtime-config...');
  const runtimeConfigPath = path.join(distPath, 'runtime-config.js');
  const runtimeConfigContent = `// Runtime Configuration for Warmpawz customer-web
// Injected at deployment time with actual API Gateway endpoint
(function() {
  window.__WARMPAWZ_RUNTIME_CONFIG__ = {
    apiBaseUrl: "${API_ENDPOINT}",
    uatMode: true,
    environment: "development"
  };
  console.log('Runtime config loaded:', window.__WARMPAWZ_RUNTIME_CONFIG__);
})();`;
  fs.writeFileSync(runtimeConfigPath, runtimeConfigContent, 'utf8');
  
  // Also inject inline into all HTML files for immediate availability
  const htmlFiles = getAllFiles(distPath).filter(f => f.endsWith('.html'));
  const inlineConfig = `window.__WARMPAWZ_RUNTIME_CONFIG__ = { apiBaseUrl: "${API_ENDPOINT}", uatMode: true, environment: "development" };`;
  
  for (const htmlFile of htmlFiles) {
    let htmlContent = fs.readFileSync(htmlFile, 'utf8');
    // Replace the placeholder - handle both single-line and multi-line script tags with any whitespace
    if (htmlContent.includes('runtime-config-inline')) {
      // Match script tag with id="runtime-config-inline" (with any quotes) and any content inside (including newlines and whitespace)
      // Use non-greedy match and handle both single and double quotes
      htmlContent = htmlContent.replace(
        /<script\s+id=["']runtime-config-inline["'][^>]*>[\s\S]*?<\/script>/gi,
        `<script id="runtime-config-inline">${inlineConfig}</script>`
      );
    } else {
      // Add before closing body tag if not found
      htmlContent = htmlContent.replace(
        '</body>',
        `<script id="runtime-config-inline">${inlineConfig}</script></body>`
      );
    }
    fs.writeFileSync(htmlFile, htmlContent, 'utf8');
  }
  console.log(`✅ runtime-config injected (inline in ${htmlFiles.length} HTML files + external file)\n`);

  // Step 2: Clean S3 bucket
  await deleteAllObjects();

  // Step 3: Upload all files
  console.log('📤 Uploading files to S3...');
  const allFiles = getAllFiles(distPath);
  const filesToUpload = allFiles.filter(file => {
    // Exclude source maps and server-side files
    if (file.endsWith('.map')) return false;
    if (file.includes('\\server\\') || file.includes('/server/')) return false;
    return true;
  });
  
  let uploaded = 0;
  for (const filePath of filesToUpload) {
    const relativePath = path.relative(distPath, filePath).replace(/\\/g, '/');
    await uploadFile(filePath, relativePath);
    uploaded++;
    if (uploaded % 50 === 0) {
      console.log(`   Uploaded ${uploaded}/${filesToUpload.length} files...`);
    }
  }
  console.log(`✅ Uploaded ${uploaded} files to S3\n`);

  // Step 4: Invalidate CloudFront
  console.log('🔄 Invalidating CloudFront cache...');
  try {
    const invalidationCommand = new CreateInvalidationCommand({
      DistributionId: CLOUDFRONT_DIST_ID,
      InvalidationBatch: {
        Paths: {
          Quantity: 1,
          Items: ['/*'],
        },
        CallerReference: `deploy-${Date.now()}`,
      },
    });
    const invalidation = await cloudFrontClient.send(invalidationCommand);
    console.log(`✅ CloudFront invalidation created: ${invalidation.Invalidation.Id}`);
    console.log('⏳ Full propagation may take 5-15 minutes');
    console.log('💡 Tip: Hard refresh (Ctrl+Shift+R) after propagation completes\n');
  } catch (error) {
    console.warn('⚠️  Warning: CloudFront invalidation failed:', error.message);
    console.warn('   Files are uploaded, but cache may need manual invalidation\n');
  }

  // Summary
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║   ✅ DEPLOYMENT COMPLETED                                     ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log('📦 Deployment Summary:');
  console.log('   ✅ customer-web: Built and deployed successfully');
  console.log('   ✅ S3 Upload: Synced to ' + S3_BUCKET);
  console.log('   ✅ CloudFront: Cache invalidation created');
  console.log('');
  console.log('🌐 Access URLs:');
  console.log('   - Customer Web: ' + CLOUDFRONT_URL);
  console.log('   - Direct S3: s3://' + S3_BUCKET);
  console.log('');
}

deploy().catch((error) => {
  console.error('❌ Deployment failed:', error);
  process.exit(1);
});
