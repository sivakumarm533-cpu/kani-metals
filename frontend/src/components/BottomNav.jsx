import { Link, useLocation } from 'react-router-dom'
import { itemIsActive } from '../config/navigation.js'

function ItemContent({ item, active }) {
  return <>
    <span className="bottom-nav-icon" aria-hidden="true"><i className={`bi ${active ? item.activeIcon || item.icon : item.icon}`} /></span>
    <span className="bottom-nav-label">{item.label}</span>
    <span className="bottom-nav-dot" aria-hidden="true" />
  </>
}

/**
 * Floating mobile navigation bar. Shows up to four chosen screens plus a "More"
 * button that opens the full menu. With `preview`, it renders a non-interactive
 * copy used on the profile page.
 */
export default function BottomNav({ items, navStyle = 'light', onMore, moreOpen = false, preview = false, previewActiveKey }) {
  const { pathname } = useLocation()
  const activeKey = preview ? previewActiveKey ?? items[0]?.key : items.find((item) => itemIsActive(item, pathname))?.key
  const className = `bottom-nav bottom-nav-${navStyle}${preview ? ' is-preview' : ''}`

  if (preview) {
    return (
      <div className={className} aria-hidden="true">
        {items.map((item) => <span key={item.key} className={`bottom-nav-item${item.key === activeKey ? ' is-active' : ''}`}><ItemContent item={item} active={item.key === activeKey} /></span>)}
        <span className="bottom-nav-item"><ItemContent item={{ key: 'more', icon: 'bi-grid', label: 'More' }} /></span>
      </div>
    )
  }

  return (
    <nav className={className} aria-label="Quick navigation">
      {items.map((item) => {
        const active = item.key === activeKey && !moreOpen
        return (
          <Link key={item.key} to={item.to} className={`bottom-nav-item${active ? ' is-active' : ''}`} aria-current={active ? 'page' : undefined}>
            <ItemContent item={item} active={active} />
          </Link>
        )
      })}
      <button type="button" className={`bottom-nav-item bottom-nav-more${moreOpen || !activeKey ? ' is-active' : ''}`} onClick={onMore} aria-expanded={moreOpen} aria-controls="main-navigation">
        <ItemContent item={{ key: 'more', icon: moreOpen ? 'bi-x-lg' : 'bi-grid', activeIcon: moreOpen ? 'bi-x-lg' : 'bi-grid-fill', label: moreOpen ? 'Close' : 'More' }} active={moreOpen || !activeKey} />
      </button>
    </nav>
  )
}
