/**
 * Shared dev build directory (outside OneDrive on Windows) so Next's startup cleanup
 * does not hit broken reparse points under synced Desktop folders.
 */
const path = require('path');
const os = require('os');

function devCacheAbs() {
  if (process.platform === 'win32' && process.env.LOCALAPPDATA) {
    return path.join(process.env.LOCALAPPDATA, 'warmpawz', 'admin-web-next');
  }
  return path.join(os.tmpdir(), 'warmpawz-admin-web-next');
}

/** @param {string} appRoot Absolute path to apps/admin-web */
function getDevDistDir(appRoot) {
  const rel = path.relative(appRoot, devCacheAbs());
  if (rel && !path.isAbsolute(rel)) {
    return rel;
  }
  return '.next';
}

/** @param {string} appRoot */
function getDevTypesIncludeEntry(appRoot) {
  const rel = getDevDistDir(appRoot);
  const posix = rel.split(path.sep).join('/');
  return `${posix}/types/**/*.ts`;
}

module.exports = { devCacheAbs, getDevDistDir, getDevTypesIncludeEntry };
