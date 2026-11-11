import type { Hono } from 'hono';
import { customerInsuranceEnquiriesPostHandler } from '../handlers/customer_insurance_enquiries_post.handler';

export function registerCustomerInsuranceEnquiriesPostRoute(app: Hono) {
  app.post('/customer/insurance/enquiries', customerInsuranceEnquiriesPostHandler);
}
