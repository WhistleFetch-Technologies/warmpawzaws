/**
 * Deterministic migration apply order: numeric prefix, then full filename.
 * Duplicate prefixes stay as separate files (already applied on shared RDS by name).
 */
function compareMigrationFilenames(a, b) {
  const numA = parseInt(String(a).split('_')[0], 10) || 0;
  const numB = parseInt(String(b).split('_')[0], 10) || 0;
  if (numA !== numB) return numA - numB;
  return String(a).localeCompare(String(b));
}

function sortMigrationFilenames(files) {
  return [...files].sort(compareMigrationFilenames);
}

function warnDuplicateMigrationPrefixes(files, log = console.warn) {
  const byPrefix = new Map();
  for (const file of files) {
    const prefix = parseInt(String(file).split('_')[0], 10) || 0;
    if (!byPrefix.has(prefix)) byPrefix.set(prefix, []);
    byPrefix.get(prefix).push(file);
  }
  for (const [prefix, list] of byPrefix) {
    if (list.length > 1) {
      log(
        `⚠️  Duplicate migration prefix ${prefix} (${list.length} files). Applying in filename order: ${list.join(', ')}`,
      );
    }
  }
}

module.exports = {
  compareMigrationFilenames,
  sortMigrationFilenames,
  warnDuplicateMigrationPrefixes,
};
