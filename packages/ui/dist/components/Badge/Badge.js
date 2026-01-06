'use client';
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { forwardRef } from 'react';
const variantStyles = {
    default: 'bg-gray-100 text-gray-700',
    primary: 'bg-primary-50 text-primary',
    success: 'bg-green-light text-green',
    warning: 'bg-amber-100 text-amber-700',
    error: 'bg-red-100 text-error',
    info: 'bg-blue-light text-blue',
    purple: 'bg-purple-light text-purple',
};
const sizeStyles = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5',
};
const dotColors = {
    default: 'bg-gray-500',
    primary: 'bg-primary',
    success: 'bg-green',
    warning: 'bg-amber-500',
    error: 'bg-error',
    info: 'bg-blue',
    purple: 'bg-purple',
};
export const Badge = forwardRef(({ variant = 'default', size = 'md', dot = false, className = '', children, ...props }, ref) => {
    return (_jsxs("span", { ref: ref, className: `
          inline-flex items-center font-medium rounded-full
          ${variantStyles[variant]}
          ${sizeStyles[size]}
          ${className}
        `.trim().replace(/\s+/g, ' '), ...props, children: [dot && (_jsx("span", { className: `w-1.5 h-1.5 rounded-full mr-1.5 ${dotColors[variant]}` })), children] }));
});
Badge.displayName = 'Badge';
export default Badge;
