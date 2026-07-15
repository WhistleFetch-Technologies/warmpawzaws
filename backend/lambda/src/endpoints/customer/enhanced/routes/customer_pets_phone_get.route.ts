import type { Hono } from 'hono';
import { customerPetsPhoneGetHandler } from '../handlers/customer_pets_phone_get.handler';

export function registerCustomerPetsPhoneGetRoute(app: Hono) {
  app.get('/customer/pets/:phone', customerPetsPhoneGetHandler);
}
