import type { Hono } from 'hono';
import { registerCustomerAddressesGetRoute } from './routes/customer_addresses_get.route';
import { registerCustomerAddressesAddressidGetRoute } from './routes/customer_addresses_addressid_get.route';
import { registerCustomerAddressesPostRoute } from './routes/customer_addresses_post.route';
import { registerCustomerCustomeridAddressesGetRoute } from './routes/customer_customerid_addresses_get.route';
import { registerCustomerCustomeridAddressesPostRoute } from './routes/customer_customerid_addresses_post.route';
import { registerCustomerCustomeridAddressesAddressidPutRoute } from './routes/customer_customerid_addresses_addressid_put.route';
import { registerCustomerCustomeridAddressesAddressidDeleteRoute } from './routes/customer_customerid_addresses_addressid_delete.route';

export function registerAddressEndpoints(app: Hono) {
  registerCustomerAddressesGetRoute(app);
  registerCustomerAddressesAddressidGetRoute(app);
  registerCustomerAddressesPostRoute(app);
  registerCustomerCustomeridAddressesGetRoute(app);
  registerCustomerCustomeridAddressesPostRoute(app);
  registerCustomerCustomeridAddressesAddressidPutRoute(app);
  registerCustomerCustomeridAddressesAddressidDeleteRoute(app);
}
