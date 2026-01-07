import React from 'react';

// Stub Dialog components for admin-web compatibility
export const Dialog = ({ children, open, onOpenChange, ...props }: any) => {
  if (!open) return null;
  return React.createElement('div', props, children);
};
export const DialogContent = ({ children, className, ...props }: any) => {
  return React.createElement('div', { className, ...props }, children);
};
export const DialogDescription = ({ children, className, ...props }: any) => {
  return React.createElement('p', { className, ...props }, children);
};
export const DialogFooter = ({ children, className, ...props }: any) => {
  return React.createElement('div', { className, ...props }, children);
};
export const DialogHeader = ({ children, className, ...props }: any) => {
  return React.createElement('div', { className, ...props }, children);
};
export const DialogTitle = ({ children, className, ...props }: any) => {
  return React.createElement('h2', { className, ...props }, children);
};

