import { useEffect, useState } from 'react'
import { apiRequest } from '../services/api.js'

function Inventory() {
  const [stockItems, setStockItems] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    apiRequest('/products')
      .then((products) => setStockItems(products.map((product) => ({
        ...product,
        status: product.quantity <= 10 ? 'Low stock' : 'In stock',
      }))))
      .catch((requestError) => setError(requestError.message))
  }, [])

  return (
    <section className="page-container">
      <p className="eyebrow">STOCK MANAGEMENT</p>
      <h1>Inventory</h1>
      <p className="page-description">Check current quantities and see which materials need attention.</p>
      {error && <p className="api-error" role="alert">{error}. Make sure MongoDB and the backend server are running.</p>}
      <div className="table-responsive inventory-table-wrap">
        <table className="table align-middle inventory-table">
          <thead><tr><th>Material</th><th>Item code</th><th>Quantity</th><th>Status</th></tr></thead>
          <tbody>
            {stockItems.map((item) => (
              <tr key={item._id}>
                <td className="fw-semibold">{item.name}</td>
                <td>{item.code || item._id.slice(-6).toUpperCase()}</td>
                <td>{item.quantity} {item.unit}</td>
                <td><span className={`stock-pill${item.status === 'Low stock' ? ' is-low' : ''}`}>{item.status}</span></td>
              </tr>
            ))}
            {stockItems.length === 0 && !error && <tr><td colSpan="4" className="text-center py-4">No inventory items saved yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export default Inventory
