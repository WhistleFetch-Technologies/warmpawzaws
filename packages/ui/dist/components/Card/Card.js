'use client';
import { jsx as _jsx } from "react/jsx-runtime";
import { forwardRef } from 'react';
const variantStyles = {
    default: 'bg-white shadow-card',
    outlined: 'bg-white border border-gray-200',
    elevated: 'bg-white shadow-lg',
    interactive: 'bg-white shadow-card hover:shadow-cardHover transition-shadow duration-200 cursor-pointer',
};
const paddingStyles = {
    none: 'p-0',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
};
const roundedStyles = {
    md: 'rounded-lg',
    lg: 'rounded-xl',
    xl: 'rounded-2xl',
    '2xl': 'rounded-3xl',
    '3xl': 'rounded-[32px]',
};
export const Card = forwardRef(({ variant = 'default', padding = 'md', rounded = 'xl', className = '', children, ...props }, ref) => {
    return (_jsx("div", { ref: ref, className: `
          ${variantStyles[variant]}
          ${paddingStyles[padding]}
          ${roundedStyles[rounded]}
          ${className}
        `.trim().replace(/\s+/g, ' '), ...props, children: children }));
});
Card.displayName = 'Card';
// Sub-components
export const CardHeader = forwardRef(({ className = '', children, ...props }, ref) => (_jsx("div", { ref: ref, className: `mb-4 ${className}`, ...props, children: children })));
CardHeader.displayName = 'CardHeader';
export const CardTitle = forwardRef(({ className = '', children, ...props }, ref) => (_jsx("h3", { ref: ref, className: `text-xl font-bold text-gray-900 ${className}`, ...props, children: children })));
CardTitle.displayName = 'CardTitle';
export const CardContent = forwardRef(({ className = '', children, ...props }, ref) => (_jsx("div", { ref: ref, className: className, ...props, children: children })));
CardContent.displayName = 'CardContent';
export const CardFooter = forwardRef(({ className = '', children, ...props }, ref) => (_jsx("div", { ref: ref, className: `mt-4 pt-4 border-t border-gray-100 ${className}`, ...props, children: children })));
CardFooter.displayName = 'CardFooter';
export default Card;
