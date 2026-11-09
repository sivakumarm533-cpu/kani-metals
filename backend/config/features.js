/**
 * Application features an administrator can switch on or off for regular users.
 * Administrators and sub-admins always have every feature.
 * Keep the keys in sync with frontend/src/config/navigation.js.
 */
export const FEATURE_KEYS = ['inventory', 'products', 'scrapItems', 'itemEntry', 'dealerPayments', 'billComparison', 'itemPrices']

/** Screens a user can pin to the mobile bottom bar. */
export const BOTTOM_NAV_KEYS = ['dashboard', ...FEATURE_KEYS, 'profile', 'settings']
export const DEFAULT_BOTTOM_NAV = ['dashboard', 'itemEntry', 'dealerPayments', 'profile']
export const BOTTOM_NAV_MAX = 4
export const NAV_STYLES = ['light', 'color', 'dark']

export const ROLES = ['admin', 'subadmin', 'user']
/** Roles that can open Settings and manage the team. */
export const isManagerRole = (role) => role === 'admin' || role === 'subadmin'
