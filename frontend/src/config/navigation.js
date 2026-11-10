/**
 * Single list of the application's screens. The sidebar, the mobile bottom bar,
 * the route guards and the Feature access settings all read from here.
 * `feature` keys must match backend/config/features.js.
 */
export const NAV_ITEMS = [
  { key: 'dashboard', to: '/dashboard', icon: 'bi-house-door', activeIcon: 'bi-house-door-fill', label: 'Home', fullLabel: 'Dashboard', description: 'Pending payments and latest rates at a glance' },
  { key: 'itemEntry', to: '/itemsentry', icon: 'bi-receipt-cutoff', activeIcon: 'bi-receipt-cutoff', label: 'Bills', fullLabel: 'Item entry', description: 'Add dealers and create purchase bills', feature: 'itemEntry', match: ['/itemsentry', '/dealers/'] },
  { key: 'dealerPayments', to: '/dealer-payments', icon: 'bi-wallet2', activeIcon: 'bi-wallet-fill', label: 'Payments', fullLabel: 'Dealer payments', description: 'Record and track money paid to dealers', feature: 'dealerPayments' },
  { key: 'itemPrices', to: '/item-prices', icon: 'bi-currency-rupee', activeIcon: 'bi-currency-rupee', label: 'Prices', fullLabel: 'Item prices', description: 'Latest price of every item from dealer bills', feature: 'itemPrices' },
  { key: 'billComparison', to: '/bill-comparison', icon: 'bi-arrow-left-right', activeIcon: 'bi-arrow-left-right', label: 'Compare', fullLabel: 'Bill comparison', description: 'Compare two bills from the same dealer', feature: 'billComparison' },
  { key: 'inventory', to: '/inventory', icon: 'bi-boxes', activeIcon: 'bi-boxes', label: 'Stock', fullLabel: 'Inventory', description: 'Current stock of every item', feature: 'inventory' },
]

export const PROFILE_ITEM = { key: 'profile', to: '/profile', icon: 'bi-person', activeIcon: 'bi-person-fill', label: 'Profile', fullLabel: 'My profile', description: 'Your account, appearance and sign out' }
export const SETTINGS_ITEM = { key: 'settings', to: '/settings/users', icon: 'bi-gear', activeIcon: 'bi-gear-fill', label: 'Settings', fullLabel: 'Settings', description: 'Team, features and workspace settings', managerOnly: true, match: ['/settings'] }

/** Main menu items in the workspace's saved order; unknown keys are ignored and missing items keep their default place at the end. */
export function orderNavItems(order) {
  const keys = Array.isArray(order) ? order : []
  const ordered = keys.map((key) => NAV_ITEMS.find((item) => item.key === key)).filter(Boolean)
  return [...new Set([...ordered, ...NAV_ITEMS])]
}

/** Everything a user may pin to the bottom bar. */
export const BOTTOM_NAV_CHOICES = [...NAV_ITEMS, PROFILE_ITEM, SETTINGS_ITEM]
// Phone bottom bar: Home, Bills, Payments, Stock (+ More). People can still choose their own.
export const DEFAULT_BOTTOM_NAV = ['dashboard', 'itemEntry', 'dealerPayments', 'inventory']
export const BOTTOM_NAV_MAX = 4
export const NAV_STYLES = [
  { id: 'light', name: 'Light', description: 'White bar, coloured highlight' },
  { id: 'color', name: 'Colour', description: 'Bar in your theme colour' },
  { id: 'dark', name: 'Dark', description: 'Dark bar, glowing highlight' },
]

/** Features an administrator can switch off for regular users. */
export const FEATURE_ITEMS = NAV_ITEMS.filter((item) => item.feature)

export const SETTINGS_ITEMS = [
  { to: '/settings/users', icon: 'bi-people', label: 'Users & roles', description: 'Add people, make sub-admins' },
  { to: '/settings/features', icon: 'bi-toggles', label: 'Feature access', description: 'Choose what users can open' },
  { to: '/settings/activity', icon: 'bi-clock-history', label: 'User activity', description: 'Who changed what, and when' },
  { to: '/settings/menu', icon: 'bi-list-ol', label: 'Menu order', description: 'Arrange the main menu' },
  { to: '/settings/theme', icon: 'bi-palette', label: 'Workspace theme', description: 'Default colours for everyone' },
  { to: '/settings/bill', icon: 'bi-receipt', label: 'Bill settings', description: 'Business details on bills' },
  { to: '/settings/backup', icon: 'bi-database-down', label: 'Database backup', description: 'Export or restore records', primaryOnly: true },
]

export const isManager = (user) => user?.role === 'admin' || user?.role === 'subadmin'
export const roleLabel = (role) => (role === 'admin' ? 'Administrator' : role === 'subadmin' ? 'Sub-admin' : 'Team member')

/** True when `user` may open the screen. Managers always can. */
export function canUseItem(item, user, features) {
  if (!item) return false
  if (item.managerOnly) return isManager(user)
  if (!item.feature || isManager(user)) return true
  return featureAllowed(item.feature, user?.featureAccess, features)
}

/** A per-person setting (set by an admin) wins; otherwise the workspace Feature access applies. */
export function featureAllowed(feature, featureAccess, features) {
  const own = featureAccess?.[feature]
  if (typeof own === 'boolean') return own
  return features?.[feature] !== false
}

export function itemIsActive(item, pathname) {
  const prefixes = item.match || [item.to]
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(prefix.endsWith('/') ? prefix : `${prefix}/`))
}

/** The bottom bar items this user will actually see, in their chosen order. */
export function bottomNavItems(keys, user, features) {
  const chosen = (Array.isArray(keys) && keys.length ? keys : DEFAULT_BOTTOM_NAV)
    .map((key) => BOTTOM_NAV_CHOICES.find((item) => item.key === key))
    .filter((item) => canUseItem(item, user, features))
  return chosen.slice(0, BOTTOM_NAV_MAX)
}

/**
 * Title, breadcrumb trail and "back" target for a route. Used by the desktop
 * breadcrumbs and the phone header (title + back arrow on inner screens).
 */
export function routeMeta(pathname) {
  const home = { label: 'Dashboard', to: '/dashboard' }
  const settingsItem = SETTINGS_ITEMS.find((item) => pathname === item.to || pathname.startsWith(`${item.to}/`))
  if (settingsItem) return { title: settingsItem.label, crumbs: [home, { label: 'Settings', to: '/settings/users' }, { label: settingsItem.label }], back: null }
  if (pathname.startsWith('/dealer-payments/')) return { title: 'Dealer account', crumbs: [home, { label: 'Dealer payments', to: '/dealer-payments' }, { label: 'Dealer account' }], back: '/dealer-payments' }
  if (pathname.startsWith('/dealers/')) return { title: 'Bill history', crumbs: [home, { label: 'Item entry', to: '/itemsentry' }, { label: 'Bill history' }], back: '/itemsentry' }
  if (pathname.startsWith('/bill-comparison/product/')) return { title: 'Item comparison', crumbs: [home, { label: 'Bill comparison', to: '/bill-comparison' }, { label: 'Item comparison' }], back: -1 }
  if (pathname === '/profile') return { title: 'My profile', crumbs: [home, { label: 'My profile' }], back: null }
  const item = NAV_ITEMS.find((entry) => itemIsActive(entry, pathname))
  if (!item || item.key === 'dashboard') return { title: 'Dashboard', crumbs: [{ label: 'Dashboard' }], back: null }
  return { title: item.fullLabel, crumbs: [home, { label: item.fullLabel }], back: null }
}
