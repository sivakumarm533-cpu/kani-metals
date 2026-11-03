import { LOW_STOCK_LIMIT, useProducts } from '../hooks/useProducts.js'
import LoadError from '../components/LoadError.jsx'

function Inventory() {
  const { products, loading, error, retry } = useProducts()

  return (
    <section className="page-container">
      <header className="page-header">
        <div>
          <p className="eyebrow">STOCK MANAGEMENT</p>
          <h1 className="page-title">Inventory</h1>
          <p className="page-description">Check current quantities and see which materials need attention.</p>
        </div>
      </header>
      <LoadError message={error} onRetry={retry} />
      <div className="table-responsive inventory-table-wrap">
        <table className="table align-middle inventory-table responsive-card-table">
          <thead><tr><th>Material</th><th>Item code</th><th>Quantity</th><th>Status</th></tr></thead>
          <tbody>
            {loading && Array.from({ length: 4 }, (_, index) => (
              <tr key={index} className="table-skeleton-row"><td colSpan="4"><span className="skeleton skeleton-line" /></td></tr>
            ))}
            {!loading && products.map((item) => {
              const low = item.quantity <= LOW_STOCK_LIMIT
              return (
                <tr key={item._id}>
                  <td data-label="Material" className="fw-semibold">{item.name}</td>
                  <td data-label="Item code">{item.code || String(item._id).slice(-6).toUpperCase()}</td>
                  <td data-label="Quantity">{item.quantity} {item.unit}</td>
                  <td data-label="Status"><span className={`stock-pill${low ? ' is-low' : ''}`}>{low ? 'Low stock' : 'In stock'}</span></td>
                </tr>
              )
            })}
            {!loading && !error && products.length === 0 && (
              <tr className="table-empty-row"><td colSpan="4"><div className="empty-state"><i className="bi bi-box-seam" aria-hidden="true" /><strong>No inventory items yet</strong><span>Products added to the catalog will appear here with their stock levels.</span></div></td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export default Inventory
