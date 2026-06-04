import {
  buildLoginAuditDetailsPayload,
  isPgMissingColumnError,
  isTempOrInvalidAuditId,
  isValidVendorUuid,
  mapLoginAuditRow,
} from '../../lib/services/vendor-login-audit';

const VENDOR_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const IDENTITY_ID = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';

describe('vendor-login-audit', () => {
  describe('isTempOrInvalidAuditId', () => {
    it('rejects temp and non-uuid ids', () => {
      expect(isTempOrInvalidAuditId('temp_vendor_999_123')).toBe(true);
      expect(isTempOrInvalidAuditId('')).toBe(true);
      expect(isTempOrInvalidAuditId('not-a-uuid')).toBe(true);
      expect(isTempOrInvalidAuditId(undefined)).toBe(true);
    });

    it('accepts valid uuid', () => {
      expect(isTempOrInvalidAuditId(VENDOR_ID)).toBe(false);
    });
  });

  describe('isValidVendorUuid', () => {
    it('matches backend endpoint uuid check', () => {
      expect(isValidVendorUuid(VENDOR_ID)).toBe(true);
      expect(isValidVendorUuid('test-vendor-id')).toBe(false);
    });
  });

  describe('mapLoginAuditRow', () => {
    it('maps changes jsonb payload', () => {
      const event = mapLoginAuditRow({
        id: '1',
        created_at: '2026-06-01T10:00:00.000Z',
        changes: {
          ip: '1.2.3.4',
          userAgent: 'Mozilla/5.0',
          method: 'otp',
        },
      });
      expect(event.id).toBe('1');
      expect(event.loggedInAt).toBe('2026-06-01T10:00:00.000Z');
      expect(event.ip).toBe('1.2.3.4');
      expect(event.userAgent).toBe('Mozilla/5.0');
      expect(event.method).toBe('otp');
    });

    it('maps details jsonb payload', () => {
      const event = mapLoginAuditRow({
        id: IDENTITY_ID,
        created_at: new Date('2026-06-02T12:00:00.000Z'),
        details: {
          ip: '10.0.0.1',
          userAgent: 'Mobile',
          method: 'password',
        },
      });
      expect(event.method).toBe('password');
      expect(event.ip).toBe('10.0.0.1');
    });

    it('falls back to ip_address and user_agent columns', () => {
      const event = mapLoginAuditRow({
        id: '2',
        created_at: '2026-06-03T08:00:00.000Z',
        payload: {},
        ip_address: '192.168.1.1',
        user_agent: 'Windows NT',
      });
      expect(event.ip).toBe('192.168.1.1');
      expect(event.userAgent).toBe('Windows NT');
      expect(event.method).toBe('otp');
    });

    it('prefers payload over empty columns', () => {
      const event = mapLoginAuditRow({
        id: '3',
        created_at: '2026-06-04T08:00:00.000Z',
        payload: { ip: '5.6.7.8', method: 'password' },
        ip_address: '192.168.1.1',
      });
      expect(event.ip).toBe('5.6.7.8');
      expect(event.method).toBe('password');
    });
  });

  describe('buildLoginAuditDetailsPayload', () => {
    it('defaults method to otp', () => {
      expect(buildLoginAuditDetailsPayload({}).method).toBe('otp');
    });
  });

  describe('isPgMissingColumnError', () => {
    it('detects postgres undefined_column', () => {
      expect(isPgMissingColumnError({ code: '42703', message: 'column "changes" does not exist' })).toBe(
        true
      );
    });

    it('ignores other errors', () => {
      expect(isPgMissingColumnError({ code: '23505', message: 'duplicate' })).toBe(false);
    });
  });
});
