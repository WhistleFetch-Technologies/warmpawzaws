import {
  GetCustomerAppointmentsHandler,
  GetAppointmentDetailsHandler,
  RescheduleAppointmentHandler,
  CancelAppointmentHandler,
} from './appointment-base-handlers.service';

export const getAppointmentsHandler = new GetCustomerAppointmentsHandler();
export const getDetailsHandler = new GetAppointmentDetailsHandler();
export const rescheduleHandler = new RescheduleAppointmentHandler();
export const cancelHandler = new CancelAppointmentHandler();
