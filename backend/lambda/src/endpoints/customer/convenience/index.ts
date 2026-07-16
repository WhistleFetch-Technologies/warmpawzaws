import type { Hono } from 'hono';
import { registerCustomerBookingsActiveGetRoute } from './routes/customer_bookings_active_get.route';
import { registerCustomerPhoneBookingsUpcomingcallsGetRoute } from './routes/customer_phone_bookings_upcomingcalls_get.route';
import { registerCustomerBookingsGetRoute } from './routes/customer_bookings_get.route';
import { registerCustomerCartPhoneGetRoute } from './routes/customer_cart_phone_get.route';
import { registerCustomerCartPhoneItemsItemidPutRoute } from './routes/customer_cart_phone_items_itemid_put.route';
import { registerCustomerCartPhoneItemsItemidDeleteRoute } from './routes/customer_cart_phone_items_itemid_delete.route';
import { registerCustomerSavedPhoneGetRoute } from './routes/customer_saved_phone_get.route';
import { registerCustomerSavedPhoneItemsItemidDeleteRoute } from './routes/customer_saved_phone_items_itemid_delete.route';
import { registerCustomerWalletGetRoute } from './routes/customer_wallet_get.route';
import { registerCustomerWalletTransactionsGetRoute } from './routes/customer_wallet_transactions_get.route';
import { registerCustomerNotificationsPhoneGetRoute } from './routes/customer_notifications_phone_get.route';
import { registerCustomerNotificationsPhonePutRoute } from './routes/customer_notifications_phone_put.route';
import { registerCustomerPaymentmethodsGetRoute } from './routes/customer_paymentmethods_get.route';
import { registerCustomerPaymentsPhoneGetRoute } from './routes/customer_payments_phone_get.route';
import { registerCustomerPaymentsPhonePostRoute } from './routes/customer_payments_phone_post.route';
import { registerCustomerPaymentsPhonePaymentidDeleteRoute } from './routes/customer_payments_phone_paymentid_delete.route';
import { registerCustomerPhoneRecommendedservicesGetRoute } from './routes/customer_phone_recommendedservices_get.route';
import { registerCustomerPhonePackagesGetRoute } from './routes/customer_phone_packages_get.route';
import { registerCustomerPhoneLatestbookingbyvendorGetRoute } from './routes/customer_phone_latestbookingbyvendor_get.route';
import { registerCustomerPhoneActivewalksGetRoute } from './routes/customer_phone_activewalks_get.route';
import { registerCustomerPhonePetskillsGetRoute } from './routes/customer_phone_petskills_get.route';
import { registerCustomerPhoneBookingsActivetrackingGetRoute } from '../enhanced/routes/customer_phone_bookings_activetracking_get.route';
import { registerCustomerPhoneBookingsPendingreviewsGetRoute } from '../enhanced/routes/customer_phone_bookings_pendingreviews_get.route';
import { registerCustomerPhoneReviewsBookingidSkipPostRoute } from '../enhanced/routes/customer_phone_reviews_bookingid_skip_post.route';
import { registerCustomerPhonePreferencesGetRoute } from '../enhanced/routes/customer_phone_preferences_get.route';
import { registerCustomerPhonePreferencesPostRoute } from '../enhanced/routes/customer_phone_preferences_post.route';

export function registerCustomerPhoneConvenienceEndpoints(app: Hono) {
  registerCustomerBookingsActiveGetRoute(app);
  registerCustomerPhoneBookingsUpcomingcallsGetRoute(app);
  // Static phone booking segments before bookings/:bookingId (registered later) —
  // otherwise "active-tracking" / "pending-reviews" are parsed as UUIDs.
  registerCustomerPhoneBookingsActivetrackingGetRoute(app);
  registerCustomerPhoneBookingsPendingreviewsGetRoute(app);
  registerCustomerPhoneReviewsBookingidSkipPostRoute(app);
  registerCustomerPhonePreferencesGetRoute(app);
  registerCustomerPhonePreferencesPostRoute(app);
  registerCustomerBookingsGetRoute(app);
  registerCustomerCartPhoneGetRoute(app);
  registerCustomerCartPhoneItemsItemidPutRoute(app);
  registerCustomerCartPhoneItemsItemidDeleteRoute(app);
  registerCustomerSavedPhoneGetRoute(app);
  registerCustomerSavedPhoneItemsItemidDeleteRoute(app);
  registerCustomerWalletGetRoute(app);
  registerCustomerWalletTransactionsGetRoute(app);
  registerCustomerNotificationsPhoneGetRoute(app);
  registerCustomerNotificationsPhonePutRoute(app);
  registerCustomerPaymentmethodsGetRoute(app);
  registerCustomerPaymentsPhoneGetRoute(app);
  registerCustomerPaymentsPhonePostRoute(app);
  registerCustomerPaymentsPhonePaymentidDeleteRoute(app);
  registerCustomerPhoneRecommendedservicesGetRoute(app);
  registerCustomerPhonePackagesGetRoute(app);
  registerCustomerPhoneLatestbookingbyvendorGetRoute(app);
  registerCustomerPhoneActivewalksGetRoute(app);
  registerCustomerPhonePetskillsGetRoute(app);
}
