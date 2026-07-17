import type { Hono } from 'hono';
import { customerCartPhoneItemsItemidDeleteHandler } from '../handlers/customer_cart_phone_items_itemid_delete.handler';

export function registerCustomerCartPhoneItemsItemidDeleteRoute(app: Hono) {
  app.delete("/customer/cart/:phone/items/:itemId", customerCartPhoneItemsItemidDeleteHandler);
}
