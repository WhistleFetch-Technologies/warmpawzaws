/**
 * Removes `.next` before `next dev` so dev does not reuse a static-export tree.
 * Reusing export output causes 404s on `/_next/static/chunks/*` and pages stuck on loading text.
 *
 * For faster restarts, use `npm run dev:cached` (skips this wipe).
 */
const fs = require('fs');
const path = require('path');

const nextDir = path.join(__dirname, '..', '.next');

try {
  fs.rmSync(nextDir, {
    recursive: true,
    force: true,
    maxRetries: 8,
    retryDelay: 150,
  });
} catch (e) {
  if (e && e.code !== 'ENOENT') {
    console.warn('[clean-next-dev] could not remove .next:', e.message);
    process.exitCode = 0;
  }
}
