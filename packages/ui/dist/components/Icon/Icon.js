'use client';
import { jsx as _jsx } from "react/jsx-runtime";
import { forwardRef } from 'react';
const sizeStyles = {
    xs: 'text-base', // 16px
    sm: 'text-lg', // 18px
    md: 'text-2xl', // 24px
    lg: 'text-3xl', // 30px
    xl: 'text-4xl', // 36px
};
const sizeMap = {
    xs: 16,
    sm: 18,
    md: 24,
    lg: 30,
    xl: 36,
};
/**
 * Icon component using Material Symbols
 *
 * Usage:
 * <Icon name="home" size="md" />
 * <Icon name="favorite" filled />
 *
 * Requires Material Symbols font to be loaded in globals.css:
 * @import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@24,400,0,0');
 */
export const Icon = forwardRef(({ name, size = 'md', filled = false, className = '', style, ...props }, ref) => {
    return (_jsx("span", { ref: ref, className: `
          material-symbols-rounded
          ${sizeStyles[size]}
          inline-block align-middle select-none
          ${className}
        `.trim().replace(/\s+/g, ' '), style: {
            fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' 400, 'GRAD' 0, 'opsz' ${sizeMap[size]}`,
            ...style,
        }, "aria-hidden": "true", ...props, children: name }));
});
Icon.displayName = 'Icon';
export default Icon;
