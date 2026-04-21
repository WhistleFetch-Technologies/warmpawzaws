/**
 * Runs `next dev` / `next start` on PORT (default 3001) so the port can be
 * overridden when 3001 is already in use: set PORT=3002 npm run dev
 */
const { spawnSync } = require('child_process');
const path = require('path');

const appDir = path.resolve(__dirname, '..');
const port = String(process.env.PORT || '3001');
const mode = process.argv[2];
const extras = process.argv.slice(3);

if (mode !== 'dev' && mode !== 'start') {
  console.error('Usage: node scripts/run-next.js dev|start [...next args]');
  process.exit(1);
}

const nextArgs = mode === 'dev' ? ['dev', '-p', port, ...extras] : ['start', '-p', port, ...extras];
const r = spawnSync('npx', ['--no', 'next', ...nextArgs], {
  stdio: 'inherit',
  cwd: appDir,
  shell: true,
  env: process.env,
});

process.exit(r.status === null ? 1 : r.status);
