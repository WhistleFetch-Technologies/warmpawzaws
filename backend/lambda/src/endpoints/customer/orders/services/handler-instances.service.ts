import {
  CreateCustomerOrderHandler,
  GetCustomerOrdersHandler,
  GetOrderDetailsHandler,
  GetOrderInvoiceHandler,
  CustomerReturnOrderHandler,
  ShopOrderPaymentResumeHandler,
  ShopOrderPaymentReconcileHandler,
} from './order-base-handlers.service';

export const createOrderHandler = new CreateCustomerOrderHandler();
export const getOrdersHandler = new GetCustomerOrdersHandler();
export const getDetailsHandler = new GetOrderDetailsHandler();
export const getInvoiceHandler = new GetOrderInvoiceHandler();
export const returnOrderHandler = new CustomerReturnOrderHandler();
export const shopPaymentResumeHandler = new ShopOrderPaymentResumeHandler();
export const shopPaymentReconcileHandler = new ShopOrderPaymentReconcileHandler();
