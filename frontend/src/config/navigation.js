/**
 * Single list of the application's screens. The sidebar, the mobile bottom bar,
 * the route guards and the Feature access settings all read from here.
 * `feature` keys must match backend/config/features.js.
 */
export const NAV_ITEMS = [
  { key: 'dashboard', to: '/dashboard', icon: 'bi-house-door', activeIcon: 'bi-house-door-fill', label: 'Home', fullLabel: 'Dashboard', description: 'Pending payments and latest rates at a glance' },
  { key: 'itemEntry', to: '/itemsentry', icon: 'bi-receipt-cutoff', activeIcon: 'bi-receipt-cutoff', label: 'New bill', fullLabel: 'Item entry', description: 'Add dealers and create purchase bills', feature: 'itemEntry', match: ['/itemsentry', '/dealers/'] },
  { key: 'dealerPayments', to: '/dealer-payments', icon: 'bi-wallet2', activeIcon: 'bi-wallet-fill', label: 'Payments', fullLabel: 'Dealer payments', description: 'Record and track money paid to dealers', feature: 'dealerPayments' },
  { key: 'itemPrices', to: '/item-prices', icon: 'bi-currency-rupee', activeIcon: 'bi-currency-rupee', label: 'Prices', fullLabel: 'Item prices', description: 'Latest price of every item from dealer bills', feature: 'itemPrices' },
  { key: 'billComparison', to: '/bill-comparison', icon: 'bi-arrow-left-right', activeIcon: 'bi-arrow-left-right', label: 'Compare', fullLabel: 'Bill comparison', description: 'Compare two bills from the same dealer', feature: 'billComparison' },
  { key: 'inventory', to: '/inventory', icon: 'bi-boxes', activeIcon: 'bi-boxes', label: 'Stock', fullLabel: 'Inventory', description: 'Current stock of every item', feature: 'inventory' },
  { key: 'products', to: '/products', icon: 'bi-tags', activeIcon: 'bi-tags-fill', label: 'Products', fullLabel: 'Products', description: 'Product list and prices', feature: 'products' },
  { key: 'scrapItems', to: '/scrap-items', icon: 'bi-recycle', activeIcon: 'bi-recycle', label: 'Scrap', fullLabel: 'Scrap items', description: 'Scrap material catalogue', feature: 'scrapItems' },
]

export const PROFILE_ITEM = { key: 'profile', to: '/profile', icon: 'bi-person', activeIcon: 'bi-person-fill', label: 'Profile', fullLabel: 'My profile', description: 'Your account, appearance and sign out' }
export const SETTINGS_ITEM = { key: 'settings', to: '/settings/users', icon: 'bi-gear', activeIcon: 'bi-gear-fill', label: 'Settings', fullLabel: 'Settings', description: 'Team, features and workspace settings', managerOnly: true, match: ['/settings'] }

/** Everything a user may pin to the bottom bar. */
export const BOTTOM_NAV_CHOICES = [...NAV_ITEMS, PROFILE_ITEM, SETTINGS_ITEM]
export const DEFAULT_BOTTOM_NAV = ['dashboard', 'itemEntry', 'dealerPayments', 'profile']
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
  return features?.[item.feature] !== false
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
