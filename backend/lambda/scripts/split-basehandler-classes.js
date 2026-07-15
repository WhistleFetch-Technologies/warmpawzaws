/**
 * Move BaseHandler classes from module-helpers.repo.ts -> services/*-base-handlers.service.ts
 * Keep non-class helpers in repos/module-helpers.repo.ts
 */
const fs = require('fs');
const path = require('path');

function splitModule(moduleName, serviceFileName) {
  const repoPath = path.join(
    __dirname,
    `../src/endpoints/customer/${moduleName}/repos/module-helpers.repo.ts`
  );
  const content = fs.readFileSync(repoPath, 'utf8');
  const classStart = content.search(/^export class /m);
  if (classStart < 0) {
    console.log('no classes in', moduleName);
    return;
  }

  const registerMarker = content.indexOf('// REGISTER ENDPOINTS');
  const classEnd = registerMarker >= 0 ? registerMarker : content.length;
  const header = content.slice(0, classStart).trimEnd();
  const classes = content.slice(classStart, classEnd).trimEnd();
  const tail = registerMarker >= 0 ? content.slice(classEnd).trimEnd() : '';

  const servicePath = path.join(
    __dirname,
    `../src/endpoints/customer/${moduleName}/services/${serviceFileName}`
  );
  fs.mkdirSync(path.dirname(servicePath), { recursive: true });
  fs.writeFileSync(servicePath, `${header}\n\n${classes}\n`);

  let repoRemainder = header;
  if (tail) {
    // appointments: keep runAppointmentHandler in repo
    const runtimeStart = tail.indexOf('const LIST_FALLBACK');
    if (runtimeStart >= 0) {
      const runtime = tail.slice(runtimeStart);
      const runtimePath = path.join(
        __dirname,
        `../src/endpoints/customer/${moduleName}/repos/appointment-runtime.repo.ts`
      );
      fs.writeFileSync(
        runtimePath,
        `${header}\n\n${runtime.replace(/^const NOT_FOUND_FALLBACK/, 'export const NOT_FOUND_FALLBACK').replace(/^const LIST_FALLBACK/, 'export const LIST_FALLBACK')}\n`
      );
      repoRemainder = header + '\n\n/** SQL/helpers only — handler classes live in services/. */\n';
    } else {
      repoRemainder = header + '\n\n/** SQL/helpers only — handler classes live in services/. */\n';
    }
  } else {
    repoRemainder = header + '\n\n/** SQL/helpers only — handler classes live in services/. */\n';
  }

  fs.writeFileSync(repoPath, repoRemainder);
  console.log('split', moduleName, '->', serviceFileName);
}

splitModule('orders', 'order-base-handlers.service.ts');
splitModule('appointments', 'appointment-base-handlers.service.ts');
splitModule('enhanced', 'enhanced-base-handlers.service.ts');
