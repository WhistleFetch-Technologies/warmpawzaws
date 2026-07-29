#!/usr/bin/env node
/**
 * Pre-upload guard for api-handler.zip.
 * Rejects handler-only packages (~2–5 MB) and bundles missing Commerce Switch registration.
 *
 * Usage:
 *   node scripts/validate-lambda-deploy-artifact.js [path/to/api-handler.zip]
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');

const lambdaRoot = path.join(__dirname, '..');
const zipPath = path.resolve(process.argv[2] || path.join(lambdaRoot, 'api-handler.zip'));
const distHandlerPath = path.join(lambdaRoot, 'dist', 'handler.js');

const MIN_ZIP_BYTES = Number(process.env.LAMBDA_ZIP_MIN_BYTES || 20 * 1024 * 1024);
const MAX_ZIP_BYTES = Number(process.env.LAMBDA_ZIP_MAX_BYTES || 45 * 1024 * 1024);
const HANDLER_ONLY_MAX_BYTES = Number(process.env.LAMBDA_HANDLER_ONLY_MAX_BYTES || 6 * 1024 * 1024);

let failures = 0;

function fail(msg) {
  console.error('FAIL', msg);
  failures += 1;
}

function pass(msg, detail) {
  console.log('PASS', msg, detail ?? '');
}

function readHandlerSource() {
  if (fs.existsSync(distHandlerPath)) {
    return fs.readFileSync(distHandlerPath, 'utf8');
  }
  return extractHandlerFromZip(zipPath);
}

function extractHandlerFromZip(targetZip) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'warmpawz-lambda-artifact-'));
  try {
    if (process.platform === 'win32') {
      const escapedZip = targetZip.replace(/'/g, "''");
      const escapedDir = tempDir.replace(/'/g, "''");
      execSync(
        `powershell -NoProfile -Command "Expand-Archive -LiteralPath '${escapedZip}' -DestinationPath '${escapedDir}' -Force"`,
        { stdio: 'pipe' }
      );
    } else {
      execSync(`unzip -o -q "${targetZip}" handler.js -d "${tempDir}"`, { stdio: 'pipe' });
    }
    const handlerFile = path.join(tempDir, 'handler.js');
    if (!fs.existsSync(handlerFile)) {
      fail(`handler.js not found inside zip: ${targetZip}`);
      return '';
    }
    return fs.readFileSync(handlerFile, 'utf8');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function listZipEntries(targetZip) {
  if (process.platform === 'win32') {
    const escaped = targetZip.replace(/'/g, "''");
    const out = execSync(
      `powershell -NoProfile -Command "Add-Type -AssemblyName System.IO.Compression.FileSystem; [IO.Compression.ZipFile]::OpenRead('${escaped}').Entries | ForEach-Object { $_.FullName }"`,
      { encoding: 'utf8' }
    );
    return out.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  }
  const out = execSync(`unzip -Z1 "${targetZip}"`, { encoding: 'utf8' });
  return out.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
}

function validateArtifactFreshness(targetZip) {
  const manifestPath = path.join(lambdaRoot, 'dist', '.lambda-build-manifest.json');
  if (fs.existsSync(manifestPath)) {
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      const zipMtime = fs.statSync(targetZip).mtimeMs;
      const handlerMtime = fs.statSync(distHandlerPath).mtimeMs;
      if (zipMtime + 1000 < handlerMtime) {
        fail(
          'api-handler.zip is older than dist/handler.js — run npm run build to refresh the package before deploy'
        );
      } else {
        pass('artifact freshness OK (zip newer than handler.js)');
      }
      if (manifest.gitSha && manifest.gitSha !== 'unknown' && process.env.SKIP_GIT_SHA_CHECK !== '1') {
        try {
          const headSha = execSync('git rev-parse HEAD', {
            cwd: path.join(lambdaRoot, '..', '..'),
            encoding: 'utf8',
            stdio: ['pipe', 'pipe', 'pipe'],
          }).trim();
          if (headSha !== manifest.gitSha) {
            fail(
              `build manifest gitSha (${manifest.gitSha.slice(0, 8)}) does not match HEAD (${headSha.slice(0, 8)}) — rebuild before deploy`
            );
          } else {
            pass('build manifest gitSha matches HEAD');
          }
        } catch {
          pass('gitSha check skipped (git unavailable)');
        }
      }
    } catch (err) {
      fail(`could not read build manifest: ${err.message}`);
    }
  }
}

function validateCommerceSwitchRegistration(handlerSource) {
  if (!handlerSource.includes('registerCommerceSwitchEndpoints')) {
    fail('handler bundle missing registerCommerceSwitchEndpoints (Commerce Switch routes not registered)');
    return;
  }
  pass('Commerce Switch registrar present in handler bundle');

  const callPattern = (name) => {
    const re = new RegExp(`${name}\\s*\\(\\s*app`, 'g');
    let lastIdx = -1;
    let match;
    while ((match = re.exec(handlerSource)) !== null) {
      const prefix = handlerSource.slice(Math.max(0, match.index - 9), match.index);
      if (prefix.endsWith('function ')) continue;
      lastIdx = match.index;
    }
    return lastIdx;
  };

  const serviceLaunchIdx = callPattern('registerServiceLaunchConfigEndpoints');
  const commerceSwitchIdx = callPattern('registerCommerceSwitchEndpoints');
  const carePlansIdx = callPattern('registerCarePlansEndpoints');

  if (serviceLaunchIdx === -1 || commerceSwitchIdx === -1 || carePlansIdx === -1) {
    fail('handler bundle missing expected route registration calls (ServiceLaunch / CommerceSwitch / CarePlans)');
    return;
  }
  if (!(serviceLaunchIdx < commerceSwitchIdx && commerceSwitchIdx < carePlansIdx)) {
    fail(
      'handler route registration order invalid — expected ServiceLaunchConfig → CommerceSwitch → CarePlans call sites'
    );
    return;
  }
  pass('Commerce Switch registration order OK');
}

function main() {
  console.log('Lambda deploy artifact validation —', zipPath);

  if (!fs.existsSync(zipPath)) {
    fail(`api-handler.zip not found: ${zipPath}`);
    console.error('\nRun: cd backend/lambda && npm run build');
    process.exit(1);
  }

  const zipSize = fs.statSync(zipPath).size;
  const zipSizeMb = (zipSize / (1024 * 1024)).toFixed(2);
  console.log(`Zip size: ${zipSizeMb} MB (${zipSize} bytes)`);

  if (zipSize <= HANDLER_ONLY_MAX_BYTES) {
    fail(
      `zip size ${zipSizeMb} MB looks like handler-only package (max allowed for full deploy: ${(
        HANDLER_ONLY_MAX_BYTES /
        (1024 * 1024)
      ).toFixed(0)} MB). Use npm run build (package-lambda.js), not handler.js-only zip.`
    );
  } else if (zipSize < MIN_ZIP_BYTES) {
    fail(
      `zip size ${zipSizeMb} MB is below minimum ${(MIN_ZIP_BYTES / (1024 * 1024)).toFixed(
        0
      )} MB — incomplete Lambda package`
    );
  } else if (zipSize > MAX_ZIP_BYTES) {
    fail(`zip size ${zipSizeMb} MB exceeds maximum ${(MAX_ZIP_BYTES / (1024 * 1024)).toFixed(0)} MB`);
  } else {
    pass('api-handler.zip size in expected range (full package)');
  }

  let entries = [];
  try {
    entries = listZipEntries(zipPath);
  } catch (err) {
    fail(`could not list zip entries: ${err.message}`);
  }

  if (entries.length > 0) {
    const hasHandler = entries.some((e) => e === 'handler.js' || e.endsWith('/handler.js'));
    const hasRuntimeDeps = entries.some(
      (e) =>
        e.includes('node_modules/firebase-admin') ||
        e.includes('node_modules\\firebase-admin') ||
        e.includes('node_modules/sharp')
    );
    const hasManifest =
      entries.some((e) => e.endsWith('.lambda-build-manifest.json')) ||
      entries.some((e) => e.includes('.lambda-build-manifest.json'));
    if (!hasHandler) {
      fail('api-handler.zip missing handler.js');
    } else {
      pass('handler.js present in zip');
    }
    if (!hasRuntimeDeps) {
      fail(
        'api-handler.zip missing runtime node_modules (firebase-admin/sharp) — run npm run package via npm run build'
      );
    } else {
      pass('runtime dependencies present in zip');
    }
    if (!hasManifest) {
      fail('api-handler.zip missing .lambda-build-manifest.json — run npm run build (package-lambda.js)');
    } else {
      pass('build manifest present in zip');
    }
    if (entries.length < 10) {
      fail(`api-handler.zip has only ${entries.length} entries — expected full dist/ tree`);
    }
  }

  validateArtifactFreshness(zipPath);

  const handlerSource = readHandlerSource();
  if (handlerSource) {
    validateCommerceSwitchRegistration(handlerSource);
  }

  if (failures > 0) {
    console.error(`\nArtifact validation FAILED (${failures} check(s))`);
    console.error('Use: ./scripts/deploy-lambda-direct.sh  (or npm run build && validate:lambda-artifact)');
    process.exit(1);
  }

  console.log('\nArtifact validation OK — safe to upload api-handler.zip');
}

main();
