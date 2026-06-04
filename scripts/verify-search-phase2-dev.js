#!/usr/bin/env node
/**
 * Live GET /search against dev API (current deployed Lambda).
 * Phase-2 fields appear only after backend deploy.
 */
const BASE = process.env.SEARCH_API_BASE || 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';

const QUERIES = [
  'dog doctor',
  'cat doctor',
  'pet clinic',
  'animal hospital',
  'dog grooming',
  'pet nutritionist',
  'pet surgery',
  'vet near me',
];

async function main() {
  for (const q of QUERIES) {
    const url = `${BASE}/search?q=${encodeURIComponent(q)}&limit=20`;
    const res = await fetch(url);
    const body = await res.json();
    console.log(
      JSON.stringify(
        {
          query: q,
          status: res.status,
          ...pick(body),
          categories: body.categories,
          vendors: (body.vendors || []).slice(0, 2).map((v) => ({
            id: v.id,
            businessName: v.businessName,
            category: v.category,
          })),
          services: (body.services || []).slice(0, 2).map((s) => ({
            id: s.id,
            serviceName: s.serviceName,
            vendorId: s.vendorId,
          })),
        },
        null,
        2
      )
    );
    console.log('---');
  }
}

function pick(body) {
  return {
    effectiveCategory: body.effectiveCategory ?? null,
    taxonomySource: body.taxonomySource ?? null,
    searchText: body.searchText ?? null,
    categorySource: body.categorySource ?? null,
    total: body.total ?? 0,
    searchMethod: body.searchMethod,
    vendorCount: Array.isArray(body.vendors) ? body.vendors.length : 0,
    serviceCount: Array.isArray(body.services) ? body.services.length : 0,
    categoriesCount: Array.isArray(body.categories) ? body.categories.length : 0,
  };
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
