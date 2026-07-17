import {
  GetCustomerHandlerEnhanced,
  GetCustomerByPhoneHandlerEnhanced,
  UpdateCustomerHandlerEnhanced,
  GetCustomerPetsHandlerEnhanced,
  AddPetHandlerEnhanced,
  DeactivateCustomerHandlerEnhanced,
} from './enhanced-base-handlers.service';

export const getHandler = new GetCustomerHandlerEnhanced();
export const getByPhoneHandler = new GetCustomerByPhoneHandlerEnhanced();
export const updateHandler = new UpdateCustomerHandlerEnhanced();
export const getPetsHandler = new GetCustomerPetsHandlerEnhanced();
export const addPetHandler = new AddPetHandlerEnhanced();
export const deactivateHandler = new DeactivateCustomerHandlerEnhanced();
