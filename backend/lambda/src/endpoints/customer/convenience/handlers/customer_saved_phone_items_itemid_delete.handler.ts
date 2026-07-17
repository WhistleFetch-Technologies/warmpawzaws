import type { Context } from 'hono';
import { executecustomerSavedPhoneItemsItemidDelete } from '../services/customer_saved_phone_items_itemid_delete.service';

/** HTTP adapter — delegates to service layer. */
export async function customerSavedPhoneItemsItemidDeleteHandler(c: Context) {
  return executecustomerSavedPhoneItemsItemidDelete(c);
}
