/**
 * Package Lambda deployment zips.
 *
 * esbuild marks firebase-admin as external (runtime require). The zip must
 * include node_modules/firebase-admin alongside dist/handler.js.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const lambdaRoot = path.join(__dirname, '..');
const distDir = path.join(lambdaRoot, 'dist');
const handlerPath = path.join(distDir, 'handler.js');
const apiZipPath = path.join(lambdaRoot, 'api-handler.zip');
const loyaltyZipPath = path.join(lambdaRoot, 'loyalty-consumer.zip');
const loyaltyHandlerPath = path.join(distDir, 'loyalty-consumer.js');

if (!fs.existsSync(handlerPath)) {
  console.error('dist/handler.js not found — run build:bundle first');
  process.exit(1);
}

const firebaseVersion =
  require(path.join(lambdaRoot, 'package.json')).dependencies['firebase-admin'];

const runtimePkg = {
  name: 'warmpawz-lambda-runtime-deps',
  private: true,
  dependencies: {
    'firebase-admin': firebaseVersion,
  },
};

fs.writeFileSync(path.join(distDir, 'package.json'), JSON.stringify(runtimePkg, null, 2));

console.log('Installing firebase-admin into dist/ for Lambda runtime...');
execSync('npm install --omit=dev --no-audit --no-fund', {
  cwd: distDir,
  stdio: 'inherit',
});

if (!fs.existsSync(path.join(distDir, 'node_modules', 'firebase-admin'))) {
  console.error('firebase-admin was not installed into dist/node_modules');
  process.exit(1);
}

const assetsSrc = path.join(lambdaRoot, 'assets');
const assetsDest = path.join(distDir, 'assets');
if (fs.existsSync(assetsSrc)) {
  fs.cpSync(assetsSrc, assetsDest, { recursive: true });
}

function zipWithPowerShell(sourcePattern, destinationPath, literalPath) {
  const useLiteral = Boolean(literalPath);
  const literalFlag = useLiteral ? '-LiteralPath' : '-Path';
  const source = useLiteral ? literalPath : sourcePattern;
  execSync(
    `powershell -Command "Compress-Archive ${literalFlag} '${String(source).replace(/'/g, "''")}' -DestinationPath '${destinationPath.replace(/'/g, "''")}' -Force"`,
    { stdio: 'inherit' }
  );
}

console.log('Creating api-handler.zip...');
zipWithPowerShell(`${distDir}\\*`, apiZipPath);

if (fs.existsSync(loyaltyHandlerPath)) {
  console.log('Creating loyalty-consumer.zip...');
  zipWithPowerShell(loyaltyHandlerPath, loyaltyZipPath, loyaltyHandlerPath);
}

console.log('Lambda packaging complete.');
