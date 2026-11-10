import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/authContextValue.js'
import { useAppSettings } from '../settings/appSettingsContext.js'
import { canUseItem, NAV_ITEMS } from '../config/navigation.js'
import { LOW_STOCK_LIMIT, useProducts } from '../hooks/useProducts.js'
import { apiRequest } from '../services/api.js'
import LoadError from '../components/LoadError.jsx'
import Modal from '../components/Modal.jsx'
import { EmptyState, PageHeader, StatCard, StatusBadge } from '../components/ui.jsx'

/**
 * Sections each person can show or hide on their dashboard (saved in their preferences).
 * A section is offered only when the person can open the screen it comes from.
 * Keep ids in sync with DASHBOARD_WIDGETS in backend/config/features.js.
 */
const DASHBOARD_WIDGETS = [
  { id: 'pendingCard', group: 'Summary cards', icon: 'bi-hourglass-split', label: 'Pending from dealers', text: 'Total balance still to pay dealers', features: ['dealerPayments'] },
  { id: 'paidCard', group: 'Summary cards', icon: 'bi-cash-coin', label: 'Paid to dealers', text: 'Total paid out of the total billed', features: ['dealerPayments'] },
  { id: 'billedCard', group: 'Summary cards', icon: 'bi-receipt', label: 'Total billed', text: 'Total of all dealer bills', features: ['itemEntry'] },
  { id: 'lowStockCard', group: 'Summary cards', icon: 'bi-exclamation-triangle', label: 'Low stock', text: 'Items with low stock', features: ['inventory'] },
  { id: 'pendingDealers', group: 'Lists', icon: 'bi-people', label: 'Dealer pending amounts', text: 'Dealers with an outstanding balance', features: ['dealerPayments'] },
  { id: 'rateUpdates', group: 'Lists', icon: 'bi-graph-up', label: 'Item rate updates', text: 'Latest purchase rate of each item', features: ['itemPrices', 'billComparison'] },
  { id: 'recentPayments', group: 'Lists', icon: 'bi-clock-history', label: 'Recent transactions', text: 'Latest payments to dealers', features: ['dealerPayments'] },
  { id: 'lowStockList', group: 'Lists', icon: 'bi-box-seam', label: 'Low-stock alerts', text: 'Items that are running out', features: ['inventory'] },
  { id: 'quickActions', group: 'Shortcuts', icon: 'bi-lightning', label: 'Quick actions', text: 'Shortcuts to the screens you use', features: [] },
]

