import * as fs from 'fs';
import * as path from 'path';

describe('admin catalogue search query', () => {
  it('allows multi-letter q on WPay and Wappt catalogue DTOs', () => {
    const files = [
      path.join(__dirname, '../../endpoints/warmpawz-pay/admin/catalogue/dto/catalogue.requests.ts'),
      path.join(
        __dirname,
        '../../endpoints/warmpawz-appointments/admin/catalogue/dto/catalogue.requests.ts',
      ),
    ];
    for (const file of files) {
      const src = fs.readFileSync(file, 'utf8');
      expect(src).toContain('export const MAX_SEARCH_QUERY_LENGTH = 256');
      expect(src).toContain('q: z.string().trim().min(1).max(MAX_SEARCH_QUERY_LENGTH).optional()');
    }
  });
});
