import type { Context } from 'hono';
import { executeDiscoverEvents, executePublicEventDetail } from '../services/event-discovery.service';
import {
  executeCreateVendorEvent,
  executeListVendorEvents,
  executeSubmitVendorEvent,
  executeUpdateVendorEvent,
} from '../services/event-lifecycle.service';
import {
  executeAdminEventRegistrations,
  executeGetRegistration,
  executeMyRegistrations,
  executePrefillPets,
  executeRegisterForEvent,
  executeVendorEventRegistrations,
} from '../services/event-registration.service';
import {
  executeCancelRegistration,
  executeCreateEventPayment,
  executeVerifyEventPayment,
} from '../services/event-payment.service';
import { executeCheckInTicket, executeVerifyTicket } from '../services/event-checkin.service';
import {
  executeAdminCreateEvent,
  executeAdminDeleteEvent,
  executeAdminGetEvent,
  executeAdminListEvents,
  executeAdminPendingEvents,
  executeAdminUpdateEvent,
  executeApproveEvent,
  executeRejectEvent,
} from '../services/event-admin.service';

export async function discoverEventsHandler(c: Context) {
  return executeDiscoverEvents(c);
}
export async function publicEventDetailHandler(c: Context) {
  return executePublicEventDetail(c);
}
export async function createVendorEventHandler(c: Context) {
  return executeCreateVendorEvent(c);
}
export async function listVendorEventsHandler(c: Context) {
  return executeListVendorEvents(c);
}
export async function updateVendorEventHandler(c: Context) {
  return executeUpdateVendorEvent(c);
}
export async function submitVendorEventHandler(c: Context) {
  return executeSubmitVendorEvent(c);
}
export async function registerForEventHandler(c: Context) {
  return executeRegisterForEvent(c);
}
export async function prefillPetsHandler(c: Context) {
  return executePrefillPets(c);
}
export async function myRegistrationsHandler(c: Context) {
  return executeMyRegistrations(c);
}
export async function getRegistrationHandler(c: Context) {
  return executeGetRegistration(c);
}
export async function vendorRegistrationsHandler(c: Context) {
  return executeVendorEventRegistrations(c);
}
export async function adminRegistrationsHandler(c: Context) {
  return executeAdminEventRegistrations(c);
}
export async function createEventPaymentHandler(c: Context) {
  return executeCreateEventPayment(c);
}
export async function verifyEventPaymentHandler(c: Context) {
  return executeVerifyEventPayment(c);
}
export async function cancelRegistrationHandler(c: Context) {
  return executeCancelRegistration(c);
}
export async function verifyTicketHandler(c: Context) {
  return executeVerifyTicket(c);
}
export async function checkInTicketHandler(c: Context) {
  return executeCheckInTicket(c);
}
export async function adminListEventsHandler(c: Context) {
  return executeAdminListEvents(c);
}
export async function adminPendingEventsHandler(c: Context) {
  return executeAdminPendingEvents(c);
}
export async function adminGetEventHandler(c: Context) {
  return executeAdminGetEvent(c);
}
export async function adminCreateEventHandler(c: Context) {
  return executeAdminCreateEvent(c);
}
export async function adminUpdateEventHandler(c: Context) {
  return executeAdminUpdateEvent(c);
}
export async function adminDeleteEventHandler(c: Context) {
  return executeAdminDeleteEvent(c);
}
export async function approveEventHandler(c: Context) {
  return executeApproveEvent(c);
}
export async function rejectEventHandler(c: Context) {
  return executeRejectEvent(c);
}