function CustomizeDashboard({ widgets, hidden, onClose, onSaved }) {
  const { updateUser } = useAuth()
  const [draft, setDraft] = useState(() => new Set(hidden))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const shownCount = widgets.filter((widget) => !draft.has(widget.id)).length
  const toggle = (id) => setDraft((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next })

  async function save() {
    setBusy(true); setError('')
    try {
      const result = await apiRequest('/auth/profile', { method: 'PATCH', body: JSON.stringify({ preferences: { dashboardHidden: [...draft] } }) })
      updateUser(result.user)
      onSaved()
    } catch (issue) { setError(issue.message) } finally { setBusy(false) }
  }

  return (
    <Modal className="dealer-delete-dialog dash-customize-dialog" busy={busy} onClose={onClose} labelledBy="dash-customize-title">
      <div className="payment-modal-heading">
        <div><span className="payment-eyebrow"><i className="bi bi-sliders" aria-hidden="true" /> DASHBOARD</span><h2 id="dash-customize-title">Customise your dashboard</h2></div>
        <button type="button" className="payment-close" aria-label="Close" onClick={onClose} disabled={busy}>×</button>
      </div>
      <div className="dash-customize-body">
        <p className="dash-customize-intro">Choose what you see on your dashboard. This only changes <strong>your</strong> dashboard. Showing {shownCount} of {widgets.length}.</p>
        {error && <p className="api-error" role="alert">{error}</p>}
        {[...new Set(widgets.map((widget) => widget.group))].map((group) => (
          <section key={group}>
            <h3 className="dash-customize-group">{group}</h3>
            <ul className="feature-list">
              {widgets.filter((widget) => widget.group === group).map((widget) => {
                const on = !draft.has(widget.id)
                return (
                  <li key={widget.id} className={`feature-row${on ? '' : ' is-off'}`}>
                    <span className="feature-row-icon" aria-hidden="true"><i className={`bi ${widget.icon}`} /></span>
                    <span className="feature-row-text"><strong>{widget.label}</strong><small>{widget.text}</small></span>
                    <label className={`feature-switch${on ? ' is-on' : ''}`}>
                      <input type="checkbox" role="switch" checked={on} onChange={() => toggle(widget.id)} disabled={busy} aria-label={`Show ${widget.label}`} />
                      <span className="feature-switch-track" aria-hidden="true"><span /></span>
                      <span className="feature-switch-state" aria-hidden="true">{on ? 'On' : 'Off'}</span>
                    </label>
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
      </div>
      <div className="dealer-delete-actions dash-customize-actions">
        <button type="button" className="back-button dash-customize-reset" onClick={() => setDraft(new Set())} disabled={busy || !draft.size}><i className="bi bi-arrow-counterclockwise" aria-hidden="true" /> Show everything</button>
        <button type="button" className="back-button" onClick={onClose} disabled={busy}>Cancel</button>
        <button type="button" className="continue-btn" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save dashboard'}</button>
      </div>
    </Modal>
  )
}

const money = (paise = 0) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format((Number(paise) || 0) / 100)
const shortDate = (value) => (value ? new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—')
const initials = (name = '') => name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || '?'

// Each quick action belongs to a menu screen and only shows when the user can open it.
const quickLinks = [
  { feature: 'itemEntry', to: '/itemsentry', icon: 'bi-receipt-cutoff', title: 'New bill', text: 'Choose a dealer and enter purchased items.' },
  { feature: 'dealerPayments', to: '/dealer-payments', icon: 'bi-wallet2', title: 'Pay dealer', text: 'Record payments and follow up on balances.' },
  { feature: 'inventory', to: '/inventory', icon: 'bi-boxes', title: 'Stock', text: 'Review stock levels and low-stock items.' },
  { feature: 'itemPrices', to: '/item-prices', icon: 'bi-currency-rupee', title: 'Prices', text: 'Latest price of every item from dealer bills.' },
  { feature: 'billComparison', to: '/bill-comparison', icon: 'bi-arrow-left-right', title: 'Compare', text: 'See price and quantity changes between bills.' },
]

const methodLabels = { cash: 'Cash', gpay: 'GPay', phonepe: 'PhonePe', paytm: 'Paytm', upi_other: 'UPI', net_banking: 'Net banking', cheque: 'Cheque', bank_deposit: 'Bank deposit', advance: 'From advance', other: 'Other' }
const methodIcons = { cash: 'bi-cash', cheque: 'bi-bank', bank_deposit: 'bi-bank', net_banking: 'bi-bank', advance: 'bi-piggy-bank' }
const statusTone = { received: ['success', 'Paid'], cleared: ['success', 'Cleared'], pending: ['warning', 'Cheque pending'], bounced: ['danger', 'Bounced'], reversed: ['neutral', 'Reversed'] }
/** Whole rupees for headline figures; the exact amount is in the tooltip. */
const rupees = (paise = 0) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Math.round((Number(paise) || 0) / 100))

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
                <small><span className="dash-hide-phone">{row.dealer.phone} · </span>{row.pendingBills ? `${row.pendingBills} pending ${row.pendingBills === 1 ? 'bill' : 'bills'}` : ''}{row.oldestPendingDate ? ` · since ${shortDate(row.oldestPendingDate)}` : ''}</small>
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
              : <small className={`dash-rate-change dash-trend-text-${row.trend}`}>{row.changePaise > 0 ? '+' : row.changePaise < 0 ? '−' : ''}{money(Math.abs(row.changePaise))}{row.changePercent !== null && row.changePaise !== 0 ? ` (${row.changePercent > 0 ? '+' : ''}${row.changePercent}%)` : ''}<span className="dash-hide-phone"> · was {money(row.previousPaise)}</span></small>}
          </span>
        </li>
      ))}
    </ul>
  )
}

function RecentPayments({ loading, rows }) {
  if (loading) return <div className="dash-list">{Array.from({ length: 3 }, (_, index) => <div className="skeleton dash-skeleton-row" key={index} />)}</div>
  if (!rows.length) return <EmptyState icon="bi-wallet2" title="No payments yet" text="Payments you record appear here." />
  return (
    <ul className="dash-list">
      {rows.map((row) => {
        const [tone, label] = statusTone[row.paymentStatus] || ['neutral', row.paymentStatus]
        return (
          <li key={row._id}>
            <Link className="dash-tx-row" to={row.dealer ? `/dealer-payments/${row.dealer._id}` : '/dealer-payments'}>
              <span className={`dash-tx-icon is-${tone}`} aria-hidden="true"><i className={`bi ${methodIcons[row.paymentMethod] || 'bi-phone'}`} /></span>
              <span className="dash-tx-main"><strong>{row.dealer?.name || 'Dealer'}</strong><small>{methodLabels[row.paymentMethod] || row.paymentMethod} · {shortDate(row.paymentDate)}</small></span>
              <span className="dash-tx-amount"><strong>{money(row.amountPaise)}</strong><StatusBadge tone={tone}>{label}</StatusBadge></span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

function LowStockAlerts({ loading, items }) {
  if (loading) return <div className="dash-list">{Array.from({ length: 3 }, (_, index) => <div className="skeleton dash-skeleton-row" key={index} />)}</div>
  if (!items.length) return <EmptyState icon="bi-check2-circle" title="Stock looks fine" text={`No item is at ${LOW_STOCK_LIMIT} units or fewer.`} />
  return (
    <ul className="dash-list">
      {items.map((item) => (
        <li key={item._id}>
          <Link className="dash-tx-row" to="/inventory?filter=low">
            <span className="dash-stock-thumb" aria-hidden="true">{item.image ? <img src={item.image} alt="" loading="lazy" /> : <i className="bi bi-box-seam" />}</span>
            <span className="dash-tx-main"><strong>{item.name}</strong><small>{item.category}</small></span>
            <span className="dash-tx-amount"><strong>{Number(item.quantity).toLocaleString('en-IN', { maximumFractionDigits: 3 })} {item.unit}</strong><StatusBadge tone="warning" icon="bi-exclamation-triangle">Low</StatusBadge></span>
          </Link>
        </li>
      ))}
    </ul>
  )
}

function Panel({ title, text, link, children }) {
  return (
    <section className="dashboard-card dash-panel">
      <div className="dash-panel-head">
        <div><h2>{title}</h2>{text && <p>{text}</p>}</div>
        {link && <Link className="dash-panel-link" to={link.to}>{link.label} <i className="bi bi-arrow-right" aria-hidden="true" /></Link>}
      </div>
      {children}
    </section>
  )
}

function Dashboard() {
  const { user } = useAuth()
  const { features } = useAppSettings()
  const can = (feature) => canUseItem(NAV_ITEMS.find((item) => item.key === feature), user, features)
  const [customizing, setCustomizing] = useState(false)
  const hidden = user?.preferences?.dashboardHidden || []
  // Sections this person may see, then the ones they chose to show.
  const available = DASHBOARD_WIDGETS.filter((widget) => !widget.features.length || widget.features.some(can))
  const shows = (id) => available.some((widget) => widget.id === id) && !hidden.includes(id)
  const showStock = shows('lowStockCard') || shows('lowStockList')
  const { products, loading, error, retry } = useProducts()
  const summary = useDashboardSummary()
  const lowStock = products.filter((product) => product.quantity <= LOW_STOCK_LIMIT).sort((a, b) => a.quantity - b.quantity)
  const totals = summary.data?.summary
  const busy = summary.loading

  // Only figures for screens this person can open.
  const cards = [
    shows('pendingCard') && { icon: 'bi-hourglass-split', label: 'Pending to dealers', paise: totals?.totalPendingPaise, note: totals?.dealersWithPending != null ? `${totals.dealersWithPending} dealers · ${totals.pendingBills} bills` : 'Outstanding balance', tone: 'warning', to: '/dealer-payments' },
    shows('paidCard') && { icon: 'bi-cash-coin', label: 'Paid to dealers', paise: totals?.totalReceivedPaise, note: totals?.totalBilledPaise != null ? `of ${rupees(totals.totalBilledPaise)} billed` : 'All payments recorded', tone: 'success', to: '/dealer-payments' },
    shows('billedCard') && { icon: 'bi-receipt', label: 'Total billed', paise: totals?.totalBilledPaise, note: 'All dealer bills', tone: 'primary', to: '/itemsentry' },
    shows('lowStockCard') && { icon: 'bi-exclamation-triangle', label: 'Low stock', count: lowStock.length, note: `${LOW_STOCK_LIMIT} units or fewer`, tone: 'danger', to: '/inventory?filter=low', stock: true },
  ].filter(Boolean)
  const links = shows('quickActions') ? quickLinks.filter((link) => can(link.feature)) : []
  const panels = [
    shows('pendingDealers') && <Panel key="pending" title="Dealer pending amounts" text="Highest balance first." link={{ to: '/dealer-payments', label: 'View all' }}><PendingDealers loading={busy} rows={summary.data?.pendingDealers || []} /></Panel>,
    shows('rateUpdates') && <Panel key="rates" title="Latest item prices" text="Latest bill price compared with the previous bill." link={can('itemPrices') ? { to: '/item-prices', label: 'All prices' } : { to: '/bill-comparison', label: 'Compare' }}><RateUpdates loading={busy} rows={(summary.data?.rateUpdates || []).slice(0, 6)} /></Panel>,
    shows('recentPayments') && <Panel key="recent" title="Recent transactions" text="Latest payments to dealers." link={{ to: '/dealer-payments', label: 'Payments' }}><RecentPayments loading={busy} rows={summary.data?.recentPayments || []} /></Panel>,
    shows('lowStockList') && <Panel key="stock" title="Low-stock alerts" text={`Items at ${LOW_STOCK_LIMIT} units or fewer.`} link={{ to: '/inventory?filter=low', label: 'Inventory' }}><LowStockAlerts loading={loading} items={lowStock.slice(0, 5)} /></Panel>,
  ].filter(Boolean)
  const needsSummary = cards.some((card) => !card.stock) || panels.length > 0

  return (
    <section className="page-container dash-page">
      <PageHeader
        eyebrow="OVERVIEW"
        title={`Welcome${user?.name ? `, ${user.name.split(' ')[0]}` : ''}`}
        description="Here is a quick look at your business today."
        actions={available.length > 0 && <button type="button" className="back-button dash-customize-button" onClick={() => setCustomizing(true)}><i className="bi bi-sliders" aria-hidden="true" /> Customise</button>}
      />
      {showStock && <LoadError message={error} onRetry={retry} />}
      {needsSummary && <LoadError message={summary.error} onRetry={summary.retry} />}

      {cards.length > 0 && <div className="ui-stat-grid dash-stats">
        {cards.map((card) => (
          <StatCard key={card.label} icon={card.icon} label={card.label} tone={card.tone} to={card.to} note={card.note}
            loading={card.stock ? loading : busy}
            value={card.stock ? (error ? '—' : card.count) : summary.error || card.paise == null ? '—' : <span title={money(card.paise)}>{rupees(card.paise)}</span>} />
        ))}
      </div>}

      {links.length > 0 && <nav className="dash-actions" aria-label="Quick actions">
        {links.map((link) => (
          <Link className="dash-action" to={link.to} key={link.to} title={link.text}>
            <span className="dash-action-icon" aria-hidden="true"><i className={`bi ${link.icon}`} /></span>
            <span>{link.title}</span>
          </Link>
        ))}
      </nav>}

      {panels.length > 0 && <div className={`dash-panels${panels.length === 1 ? ' is-single' : ''}`}>{panels}</div>}

      {!cards.length && !panels.length && !links.length && (available.length
        ? <EmptyState icon="bi-eye-slash" title="Everything is hidden" text="Choose what to show on your dashboard." action={<button type="button" className="continue-btn" onClick={() => setCustomizing(true)}><i className="bi bi-sliders" aria-hidden="true" /> Customise</button>} />
        : <EmptyState icon="bi-person-lock" title="No screens switched on yet" text="Ask your administrator to give you access to the screens you need." />)}
      {customizing && <CustomizeDashboard widgets={available} hidden={hidden.filter((id) => available.some((widget) => widget.id === id))} onClose={() => setCustomizing(false)} onSaved={() => setCustomizing(false)} />}
    </section>
  )
}

export default Dashboard
