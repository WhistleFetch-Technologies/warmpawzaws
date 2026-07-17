import type { Context } from 'hono';
import { executecustomerCartPhoneItemsItemidPut } from '../services/customer_cart_phone_items_itemid_put.service';

/** HTTP adapter — delegates to service layer. */
export async function customerCartPhoneItemsItemidPutHandler(c: Context) {
  return executecustomerCartPhoneItemsItemidPut(c);
}
