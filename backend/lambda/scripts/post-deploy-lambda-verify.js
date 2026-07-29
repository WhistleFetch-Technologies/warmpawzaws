#!/usr/bin/env node
/**
 * Post-deploy verification: HTTP smoke + optional deployed bundle Commerce Switch check.
 *
 * Usage:
 *   node scripts/post-deploy-lambda-verify.js [apiBaseUrl] [lambdaFunctionName]
 *   API_BASE_URL=... LAMBDA_FUNCTION_NAME=warmpawz-dev-api-handler npm run post-deploy:lambda-verify
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const base = (
  process.argv[2] ||
  process.env.API_BASE_URL ||
  'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com'
).replace(/\/+$/, '');

const lambdaFunctionName =
  process.argv[3] || process.env.LAMBDA_FUNCTION_NAME || 'warmpawz-dev-api-handler';
const region = process.env.AWS_REGION || 'ap-south-1';

const HANDLER_ONLY_MAX_BYTES = Number(process.env.LAMBDA_HANDLER_ONLY_MAX_BYTES || 6 * 1024 * 1024);
const MIN_ZIP_BYTES = Number(process.env.LAMBDA_ZIP_MIN_BYTES || 20 * 1024 * 1024);

let failures = 0;

function fail(msg) {
  console.error('FAIL', msg);
  failures += 1;
}

function pass(msg, detail) {
  console.log('PASS', msg, detail ?? '');
}

async function fetchStatus(pathname) {
  const url = `${base}${pathname}`;
  const res = await fetch(url);
  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { url, status: res.status, body };
}

async function verifyHttpEndpoints() {
  const health = await fetchStatus('/health');
  if (health.status !== 200) {
    fail(`GET /health HTTP ${health.status}`);
  } else {
    pass('GET /health', { status: health.status });
  }

  const config = await fetchStatus('/config/commerce-switch');
  if (config.status === 404) {
    fail('GET /config/commerce-switch HTTP 404 — Commerce Switch routes missing from deployed Lambda');
  } else if (config.status !== 200) {
    fail(`GET /config/commerce-switch HTTP ${config.status}`);
  } else if (config.body?.success !== true) {
    fail('GET /config/commerce-switch: success !== true');
  } else {
    pass('GET /config/commerce-switch', {
      activeModelId: config.body.activeModelId,
      version: config.body.version,
    });
  }

  const healthCs = await fetchStatus('/config/commerce-switch/health');
  if (healthCs.status === 404) {
    fail('GET /config/commerce-switch/health HTTP 404');
  } else if (healthCs.status !== 200) {
    fail(`GET /config/commerce-switch/health HTTP ${healthCs.status}`);
  } else {
    pass('GET /config/commerce-switch/health', { status: healthCs.status });
  }

  for (const adminPath of ['/admin/commerce-switch/models', '/admin/commerce-switch/configuration']) {
    const admin = await fetchStatus(adminPath);
    if (admin.status === 404) {
      fail(`GET ${adminPath} HTTP 404 — route not registered (deployment regression)`);
    } else if (admin.status === 401 || admin.status === 403) {
      pass(`GET ${adminPath}`, { status: admin.status, note: 'route exists (auth required)' });
    } else if (admin.status === 200) {
      pass(`GET ${adminPath}`, { status: admin.status });
    } else if (admin.status >= 500) {
      fail(`GET ${adminPath} HTTP ${admin.status}`);
    } else {
      pass(`GET ${adminPath}`, { status: admin.status });
    }
  }
}

async function verifyDeployedLambdaBundle() {
  console.log('\nVerifying deployed Lambda bundle —', lambdaFunctionName);

  let config;
  try {
    const raw = execSync(
      `aws lambda get-function-configuration --function-name ${lambdaFunctionName} --region ${region} --output json`,
      { encoding: 'utf8' }
    );
    config = JSON.parse(raw);
  } catch (err) {
    fail(`could not read Lambda configuration: ${err.message}`);
    return;
  }

  const codeSize = config.CodeSize || 0;
  const codeSizeMb = (codeSize / (1024 * 1024)).toFixed(2);
  pass('Deployed Lambda CodeSize', { bytes: codeSize, mb: codeSizeMb });

  if (codeSize <= HANDLER_ONLY_MAX_BYTES) {
    fail(
      `deployed CodeSize ${codeSizeMb} MB indicates handler-only package — Commerce Switch likely missing`
    );
  } else if (codeSize < MIN_ZIP_BYTES) {
    fail(`deployed CodeSize ${codeSizeMb} MB below minimum full-package threshold`);
  }

  let downloadUrl;
  try {
    const raw = execSync(
      `aws lambda get-function --function-name ${lambdaFunctionName} --region ${region} --query Code.Location --output text`,
      { encoding: 'utf8' }
    );
    downloadUrl = raw.trim();
  } catch (err) {
    fail(`could not get Lambda code download URL: ${err.message}`);
    return;
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'warmpawz-post-deploy-'));
  const zipFile = path.join(tempDir, 'deployed.zip');
  try {
    if (typeof fetch === 'function') {
      const res = await fetch(downloadUrl);
      if (!res.ok) {
        throw new Error(`download HTTP ${res.status}`);
      }
      const buf = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync(zipFile, buf);
    } else {
      execSync(`curl -sS -o "${zipFile}" "${downloadUrl}"`, { stdio: 'pipe' });
    }
    const handlerSource = extractHandlerFromZip(zipFile, tempDir);
    if (!handlerSource.includes('registerCommerceSwitchEndpoints')) {
      fail('deployed handler.js missing registerCommerceSwitchEndpoints');
    } else {
      pass('deployed handler.js contains registerCommerceSwitchEndpoints');
    }
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
    const sl = callPattern('registerServiceLaunchConfigEndpoints');
    const cs = callPattern('registerCommerceSwitchEndpoints');
    const cp = callPattern('registerCarePlansEndpoints');
    if (sl === -1 || cs === -1 || cp === -1 || !(sl < cs && cs < cp)) {
      fail('deployed handler registration order missing Commerce Switch between ServiceLaunch and CarePlans');
    } else {
      pass('deployed handler registration order OK');
    }
  } catch (err) {
    fail(`deployed bundle inspection failed: ${err.message}`);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function extractHandlerFromZip(zipFile, tempDir) {
  const extractDir = path.join(tempDir, 'extract');
  fs.mkdirSync(extractDir, { recursive: true });
  if (process.platform === 'win32') {
    const escapedZip = zipFile.replace(/'/g, "''");
    const escapedDir = extractDir.replace(/'/g, "''");
    execSync(
      `powershell -NoProfile -Command "Expand-Archive -LiteralPath '${escapedZip}' -DestinationPath '${escapedDir}' -Force"`,
      { stdio: 'pipe' }
    );
  } else {
    execSync(`unzip -o -q "${zipFile}" handler.js -d "${extractDir}"`, { stdio: 'pipe' });
  }
  const handlerPath = path.join(extractDir, 'handler.js');
  if (!fs.existsSync(handlerPath)) {
    throw new Error('handler.js not found in deployed zip');
  }
  return fs.readFileSync(handlerPath, 'utf8');
}

async function main() {
  console.log('Post-deploy Lambda verification —', base);
  await verifyHttpEndpoints();
  await verifyDeployedLambdaBundle();

  if (failures > 0) {
    console.error(`\nPost-deploy verification FAILED (${failures} check(s))`);
    process.exit(1);
  }
  console.log('\nPost-deploy verification OK');
}

main().catch((err) => {
  console.error('FAIL', err.message);
  process.exit(1);
});
