'use client';
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { forwardRef, useState } from 'react';
const sizeStyles = {
    md: 'h-12 px-4 text-base rounded-xl',
    lg: 'h-14 px-5 text-lg rounded-2xl',
};
export const Input = forwardRef(({ label, error, hint, size = 'md', leftIcon, rightIcon, fullWidth = true, disabled, className = '', id, ...props }, ref) => {
    const [isFocused, setIsFocused] = useState(false);
    const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;
    const hasError = Boolean(error);
    const baseStyles = 'block border-2 bg-white text-gray-900 placeholder-gray-400 transition-all duration-200 ease-out focus:outline-none';
    const stateStyles = hasError
        ? 'border-error bg-red-50 focus:border-error focus:ring-2 focus:ring-error/20'
        : 'border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20';
    const disabledStyles = disabled
        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
        : '';
    return (_jsxs("div", { className: `${fullWidth ? 'w-full' : ''}`, children: [label && (_jsx("label", { htmlFor: inputId, className: "block text-sm font-medium text-gray-700 mb-1.5", children: label })), _jsxs("div", { className: "relative", children: [leftIcon && (_jsx("div", { className: "absolute left-4 top-1/2 -translate-y-1/2 text-gray-400", children: leftIcon })), _jsx("input", { ref: ref, id: inputId, disabled: disabled, onFocus: (e) => {
                            setIsFocused(true);
                            props.onFocus?.(e);
                        }, onBlur: (e) => {
                            setIsFocused(false);
                            props.onBlur?.(e);
                        }, className: `
              ${baseStyles}
              ${stateStyles}
              ${disabledStyles}
              ${sizeStyles[size]}
              ${leftIcon ? 'pl-12' : ''}
              ${rightIcon ? 'pr-12' : ''}
              ${fullWidth ? 'w-full' : ''}
              ${className}
            `.trim().replace(/\s+/g, ' '), ...props }), rightIcon && (_jsx("div", { className: "absolute right-4 top-1/2 -translate-y-1/2 text-gray-400", children: rightIcon }))] }), (error || hint) && (_jsx("p", { className: `mt-1.5 text-sm ${hasError ? 'text-error' : 'text-gray-500'}`, children: error || hint }))] }));
});
Input.displayName = 'Input';
export default Input;
