/**
 * Starts `next dev` with a stable distDir for all processes (including workers).
 * Next reloads next.config in children where argv no longer looks like `next dev`, which
 * previously made distDir fall back to `dist` / default `.next` and triggered readlink
 * cleanup on a broken OneDrive `.next` tree.
 */
const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const net = require('net');
const path = require('path');

/** @param {number} start */
function firstFreePortFrom(start) {
  const max = start + 100;
  return new Promise((resolve, reject) => {
    const tryListen = (port) => {
      if (port > max) {
        reject(new Error(`No free TCP port found from ${start} through ${max}`));
        return;
      }
      const server = net.createServer();
      server.once('error', (err) => {
        if (err.code === 'EADDRINUSE') tryListen(port + 1);
        else reject(err);
      });
      server.listen(port, () => {
        server.close(() => resolve(port));
      });
    };
    tryListen(start);
  });
}

const appRoot = path.resolve(__dirname, '..');
const staleNext = path.join(appRoot, '.next');

spawnSync(process.execPath, [path.join(__dirname, 'sync-tsconfig-next-types.cjs')], {
  cwd: appRoot,
  stdio: 'inherit',
});

try {
  fs.rmSync(staleNext, { recursive: true, force: true, maxRetries: 10 });
} catch {
  /* ignore */
}
if (process.platform === 'win32' && fs.existsSync(staleNext)) {
  spawnSync('cmd.exe', ['/d', '/s', '/c', `rd /s /q "${staleNext}"`], {
    stdio: 'ignore',
    windowsHide: true,
  });
}

const { getDevDistDir } = require('./dev-cache-path.cjs');
const rel = getDevDistDir(appRoot);

// Server bundles live under distDir (often outside the repo on Windows). Node must still
// resolve `next/...` and `react/...` from this app's node_modules (see MODULE_NOT_FOUND).
const nodeModulesDir = path.join(appRoot, 'node_modules');
const nodePath = [nodeModulesDir, process.env.NODE_PATH].filter(Boolean).join(path.delimiter);

const nextBin = require.resolve('next/dist/bin/next', { paths: [appRoot] });

(async () => {
  const defaultPort = 3003;
  const envPort = process.env.PORT;
  const preferred =
    envPort !== undefined && envPort !== ''
      ? Number.parseInt(envPort, 10)
      : defaultPort;
  const port =
    Number.isFinite(preferred) && preferred > 0
      ? envPort !== undefined && envPort !== ''
        ? preferred
        : await firstFreePortFrom(preferred)
      : await firstFreePortFrom(defaultPort);

  if (port !== defaultPort && (envPort === undefined || envPort === '')) {
    console.info(`[start-dev] Port ${defaultPort} is in use; starting Next.js on ${port}`);
  }

  const proc = spawn(process.execPath, [nextBin, 'dev', '-p', String(port)], {
    cwd: appRoot,
    env: { ...process.env, PORT: String(port), WARMPAWZ_ADMIN_WEB_DEV_DISTDIR: rel, NODE_PATH: nodePath },
    stdio: 'inherit',
  });
  proc.on('exit', (code, signal) => {
    if (signal) process.kill(process.pid, signal);
    process.exit(code ?? 0);
  });
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
