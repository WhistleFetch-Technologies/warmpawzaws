import type { Hono } from 'hono';
import { registerCustomerByphoneGetRoute } from './routes/customer_byphone_get.route';
import { registerCustomerMealplanordersGetRoute } from './routes/customer_mealplanorders_get.route';
import { registerCustomerPetsGetRoute } from './routes/customer_pets_get.route';
import { registerCustomerDiagnosticpackagesGetRoute } from './routes/customer_diagnosticpackages_get.route';
import { registerCustomerCustomeridGetRoute } from './routes/customer_customerid_get.route';
import { registerCustomerCustomeridPutRoute } from './routes/customer_customerid_put.route';
import { registerCustomerCustomeridDeleteRoute } from './routes/customer_customerid_delete.route';
import { registerCustomerCustomeridPetsGetRoute } from './routes/customer_customerid_pets_get.route';
import { registerCustomerCustomeridPetsPostRoute } from './routes/customer_customerid_pets_post.route';
import { registerCustomerPetsPhoneGetRoute } from './routes/customer_pets_phone_get.route';
import { registerCustomerPetsPostRoute } from './routes/customer_pets_post.route';
import { registerCustomerQuestionnairePlanningPostRoute } from './routes/customer_questionnaire_planning_post.route';
import { registerCustomerPaymentmethodsGetRoute } from './routes/customer_paymentmethods_get.route';
import { registerCustomerPaymentmethodsPostRoute } from './routes/customer_paymentmethods_post.route';
import { registerCustomerPaymentmethodsMethodidDeleteRoute } from './routes/customer_paymentmethods_methodid_delete.route';
import { registerCustomerPhoneOnboardingCompletePostRoute } from './routes/customer_phone_onboarding_complete_post.route';
import { registerCustomerPhoneOrdersPharmacyActiveGetRoute } from './routes/customer_phone_orders_pharmacy_active_get.route';
import { registerCustomerPhoneOrdersMealsActiveGetRoute } from './routes/customer_phone_orders_meals_active_get.route';
import { registerCustomerPhoneOrdersMealsRideractiveGetRoute } from './routes/customer_phone_orders_meals_rideractive_get.route';
import { registerCustomerPhoneSubscriptionsActiveGetRoute } from './routes/customer_phone_subscriptions_active_get.route';
import { registerCustomerOrdersOrderidPharmacystatusGetRoute } from './routes/customer_orders_orderid_pharmacystatus_get.route';
import { registerCustomerPhonePreferencesGetRoute } from './routes/customer_phone_preferences_get.route';
import { registerCustomerPhonePreferencesPostRoute } from './routes/customer_phone_preferences_post.route';

export function registerCustomerEndpointsEnhanced(app: Hono) {
  registerCustomerByphoneGetRoute(app);
  registerCustomerMealplanordersGetRoute(app);
  registerCustomerPetsGetRoute(app);
  registerCustomerDiagnosticpackagesGetRoute(app);
  registerCustomerCustomeridGetRoute(app);
  registerCustomerCustomeridPutRoute(app);
  registerCustomerCustomeridDeleteRoute(app);
  registerCustomerCustomeridPetsGetRoute(app);
  registerCustomerCustomeridPetsPostRoute(app);
  registerCustomerPetsPhoneGetRoute(app);
  registerCustomerPetsPostRoute(app);
  registerCustomerQuestionnairePlanningPostRoute(app);
  registerCustomerPaymentmethodsGetRoute(app);
  registerCustomerPaymentmethodsPostRoute(app);
  registerCustomerPaymentmethodsMethodidDeleteRoute(app);
  registerCustomerPhoneOnboardingCompletePostRoute(app);
  registerCustomerPhoneOrdersPharmacyActiveGetRoute(app);
  registerCustomerPhoneOrdersMealsActiveGetRoute(app);
  registerCustomerPhoneOrdersMealsRideractiveGetRoute(app);
  registerCustomerPhoneSubscriptionsActiveGetRoute(app);
  registerCustomerOrdersOrderidPharmacystatusGetRoute(app);
  // Same order as develop: phone prefs after profile's :customerId/preferences
  // (enhanced registers last in handler/index.ts).
  registerCustomerPhonePreferencesGetRoute(app);
  registerCustomerPhonePreferencesPostRoute(app);
}
