import type { Hono } from 'hono';
import { customerSavedPhoneItemsItemidDeleteHandler } from '../handlers/customer_saved_phone_items_itemid_delete.handler';

export function registerCustomerSavedPhoneItemsItemidDeleteRoute(app: Hono) {
  app.delete("/customer/saved/:phone/items/:itemId", customerSavedPhoneItemsItemidDeleteHandler);
}
