import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
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
            <Route path="/dealers/:dealerId/bills" element={<DealerBills />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}

function App() {
  return <BrowserRouter><AppLayout /></BrowserRouter>
}

export default App
