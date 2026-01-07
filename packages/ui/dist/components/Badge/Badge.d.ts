import React, { HTMLAttributes } from 'react';
export type BadgeVariant = 'default' | 'primary' | 'success' | 'warning' | 'error' | 'info' | 'purple';
export type BadgeSize = 'sm' | 'md' | 'lg';
export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
    variant?: BadgeVariant;
    size?: BadgeSize;
    dot?: boolean;
}
export declare const Badge: React.ForwardRefExoticComponent<BadgeProps & React.RefAttributes<HTMLSpanElement>>;
export default Badge;
//# sourceMappingURL=Badge.d.ts.map