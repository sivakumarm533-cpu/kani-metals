import { useProducts } from '../hooks/useProducts.js'
import LoadError from '../components/LoadError.jsx'
import { formatRupees } from '../utils/format.js'

function Products() {
  const { products, loading, error, retry } = useProducts()

  return (
    <section className="page-container">
      <header className="page-header">
        <div>
          <p className="eyebrow">CATALOG</p>
          <h1 className="page-title">Products</h1>
          <p className="page-description">Browse the materials listed in your Kani Metals catalog.</p>
        </div>
      </header>
      <LoadError message={error} onRetry={retry} />
      <div className="product-list">
        {loading && Array.from({ length: 4 }, (_, index) => <div className="skeleton skeleton-row" key={index} />)}
        {!loading && products.map((product) => (
          <article className="product-row" key={product._id}>
            <div className="product-symbol" aria-hidden="true">
              {product.image ? <img src={product.image} alt="" /> : <i className="bi bi-tag" />}
            </div>
            <div className="product-info">
              <h2>{product.name}</h2>
              <p>{product.category}{product.code ? ` · ${product.code}` : ''}</p>
            </div>
            <strong className="product-price">{formatRupees(product.price)} <small>/ {product.unit}</small></strong>
          </article>
        ))}
      </div>
      {!loading && !error && products.length === 0 && (
        <div className="empty-state empty-state-panel"><i className="bi bi-tags" aria-hidden="true" /><strong>No products saved yet</strong><span>Products added to the catalog will be listed here.</span></div>
      )}
    </section>
  )
}

export default Products
