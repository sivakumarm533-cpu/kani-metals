/**
 * Application features an administrator can switch on or off for regular users.
 * Administrators and sub-admins always have every feature.
 * Keep the keys in sync with frontend/src/config/navigation.js.
 */
export const FEATURE_KEYS = ['inventory', 'itemEntry', 'dealerPayments', 'billComparison', 'itemPrices']

/** Screens in the main menu, in their default order. Admins can reorder them. */
export const MENU_KEYS = ['dashboard', 'itemEntry', 'dealerPayments', 'itemPrices', 'billComparison', 'inventory']

/** Dashboard sections a user can hide. Keep in sync with DASHBOARD_WIDGETS in frontend/src/pages/Dashboard.jsx. */
export const DASHBOARD_WIDGETS = ['pendingCard', 'paidCard', 'billedCard', 'lowStockCard', 'pendingDealers', 'rateUpdates', 'quickActions']

/** Screens a user can pin to the mobile bottom bar. */
export const BOTTOM_NAV_KEYS = ['dashboard', ...FEATURE_KEYS, 'profile', 'settings']
export const DEFAULT_BOTTOM_NAV = ['dashboard', 'itemEntry', 'dealerPayments', 'profile']
export const BOTTOM_NAV_MAX = 4
export const NAV_STYLES = ['light', 'color', 'dark']

export const ROLES = ['admin', 'subadmin', 'user']
/** Roles that can open Settings and manage the team. */
export const isManagerRole = (role) => role === 'admin' || role === 'subadmin'
