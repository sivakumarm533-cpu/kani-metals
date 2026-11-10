import { lazy, Suspense, useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext.jsx'
import { useAuth } from './auth/authContextValue.js'
import RequireAuth from './components/RequireAuth.jsx'
import AppHeader from './components/AppHeader.jsx'
import MobileMoreMenu from './components/MobileMoreMenu.jsx'
import Sidebar from './components/Sidebar.jsx'
import BottomNav from './components/BottomNav.jsx'
import PageLoader from './components/PageLoader.jsx'
import { useMediaQuery } from './hooks/useMediaQuery.js'
import { AppSettingsProvider } from './settings/AppSettingsProvider.jsx'
import { useAppSettings } from './settings/appSettingsContext.js'
import { bottomNavItems, canUseItem, NAV_ITEMS } from './config/navigation.js'
import './App.css'
import './components/component.css'
import './pages/pages.css'
import './styles/system.css'
import './styles/features.css'
import './styles/navigation.css'
import './styles/app-shell.css'
import './styles/mobile-typography.css'

// Pages are split into separate chunks so the first load only downloads what is shown.
const pageImports = {
  Dashboard: () => import('./pages/Dashboard.jsx'),
  Inventory: () => import('./pages/Inventory.jsx'),
  ItemPrices: () => import('./pages/ItemPrices.jsx'),
  Itemsentry: () => import('./pages/Itemsentry.jsx'),
  DealerBills: () => import('./pages/DealerBills.jsx'),
  Settings: () => import('./pages/Settings.jsx'),
  BillComparison: () => import('./pages/BillComparison.jsx'),
  BillComparisonProduct: () => import('./pages/BillComparisonProduct.jsx'),
  DealerPayments: () => import('./pages/DealerPayments.jsx'),
  ThemeSettings: () => import('./pages/ThemeSettings.jsx'),
  BillSettings: () => import('./pages/BillSettings.jsx'),
  FeatureSettings: () => import('./pages/FeatureSettings.jsx'),
  MenuSettings: () => import('./pages/MenuSettings.jsx'),
  Profile: () => import('./pages/Profile.jsx'),
}
const Dashboard = lazy(pageImports.Dashboard)
const Inventory = lazy(pageImports.Inventory)
const ItemPrices = lazy(pageImports.ItemPrices)
const Itemsentry = lazy(pageImports.Itemsentry)
const DealerBills = lazy(pageImports.DealerBills)
const Settings = lazy(pageImports.Settings)
const BillComparison = lazy(pageImports.BillComparison)
const BillComparisonProduct = lazy(pageImports.BillComparisonProduct)
const DealerPayments = lazy(pageImports.DealerPayments)
const ThemeSettings = lazy(pageImports.ThemeSettings)
const BillSettings = lazy(pageImports.BillSettings)
const FeatureSettings = lazy(pageImports.FeatureSettings)
const MenuSettings = lazy(pageImports.MenuSettings)
const Profile = lazy(pageImports.Profile)
const Login = lazy(() => import('./pages/Login.jsx'))
const AdminSignup = lazy(() => import('./pages/AdminSignup.jsx'))

const DESKTOP_QUERY = '(min-width: 961px)'
const PHONE_QUERY = '(max-width: 720px)'

/** Downloads the other pages while the browser is idle so moving between screens is instant. */
function usePrefetchPages() {
  useEffect(() => {
    const idle = window.requestIdleCallback || ((callback) => window.setTimeout(callback, 1200))
    const cancel = window.cancelIdleCallback || window.clearTimeout
    const handle = idle(() => { Object.values(pageImports).forEach((load) => { load().catch(() => {}) }) })
    return () => cancel(handle)
  }, [])
}

/** Sends people away from a screen the administrator has switched off for them. */
function FeatureRoute({ feature, children }) {
  const { user } = useAuth()
  const { features } = useAppSettings()
  const item = NAV_ITEMS.find((entry) => entry.key === feature)
  if (!canUseItem(item, user, features)) return <Navigate to="/dashboard" replace state={{ blockedFeature: item?.fullLabel }} />
  return children
}

function AppLayout() {
  const location = useLocation()
  const { user } = useAuth()
  const { features } = useAppSettings()
  const isDesktop = useMediaQuery(DESKTOP_QUERY)
  const isPhone = useMediaQuery(PHONE_QUERY)
  // Desktop starts with the sidebar open; small screens start with the drawer closed.
  const [desktopOpen, setDesktopOpen] = useState(true)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const sidebarOpen = isDesktop ? desktopOpen : drawerOpen
  const quickItems = bottomNavItems(user?.preferences?.bottomNav, user, features)
  const navStyle = user?.preferences?.navStyle || 'light'
  usePrefetchPages()

  function toggleSidebar() {
    if (isDesktop) setDesktopOpen((open) => !open)
    else setDrawerOpen((open) => !open)
  }

  function closeDrawer() { setDrawerOpen(false) }

  useEffect(() => {
    // Close the mobile drawer with Escape and stop the page behind it from scrolling.
    if (isDesktop || !drawerOpen) return undefined
    const handleKeyDown = (event) => { if (event.key === 'Escape') setDrawerOpen(false) }
    document.addEventListener('keydown', handleKeyDown)
    document.body.classList.add('drawer-open')
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.classList.remove('drawer-open')
    }
  }, [isDesktop, drawerOpen])

  // Moving to another screen closes the mobile menu.
  const [lastPath, setLastPath] = useState(location.pathname)
  if (lastPath !== location.pathname) { setLastPath(location.pathname); if (drawerOpen) setDrawerOpen(false); if (moreOpen) setMoreOpen(false) }

  return (
    <div className={`admin-layout${isPhone ? ' has-bottom-nav is-phone' : ''}${isDesktop && !desktopOpen ? ' is-sidebar-collapsed' : ''}`}>
      <a className="skip-link" href="#main-content">Skip to content</a>
      <AppHeader isPhone={isPhone} isDesktop={isDesktop} sidebarOpen={sidebarOpen} onToggleSidebar={toggleSidebar} onNavigate={closeDrawer} />
      <div className="admin-body">
        {/* Phones use the bottom bar and the More sheet instead of the side menu. */}
        {!isPhone && <Sidebar isOpen={sidebarOpen} isDesktop={isDesktop} onNavigate={closeDrawer} />}
        <main className="admin-content" id="main-content" tabIndex={-1}>
          <div className="page-transition" key={location.pathname}>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/inventory" element={<FeatureRoute feature="inventory"><Inventory /></FeatureRoute>} />
                <Route path="/item-prices" element={<FeatureRoute feature="itemPrices"><ItemPrices /></FeatureRoute>} />
                <Route path="/itemsentry" element={<FeatureRoute feature="itemEntry"><Itemsentry /></FeatureRoute>} />
                <Route path="/bill-comparison" element={<FeatureRoute feature="billComparison"><BillComparison /></FeatureRoute>} />
                <Route path="/bill-comparison/product/:productKey" element={<FeatureRoute feature="billComparison"><BillComparisonProduct /></FeatureRoute>} />
                <Route path="/dealer-payments" element={<FeatureRoute feature="dealerPayments"><DealerPayments /></FeatureRoute>} />
                <Route path="/dealer-payments/:dealerId" element={<FeatureRoute feature="dealerPayments"><DealerPayments /></FeatureRoute>} />
                <Route path="/dealers/:dealerId/bills" element={<FeatureRoute feature="itemEntry"><DealerBills /></FeatureRoute>} />
                <Route path="/settings/theme" element={<RequireAuth adminOnly><ThemeSettings /></RequireAuth>} />
                <Route path="/settings/bill" element={<RequireAuth adminOnly><BillSettings /></RequireAuth>} />
                <Route path="/settings/features" element={<RequireAuth adminOnly><FeatureSettings /></RequireAuth>} />
                <Route path="/settings/menu" element={<RequireAuth adminOnly><MenuSettings /></RequireAuth>} />
                <Route path="/settings/backup" element={<RequireAuth primaryOnly><Settings /></RequireAuth>} />
                <Route path="/settings/*" element={<RequireAuth adminOnly><Settings /></RequireAuth>} />
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Routes>
            </Suspense>
          </div>
        </main>
      </div>
      {isPhone && <BottomNav items={quickItems} navStyle={navStyle} moreOpen={moreOpen} onMore={() => setMoreOpen((open) => !open)} />}
      {isPhone && moreOpen && <MobileMoreMenu barKeys={quickItems.map((item) => item.key)} onClose={() => setMoreOpen(false)} />}
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={<PageLoader fullScreen />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<AdminSignup />} />
            <Route path="/*" element={<RequireAuth><AppSettingsProvider><AppLayout /></AppSettingsProvider></RequireAuth>} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
