import type { Context } from 'hono';
import { executecustomerCartPhoneItemsItemidDelete } from '../services/customer_cart_phone_items_itemid_delete.service';

/** HTTP adapter — delegates to service layer. */
export async function customerCartPhoneItemsItemidDeleteHandler(c: Context) {
  return executecustomerCartPhoneItemsItemidDelete(c);
}
