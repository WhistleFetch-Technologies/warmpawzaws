import type { Hono } from 'hono';
import {
  adminCreateEventHandler,
  adminDeleteEventHandler,
  adminGetEventHandler,
  adminListEventsHandler,
  adminPendingEventsHandler,
  adminRegistrationsHandler,
  adminUpdateEventHandler,
  approveEventHandler,
  cancelRegistrationHandler,
  checkInTicketHandler,
  createEventPaymentHandler,
  createVendorEventHandler,
  discoverEventsHandler,
  getRegistrationHandler,
  listVendorEventsHandler,
  myRegistrationsHandler,
  prefillPetsHandler,
  publicEventDetailHandler,
  registerForEventHandler,
  rejectEventHandler,
  submitVendorEventHandler,
  updateVendorEventHandler,
  vendorRegistrationsHandler,
  verifyEventPaymentHandler,
  verifyTicketHandler,
} from '../handlers/events.handler';

export function registerEventRoutes(app: Hono) {
  app.get('/public/events/discover', discoverEventsHandler);
  app.get('/public/events/:eventId', publicEventDetailHandler);
  app.get('/events/discover', discoverEventsHandler);
  app.get('/events/my-registrations', myRegistrationsHandler);
  app.get('/events/pets/prefill', prefillPetsHandler);
  app.get('/events/verify/:bookingReference', verifyTicketHandler);
  app.get('/events/registrations/:registrationId', getRegistrationHandler);
  app.delete('/events/registrations/:registrationId', cancelRegistrationHandler);
  app.post('/events/registrations/:registrationId/payment', createEventPaymentHandler);
  app.post('/events/registrations/:registrationId/payment/verify', verifyEventPaymentHandler);
  app.post('/events/:eventId/register', registerForEventHandler);
  app.get('/events/:eventId', publicEventDetailHandler);

  app.post('/vendor/events', createVendorEventHandler);
  app.get('/vendor/events', listVendorEventsHandler);
  app.put('/vendor/events/:eventId', updateVendorEventHandler);
  app.post('/vendor/events/:eventId/submit', submitVendorEventHandler);
  app.get('/vendor/events/:eventId/registrations', vendorRegistrationsHandler);
  app.post('/events/tickets/:ticketId/check-in', checkInTicketHandler);
  app.post('/events/registrations/:registrationId/check-in', checkInTicketHandler);

  app.get('/admin/events/pending', adminPendingEventsHandler);
  app.get('/admin/events/:eventId/registrations', adminRegistrationsHandler);
  app.get('/admin/events/:eventId', adminGetEventHandler);
  app.get('/admin/events', adminListEventsHandler);
  app.post('/admin/events', adminCreateEventHandler);
  app.put('/admin/events/:eventId', adminUpdateEventHandler);
  app.delete('/admin/events/:eventId', adminDeleteEventHandler);
  app.post('/admin/events/:eventId/approve', approveEventHandler);
  app.post('/admin/events/:eventId/reject', rejectEventHandler);
}
