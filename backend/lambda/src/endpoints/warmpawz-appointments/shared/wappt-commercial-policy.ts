/**
 * Thin facade for Warmpawz Pay commercial rules — delegates without changing behavior.
 */
export {
  isWapptAppointmentBooking,
  shouldSkipVendorEarningsForWappt,
  SQL_EXCLUDE_WAPPT_BOOKING_EARNINGS,
  SQL_EXCLUDE_WAPPT_VENDOR_EARNINGS_VE,
  WAPPT_COMMERCE_MODE,
} from './wappt-earnings-policy';

export {
  assertBookingEligibleForPayCredit,
  isWapptBookingBlockedForPayCredit,
  resolveWapptAppointmentFeeCredit,
} from '../../customer/warmpawz-pay/shared/wpay-appointment-credit';

export {
  assertWapptSettlementEligible,
  isWapptAppointmentLinkedPayBill,
  resolveWapptSettlementBookingId,
  type WapptBookingSettlementFacts,
} from '../../customer/warmpawz-pay/shared/wpay-settlement-policy';

export { onWapptServiceCompleted } from './on-wappt-service-completed';

export { finalizeBookingServiceCompleted } from './finalize-booking-service-completed';
