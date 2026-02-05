#!/usr/bin/env node
/**
 * Generate report of all service_catalog services:
 * - Count by role (applicable_roles) — ACTIVE ROLES ONLY (from GET /admin/roles)
 * - Solo vs Business (Center) breakdown for active roles
 * - Count by service_style
 * - Specialization attached: yes/no counts
 * Uses GET /admin/roles (active only) and GET /admin/service-catalog with UAT auth,
 * then writes reports/service-catalog-report-<date>.md
 */

const fs = require('fs');
const path = require('path');

const API_BASE = process.env.API_BASE_URL || 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';
const AUTH_HEADER = process.env.ADMIN_AUTH_HEADER || 'Bearer uat-token-admin-warmpawz2025uat';

function normalizeRoleKey(r) {
  return String(r || '').trim().toLowerCase().replace(/\s+/g, '_') || '(blank)';
}

/** GET /admin/roles — returns active roles by default (active=true or omit). */
async function fetchActiveRoles() {
  const url = `${API_BASE.replace(/\/$/, '')}/admin/roles`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': AUTH_HEADER,
    },
  });
  if (!res.ok) {
    throw new Error(`Roles API ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();
  const roles = data.roles || data.data || (Array.isArray(data) ? data : []);
  const names = roles.map((r) => (r.name || r.id || '').trim()).filter(Boolean);
  const activeSet = new Set(names.map(normalizeRoleKey));
  return { roles: names, activeRoleKeys: activeSet, totalActive: names.length };
}

async function fetchAllServices() {
  const url = `${API_BASE.replace(/\/$/, '')}/admin/service-catalog`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': AUTH_HEADER,
    },
  });
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();
  let services = data.services || data.data || [];
  if (data.grouped && Array.isArray(services)) {
    const flat = [];
    for (const cat of services) {
      if (cat.subcategories && cat.subcategories.length) {
        for (const sub of cat.subcategories) {
          flat.push(...(sub.services || []));
        }
      }
      if (cat.services && cat.services.length) flat.push(...cat.services);
    }
    services = flat.length ? flat : (services[0] && services[0].services ? services.flatMap(c => c.services || []) : services);
  }
  return Array.isArray(services) ? services : [];
}

function classifyRoleType(roleKey) {
  if (roleKey.endsWith('_solo')) return 'solo';
  if (roleKey.endsWith('_center') || roleKey.endsWith('_clinic')) return 'business';
  return 'other';
}

function generateReport(services, activeRoles) {
  const { activeRoleKeys, totalActive } = activeRoles;
  const byRole = {};
  const byRoleInactive = {};
  const byStyle = {};
  let withSpec = 0;
  let withoutSpec = 0;
  const activeRoleSetReferenced = new Set();
  const inactiveRoleSet = new Set();
  const styleSet = new Set();
  const byType = { solo: new Set(), business: new Set(), other: new Set() };

  for (const s of services) {
    const roles = s.applicable_roles || s.applicableRoles || [];
    const style = (s.service_style || s.serviceStyle || 'null').trim() || 'null';
    const specIds = s.specialization_ids || s.specializationIds || [];
    const hasSpec = Array.isArray(specIds) ? specIds.length > 0 : false;

    if (hasSpec) withSpec++; else withoutSpec++;
    styleSet.add(style);
    byStyle[style] = (byStyle[style] || 0) + 1;

    if (roles.length === 0) {
      byRole['(none)'] = (byRole['(none)'] || 0) + 1;
    } else {
      for (const r of roles) {
        const role = (r || '').trim() || '(blank)';
        const key = normalizeRoleKey(role);
        if (activeRoleKeys.has(key)) {
          activeRoleSetReferenced.add(key);
          byRole[role] = (byRole[role] || 0) + 1;
          const type = classifyRoleType(key);
          byType[type].add(key);
        } else {
          inactiveRoleSet.add(role);
          byRoleInactive[role] = (byRoleInactive[role] || 0) + 1;
        }
      }
    }
  }

  const total = services.length;
  const lines = [
    '# Service Catalog Report',
    '',
    `**Generated:** ${new Date().toISOString().slice(0, 19).replace('T', ' ')} UTC`,
    `**Total services:** ${total}`,
    `**Active roles (platform):** ${totalActive} (from GET /admin/roles)`,
    '',
    '---',
    '',
    '## 1. By role (applicable_roles) — active roles only',
    '',
    'Only roles that exist as **active** in the platform (GET /admin/roles) are counted. Counts are role–service *attachments*, not unique services.',
    '',
    '| Role | Count |',
    '|------|------:|',
  ];

  const sortedRoles = [...Object.keys(byRole)].sort((a, b) => (byRole[b] || 0) - (byRole[a] || 0));
  for (const role of sortedRoles) {
    lines.push(`| ${role} | ${byRole[role]} |`);
  }

  lines.push(
    '',
    '---',
    '',
    '## 2. By role type (Solo vs Business)',
    '',
    'Active roles only, grouped by type: **_solo** = Solo, **_center** / **_clinic** = Business (Center), else = Other.',
    '',
    '| Type | Unique roles | Role names |',
    '|------|--------------|------------|',
  );
  const soloList = [...byType.solo].sort().join(', ') || '—';
  const businessList = [...byType.business].sort().join(', ') || '—';
  const otherList = [...byType.other].sort().join(', ') || '—';
  lines.push(`| **Solo** | ${byType.solo.size} | ${soloList} |`);
  lines.push(`| **Business (Center)** | ${byType.business.size} | ${businessList} |`);
  lines.push(`| **Other** | ${byType.other.size} | ${otherList} |`);

  if (inactiveRoleSet.size > 0) {
    lines.push(
      '',
      '---',
      '',
      '## 2b. Inactive/legacy roles still in catalog (excluded from counts above)',
      '',
      'These role names appear in service_catalog.applicable_roles but are **not** in the active roles list (GET /admin/roles). They should be removed or the roles reactivated.',
      '',
      '| Role | Attachments |',
      '|------|------:|',
    );
    const sortedInactive = [...Object.keys(byRoleInactive)].sort((a, b) => (byRoleInactive[b] || 0) - (byRoleInactive[a] || 0));
    for (const role of sortedInactive) {
      lines.push(`| ${role} | ${byRoleInactive[role]} |`);
    }
    lines.push('', '');
  }

  lines.push(
    '',
    '---',
    '',
    '## 3. By service style',
    '',
    '| Service style | Count |',
    '|----------------|------:|',
  );

  const sortedStyles = [...Object.keys(byStyle)].sort((a, b) => (byStyle[b] || 0) - (byStyle[a] || 0));
  for (const style of sortedStyles) {
    lines.push(`| ${style} | ${byStyle[style]} |`);
  }

  lines.push(
    '',
    '---',
    '',
    '## 4. Specialization attached',
    '',
    '| | Count |',
    '|---|------:|',
    `| **Yes** (at least one specialization) | ${withSpec} |`,
    `| **No** (none) | ${withoutSpec} |`,
    '',
    `**Total** | ${total} |`,
    '',
    '---',
    '',
    '## 5. Summary',
    '',
    `- **Total services:** ${total}`,
    `- **Active roles on platform:** ${totalActive} (from GET /admin/roles)`,
    `- **Active roles referenced in catalog:** ${activeRoleSetReferenced.size} (only these should appear in catalog)`,
    `- **Unique service styles:** ${styleSet.size}`,
    `- **With specialization:** ${withSpec} (${total ? ((100 * withSpec / total).toFixed(1)) : 0}%)`,
    `- **Without specialization:** ${withoutSpec} (${total ? ((100 * withoutSpec / total).toFixed(1)) : 0}%)`,
    inactiveRoleSet.size > 0 ? `- **Inactive/legacy roles still in catalog:** ${inactiveRoleSet.size} (see section 2b)` : '',
    '',
  );

  return lines.join('\n');
}

async function main() {
  console.log('Fetching active roles from', API_BASE, '...');
  const activeRoles = await fetchActiveRoles();
  console.log('Active roles:', activeRoles.totalActive);

  console.log('Fetching all services from', API_BASE, '...');
  const services = await fetchAllServices();
  console.log('Services fetched:', services.length);

  const report = generateReport(services, activeRoles);
  const reportsDir = path.join(__dirname, '..', 'reports');
  if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });
  const date = new Date().toISOString().slice(0, 10);
  const file = path.join(reportsDir, `service-catalog-report-${date}.md`);
  fs.writeFileSync(file, report, 'utf8');
  console.log('Report written:', file);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
