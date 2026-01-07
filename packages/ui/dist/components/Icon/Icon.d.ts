import React, { HTMLAttributes } from 'react';
export type IconSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type IconName = 'home' | 'search' | 'person' | 'settings' | 'notifications' | 'favorite' | 'favorite_border' | 'star' | 'star_border' | 'check' | 'close' | 'add' | 'remove' | 'edit' | 'delete' | 'visibility' | 'visibility_off' | 'arrow_back' | 'arrow_forward' | 'chevron_left' | 'chevron_right' | 'expand_more' | 'expand_less' | 'menu' | 'more_vert' | 'more_horiz' | 'local_hospital' | 'videocam' | 'content_cut' | 'bathtub' | 'school' | 'directions_walk' | 'hotel' | 'local_cafe' | 'medication' | 'science' | 'emergency' | 'shield' | 'restaurant' | 'inventory_2' | 'account_balance_wallet' | 'calendar_today' | 'analytics' | 'pets' | 'location_on' | 'phone' | 'email' | 'schedule' | 'payments' | 'receipt' | 'help' | 'info' | 'warning' | 'error' | 'check_circle' | 'cancel' | 'photo_camera' | 'image' | 'upload' | 'download' | 'share' | 'copy' | 'logout' | 'login' | string;
export interface IconProps extends HTMLAttributes<HTMLSpanElement> {
    name: IconName;
    size?: IconSize;
    filled?: boolean;
}
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
export declare const Icon: React.ForwardRefExoticComponent<IconProps & React.RefAttributes<HTMLSpanElement>>;
export default Icon;
//# sourceMappingURL=Icon.d.ts.map