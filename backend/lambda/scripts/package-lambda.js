/**
 * Package Lambda deployment zips.
 *
 * esbuild marks firebase-admin as external (runtime require). The zip must
 * include node_modules/firebase-admin alongside dist/handler.js.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function readGitSha() {
  try {
    return execSync('git rev-parse HEAD', {
      cwd: path.join(__dirname, '..', '..', '..'),
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch {
    return 'unknown';
  }
}

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
const sharpVersion = require(path.join(lambdaRoot, 'package.json')).dependencies.sharp;

const runtimePkg = {
  name: 'warmpawz-lambda-runtime-deps',
  private: true,
  dependencies: {
    'firebase-admin': firebaseVersion,
    sharp: sharpVersion,
  },
};

fs.writeFileSync(path.join(distDir, 'package.json'), JSON.stringify(runtimePkg, null, 2));

console.log('Installing firebase-admin into dist/ for Lambda runtime...');
execSync(`npm install firebase-admin@${firebaseVersion} --omit=dev --no-audit --no-fund`, {
  cwd: distDir,
  stdio: 'inherit',
});

// AWS Lambda Node 20 (Amazon Linux 2023) uses glibc → linux-x64, NOT linuxmusl-x64.
console.log(`Installing sharp@${sharpVersion} for linux x64 glibc (Lambda runtime)...`);
execSync(
  `npm install sharp@${sharpVersion} --no-save --force --os=linux --cpu=x64 --libc=glibc --include=optional`,
  { cwd: distDir, stdio: 'inherit' },
);

const sharpLinuxNode = path.join(
  distDir,
  'node_modules',
  '@img',
  'sharp-linux-x64',
  'lib',
  'sharp-linux-x64.node',
);
if (!fs.existsSync(sharpLinuxNode)) {
  console.error('FATAL: @img/sharp-linux-x64 native binary missing — Lambda needs glibc linux-x64.');
  console.error(`Expected: ${sharpLinuxNode}`);
  process.exit(1);
}
console.log(`Sharp linux-x64 binary OK (${fs.statSync(sharpLinuxNode).size} bytes)`);

if (!fs.existsSync(path.join(distDir, 'node_modules', 'firebase-admin'))) {
  console.error('firebase-admin was not installed into dist/node_modules');
  process.exit(1);
}

if (!fs.existsSync(path.join(distDir, 'node_modules', 'sharp'))) {
  console.error('sharp was not installed into dist/node_modules');
  process.exit(1);
}

const imgDir = path.join(distDir, 'node_modules', '@img');
const hasLinuxX64 = fs.existsSync(path.join(imgDir, 'sharp-linux-x64'));
if (!hasLinuxX64) {
  console.error(
    'FATAL: @img/sharp-linux-x64 missing in dist/node_modules — Lambda image uploads will fail.',
  );
  process.exit(1);
}
console.log('Sharp native bindings: linux-x64=true');

const assetsSrc = path.join(lambdaRoot, 'assets');
const assetsDest = path.join(distDir, 'assets');
if (fs.existsSync(assetsSrc)) {
  fs.cpSync(assetsSrc, assetsDest, { recursive: true });
}

const buildManifest = {
  artifact: 'api-handler',
  builtAt: new Date().toISOString(),
  gitSha: readGitSha(),
  handlerBytes: fs.statSync(handlerPath).size,
  nodeVersion: process.version,
};
fs.writeFileSync(
  path.join(distDir, '.lambda-build-manifest.json'),
  JSON.stringify(buildManifest, null, 2)
);
console.log('Build manifest:', JSON.stringify(buildManifest));

/**
 * Zip packaging: prefer `tar -a` (Windows bsdtar / libarchive) over PowerShell
 * Compress-Archive, which fails on long nested paths (e.g. @grpc under firebase-admin).
 * Falls back to `zip`, then Compress-Archive. Artifact layout unchanged for Lambda.
 */
function commandExists(cmd) {
  try {
    execSync(process.platform === 'win32' ? `where ${cmd}` : `command -v ${cmd}`, {
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true,
    });
    return true;
  } catch {
    return false;
  }
}

function zipWithTar(cwd, destinationPath, entries) {
  const dest = path.resolve(destinationPath);
  if (fs.existsSync(dest)) fs.unlinkSync(dest);
  const entryArgs = entries.map((e) => `"${e}"`).join(' ');
  execSync(`tar -a -cf "${dest}" ${entryArgs}`, {
    cwd,
    stdio: 'inherit',
    shell: true,
  });
}

function zipWithZipCli(cwd, destinationPath, entries) {
  const dest = path.resolve(destinationPath);
  if (fs.existsSync(dest)) fs.unlinkSync(dest);
  const entryArgs = entries.map((e) => `"${e}"`).join(' ');
  execSync(`zip -r "${dest}" ${entryArgs}`, {
    cwd,
    stdio: 'inherit',
    shell: true,
  });
}

function zipWithPowerShell(sourcePath, destinationPath) {
  const dest = path.resolve(destinationPath);
  if (fs.existsSync(dest)) fs.unlinkSync(dest);
  const src = String(sourcePath).replace(/'/g, "''");
  const dst = dest.replace(/'/g, "''");
  execSync(
    `powershell -NoProfile -Command "Compress-Archive -LiteralPath '${src}' -DestinationPath '${dst}' -Force"`,
    { stdio: 'inherit' }
  );
}

function createZipFromDir(sourceDir, destinationPath) {
  const entries = fs.readdirSync(sourceDir);
  if (entries.length === 0) {
    throw new Error(`Nothing to zip in ${sourceDir}`);
  }
  if (commandExists('tar')) {
    console.log('  using tar -a (avoids Windows Compress-Archive path limits)');
    zipWithTar(sourceDir, destinationPath, entries);
    return;
  }
  if (commandExists('zip')) {
    console.log('  using zip CLI');
    zipWithZipCli(sourceDir, destinationPath, entries);
    return;
  }
  console.log('  using PowerShell Compress-Archive (fallback)');
  // -Path (not -LiteralPath) so wildcards expand; may fail on long paths.
  const dest = path.resolve(destinationPath).replace(/'/g, "''");
  const src = path.join(sourceDir, '*').replace(/'/g, "''");
  if (fs.existsSync(path.resolve(destinationPath))) {
    fs.unlinkSync(path.resolve(destinationPath));
  }
  execSync(
    `powershell -NoProfile -Command "Compress-Archive -Path '${src}' -DestinationPath '${dest}' -Force"`,
    { stdio: 'inherit' }
  );
}

function createZipFromFile(filePath, destinationPath) {
  const dir = path.dirname(filePath);
  const base = path.basename(filePath);
  if (commandExists('tar')) {
    zipWithTar(dir, destinationPath, [base]);
    return;
  }
  if (commandExists('zip')) {
    zipWithZipCli(dir, destinationPath, [base]);
    return;
  }
  zipWithPowerShell(filePath, destinationPath);
}

console.log('Creating api-handler.zip...');
createZipFromDir(distDir, apiZipPath);

if (fs.existsSync(loyaltyHandlerPath)) {
  console.log('Creating loyalty-consumer.zip...');
  createZipFromFile(loyaltyHandlerPath, loyaltyZipPath);
}

console.log('Lambda packaging complete.');
