import * as fs from 'fs';
import * as path from 'path';

describe('vendor services catalog description', () => {
  it('looks up catalogue copy by service name when the id join misses', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '../vendor-services-list.repo.ts'),
      'utf8',
    );
    expect(src).toContain('catalog_description_by_name');
    expect(src).toContain("LOWER(BTRIM(COALESCE(sc2.service_name, '')))");
  });

  it('maps empty custom_description onto catalogue copy', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '../../services/vendor-services/map-vendor-service-rows.ts'),
      'utf8',
    );
    expect(src).toContain('firstCleanDescription');
    expect(src).toContain('row.catalog_description_by_name');
    expect(src).toContain('cleanDescription');
  });
});
