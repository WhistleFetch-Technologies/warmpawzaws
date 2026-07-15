import { execSync, spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const lambdaRoot = path.join(__dirname, '../../../..');
const manifestPath = path.join(lambdaRoot, 'scripts/_customer-route-manifest.json');
const smokeScript = path.join(lambdaRoot, 'scripts/customer-endpoint-full-smoke.js');
const BASE = process.env.SMOKE_BASE_URL || 'http://localhost:3000';

async function isApiReachable(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE.replace(/\/$/, '')}/health`);
    return res.ok;
  } catch {
    return false;
  }
}

describe('customer endpoints smoke (manifest)', () => {
  const runSmoke = process.env.RUN_CUSTOMER_SMOKE === '1';

  it('manifest exists with ~158 routes', () => {
    if (!fs.existsSync(manifestPath)) {
      execSync('node scripts/generate-customer-route-manifest.js', {
        cwd: lambdaRoot,
        encoding: 'utf8',
      });
    }
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    expect(manifest.totalRoutes).toBeGreaterThanOrEqual(150);
    expect(manifest.routes.length).toBe(manifest.totalRoutes);
  });

  (runSmoke ? it : it.skip)('all manifest routes return 200 with non-null JSON', async () => {
    const reachable = await isApiReachable();
    if (!reachable) {
      throw new Error(
        `Local API not reachable at ${BASE}. Start: cd backend/lambda && npm run start:local`
      );
    }
    const result = spawnSync('node', [smokeScript, '--base', BASE, '--no-retry'], {
      cwd: lambdaRoot,
      encoding: 'utf8',
      env: { ...process.env, SMOKE_BASE_URL: BASE },
    });
    if (result.status !== 0) {
      console.error(result.stdout);
      console.error(result.stderr);
    }
    expect(result.status).toBe(0);
  }, 600000);
});
