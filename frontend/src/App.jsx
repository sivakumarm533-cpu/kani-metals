import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext.jsx'
import RequireAuth from './components/RequireAuth.jsx'
import Navbar from './components/Navbar.jsx'
import Sidebar from './components/Sidebar.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Inventory from './pages/Inventory.jsx'
import Products from './pages/Products.jsx'
import Cards from './pages/Cards.jsx'
import './App.css'
import './components/component.css'
import Itemsentry from './pages/Itemsentry.jsx'
import DealerBills from './pages/DealerBills.jsx'
import Login from './pages/Login.jsx'
import AdminSignup from './pages/AdminSignup.jsx'
import Settings from './pages/Settings.jsx'
import BillComparison from './pages/BillComparison.jsx'
import BillComparisonProduct from './pages/BillComparisonProduct.jsx'
import DealerPayments from './pages/DealerPayments.jsx'

function AppLayout() {
  return (
    <div className="admin-layout">
      <Navbar />
      <div className="admin-body">
        <Sidebar />
        <main className="admin-content">
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
            <Route path="/settings/*" element={<RequireAuth adminOnly><Settings /></RequireAuth>} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}

function App() {
  return <BrowserRouter><AuthProvider><Routes><Route path="/login" element={<Login />} /><Route path="/signup" element={<AdminSignup />} /><Route path="/*" element={<RequireAuth><AppLayout /></RequireAuth>} /></Routes></AuthProvider></BrowserRouter>
}

export default App
