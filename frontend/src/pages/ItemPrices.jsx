import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiRequest } from '../services/api.js'
import Modal from '../components/Modal.jsx'
import Toast from '../components/Toast.jsx'
import LoadError from '../components/LoadError.jsx'
import { useToast } from '../hooks/useToast.js'
import { compressImage } from '../utils/image.js'
import { readPriceMessage } from '../utils/priceMessage.js'
import { useAuth } from '../auth/authContextValue.js'
import { isManager } from '../config/navigation.js'
import { FloatingActionButton } from '../components/ui.jsx'
import { useAppSettings } from '../settings/appSettingsContext.js'
import scrapImages from '../assets/scrap/scrap-materials-sheet.webp'
import './ItemPrices.css'

/*
 * Item prices: every item sold on a dealer bill, priced from the most recent bill.
 * A manual price set here only changes this screen.
 */

const VIEW_KEY = 'kani-item-price-view'
const rupee = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0, maximumFractionDigits: 2 })
const money = (paise) => rupee.format((Number(paise) || 0) / 100)
const shortDate = (value) => (value ? new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')
const tinyDate = (value) => new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
const perUnit = (unit) => (unit ? ` / ${unit}` : '')
const quantityText = (value, unit) => `${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 3 })} ${unit || ''}`.trim()

function readView() {
  try { return localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : 'cards' } catch { return 'cards' }
}

/** Sample photo from the scrap sheet when the bill has no photo of the item. */
function scrapTile(name = '') {
  const text = name.toLowerCase()
  if (/stainless|\bss\b/.test(text)) return 4
  if (/copper|cu\b/.test(text)) return 0
  if (/alumin/.test(text)) return 2
  if (/brass/.test(text)) return 3
  if (/e-?waste|board|pcb|electronic/.test(text)) return 5
  if (/steel|iron|\bms\b/.test(text)) return 1
  return null
}

// Bill photos are fetched one by one after the list shows, and kept for the session.
const imageCache = new Map()
function useItemImages(items) {
  const [images, setImages] = useState(() => Object.fromEntries(imageCache))
  useEffect(() => {
    const wanted = items.filter((item) => item.hasImage && !imageCache.has(item.key)).map((item) => item.key)
    if (!wanted.length) return undefined
    let cancelled = false
    const queue = [...wanted]
    async function worker() {
      while (queue.length && !cancelled) {
        const key = queue.shift()
        try {
          const { image } = await apiRequest(`/item-prices/image?key=${encodeURIComponent(key)}`)
          imageCache.set(key, image || '')
          if (!cancelled && image) setImages((current) => ({ ...current, [key]: image }))
        } catch { imageCache.set(key, '') }
      }
    }
    Promise.all([worker(), worker(), worker()])
    return () => { cancelled = true }
  }, [items])
  // Called after a photo is uploaded or removed, so cards update without refetching.
  const setImage = useCallback((key, image) => {
    if (image === undefined) imageCache.delete(key)
    else imageCache.set(key, image)
    setImages((current) => ({ ...current, [key]: image || '' }))
  }, [])
  return [images, setImage]
}

function ItemPhoto({ item, image, className = '' }) {
  if (image) return <img className={`price-photo ${className}`} src={image} alt="" loading="lazy" />
  const tile = scrapTile(item.name)
  if (tile !== null) {
    return <span className={`price-photo ${className}`} aria-hidden="true" style={{ backgroundImage: `url(${scrapImages})`, backgroundPosition: `${(tile % 3) * 50}% ${Math.floor(tile / 3) * 100}%`, backgroundSize: '300% 200%' }} />
  }
  return <span className={`price-photo price-photo-empty ${className}`} aria-hidden="true">{item.name.trim().charAt(0).toUpperCase()}</span>
}

function TrendBadge({ item, compact = false }) {
  if (item.trend === 'new') return <span className="price-trend is-new">{compact ? 'New' : 'First price'}</span>
  if (item.trend === 'same') return <span className="price-trend is-same"><i className="bi bi-dash" aria-hidden="true" />{compact ? '0%' : 'No change'}</span>
  const up = item.trend === 'up'
  const amount = money(Math.abs(item.changePaise))
  const percent = item.changePercent !== null ? `${up ? '+' : '−'}${Math.abs(item.changePercent)}%` : ''
  return (
    <span className={`price-trend ${up ? 'is-up' : 'is-down'}`} title={`${up ? 'Up' : 'Down'} ${amount} vs ${item.compareWith}`}>
      <i className={`bi ${up ? 'bi-arrow-up-right' : 'bi-arrow-down-right'}`} aria-hidden="true" />
      {compact ? percent || amount : `${up ? '+' : '−'}${amount}${percent ? ` (${percent})` : ''}`}
      <span className="visually-hidden"> vs {item.compareWith}</span>
    </span>
  )
}

function Sparkline({ values }) {
  if (!values || values.length < 2) return <span className="price-spark price-spark-empty">Only one bill so far</span>
  const width = 120
  const height = 32
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const points = values.map((value, index) => [(index / (values.length - 1)) * (width - 6) + 3, height - 4 - ((value - min) / span) * (height - 8)])
  const last = points[points.length - 1]
  return (
    <svg className="price-spark" viewBox={`0 0 ${width} ${height}`} aria-hidden="true" focusable="false">
      <polyline points={points.map((point) => point.join(',')).join(' ')} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      <circle cx={last[0]} cy={last[1]} r="3" fill="currentColor" stroke="var(--color-surface)" strokeWidth="1.5" />
    </svg>
  )
}

function SourceTag({ item }) {
  return item.source === 'manual'
    ? <span className="price-source is-manual"><i className="bi bi-pencil-fill" aria-hidden="true" />Manual</span>
    : <span className="price-source"><i className="bi bi-receipt" aria-hidden="true" />From bill</span>
}

function PriceCard({ item, image, onOpen }) {
  return (
    <li>
      <button type="button" className="price-card" onClick={() => onOpen(item.key)}>
        <span className="price-card-media">
          <ItemPhoto item={item} image={image} />
          {item.category && <span className="price-card-category">{item.category}</span>}
          <SourceTag item={item} />
        </span>
        <span className="price-card-body">
          <span className="price-card-title">
            <strong>{item.name}</strong>
            <small>{item.hasBill ? `${item.billCount} bill${item.billCount === 1 ? '' : 's'} · ${item.dealerCount} dealer${item.dealerCount === 1 ? '' : 's'}` : 'Added here · no bills yet'}</small>
          </span>
          <span className="price-card-price">
            <span><b>{money(item.currentPaise)}</b><small>{perUnit(item.unit)}</small></span>
            <TrendBadge item={item} compact />
          </span>
          <span className={`price-card-spark trend-${item.trend}`}><Sparkline values={item.spark} /></span>
          <span className="price-card-foot">
            {item.source === 'manual'
              ? <><span>{item.hasBill ? `Bill price ${money(item.billPaise)}` : 'Price set by hand'}</span><span>Set {shortDate(item.manual.updatedAt)}</span></>
              : <><span title={item.billDealer}>{item.billDealer || 'Dealer'}</span><span>{shortDate(item.billDate)}</span></>}
          </span>
        </span>
      </button>
    </li>
  )
}

function PriceRow({ item, image, onOpen }) {
  return (
    <li>
      <button type="button" className="price-row" onClick={() => onOpen(item.key)}>
        <ItemPhoto item={item} image={image} className="price-row-photo" />
        <span className="price-row-name"><strong>{item.name}</strong><small>{[item.category, item.unit && `per ${item.unit}`].filter(Boolean).join(' · ')}</small></span>
        <span className="price-row-price"><b>{money(item.currentPaise)}</b><SourceTag item={item} /></span>
        <span className="price-row-trend"><TrendBadge item={item} compact /></span>
        <span className={`price-row-spark trend-${item.trend}`}><Sparkline values={item.spark} /></span>
        <span className="price-row-date"><span>{item.billDealer || 'Added here'}</span><small>{shortDate(item.billDate || item.updatedAt)}</small></span>
        <i className="bi bi-chevron-right price-row-chevron" aria-hidden="true" />
      </button>
    </li>
  )
}

const RANGES = [['3m', '3 months', 92], ['6m', '6 months', 183], ['1y', '1 year', 366], ['all', 'All', null]]

/** Price over time from every bill line, with a hover/tap crosshair and tooltip. */
function PriceChart({ history, manualPaise, unit }) {
  const wrapRef = useRef(null)
  const [width, setWidth] = useState(560)
  const [range, setRange] = useState('all')
  const [active, setActive] = useState(null)

  useEffect(() => {
    const element = wrapRef.current
    if (!element) return undefined
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(260, Math.round(entry.contentRect.width))))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const points = useMemo(() => {
    const days = RANGES.find(([id]) => id === range)?.[2]
    const all = history.slice().reverse()
    if (!days) return all
    // Counted back from the latest sale, so items sold rarely still show their recent run.
    const from = new Date(all[all.length - 1].date).getTime() - days * 86400000
    const inRange = all.filter((point) => new Date(point.date).getTime() >= from)
    return inRange.length ? inRange : all.slice(-1)
  }, [history, range])

  const height = 220
  const pad = { top: 16, right: 16, bottom: 28, left: 58 }
  const plotW = width - pad.left - pad.right
  const plotH = height - pad.top - pad.bottom
  const values = points.map((point) => point.pricePaise)
  if (Number.isFinite(manualPaise)) values.push(manualPaise)
  let min = Math.min(...values)
  let max = Math.max(...values)
  if (min === max) { min = Math.max(0, min * 0.9); max = max * 1.1 || 100 }
  const spread = max - min
  min = Math.max(0, min - spread * 0.12)
  max += spread * 0.12
  // One even step per sale, so several sales on the same day each get their own point
  // (by date they would sit on top of each other and hide the rise or drop).
  const x = (index) => (points.length === 1 ? plotW / 2 : (index / (points.length - 1)) * plotW) + pad.left
  const y = (value) => pad.top + plotH - ((value - min) / (max - min)) * plotH
  const ticks = [0, 1, 2, 3].map((step) => min + ((max - min) * step) / 3)
  const path = points.map((point, index) => `${index ? 'L' : 'M'}${x(index).toFixed(1)},${y(point.pricePaise).toFixed(1)}`).join(' ')
  const area = points.length > 1 ? `${path} L${x(points.length - 1).toFixed(1)},${pad.top + plotH} L${x(0).toFixed(1)},${pad.top + plotH} Z` : ''
  const labelIndexes = [...new Set([0, Math.floor((points.length - 1) / 2), points.length - 1])]
  const showMarkers = points.length <= 40

  function pick(event) {
    const box = event.currentTarget.getBoundingClientRect()
    const px = ((event.clientX - box.left) / box.width) * width
    let best = 0
    for (let index = 1; index < points.length; index += 1) if (Math.abs(x(index) - px) < Math.abs(x(best) - px)) best = index
    setActive(best)
  }

  const current = active !== null ? points[active] : null
  const tipLeft = current ? Math.min(Math.max(x(active), 90), width - 90) : 0

  return (
    <div className="price-chart-card">
      <div className="price-chart-head">
        <div><h3>Price history</h3><p>Bill price{perUnit(unit)} on each sale</p></div>
        <div className="price-range" role="radiogroup" aria-label="Time range">
          {RANGES.map(([id, label]) => <button key={id} type="button" role="radio" aria-checked={range === id} className={range === id ? 'is-active' : ''} onClick={() => { setRange(id); setActive(null) }}>{label}</button>)}
        </div>
      </div>
      <div className="price-chart" ref={wrapRef}>
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Price history: ${points.length} sales from ${shortDate(points[0]?.date)} to ${shortDate(points[points.length - 1]?.date)}, between ${money(Math.min(...points.map((p) => p.pricePaise)))} and ${money(Math.max(...points.map((p) => p.pricePaise)))}.`}
          onPointerMove={pick} onPointerDown={pick} onPointerLeave={() => setActive(null)}>
          {ticks.map((tick) => (
            <g key={tick}>
              <line className="price-chart-grid" x1={pad.left} x2={width - pad.right} y1={y(tick)} y2={y(tick)} />
              <text className="price-chart-axis" x={pad.left - 8} y={y(tick)} textAnchor="end" dominantBaseline="middle">{money(Math.round(tick))}</text>
            </g>
          ))}
          {labelIndexes.map((index) => <text key={index} className="price-chart-axis" x={x(index)} y={height - 8} textAnchor={index === 0 && points.length > 1 ? 'start' : index === points.length - 1 && points.length > 1 ? 'end' : 'middle'}>{tinyDate(points[index].date)}</text>)}
          {area && <path className="price-chart-area" d={area} />}
          {Number.isFinite(manualPaise) && (
            <g>
              <line className="price-chart-manual" x1={pad.left} x2={width - pad.right} y1={y(manualPaise)} y2={y(manualPaise)} />
              <text className="price-chart-manual-label" x={width - pad.right - 4} y={y(manualPaise) - 6} textAnchor="end">Manual {money(manualPaise)}</text>
            </g>
          )}
          {points.length > 1 && <path className="price-chart-line" d={path} />}
          {(showMarkers || points.length === 1) && points.map((point, index) => <circle key={`${point.bill}-${index}`} className="price-chart-dot" cx={x(index)} cy={y(point.pricePaise)} r="4" />)}
          {current && (
            <g>
              <line className="price-chart-cross" x1={x(active)} x2={x(active)} y1={pad.top} y2={pad.top + plotH} />
              <circle className="price-chart-dot is-active" cx={x(active)} cy={y(current.pricePaise)} r="5.5" />
            </g>
          )}
        </svg>
        {current && (
          <div className="price-chart-tip" style={{ left: tipLeft }} role="status">
            <strong>{money(current.pricePaise)}{perUnit(unit)}</strong>
            <span>{shortDate(current.date)}</span>
            <span>{current.dealer} · {quantityText(current.quantity, unit)}</span>
          </div>
        )}
      </div>
    </div>
  )
}

function ManualPriceForm({ item, onSaved, notify }) {
  const [price, setPrice] = useState(item.manual ? String(item.manual.pricePaise / 100) : '')
  const [note, setNote] = useState(item.manual?.note || '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const priceId = useId()
  const noteId = useId()

  async function save(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const result = await apiRequest('/item-prices/manual', { method: 'PUT', body: JSON.stringify({ key: item.key, price, note }) })
      notify(result.message)
      onSaved()
    } catch (saveError) { setError(saveError.message) } finally { setBusy(false) }
  }

  async function clear() {
    setBusy(true)
    setError('')
    try {
      const result = await apiRequest(`/item-prices/manual?key=${encodeURIComponent(item.key)}`, { method: 'DELETE' })
      notify(result.message, 'info', 'bi-receipt')
      setPrice('')
      setNote('')
      onSaved()
    } catch (clearError) { setError(clearError.message) } finally { setBusy(false) }
  }

  return (
    <form className="price-manual" onSubmit={save}>
      <div className="price-manual-head">
        <h3><i className="bi bi-pencil-square" aria-hidden="true" />Manual price</h3>
        <p>{item.hasBill ? 'Only changes the price on this screen. Bills, products and the dashboard are not changed.' : 'This item was added here. Its price stays as you set it until a bill includes it.'}</p>
      </div>
      {item.newerBill && <p className="price-manual-warning"><i className="bi bi-info-circle" aria-hidden="true" />A newer bill came in at {money(item.billPaise)} after this manual price was set.</p>}
      <div className="price-manual-fields">
        <label htmlFor={priceId}>Price{perUnit(item.unit)} (₹)
          <input id={priceId} type="number" inputMode="decimal" min="0.01" step="0.01" required value={price} onChange={(event) => setPrice(event.target.value)} placeholder={item.hasBill ? (item.billPaise / 100).toString() : '0.00'} />
        </label>
        <label htmlFor={noteId}>Note (optional)
          <input id={noteId} type="text" maxLength="200" value={note} onChange={(event) => setNote(event.target.value)} placeholder="For example: today's market rate" />
        </label>
      </div>
      {error && <p className="payment-form-error" role="alert">{error}</p>}
      <div className="price-manual-actions">
        {item.manual && item.hasBill && <button type="button" className="back-button" disabled={busy} onClick={clear}><i className="bi bi-receipt" aria-hidden="true" /> Use bill price ({money(item.billPaise)})</button>}
        <button className="continue-btn" disabled={busy || !price}>{busy ? 'Saving…' : item.manual ? 'Update manual price' : 'Set manual price'}</button>
      </div>
    </form>
  )
}

/** Photo source for one item: the latest bill photo, or one uploaded here. */
function PhotoControls({ item, notify, onSaved }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const inputId = useId()

  async function save(image) {
    setBusy(true)
    setError('')
    try {
      const result = await apiRequest('/item-prices/image', { method: 'PUT', body: JSON.stringify({ key: item.key, image }) })
      notify(result.message, 'success', 'bi-image')
      onSaved(image)
    } catch (saveError) { setError(saveError.message) } finally { setBusy(false) }
  }

  async function choose(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try { await save(await compressImage(file, { maxSize: 800 })) } catch (readError) { setError(readError.message) }
  }

  const label = item.imageSource === 'manual' ? 'Uploaded photo' : item.imageSource === 'bill' ? 'Photo from bill' : 'No photo yet'
  return (
    <div className="price-photo-controls">
      <span className="price-photo-source"><i className={`bi ${item.imageSource === 'manual' ? 'bi-upload' : item.imageSource === 'bill' ? 'bi-receipt' : 'bi-image'}`} aria-hidden="true" />{label}</span>
      <div className="price-photo-buttons">
        <label htmlFor={inputId} className={`price-photo-button${busy ? ' is-busy' : ''}`}>
          <i className="bi bi-camera" aria-hidden="true" />{busy ? 'Saving…' : item.imageSource === 'manual' ? 'Change' : 'Upload'}
          <input id={inputId} className="visually-hidden" type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={choose} />
        </label>
        {item.imageSource === 'manual' && (
          <button type="button" className="price-photo-button" disabled={busy} onClick={() => save('')}>
            <i className={`bi ${item.billImageAvailable ? 'bi-receipt' : 'bi-trash'}`} aria-hidden="true" />{item.billImageAvailable ? 'Use bill photo' : 'Remove'}
          </button>
        )}
      </div>
      {error && <p className="payment-form-error" role="alert">{error}</p>}
    </div>
  )
}

function DetailModal({ itemKey, onClose, onChanged, onPhotoChanged, notify }) {
  const [state, setState] = useState({ loading: true, error: '', data: null })
  const [tab, setTab] = useState('purchases')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function removeItem() {
    setDeleting(true)
    try {
      const result = await apiRequest(`/item-prices/items?key=${encodeURIComponent(itemKey)}`, { method: 'DELETE' })
      notify(result.message, 'info', 'bi-trash')
      onChanged()
      onClose()
    } catch (deleteError) { notify(deleteError.message, 'danger'); setDeleting(false); setConfirmDelete(false) }
  }

  const load = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: '' }))
    try { setState({ loading: false, error: '', data: await apiRequest(`/item-prices/detail?key=${encodeURIComponent(itemKey)}`) }) }
    catch (loadError) { setState((current) => ({ ...current, loading: false, error: loadError.message })) }
  }, [itemKey])
  useEffect(() => { load() }, [load])

  const data = state.data
  const item = data?.item
  return (
    <Modal className="payment-modal price-detail" backdropClassName="payment-modal-backdrop" onClose={onClose} labelledBy="price-detail-title">
      <div className="payment-modal-heading">
        <div><span className="payment-eyebrow">ITEM PRICE</span><h2 id="price-detail-title">{item?.name || 'Loading…'}</h2></div>
        <button type="button" className="payment-close" aria-label="Close dialog" onClick={onClose}>×</button>
      </div>
      {state.error && <LoadError message={state.error} onRetry={load} />}
      {!data && state.loading && <div className="price-detail-loading"><span className="payment-skeleton" /><span className="payment-skeleton" /></div>}
      {item && (
        <div className={`price-detail-body${state.loading ? ' is-refreshing' : ''}`}>
          <section className="price-hero">
            <div className="price-hero-media">
              <ItemPhoto item={item} image={item.image} className="price-hero-photo" />
              <PhotoControls key={`${item.imageSource}-${item.image.length}`} item={item} notify={notify} onSaved={(image) => { onPhotoChanged(item.key, image || undefined); load() }} />
            </div>
            <div className="price-hero-text">
              <div className="price-hero-tags">{item.category && <span className="price-chip">{item.category}</span>}<SourceTag item={item} /></div>
              <p className="price-hero-price"><b>{money(item.currentPaise)}</b><small>{perUnit(item.unit)}</small></p>
              <TrendBadge item={item} />
              <p className="price-hero-meta">
                {item.source === 'manual'
                  ? <>Manual price set {shortDate(item.manual.updatedAt)}{item.manual.updatedByName ? ` by ${item.manual.updatedByName}` : ''}{item.manual.note ? ` · “${item.manual.note}”` : ''}</>
                  : <>From {item.billDealer || 'a dealer'}’s bill on {shortDate(item.billDate)}</>}
              </p>
              {item.addedManually && !item.hasBill && (confirmDelete
                ? <div className="price-delete-confirm" role="alert"><span>Remove {item.name} from the price list?</span><button type="button" className="back-button" disabled={deleting} onClick={() => setConfirmDelete(false)}>Keep</button><button type="button" className="confirm-delete-btn" disabled={deleting} onClick={removeItem}>{deleting ? 'Removing…' : 'Remove'}</button></div>
                : <button type="button" className="price-delete-link" onClick={() => setConfirmDelete(true)}><i className="bi bi-trash" aria-hidden="true" />Remove item</button>)}
            </div>
          </section>

          <dl className="price-stats">
            <div><dt>Latest bill</dt><dd>{item.hasBill ? money(item.billPaise) : '—'}</dd><small>{item.hasBill ? shortDate(item.billDate) : 'Not on a bill yet'}</small></div>
            <div><dt>Previous bill</dt><dd>{item.previousBillPaise === null ? '—' : money(item.previousBillPaise)}</dd><small>{item.previousBillDate ? shortDate(item.previousBillDate) : 'No earlier bill'}</small></div>
            <div><dt>Lowest</dt><dd>{money(data.stats.minPaise)}</dd><small>All bills</small></div>
            <div><dt>Highest</dt><dd>{money(data.stats.maxPaise)}</dd><small>All bills</small></div>
            <div><dt>Average</dt><dd>{money(data.stats.avgPaise)}</dd><small>{data.history.length} sale{data.history.length === 1 ? '' : 's'}</small></div>
            <div><dt>Total sold</dt><dd>{quantityText(data.stats.totalQuantity, item.unit)}</dd><small>Since {shortDate(data.stats.firstDate)}</small></div>
          </dl>

          {data.history.length
            ? <PriceChart history={data.history} manualPaise={item.manual?.pricePaise} unit={item.unit} />
            : <div className="price-chart-card price-chart-empty"><i className="bi bi-graph-up" aria-hidden="true" /><span>The price graph appears once this item is on a dealer bill.</span></div>}

          <ManualPriceForm key={`${item.manual?.pricePaise ?? 'bill'}-${item.manual?.updatedAt ?? ''}`} item={item} notify={notify} onSaved={() => { load(); onChanged() }} />

          <section className="price-tabs-card">
            <div className="price-tabs" role="tablist" aria-label="Item details">
              {[['purchases', `Sales (${data.history.length})`], ['dealers', `Dealers (${data.dealers.length})`], ['changes', `Manual changes (${data.manualHistory.length})`]].map(([id, label]) => (
                <button key={id} type="button" role="tab" id={`price-tab-${id}`} aria-selected={tab === id} aria-controls={`price-panel-${id}`} className={tab === id ? 'is-active' : ''} onClick={() => setTab(id)}>{label}</button>
              ))}
            </div>
            <div role="tabpanel" id={`price-panel-${tab}`} aria-labelledby={`price-tab-${tab}`}>
              {tab === 'purchases' && !data.history.length && <p className="price-empty-note">No bills include this item yet.</p>}
              {tab === 'dealers' && !data.dealers.length && <p className="price-empty-note">This item has not been sold to any dealer yet.</p>}
              {tab === 'purchases' && data.history.length > 0 && (
                <div className="price-table-wrap">
                  <table className="price-table">
                    <thead><tr><th scope="col">Date</th><th scope="col">Dealer</th><th scope="col" className="is-num">Quantity</th><th scope="col" className="is-num">Price{perUnit(item.unit)}</th></tr></thead>
                    <tbody>{data.history.map((row, index) => {
                      const older = data.history[index + 1]
                      const diff = older ? row.pricePaise - older.pricePaise : 0
                      return (
                        <tr key={`${row.bill}-${index}`}>
                          <td>{shortDate(row.date)}</td>
                          <td><Link to={`/dealers/${row.dealerId}/bills`}>{row.dealer}</Link></td>
                          <td className="is-num">{quantityText(row.quantity, item.unit)}</td>
                          <td className="is-num"><b>{money(row.pricePaise)}</b>{diff !== 0 && <small className={diff > 0 ? 'is-up' : 'is-down'}>{diff > 0 ? '▲' : '▼'} {money(Math.abs(diff))}</small>}</td>
                        </tr>
                      )
                    })}</tbody>
                  </table>
                </div>
              )}
              {tab === 'dealers' && (
                <ul className="price-dealers">
                  {data.dealers.map((row) => (
                    <li key={row.dealer._id}>
                      <span className="price-dealer-avatar" aria-hidden="true">{row.dealer.profileImage ? <img src={row.dealer.profileImage} alt="" /> : row.dealer.name.charAt(0).toUpperCase()}</span>
                      <span className="price-dealer-text"><strong>{row.dealer.name}</strong><small>{row.lines} sale{row.lines === 1 ? '' : 's'} · {quantityText(row.quantity, item.unit)}</small></span>
                      <span className="price-dealer-price"><b>{money(row.lastPaise)}</b><small>Last on {shortDate(row.lastDate)}</small></span>
                    </li>
                  ))}
                </ul>
              )}
              {tab === 'changes' && (data.manualHistory.length
                ? <ul className="price-changes">{data.manualHistory.map((change, index) => (
                    <li key={`${change.changedAt}-${index}`}>
                      <i className={`bi ${change.action === 'set' ? 'bi-pencil-fill' : 'bi-arrow-counterclockwise'}`} aria-hidden="true" />
                      <span><strong>{change.action === 'set' ? `Set to ${money(change.pricePaise)}` : 'Back to bill price'}</strong><small>{shortDate(change.changedAt)}{change.changedByName ? ` · ${change.changedByName}` : ''}{change.note ? ` · “${change.note}”` : ''}</small></span>
                    </li>
                  ))}</ul>
                : <p className="price-empty-note">No manual price has been set for this item.</p>)}
            </div>
          </section>
        </div>
      )}
    </Modal>
  )
}


/** Adds an item that is not on any bill yet, with its price and an optional photo. */
function AddItemModal({ categories, units, onClose, onAdded, notify }) {
  const [form, setForm] = useState({ name: '', category: '', unit: units[0] || 'kg', price: '', note: '', image: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const set = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }))

  async function choosePhoto(event) {
    const file = event.target.files?.[0]
    if (!file) return
    try { const image = await compressImage(file, { maxSize: 800 }); setForm((current) => ({ ...current, image })) }
    catch (readError) { event.target.value = ''; setError(readError.message) }
  }

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const result = await apiRequest('/item-prices/items', { method: 'POST', body: JSON.stringify(form) })
      notify(result.message)
      onAdded(result.key, form.image)
    } catch (saveError) { setError(saveError.message); setBusy(false) }
  }

  return (
    <Modal className="payment-modal price-add" backdropClassName="payment-modal-backdrop" busy={busy} onClose={onClose} labelledBy="price-add-title">
      <div className="payment-modal-heading">
        <div><span className="payment-eyebrow">NEW ITEM</span><h2 id="price-add-title">Add an item</h2></div>
        <button type="button" className="payment-close" aria-label="Close dialog" onClick={onClose}>×</button>
      </div>
      <p className="price-add-help">For items you have not sold on a bill yet. When a bill later includes the same name and unit, its bill prices join this item.</p>
      <form className="price-add-form" onSubmit={submit}>
        <div className="price-add-photo">
          {form.image
            ? <img src={form.image} alt="Selected item" />
            : <span><i className="bi bi-image" aria-hidden="true" />No photo</span>}
          <div>
            <label className="price-photo-button">
              <i className="bi bi-camera" aria-hidden="true" />{form.image ? 'Change photo' : 'Add photo'}
              <input className="visually-hidden" type="file" accept="image/png,image/jpeg,image/webp" onChange={choosePhoto} />
            </label>
            {form.image && <button type="button" className="price-photo-button" onClick={() => setForm((current) => ({ ...current, image: '' }))}><i className="bi bi-x-lg" aria-hidden="true" />Remove</button>}
            <small>Optional. You can also add it later.</small>
          </div>
        </div>
        <label>Item name<input data-autofocus required maxLength="120" value={form.name} onChange={set('name')} placeholder="For example: Copper wire scrap" /></label>
        <div className="price-add-grid">
          <label>Category<input list="price-add-categories" maxLength="80" value={form.category} onChange={set('category')} placeholder="For example: Metal" /></label>
          <datalist id="price-add-categories">{categories.map((name) => <option key={name} value={name} />)}</datalist>
          <label>Unit<input list="price-add-units" required maxLength="20" value={form.unit} onChange={set('unit')} /></label>
          <datalist id="price-add-units">{units.map((unit) => <option key={unit} value={unit} />)}</datalist>
        </div>
        <div className="price-add-grid">
          <label>Price per {form.unit || 'unit'} (₹)<input required type="number" inputMode="decimal" min="0.01" step="0.01" value={form.price} onChange={set('price')} placeholder="0.00" /></label>
          <label>Note (optional)<input maxLength="200" value={form.note} onChange={set('note')} placeholder="For example: market rate" /></label>
        </div>
        {error && <p className="payment-form-error" role="alert">{error}</p>}
        <div className="payment-modal-actions">
          <button type="button" className="back-button" disabled={busy} onClick={onClose}>Cancel</button>
          <button className="continue-btn" disabled={busy}>{busy ? 'Adding…' : 'Add item'}</button>
        </div>
      </form>
    </Modal>
  )
}

/** Items with a manual price where a newer bill came in at a different price. */
const needsBillReview = (item) => item.newerBill && item.manual && item.billPaise !== item.manual.pricePaise
const REVIEW_LATER_KEY = 'kani-price-review-later'

/**
 * Admin check after new bills: for each item with a manual price, use the new bill
 * price, keep the manual price, or type a new one.
 */
function BillPriceReviewModal({ items, onClose, onSaved, notify }) {
  const [choices, setChoices] = useState(() => Object.fromEntries(items.map((item) => [item.key, { action: 'bill', price: String(item.billPaise / 100) }])))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const choose = (key, changes) => setChoices((current) => ({ ...current, [key]: { ...current[key], ...changes } }))
  const setAll = (action) => setChoices((current) => Object.fromEntries(Object.entries(current).map(([key, value]) => [key, { ...value, action }])))

  async function save() {
    setError('')
    const edited = items.filter((item) => choices[item.key].action === 'edit')
    const bad = edited.find((item) => !(Number(choices[item.key].price) > 0))
    if (bad) { setError(`Enter a price above ₹0 for ${bad.name}.`); return }
    setBusy(true)
    try {
      const useBill = items.filter((item) => choices[item.key].action === 'bill')
      for (const item of useBill) await apiRequest(`/item-prices/manual?key=${encodeURIComponent(item.key)}`, { method: 'DELETE' })
      // Keeping the manual price saves it again, so the newer bill no longer asks for a check.
      const keep = items.filter((item) => choices[item.key].action === 'keep')
      if (keep.length) await apiRequest('/item-prices/manual/bulk', { method: 'PUT', body: JSON.stringify({ note: 'Kept after new bill', updates: keep.map((item) => ({ key: item.key, price: (item.manual.pricePaise / 100).toFixed(2) })) }) })
      if (edited.length) await apiRequest('/item-prices/manual/bulk', { method: 'PUT', body: JSON.stringify({ note: 'Updated after new bill', updates: edited.map((item) => ({ key: item.key, price: choices[item.key].price })) }) })
      const parts = [useBill.length && `${useBill.length} now use the bill price`, keep.length && `${keep.length} kept`, edited.length && `${edited.length} updated`].filter(Boolean)
      notify(`Prices checked: ${parts.join(', ')}.`)
      onSaved()
    } catch (saveError) {
      // Some items may already be saved; reload so the list shows what is left.
      setError(saveError.message)
      setBusy(false)
      onSaved({ keepOpen: true })
    }
  }

  return (
    <Modal className="payment-modal price-review" backdropClassName="payment-modal-backdrop" busy={busy} onClose={onClose} labelledBy="price-review-title">
      <div className="payment-modal-heading">
        <div><span className="payment-eyebrow">NEW BILL PRICES</span><h2 id="price-review-title">Confirm item prices</h2></div>
        <button type="button" className="payment-close" aria-label="Close dialog" onClick={onClose}>×</button>
      </div>
      <p className="price-add-help">New bills came in at a different price for {items.length} {items.length === 1 ? 'item' : 'items'} that {items.length === 1 ? 'has' : 'have'} a manual price. Choose which price to show for each.</p>
      <div className="price-review-all">
        <span>Set all:</span>
        <button type="button" className="dealer-pick-chip" onClick={() => setAll('bill')}>Use bill prices</button>
        <button type="button" className="dealer-pick-chip" onClick={() => setAll('keep')}>Keep my prices</button>
      </div>
      <ul className="price-review-rows">
        {items.map((item) => {
          const choice = choices[item.key]
          const up = item.billPaise > item.manual.pricePaise
          return (
            <li key={item.key} className="price-review-row">
              <div className="price-review-head">
                <strong>{item.name}{item.unit ? <small> / {item.unit}</small> : null}</strong>
                <span className={`price-trend ${up ? 'is-up' : 'is-down'}`}>{up ? '▲' : '▼'} {money(Math.abs(item.billPaise - item.manual.pricePaise))}</span>
              </div>
              <div className="price-review-compare">
                <span><small>Your price</small><b>{money(item.manual.pricePaise)}</b><em>Set {shortDate(item.manual.updatedAt)}</em></span>
                <i className="bi bi-arrow-right" aria-hidden="true" />
                <span><small>New bill</small><b>{money(item.billPaise)}</b><em>{item.billDealer || 'Dealer'} · {shortDate(item.billDate)}</em></span>
              </div>
              <div className="price-review-choice" role="radiogroup" aria-label={`Price for ${item.name}`}>
                {[['bill', 'Use bill price'], ['keep', 'Keep my price'], ['edit', 'Edit']].map(([id, label]) => (
                  <button key={id} type="button" role="radio" aria-checked={choice.action === id} className={`dealer-pick-chip${choice.action === id ? ' is-active' : ''}`} onClick={() => choose(item.key, { action: id })}>{label}</button>
                ))}
                {choice.action === 'edit' && (
                  <label className="price-message-price"><span>₹</span><input type="number" inputMode="decimal" min="0.01" step="0.01" value={choice.price} onChange={(event) => choose(item.key, { price: event.target.value })} aria-label={`New price for ${item.name}`} data-autofocus /></label>
                )}
              </div>
            </li>
          )
        })}
      </ul>
      {error && <p className="payment-form-error" role="alert">{error}</p>}
      <div className="payment-modal-actions">
        <button type="button" className="back-button" disabled={busy} onClick={onClose}>Later</button>
        <button type="button" className="continue-btn" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Confirm prices'}</button>
      </div>
    </Modal>
  )
}

const MESSAGE_EXAMPLE = 'Copper 780\nBrass 520/kg, Aluminium 185\nIron scrap - Rs 32 per kg'

/** Paste a rate message, check what was read, then save the prices together. */
function MessagePricesModal({ items, onClose, onSaved, notify }) {
  const [text, setText] = useState('')
  const [rows, setRows] = useState(null)
  const [skipped, setSkipped] = useState([])
  const [note, setNote] = useState(() => `Rate message ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const itemByKey = useMemo(() => new Map(items.map((item) => [item.key, item])), [items])
  const sortedItems = useMemo(() => items.slice().sort((a, b) => a.name.localeCompare(b.name)), [items])

  function read() {
    setError('')
    const result = readPriceMessage(text, items)
    if (!result.rows.length) { setError('No prices found. Write one item and price per line, like "Copper 780".'); return }
    setRows(result.rows.map((row, index) => {
      const current = itemByKey.get(row.key)
      return { ...row, id: index, price: String(row.price), include: Boolean(current) && row.confidence !== 'none' && row.pricePaise !== current.currentPaise }
    }))
    setSkipped(result.skipped)
  }

  const update = (id, changes) => setRows((current) => current.map((row) => {
    if (row.id !== id) return row
    const next = { ...row, ...changes }
    // Picking an item by hand means the match is now confirmed.
    if ('key' in changes) { next.confidence = changes.key ? 'high' : 'none'; next.include = Boolean(changes.key) }
    return next
  }))

  const chosen = (rows || []).filter((row) => row.include && row.key)
  const repeated = chosen.map((row) => row.key).filter((key, index, keys) => keys.indexOf(key) !== index)

  async function save() {
    setError('')
    if (repeated.length) { setError(`${itemByKey.get(repeated[0])?.name} is chosen twice. Untick one of them.`); return }
    const bad = chosen.find((row) => !(Number(row.price) > 0))
    if (bad) { setError(`Enter a price above ₹0 for ${itemByKey.get(bad.key)?.name}.`); return }
    setBusy(true)
    try {
      const result = await apiRequest('/item-prices/manual/bulk', { method: 'PUT', body: JSON.stringify({ note, updates: chosen.map((row) => ({ key: row.key, price: row.price })) }) })
      notify(result.message)
      onSaved()
    } catch (saveError) { setError(saveError.message); setBusy(false) }
  }

  return (
    <Modal className="payment-modal price-message" backdropClassName="payment-modal-backdrop" busy={busy} onClose={onClose} labelledBy="price-message-title">
      <div className="payment-modal-heading">
        <div><span className="payment-eyebrow">UPDATE FROM MESSAGE</span><h2 id="price-message-title">{rows ? 'Check the prices' : 'Paste a rate message'}</h2></div>
        <button type="button" className="payment-close" aria-label="Close dialog" onClick={onClose}>×</button>
      </div>

      {!rows && (
        <div className="price-message-step">
          <p className="price-add-help">Paste a WhatsApp or SMS rate list. Write one item per line, or separate items with commas. You will see every price before anything is saved.</p>
          <label className="price-message-input">Message
            <textarea data-autofocus rows="8" value={text} onChange={(event) => setText(event.target.value)} placeholder={MESSAGE_EXAMPLE} />
          </label>
          {error && <p className="payment-form-error" role="alert">{error}</p>}
          <div className="payment-modal-actions">
            <button type="button" className="back-button" onClick={onClose}>Cancel</button>
            <button type="button" className="continue-btn" disabled={!text.trim()} onClick={read}><i className="bi bi-magic" aria-hidden="true" /> Read prices</button>
          </div>
        </div>
      )}

      {rows && (
        <div className="price-message-step">
          <p className="price-add-help">Ticked rows will be saved as manual prices. Rows marked <b>Check</b> were a close spelling match; make sure the item is right.</p>
          <ul className="price-message-rows">
            {rows.map((row) => {
              const current = itemByKey.get(row.key)
              const newPaise = Math.round(Number(row.price) * 100) || 0
              const diff = current ? newPaise - current.currentPaise : 0
              return (
                <li key={row.id} className={`price-message-row${row.include ? ' is-on' : ''}${row.confidence !== 'high' ? ' needs-check' : ''}`}>
                  <input type="checkbox" checked={row.include} disabled={!row.key} onChange={(event) => update(row.id, { include: event.target.checked })} aria-label={`Save price for ${row.name}`} />
                  <div className="price-message-main">
                    <span className="price-message-raw" title={row.raw}>“{row.raw}”
                      {row.confidence === 'low' && <span className="price-message-flag is-check">Check</span>}
                      {row.confidence === 'none' && <span className="price-message-flag is-none">No match</span>}
                    </span>
                    <div className="price-message-fields">
                      <select value={row.key} onChange={(event) => update(row.id, { key: event.target.value })} aria-label="Item">
                        <option value="">— Choose item —</option>
                        {sortedItems.map((item) => <option key={item.key} value={item.key}>{item.name}{item.unit ? ` (${item.unit})` : ''}</option>)}
                      </select>
                      <label className="price-message-price"><span>₹</span><input type="number" inputMode="decimal" min="0.01" step="0.01" value={row.price} onChange={(event) => update(row.id, { price: event.target.value })} aria-label="New price" /></label>
                    </div>
                    {current && (
                      <small className="price-message-change">
                        Now {money(current.currentPaise)}{perUnit(current.unit)} →{' '}
                        {diff === 0 ? <span>no change</span> : <span className={diff > 0 ? 'is-up' : 'is-down'}>{diff > 0 ? '▲' : '▼'} {money(Math.abs(diff))}</span>}
                      </small>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
          {skipped.length > 0 && <p className="price-message-skipped"><i className="bi bi-info-circle" aria-hidden="true" /> Not read (no price): {skipped.map((line) => `“${line}”`).join(', ')}</p>}
          <label className="price-message-note">Note for these prices (optional)<input maxLength="200" value={note} onChange={(event) => setNote(event.target.value)} /></label>
          {error && <p className="payment-form-error" role="alert">{error}</p>}
          <div className="payment-modal-actions">
            <button type="button" className="back-button" disabled={busy} onClick={() => { setRows(null); setError('') }}><i className="bi bi-arrow-left" aria-hidden="true" /> Edit message</button>
            <button type="button" className="continue-btn" disabled={busy || !chosen.length} onClick={save}>{busy ? 'Saving…' : `Save ${chosen.length} price${chosen.length === 1 ? '' : 's'}`}</button>
          </div>
        </div>
      )}
    </Modal>
  )
}

const SORTS = [['recent', 'Recently updated'], ['name', 'Name A–Z'], ['high', 'Highest price'], ['low', 'Lowest price'], ['change', 'Biggest change']]

export default function ItemPrices() {
  const { lists } = useAppSettings()
  const [state, setState] = useState({ loading: true, error: '', items: [], categories: [] })
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [sort, setSort] = useState('recent')
  const [view, setView] = useState(readView)
  const [openKey, setOpenKey] = useState(null)
  const [adding, setAdding] = useState(false)
  const [fromMessage, setFromMessage] = useState(false)
  const [toast, notify] = useToast()
  const { user } = useAuth()
  const admin = isManager(user)
  // The bill-price check opens by itself once per session; "Later" hides it until the next visit.
  const [reviewing, setReviewing] = useState(false)
  const [reviewLater, setReviewLater] = useState(() => { try { return sessionStorage.getItem(REVIEW_LATER_KEY) === '1' } catch { return false } })
  const toReview = useMemo(() => (admin ? state.items.filter(needsBillReview) : []), [admin, state.items])
  useEffect(() => { if (toReview.length && !reviewLater) setReviewing(true) }, [toReview.length, reviewLater])
  function reviewLaterClose() {
    setReviewing(false)
    setReviewLater(true)
    try { sessionStorage.setItem(REVIEW_LATER_KEY, '1') } catch { /* only for this visit */ }
  }

  const load = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: '' }))
    try {
      const data = await apiRequest('/item-prices')
      setState({ loading: false, error: '', items: data.items || [], categories: data.categories || [] })
    } catch (loadError) { setState((current) => ({ ...current, loading: false, error: loadError.message })) }
  }, [])
  useEffect(() => { load() }, [load])

  const [images, setImage] = useItemImages(state.items)

  function chooseView(next) {
    setView(next)
    try { localStorage.setItem(VIEW_KEY, next) } catch { /* the choice just isn't remembered */ }
  }

  const shown = useMemo(() => {
    const term = search.trim().toLowerCase()
    const rows = state.items.filter((item) => (category === 'all' || item.category === category) && (!term || `${item.name} ${item.category} ${item.billDealer}`.toLowerCase().includes(term)))
    const sorters = {
      recent: () => 0,
      name: (a, b) => a.name.localeCompare(b.name),
      high: (a, b) => b.currentPaise - a.currentPaise,
      low: (a, b) => a.currentPaise - b.currentPaise,
      change: (a, b) => Math.abs(b.changePercent ?? 0) - Math.abs(a.changePercent ?? 0),
    }
    return sort === 'recent' ? rows : rows.slice().sort(sorters[sort])
  }, [state.items, search, category, sort])

  const counts = useMemo(() => ({
    up: state.items.filter((item) => item.trend === 'up').length,
    down: state.items.filter((item) => item.trend === 'down').length,
    manual: state.items.filter((item) => item.source === 'manual').length,
  }), [state.items])

  return (
    <section className="page-container price-page">
      <Toast toast={toast} />
      <header className="price-page-head">
        <div>
          <p className="eyebrow">ITEM PRICES</p>
          <h1 className="page-title">Item prices</h1>
          <p className="page-description">Prices come from the latest dealer bill. Tap an item for its full price history.</p>
        </div>
        <div className="price-head-actions">
          {state.items.length > 0 && <button type="button" className="back-button price-message-button" onClick={() => setFromMessage(true)}><i className="bi bi-chat-text" aria-hidden="true" />Update from message</button>}
          <button type="button" className="continue-btn price-add-button" onClick={() => setAdding(true)}><i className="bi bi-plus-lg" aria-hidden="true" />Add item</button>
        </div>
      </header>

      {!state.loading && state.items.length > 0 && (
        <ul className="price-summary" aria-label="Summary">
          <li><span className="price-summary-icon"><i className="bi bi-tags" aria-hidden="true" /></span><span><b>{state.items.length}</b><small>Items</small></span></li>
          <li><span className="price-summary-icon is-up"><i className="bi bi-arrow-up-right" aria-hidden="true" /></span><span><b>{counts.up}</b><small>Went up</small></span></li>
          <li><span className="price-summary-icon is-down"><i className="bi bi-arrow-down-right" aria-hidden="true" /></span><span><b>{counts.down}</b><small>Went down</small></span></li>
          <li><span className="price-summary-icon is-manual"><i className="bi bi-pencil" aria-hidden="true" /></span><span><b>{counts.manual}</b><small>Manual prices</small></span></li>
        </ul>
      )}

      {toReview.length > 0 && !reviewing && (
        <button type="button" className="price-review-banner" onClick={() => setReviewing(true)}>
          <i className="bi bi-receipt" aria-hidden="true" />
          <span><strong>{toReview.length} new bill {toReview.length === 1 ? 'price' : 'prices'} to confirm</strong><small>New bills differ from your manual prices. Tap to choose which price to keep.</small></span>
          <i className="bi bi-chevron-right" aria-hidden="true" />
        </button>
      )}

      {/* Category tabs first, then search, sort and layout. */}
      {state.categories.length > 1 && (
        <div className="dealer-pick-chips price-chips" role="radiogroup" aria-label="Category">
          {[['all', 'All'], ...state.categories.map((name) => [name, name])].map(([id, label]) => <button key={id} type="button" role="radio" aria-checked={category === id} className={`dealer-pick-chip${category === id ? ' is-active' : ''}`} onClick={() => setCategory(id)}>{label}</button>)}
        </div>
      )}
      <div className="price-toolbar">
        <label className="dealer-pick-search">
          <i className="bi bi-search" aria-hidden="true" />
          <span className="visually-hidden">Search items</span>
          <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search item, category or dealer" />
        </label>
        <label className="price-sort"><span className="visually-hidden">Sort by</span>
          <i className="bi bi-sort-down" aria-hidden="true" />
          <select value={sort} onChange={(event) => setSort(event.target.value)}>{SORTS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select>
        </label>
        <div className="price-view-toggle" role="group" aria-label="Layout">
          <button type="button" aria-pressed={view === 'cards'} className={view === 'cards' ? 'is-active' : ''} onClick={() => chooseView('cards')}><i className="bi bi-grid-3x2-gap" aria-hidden="true" /><span>Cards</span></button>
          <button type="button" aria-pressed={view === 'list'} className={view === 'list' ? 'is-active' : ''} onClick={() => chooseView('list')}><i className="bi bi-list-ul" aria-hidden="true" /><span>List</span></button>
        </div>
      </div>

      <LoadError message={state.error} onRetry={load} />
      {state.loading && !state.items.length && <ul className={view === 'list' ? 'price-list' : 'price-grid'} aria-hidden="true">{Array.from({ length: 6 }, (_, index) => <li key={index}><span className={`payment-skeleton ${view === 'list' ? 'price-skeleton-row' : 'price-skeleton-card'}`} /></li>)}</ul>}
      {!state.loading && !state.error && !state.items.length && (
        <div className="price-empty"><i className="bi bi-receipt" aria-hidden="true" /><h2>No prices yet</h2><p>Prices appear here once you save a dealer bill, or add an item yourself.</p><div className="price-empty-actions"><button type="button" className="continue-btn" onClick={() => setAdding(true)}><i className="bi bi-plus-lg" aria-hidden="true" /> Add item</button><Link className="back-button" to="/itemsentry">Create a bill</Link></div></div>
      )}
      {state.items.length > 0 && !shown.length && <p className="price-empty-note">No items match your search.</p>}
      {shown.length > 0 && (view === 'cards'
        ? <ul className="price-grid">{shown.map((item) => <PriceCard key={item.key} item={item} image={images[item.key]} onOpen={setOpenKey} />)}</ul>
        : <ul className="price-list">{shown.map((item) => <PriceRow key={item.key} item={item} image={images[item.key]} onOpen={setOpenKey} />)}</ul>)}

      {openKey && <DetailModal itemKey={openKey} onClose={() => setOpenKey(null)} onChanged={load} onPhotoChanged={setImage} notify={notify} />}
      {reviewing && toReview.length > 0 && !openKey && !adding && !fromMessage && <BillPriceReviewModal key={toReview.map((item) => item.key).join(',')} items={toReview} notify={notify} onClose={reviewLaterClose} onSaved={(options) => { if (!options?.keepOpen) setReviewing(false); load() }} />}
      {fromMessage && <MessagePricesModal items={state.items} notify={notify} onClose={() => setFromMessage(false)} onSaved={() => { setFromMessage(false); load() }} />}
      {!adding && !openKey && !fromMessage && !reviewing && <FloatingActionButton icon="bi-plus-lg" label="Add item" onClick={() => setAdding(true)} />}
      {adding && <AddItemModal categories={[...new Set([...lists.itemCategories, ...state.categories])]} units={lists.units} notify={notify} onClose={() => setAdding(false)} onAdded={(key, image) => { setAdding(false); if (image) setImage(key, image); load(); setOpenKey(key) }} />}
    </section>
  )
}
