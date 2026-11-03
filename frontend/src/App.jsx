import { lazy, Suspense, useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext.jsx'
import RequireAuth from './components/RequireAuth.jsx'
import Navbar from './components/Navbar.jsx'
import Sidebar from './components/Sidebar.jsx'
import PageLoader from './components/PageLoader.jsx'
import { useMediaQuery } from './hooks/useMediaQuery.js'
import { AppSettingsProvider } from './settings/AppSettingsProvider.jsx'
import './App.css'
import './components/component.css'
import './pages/pages.css'
import './styles/system.css'
import './styles/features.css'

// Pages are split into separate chunks so the first load only downloads what is shown.
const Dashboard = lazy(() => import('./pages/Dashboard.jsx'))
const Inventory = lazy(() => import('./pages/Inventory.jsx'))
const Products = lazy(() => import('./pages/Products.jsx'))
const Cards = lazy(() => import('./pages/Cards.jsx'))
const Itemsentry = lazy(() => import('./pages/Itemsentry.jsx'))
const DealerBills = lazy(() => import('./pages/DealerBills.jsx'))
const Login = lazy(() => import('./pages/Login.jsx'))
const AdminSignup = lazy(() => import('./pages/AdminSignup.jsx'))
const Settings = lazy(() => import('./pages/Settings.jsx'))
const BillComparison = lazy(() => import('./pages/BillComparison.jsx'))
const BillComparisonProduct = lazy(() => import('./pages/BillComparisonProduct.jsx'))
const DealerPayments = lazy(() => import('./pages/DealerPayments.jsx'))
const ThemeSettings = lazy(() => import('./pages/ThemeSettings.jsx'))
const BillSettings = lazy(() => import('./pages/BillSettings.jsx'))

const DESKTOP_QUERY = '(min-width: 961px)'

function AppLayout() {
  const location = useLocation()
  const isDesktop = useMediaQuery(DESKTOP_QUERY)
  // Desktop starts with the sidebar open; small screens start with the drawer closed.
  const [desktopOpen, setDesktopOpen] = useState(true)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const sidebarOpen = isDesktop ? desktopOpen : drawerOpen

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

  return (
    <div className="admin-layout">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <Navbar sidebarOpen={sidebarOpen} onToggleSidebar={toggleSidebar} onNavigate={closeDrawer} />
      <div className="admin-body">
        <Sidebar isOpen={sidebarOpen} isDesktop={isDesktop} onNavigate={closeDrawer} />
        <main className="admin-content" id="main-content" tabIndex={-1}>
          <div className="page-transition" key={location.pathname}>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/inventory" element={<Inventory />} />
                <Route path="/products" element={<Products />} />
                <Route path="/scrap-items" element={<Cards />} />
                <Route path="/itemsentry" element={<Itemsentry />} />
                <Route path="/bill-comparison" element={<BillComparison />} />
                <Route path="/bill-comparison/product/:productKey" element={<BillComparisonProduct />} />
                <Route path="/dealer-payments" element={<DealerPayments />} />
                <Route path="/dealer-payments/:dealerId" element={<DealerPayments />} />
                <Route path="/dealers/:dealerId/bills" element={<DealerBills />} />
                <Route path="/settings/theme" element={<RequireAuth adminOnly><ThemeSettings /></RequireAuth>} />
                <Route path="/settings/bill" element={<RequireAuth adminOnly><BillSettings /></RequireAuth>} />
                <Route path="/settings/*" element={<RequireAuth adminOnly><Settings /></RequireAuth>} />
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Routes>
            </Suspense>
          </div>
        </main>
      </div>
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
