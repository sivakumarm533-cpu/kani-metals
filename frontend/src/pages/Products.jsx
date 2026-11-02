import { useEffect, useState } from 'react'
import { apiRequest } from '../services/api.js'

function Products() {
  const [products, setProducts] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    apiRequest('/products')
      .then(setProducts)
      .catch((requestError) => setError(requestError.message))
  }, [])

  return (
    <section className="page-container">
      <p className="eyebrow">CATALOG</p>
      <h1>Products</h1>
      <p className="page-description">Browse the materials listed in your Kani Metals catalog.</p>
      {error && <p className="api-error" role="alert">{error}. Make sure MongoDB and the backend server are running.</p>}
      <div className="product-list">
        {products.map((product) => (
          <article className="product-row" key={product._id}>
            <div className="product-symbol" aria-hidden="true">â—ˆ</div>
            <div className="product-info">
              <h2>{product.name}</h2>
              <p>{product.category}{product.code ? ` Â· ${product.code}` : ''}</p>
            </div>
            <strong className="product-price">₹{Number(product.price).toLocaleString('en-IN')} / {product.unit}</strong>
          </article>
        ))}
      </div>
      {!error && products.length === 0 && <p className="page-description">No products saved yet.</p>}
    </section>
  )
}

export default Products
