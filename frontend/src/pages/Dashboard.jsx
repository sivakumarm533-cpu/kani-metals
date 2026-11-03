import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/authContextValue.js'
import { LOW_STOCK_LIMIT, useProducts } from '../hooks/useProducts.js'
import { apiRequest } from '../services/api.js'
import LoadError from '../components/LoadError.jsx'

const money = (paise = 0) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format((Number(paise) || 0) / 100)
const shortDate = (value) => (value ? new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—')
const initials = (name = '') => name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || '?'

const quickLinks = [
  { to: '/itemsentry', icon: 'bi-receipt-cutoff', title: 'Create a bill', text: 'Choose a dealer and enter purchased items.' },
  { to: '/dealer-payments', icon: 'bi-wallet2', title: 'Dealer payments', text: 'Record payments and follow up on balances.' },
  { to: '/bill-comparison', icon: 'bi-arrow-left-right', title: 'Compare bills', text: 'See price and quantity changes between bills.' },
  { to: '/inventory', icon: 'bi-boxes', title: 'Check inventory', text: 'Review stock levels and low-stock items.' },
]

function useDashboardSummary() {
  const [state, setState] = useState({ data: null, loading: true, error: '' })
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    apiRequest('/dashboard/summary')
      .then((data) => { if (active) setState({ data, loading: false, error: '' }) })
      .catch((error) => { if (active) setState({ data: null, loading: false, error: error.message }) })
    return () => { active = false }
  }, [attempt])
  const retry = () => { setState((current) => ({ ...current, loading: true, error: '' })); setAttempt((count) => count + 1) }
  return { ...state, retry }
}

function DealerAvatar({ dealer }) {
  return <span className="dash-avatar">{dealer.profileImage ? <img src={dealer.profileImage} alt="" loading="lazy" /> : initials(dealer.name)}</span>
}

