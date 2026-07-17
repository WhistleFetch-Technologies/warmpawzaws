import type { Context } from 'hono';
import { executecustomerOrdersIdInvoiceGet } from '../services/customer_orders_id_invoice_get.service';

/** HTTP adapter — delegates to service layer. */
export async function customerOrdersIdInvoiceGetHandler(c: Context) {
  return executecustomerOrdersIdInvoiceGet(c);
}
