import type { Hono } from 'hono';
import { customerInsurancePawsProductGetHandler } from '../handlers/customer_insurance_paws_product_get.handler';

export function registerCustomerInsurancePawsProductGetRoute(app: Hono) {
  app.get('/customer/insurance/products/paws-n-claws', customerInsurancePawsProductGetHandler);
}
