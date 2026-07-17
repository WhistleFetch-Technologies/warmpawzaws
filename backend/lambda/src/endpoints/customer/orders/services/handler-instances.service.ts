import {
  CreateCustomerOrderHandler,
  GetCustomerOrdersHandler,
  GetOrderDetailsHandler,
  GetOrderInvoiceHandler,
  CustomerReturnOrderHandler,
  ShopOrderPaymentResumeHandler,
} from './order-base-handlers.service';

export const createOrderHandler = new CreateCustomerOrderHandler();
export const getOrdersHandler = new GetCustomerOrdersHandler();
export const getDetailsHandler = new GetOrderDetailsHandler();
export const getInvoiceHandler = new GetOrderInvoiceHandler();
export const returnOrderHandler = new CustomerReturnOrderHandler();
export const shopPaymentResumeHandler = new ShopOrderPaymentResumeHandler();
