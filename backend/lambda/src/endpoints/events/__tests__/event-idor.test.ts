import { readFileSync } from 'fs';
import { join } from 'path';

describe('events ownership and payment isolation', () => {
  const root = join(__dirname, '..');

  function source(rel: string) {
    return readFileSync(join(root, rel), 'utf8');
  }

  it('customer services resolve identity from JWT context, not body customerId', () => {
    const registration = source('services/event-registration.service.ts');
    const payment = source('services/event-payment.service.ts');
    expect(registration).toContain('executeResolveCustomerId');
    expect(registration).not.toMatch(/body\.customerId/);
    expect(payment).toContain("payment_source: 'event'");
    expect(payment).not.toContain('warmpawz_pay');
  });

  it('vendor lists and check-in compare JWT vendor id to event ownership', () => {
    const registration = source('services/event-registration.service.ts');
    const checkin = source('services/event-checkin.service.ts');
    expect(registration).toContain('executeRequireVendorEvents');
    expect(registration).toContain('event.vendor_id') ;
    expect(checkin).toContain('already_checked_in');
    expect(source('repos/event-tickets.repo.ts')).toContain('FOR UPDATE');
    expect(source('repos/events.repo.ts')).toContain('FOR UPDATE');
  });

  it('public discovery only uses published+approved queries', () => {
    const repo = source('repos/events.repo.ts');
    expect(repo).toContain("e.status = 'published'");
    expect(repo).toContain("e.approval_status = 'approved'");
  });

  it('does not encode PII in payment or ticket QR issuance', () => {
    const payment = source('services/event-payment.service.ts');
    expect(payment).toContain('dbActivateTicketTokens');
    expect(payment).not.toContain('customerName');
    expect(payment).not.toContain('attendee_phone');
  });
});
