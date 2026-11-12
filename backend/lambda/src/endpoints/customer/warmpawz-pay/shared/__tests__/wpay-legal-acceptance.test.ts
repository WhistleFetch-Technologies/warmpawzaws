import { describe, expect, it } from '@jest/globals';
import {
  PLATFORM_CUSTOMER_LEGAL_VERSION,
  WPAY_LEGAL_ACCEPTANCE_SOURCE,
} from '../wpay-legal-acceptance';

describe('wpay legal acceptance constants', () => {
  it('uses stable platform version + pay source', () => {
    expect(PLATFORM_CUSTOMER_LEGAL_VERSION).toBe('platform_tos_privacy_v1');
    expect(WPAY_LEGAL_ACCEPTANCE_SOURCE).toBe('warmpawz_pay');
  });
});
