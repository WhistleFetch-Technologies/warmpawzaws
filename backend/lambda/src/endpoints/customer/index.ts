/**
 * Customer API modules — each follows routes/ → handlers/ → services/ → repos/
 * Registration order is enforced in handler/index.ts (not here).
 */
export { registerCustomerDeliveryFeePolicyEndpoints } from './delivery-fee';
export { registerServiceDiscoveryEndpoints, getCoordinates } from './discovery';
export { registerCustomerPasswordEndpoints } from './password';
export { registerCustomerContentEndpoints } from './content';
export { registerCustomerPhoneConvenienceEndpoints } from './convenience';
export { registerCustomerProfileEndpoints } from './profile';
export { registerCustomerBookingHistoryEndpoints } from './bookings';
export { registerAddressEndpoints } from './addresses';
export { registerCustomerOrdersEndpoints } from './orders';
export { registerCustomerAppointmentsEndpoints } from './appointments';
export { registerSpecializedServiceFlows } from './specialized';
export { registerCustomerEndpointsEnhanced } from './enhanced';
