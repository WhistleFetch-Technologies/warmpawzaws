/**
 * Unit tests for RDS connection utilities
 */

import { isTransactionAbortedError } from '../rds-connection';

describe('isTransactionAbortedError', () => {
  it('should detect PostgreSQL error code 25P02', () => {
    const error = { code: '25P02', message: 'Some error' };
    expect(isTransactionAbortedError(error)).toBe(true);
  });

  it('should detect "current transaction is aborted" message', () => {
    const error = { message: 'current transaction is aborted, commands ignored until end of transaction block' };
    expect(isTransactionAbortedError(error)).toBe(true);
  });

  it('should detect "transaction is aborted" message', () => {
    const error = { message: 'transaction is aborted' };
    expect(isTransactionAbortedError(error)).toBe(true);
  });

  it('should detect "commands ignored until end of transaction block" message', () => {
    const error = { message: 'commands ignored until end of transaction block' };
    expect(isTransactionAbortedError(error)).toBe(true);
  });

  it('should return false for non-transaction errors', () => {
    const error = { code: '23505', message: 'Unique constraint violation' };
    expect(isTransactionAbortedError(error)).toBe(false);
  });

  it('should return false for null/undefined', () => {
    expect(isTransactionAbortedError(null)).toBe(false);
    expect(isTransactionAbortedError(undefined)).toBe(false);
  });

  it('should return false for errors without code or message', () => {
    const error = {};
    expect(isTransactionAbortedError(error)).toBe(false);
  });

  it('should handle case-insensitive message matching', () => {
    const error = { message: 'CURRENT TRANSACTION IS ABORTED' };
    expect(isTransactionAbortedError(error)).toBe(true);
  });
});
