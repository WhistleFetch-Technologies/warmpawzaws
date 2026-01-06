import React from 'react';

// Stub Accordion components for admin-web compatibility
export const Accordion = ({ children, type, className, ...props }: any) => {
  return React.createElement('div', { className, ...props }, children);
};
export const AccordionContent = ({ children, className, ...props }: any) => {
  return React.createElement('div', { className, ...props }, children);
};
export const AccordionItem = ({ children, value, className, ...props }: any) => {
  return React.createElement('div', { className, ...props }, children);
};
export const AccordionTrigger = ({ children, className, ...props }: any) => {
  return React.createElement('button', { className, ...props }, children);
};

