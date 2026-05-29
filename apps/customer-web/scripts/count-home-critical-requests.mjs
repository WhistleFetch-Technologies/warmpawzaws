/**
 * Static trace: count critical home-path GET calls on initial mount (before vs after Phase 1).
 * Run: node scripts/count-home-critical-requests.mjs [before|after]
 */
import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const mode = process.argv[2] || 'after';

function readAt(ref, relPath) {
  if (mode === 'after') {
    const p = join(root, relPath);
    return existsSync(p) ? readFileSync(p, 'utf8') : '';
  }
  try {
    return execSync(`git show HEAD:${relPath}`, { cwd: join(root, '../..'), encoding: 'utf8' });
  } catch {
    return '';
  }
}

const page = readAt(mode, 'apps/customer-web/app/page.tsx');
const wrapper = readAt(mode, 'apps/customer-web/components/customer/wrappers/CustomerHomeWrapper.tsx');
const home = readAt(mode, 'apps/customer-web/components/customer/homepage/CustomerHomeComplete.tsx');
const bootstrap = mode === 'after' ? readFileSync(join(root, 'lib/customer-home-bootstrap.ts'), 'utf8') : '';

const profileRe = /\/customer\/profile(\?|\/|`|')/g;
const unifiedRe = /\/customer\/profile\/unified/g;
const petsRe = /\/customer\/pets\//g;

function count(str, re) {
  return (str.match(re) || []).length;
}

const pageUnified = count(page, unifiedRe);
const pageProfile = count(page, profileRe);
const wrapperProfile = count(wrapper, profileRe);
const wrapperPets = count(wrapper, petsRe);
const homeProfile = count(home, profileRe);
const homePets = count(home, petsRe);
const bootstrapProfile = count(bootstrap, profileRe);
const bootstrapPets = count(bootstrap, petsRe);

// Effective network calls on home reload (logical, ignoring dedup):
// before: page unified + wrapper profile+pets + home profile+pets
// after: one coordinator profile+pets (page + home share); wrapper 0 on home

const before = mode === 'before';
const profileCalls = before
  ? (pageUnified > 0 ? 1 : 0) + (wrapperProfile > 0 ? 1 : 0) + (homeProfile > 0 ? 1 : 0)
  : 1; // single coordinator path
const petsCalls = before
  ? (wrapperPets > 0 ? 1 : 0) + (homePets > 0 ? 1 : 0)
  : 1;

console.log(JSON.stringify({
  mode,
  sourceHits: {
    pageUnified,
    pageProfile,
    wrapperProfile,
    wrapperPets,
    homeProfile,
    homePets,
    bootstrapProfile,
    bootstrapPets,
  },
  estimatedHomeReload: {
    profileNetworkCalls: profileCalls,
    petsNetworkCalls: petsCalls,
    profileUnifiedCalls: before ? (pageUnified > 0 ? 1 : 0) : 0,
    note: before
      ? 'page.tsx unified + CustomerHomeWrapper profile+pets + CustomerHomeComplete profile+pets (no GET dedup)'
      : 'ensureCustomerProfileAndPets once + global GET dedup; wrapper skips network on home',
  },
}, null, 2));
