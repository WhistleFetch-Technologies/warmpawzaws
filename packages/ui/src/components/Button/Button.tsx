'use client';

import React, { forwardRef, ButtonHTMLAttributes } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'xl';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-white hover:bg-primary-dark active:bg-primary-dark shadow-primary hover:shadow-primaryHover disabled:bg-gray-200 disabled:text-gray-400 disabled:shadow-none',
  secondary: 'bg-white text-primary border-2 border-primary hover:bg-primary-50 active:bg-primary-100 disabled:border-gray-200 disabled:text-gray-400',
  outline: 'bg-transparent text-gray-900 border-2 border-gray-200 hover:bg-gray-50 hover:border-gray-300 active:bg-gray-100 disabled:text-gray-400',
  ghost: 'bg-transparent text-primary hover:bg-primary-50 active:bg-primary-100 disabled:text-gray-400',
  danger: 'bg-error text-white hover:bg-red-600 active:bg-red-700 disabled:bg-gray-200 disabled:text-gray-400',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'h-8 px-4 text-sm rounded-lg',
  md: 'h-11 px-6 text-base rounded-xl',
  lg: 'h-13 px-8 text-lg rounded-xl',
  xl: 'h-14 px-10 text-lg rounded-2xl',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      fullWidth = false,
      disabled,
      className = '',
      children,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || isLoading;

    const baseStyles = 'inline-flex items-center justify-center font-semibold transition-all duration-200 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2';

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        className={`
          ${baseStyles}
          ${variantStyles[variant]}
          ${sizeStyles[size]}
          ${fullWidth ? 'w-full' : ''}
          ${isDisabled ? 'cursor-not-allowed' : 'cursor-pointer'}
          ${className}
        `.trim().replace(/\s+/g, ' ')}
        {...props}
      >
        {isLoading ? (
          <>
            <svg
              className="animate-spin -ml-1 mr-2 h-5 w-5"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Loading...
          </>
        ) : (
          <>
            {leftIcon && <span className="mr-2 -ml-1">{leftIcon}</span>}
            {children}
            {rightIcon && <span className="ml-2 -mr-1">{rightIcon}</span>}
          </>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';

export default Button;

