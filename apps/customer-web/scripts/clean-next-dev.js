/**
 * Removes `.next` before `next dev` so startup skips Next's recursive-delete walk.
 * That walk is slow and brittle on Windows + OneDrive (reparse points / locks).
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
