import { useEffect, useState } from 'react'
import { apiRequest } from '../services/api.js'

function Dashboard() {
  const [products, setProducts] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    apiRequest('/products')
      .then(setProducts)
      .catch((requestError) => setError(requestError.message))
  }, [])

  const lowStockCount = products.filter((product) => product.quantity <= 10).length
  const inStockCount = products.length - lowStockCount

  return (
    <section className="page-container">
      <p className="eyebrow">OVERVIEW</p>
      <h1>Dashboard</h1>
      <p className="page-description">Welcome to your Kani Metals admin panel. Here is a quick look at your store.</p>
      {error && <p className="api-error" role="alert">{error}. Make sure MongoDB and the backend server are running.</p>}
      <div className="row g-3 mt-2">
        <div className="col-12 col-md-4"><article className="summary-card"><span className="summary-icon">â–¤</span><p>Total products</p><strong>{products.length}</strong><small>Products in your catalog</small></article></div>
        <div className="col-12 col-md-4"><article className="summary-card"><span className="summary-icon">â—·</span><p>Low stock</p><strong>{lowStockCount}</strong><small>Items to review soon</small></article></div>
        <div className="col-12 col-md-4"><article className="summary-card"><span className="summary-icon">âœ“</span><p>In stock</p><strong>{inStockCount}</strong><small>Items currently available</small></article></div>
      </div>
      <article className="dashboard-card mt-4">
        <h2>Getting started</h2>
        <p>Use the menu on the left to view your inventory or browse and manage your products.</p>
      </article>
    </section>
  )
}

export default Dashboard
