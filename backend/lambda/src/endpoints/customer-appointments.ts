/**
 * Re-export canonical customer appointments routes.
 * The real implementation lives in customer/customerEndpoint/customer-appointments.ts
 * so this path never registers duplicate or legacy (appointments/services) SQL.
 */
export { registerCustomerAppointmentsEndpoints } from './customer/customerEndpoint/customer-appointments';
