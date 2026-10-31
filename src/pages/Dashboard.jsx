function Dashboard() {
  return (
    <section className="page-container">
      <p className="eyebrow">OVERVIEW</p>
      <h1>Dashboard</h1>
      <p className="page-description">Welcome to your Kani Metals admin panel. Here is a quick look at your store.</p>
      <div className="row g-3 mt-2">
        <div className="col-12 col-md-4"><article className="summary-card"><span className="summary-icon">▤</span><p>Total products</p><strong>24</strong><small>Products in your catalog</small></article></div>
        <div className="col-12 col-md-4"><article className="summary-card"><span className="summary-icon">◷</span><p>Low stock</p><strong>3</strong><small>Items to review soon</small></article></div>
        <div className="col-12 col-md-4"><article className="summary-card"><span className="summary-icon">✓</span><p>In stock</p><strong>21</strong><small>Items currently available</small></article></div>
      </div>
      <article className="dashboard-card mt-4">
        <h2>Getting started</h2>
        <p>Use the menu on the left to view your inventory or browse and manage your products.</p>
      </article>
    </section>
  )
}

export default Dashboard
