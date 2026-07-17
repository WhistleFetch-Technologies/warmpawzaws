import type { Hono } from 'hono';
import { customerCartPhoneItemsItemidPutHandler } from '../handlers/customer_cart_phone_items_itemid_put.handler';

export function registerCustomerCartPhoneItemsItemidPutRoute(app: Hono) {
  app.put("/customer/cart/:phone/items/:itemId", customerCartPhoneItemsItemidPutHandler);
}
