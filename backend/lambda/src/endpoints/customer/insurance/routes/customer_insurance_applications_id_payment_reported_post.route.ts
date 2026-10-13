import type { Hono } from 'hono';
import { customerInsuranceApplicationsIdPaymentReportedPostHandler } from '../handlers/customer_insurance_applications_id_payment_reported_post.handler';

export function registerCustomerInsuranceApplicationsIdPaymentReportedPostRoute(app: Hono) {
  app.post('/customer/insurance/applications/:id/payment-reported', customerInsuranceApplicationsIdPaymentReportedPostHandler);
}
