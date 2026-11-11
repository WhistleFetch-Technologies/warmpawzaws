/**
 * Replace medical-records console.warn that dump raw errors/messages with secureLog.
 * Does not touch static operational warns (constraint fallback, missing pet_id).
 */
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '../src/endpoints/medical-records.ts');
let src = fs.readFileSync(file, 'utf8');

if (!src.includes("secureLog,")) {
  src = src.replace(
    "import { secureLogError } from '../utils/secure-logger';",
    "import { secureLog, secureLogError } from '../utils/secure-logger';",
  );
}

const replacements = [
  [
    "console.warn('[MEDICAL-RECORDS] Prescriptions fetch failed (non-blocking):', prescErr?.message);",
    "secureLog('warn', '[MEDICAL-RECORDS] Prescriptions fetch failed (non-blocking)', { error: prescErr });",
  ],
  [
    "console.warn('[Medical Records] Pet prescriptions query failed (non-blocking):', prescErr);",
    "secureLog('warn', '[Medical Records] Pet prescriptions query failed (non-blocking)', { error: prescErr });",
  ],
  [
    "console.warn('Failed to send prescription notification:', notifError);",
    "secureLog('warn', 'Failed to send prescription notification', { error: notifError });",
  ],
  [
    "console.warn('Failed to send report notification to customer:', notifError);",
    "secureLog('warn', 'Failed to send report notification to customer', { error: notifError });",
  ],
  [
    "console.warn('Failed to notify prescribing vet:', vetNotifError);",
    "secureLog('warn', 'Failed to notify prescribing vet', { error: vetNotifError });",
  ],
  [
    "console.warn('Error querying prescriptions table:', prescError);",
    "secureLog('warn', 'Error querying prescriptions table', { error: prescError });",
  ],
  [
    "console.warn('Error querying medical_records table for prescriptions:', medicalError);",
    "secureLog('warn', 'Error querying medical_records table for prescriptions', { error: medicalError });",
  ],
  [
    "console.warn(`[Prescriptions] Failed to generate presigned URL for ${p.file_url}:`, urlError?.message);",
    "secureLog('warn', '[Prescriptions] Failed to generate presigned URL', { error: urlError });",
  ],
  [
    "console.warn('Error checking prescriptions table:', prescError);",
    "secureLog('warn', 'Error checking prescriptions table', { error: prescError });",
  ],
];

let n = 0;
for (const [from, to] of replacements) {
  if (src.includes(from)) {
    src = src.split(from).join(to);
    n++;
  } else {
    console.warn('missing:', from.slice(0, 80));
  }
}

fs.writeFileSync(file, src);
console.log('medical warn sanitizations', n);