function PendingDealers({ loading, rows }) {
  if (loading) return <div className="dash-list">{Array.from({ length: 4 }, (_, index) => <div className="skeleton dash-skeleton-row" key={index} />)}</div>
  if (!rows.length) return <div className="empty-state"><i className="bi bi-emoji-smile" aria-hidden="true" /><strong>No pending payments</strong><span>Every dealer bill is fully paid.</span></div>
  return (
    <ul className="dash-list">
      {rows.map((row) => {
        const paidPercent = row.totalPaise ? Math.min(100, (row.receivedPaise / row.totalPaise) * 100) : 0
        return (
          <li key={row.dealer._id}>
            <Link className="dash-dealer-row" to={`/dealer-payments/${row.dealer._id}`}>
              <DealerAvatar dealer={row.dealer} />
              <span className="dash-dealer-main">
                <strong>{row.dealer.name}</strong>
                <small>{row.dealer.phone}{row.pendingBills ? ` · ${row.pendingBills} pending ${row.pendingBills === 1 ? 'bill' : 'bills'}` : ''}{row.oldestPendingDate ? ` · since ${shortDate(row.oldestPendingDate)}` : ''}</small>
                <span className="dash-progress" role="img" aria-label={`${paidPercent.toFixed(0)} percent paid`}><span style={{ width: `${paidPercent}%` }} /></span>
              </span>
              <span className="dash-dealer-amount">
                <strong>{money(row.pendingPaise)}</strong>
                <small>of {money(row.totalPaise)}</small>
              </span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

function RateUpdates({ loading, rows }) {
  if (loading) return <div className="dash-list">{Array.from({ length: 4 }, (_, index) => <div className="skeleton dash-skeleton-row" key={index} />)}</div>
  if (!rows.length) return <div className="empty-state"><i className="bi bi-graph-up" aria-hidden="true" /><strong>No rates yet</strong><span>Rates appear here once bills are saved.</span></div>
  const trendLabel = { up: 'Increased', down: 'Decreased', same: 'No change', new: 'New rate' }
  const trendIcon = { up: 'bi-arrow-up-right', down: 'bi-arrow-down-right', same: 'bi-dash', new: 'bi-stars' }
  return (
    <ul className="dash-list">
      {rows.map((row) => (
        <li key={row.key} className="dash-rate-row">
          <span className={`dash-trend dash-trend-${row.trend}`} title={trendLabel[row.trend]}><i className={`bi ${trendIcon[row.trend]}`} aria-hidden="true" /><span className="visually-hidden">{trendLabel[row.trend]}</span></span>
          <span className="dash-rate-main">
            <strong>{row.name}</strong>
            <small>{row.category ? `${row.category} · ` : ''}{shortDate(row.latestDate)}{row.latestDealer ? ` · ${row.latestDealer}` : ''}</small>
          </span>
          <span className="dash-rate-values">
            <strong>{money(row.latestPaise)}<small> / {row.unit}</small></strong>
            {row.previousPaise === null
              ? <small className="dash-rate-change">First recorded rate</small>
              : row.changePaise === 0
              ? <small className="dash-rate-change">No change since {shortDate(row.previousDate)}</small>
              : <small className={`dash-rate-change dash-trend-text-${row.trend}`}>{row.changePaise > 0 ? '+' : row.changePaise < 0 ? '−' : ''}{money(Math.abs(row.changePaise))}{row.changePercent !== null && row.changePaise !== 0 ? ` (${row.changePercent > 0 ? '+' : ''}${row.changePercent}%)` : ''} · was {money(row.previousPaise)}</small>}
          </span>
        </li>
      ))}
    </ul>
  )
}

function Dashboard() {
  const { user } = useAuth()
  const { products, loading, error, retry } = useProducts()
  const summary = useDashboardSummary()
  const lowStockCount = products.filter((product) => product.quantity <= LOW_STOCK_LIMIT).length
  const value = (count, busy = loading, failed = error) => (busy ? <span className="skeleton skeleton-number" aria-label="Loading" /> : failed ? '—' : count)
  const totals = summary.data?.summary

  const cards = [
    { icon: 'bi-hourglass-split', label: 'Pending from dealers', count: value(money(totals?.totalPendingPaise), summary.loading, summary.error), note: totals ? `${totals.dealersWithPending} dealers · ${totals.pendingBills} bills` : 'Outstanding balance', tone: 'warning', to: '/dealer-payments' },
    { icon: 'bi-tags', label: 'Total products', count: value(products.length), note: 'Products in your catalog', to: '/products' },
    { icon: 'bi-exclamation-triangle', label: 'Low stock', count: value(lowStockCount), note: `${LOW_STOCK_LIMIT} units or fewer`, tone: 'danger', to: '/inventory' },
    { icon: 'bi-check2-circle', label: 'In stock', count: value(products.length - lowStockCount), note: 'Items currently available', tone: 'success', to: '/inventory' },
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
      <div className="summary-grid summary-grid-4">
        {cards.map((card) => (
          <Link className={`summary-card summary-card-link${card.tone ? ` summary-card-${card.tone}` : ''}`} key={card.label} to={card.to}>
            <span className="summary-icon" aria-hidden="true"><i className={`bi ${card.icon}`} /></span>
            <p>{card.label}</p>
            <strong>{card.count}</strong>
            <small>{card.note}</small>
          </Link>
        ))}
      </div>

      <LoadError message={summary.error} onRetry={summary.retry} />
      <div className="dash-panels">
        <section className="dashboard-card dash-panel">
          <div className="dash-panel-head">
            <div><h2>Dealer pending amounts</h2><p>Dealers with an outstanding balance, highest first.</p></div>
            <Link className="dash-panel-link" to="/dealer-payments">View all <i className="bi bi-arrow-right" aria-hidden="true" /></Link>
          </div>
          <PendingDealers loading={summary.loading} rows={summary.data?.pendingDealers || []} />
        </section>
        <section className="dashboard-card dash-panel">
          <div className="dash-panel-head">
            <div><h2>Product rate updates</h2><p>Latest purchase rate per product compared with its previous bill.</p></div>
            <Link className="dash-panel-link" to="/bill-comparison">Compare <i className="bi bi-arrow-right" aria-hidden="true" /></Link>
          </div>
          <RateUpdates loading={summary.loading} rows={summary.data?.rateUpdates || []} />
        </section>
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
