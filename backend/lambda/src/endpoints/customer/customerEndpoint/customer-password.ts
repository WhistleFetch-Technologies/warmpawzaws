/**
 * Shim — logic lives in endpoints/customer/password/
 */
export {
  registerCustomerPasswordEndpoints,
  handleCustomerAccountStatus,
  handleCustomerSetPassword,
  resolvePostgresCustomerIdFromAuthHeaders,
  hasMeaningfulStoredPassword,
} from '../password';
