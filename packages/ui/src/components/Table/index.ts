import React from 'react';

// Stub Table components for admin-web compatibility
export const Table = ({ children, className, ...props }: any) => {
  return React.createElement('table', { className, ...props }, children);
};
export const TableBody = ({ children, className, ...props }: any) => {
  return React.createElement('tbody', { className, ...props }, children);
};
export const TableCell = ({ children, className, ...props }: any) => {
  return React.createElement('td', { className, ...props }, children);
};
export const TableHead = ({ children, className, ...props }: any) => {
  return React.createElement('th', { className, ...props }, children);
};
export const TableHeader = ({ children, className, ...props }: any) => {
  return React.createElement('thead', { className, ...props }, children);
};
export const TableRow = ({ children, className, ...props }: any) => {
  return React.createElement('tr', { className, ...props }, children);
};

