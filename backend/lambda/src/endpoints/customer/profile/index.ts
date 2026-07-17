import type { Hono } from 'hono';
import { registerCustomerProfilePasswordstatusGetRoute } from './routes/customer_profile_passwordstatus_get.route';
import { registerCustomerProfileSetpasswordPostRoute } from './routes/customer_profile_setpassword_post.route';
import { registerCustomerAccountStatusGetRoute } from './routes/customer_account_status_get.route';
import { registerCustomerAccountPasswordPostRoute } from './routes/customer_account_password_post.route';
import { registerCustomerProfileUnifiedIdentifierGetRoute } from './routes/customer_profile_unified_identifier_get.route';
import { registerCustomerProfileGetRoute } from './routes/customer_profile_get.route';
import { registerCustomerProfileIdentifierGetRoute } from './routes/customer_profile_identifier_get.route';
import { registerCustomerProfilePostRoute } from './routes/customer_profile_post.route';
import { registerCustomerProfileIdentifierPutRoute } from './routes/customer_profile_identifier_put.route';
import { registerCustomerCustomeridPreferencesGetRoute } from './routes/customer_customerid_preferences_get.route';
import { registerCustomerCustomeridPreferencesPutRoute } from './routes/customer_customerid_preferences_put.route';
import { registerCustomerByphoneGetRoute } from './routes/customer_byphone_get.route';
import { registerCustomerCustomeridSearchhistoryGetRoute } from './routes/customer_customerid_searchhistory_get.route';
import { registerCustomerCustomeridSearchhistoryPostRoute } from './routes/customer_customerid_searchhistory_post.route';
import { registerCustomerSearchsuggestionsGetRoute } from './routes/customer_searchsuggestions_get.route';
import { registerCustomerCustomeridSearchhistoryDeleteRoute } from './routes/customer_customerid_searchhistory_delete.route';

export function registerCustomerProfileEndpoints(app: Hono) {
  registerCustomerProfilePasswordstatusGetRoute(app);
  registerCustomerProfileSetpasswordPostRoute(app);
  registerCustomerAccountStatusGetRoute(app);
  registerCustomerAccountPasswordPostRoute(app);
  registerCustomerProfileUnifiedIdentifierGetRoute(app);
  registerCustomerProfileGetRoute(app);
  registerCustomerProfileIdentifierGetRoute(app);
  registerCustomerProfilePostRoute(app);
  registerCustomerProfileIdentifierPutRoute(app);
  registerCustomerCustomeridPreferencesGetRoute(app);
  registerCustomerCustomeridPreferencesPutRoute(app);
  registerCustomerByphoneGetRoute(app);
  registerCustomerCustomeridSearchhistoryGetRoute(app);
  registerCustomerCustomeridSearchhistoryPostRoute(app);
  registerCustomerSearchsuggestionsGetRoute(app);
  registerCustomerCustomeridSearchhistoryDeleteRoute(app);
}
