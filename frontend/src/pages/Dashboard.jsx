import { Link } from 'react-router-dom'
import { useAuth } from '../auth/authContextValue.js'
import { LOW_STOCK_LIMIT, useProducts } from '../hooks/useProducts.js'
import LoadError from '../components/LoadError.jsx'

const quickLinks = [
  { to: '/itemsentry', icon: 'bi-receipt-cutoff', title: 'Create a bill', text: 'Choose a dealer and enter purchased items.' },
  { to: '/dealer-payments', icon: 'bi-wallet2', title: 'Dealer payments', text: 'Record payments and follow up on balances.' },
  { to: '/bill-comparison', icon: 'bi-arrow-left-right', title: 'Compare bills', text: 'See price and quantity changes between bills.' },
  { to: '/inventory', icon: 'bi-boxes', title: 'Check inventory', text: 'Review stock levels and low-stock items.' },
]

function Dashboard() {
  const { user } = useAuth()
  const { products, loading, error, retry } = useProducts()
  const lowStockCount = products.filter((product) => product.quantity <= LOW_STOCK_LIMIT).length
  const inStockCount = products.length - lowStockCount
  const value = (count) => (loading ? <span className="skeleton skeleton-number" aria-label="Loading" /> : error ? '—' : count)

  const cards = [
    { icon: 'bi-tags', label: 'Total products', count: products.length, note: 'Products in your catalog' },
    { icon: 'bi-exclamation-triangle', label: 'Low stock', count: lowStockCount, note: `${LOW_STOCK_LIMIT} units or fewer`, tone: 'warning' },
    { icon: 'bi-check2-circle', label: 'In stock', count: inStockCount, note: 'Items currently available', tone: 'success' },
  ]

  return (
    <section className="page-container">
      <header className="page-header">
        <div>
          <p className="eyebrow">OVERVIEW</p>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-description">Welcome{user?.name ? `, ${user.name.split(' ')[0]}` : ''}. Here is a quick look at your store.</p>
        </div>
      </header>
      <LoadError message={error} onRetry={retry} />
      <div className="summary-grid">
        {cards.map((card) => (
          <article className={`summary-card${card.tone ? ` summary-card-${card.tone}` : ''}`} key={card.label}>
            <span className="summary-icon" aria-hidden="true"><i className={`bi ${card.icon}`} /></span>
            <p>{card.label}</p>
            <strong>{value(card.count)}</strong>
            <small>{card.note}</small>
          </article>
        ))}
      </div>
      <section className="dashboard-card">
        <h2>Quick actions</h2>
        <p>Jump straight to the tasks you use most.</p>
        <div className="quick-link-grid">
          {quickLinks.map((link) => (
            <Link className="quick-link" to={link.to} key={link.to}>
              <span className="quick-link-icon" aria-hidden="true"><i className={`bi ${link.icon}`} /></span>
              <span><strong>{link.title}</strong><small>{link.text}</small></span>
              <i className="bi bi-arrow-right quick-link-arrow" aria-hidden="true" />
            </Link>
          ))}
        </div>
      </section>
    </section>
  )
}

export default Dashboard
