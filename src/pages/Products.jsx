const products = [
  { name: 'Copper Sheet', category: 'Copper', price: '₹ 720 / kg', code: 'COP-001' },
  { name: 'Mild Steel Rod', category: 'Steel', price: '₹ 86 / kg', code: 'STL-014' },
  { name: 'Aluminium Coil', category: 'Aluminium', price: '₹ 245 / kg', code: 'ALU-006' },
]

function Products() {
  return (
    <section className="page-container">
      <p className="eyebrow">CATALOG</p>
      <h1>Products</h1>
      <p className="page-description">Browse the materials listed in your Kani Metals catalog.</p>
      <div className="product-list">
        {products.map((product) => (
          <article className="product-row" key={product.code}>
            <div className="product-symbol" aria-hidden="true">◈</div>
            <div className="product-info"><h2>{product.name}</h2><p>{product.category} · {product.code}</p></div>
            <strong className="product-price">{product.price}</strong>
          </article>
        ))}
      </div>
    </section>
  )
}

export default Products
