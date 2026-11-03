import './Cards.css'
import scrapImages from '../assets/scrap/scrap-materials-sheet.webp'

const scrapItems = [
  { name: 'Copper Wire Scrap', grade: 'Clean copper · Grade A', oldPrice: 720, newPrice: 745, oldDate: '24 Oct 2026', newDate: '31 Oct 2026', tile: 0 },
  { name: 'Mild Steel Scrap', grade: 'Steel · Heavy melting', oldPrice: 38, newPrice: 40, oldDate: '24 Oct 2026', newDate: '31 Oct 2026', tile: 1 },
  { name: 'Aluminium Scrap', grade: 'Aluminium · Sheet', oldPrice: 165, newPrice: 172, oldDate: '24 Oct 2026', newDate: '31 Oct 2026', tile: 2 },
  { name: 'Brass Scrap', grade: 'Brass · Mixed fittings', oldPrice: 465, newPrice: 480, oldDate: '24 Oct 2026', newDate: '31 Oct 2026', tile: 3 },
  { name: 'Stainless Steel Scrap', grade: 'Stainless steel · 304', oldPrice: 92, newPrice: 96, oldDate: '24 Oct 2026', newDate: '31 Oct 2026', tile: 4 },
  { name: 'E-waste Boards', grade: 'Electronic scrap · Mixed', oldPrice: 115, newPrice: 120, oldDate: '24 Oct 2026', newDate: '31 Oct 2026', tile: 5 },
]

const formatPrice = (price) => `₹${price.toLocaleString('en-IN')}`

function Cards() {
  return (
    <section className="page-container scrap-page">
      <p className="eyebrow">SCRAP MARKET</p>
      <h1 className="page-title">Scrap item prices</h1>
      <p className="page-description">Compare the latest price per kilogram with the previous update.</p>

      <div className="scrap-grid">
        {scrapItems.map((item) => {
          const column = item.tile % 3
          const row = Math.floor(item.tile / 3)
          return (
            <article className="scrap-card" key={item.name}>
              <div
                className="scrap-card-image"
                role="img"
                aria-label={item.name}
                style={{
                  backgroundImage: `url(${scrapImages})`,
                  backgroundPosition: `${column * 50}% ${row * 100}%`,
                }}
              />
              <div className="scrap-card-body">
                <p className="scrap-card-grade">{item.grade}</p>
                <h2>{item.name}</h2>
                <div className="scrap-current-price">
                  <span>Current price</span>
                  <strong>{formatPrice(item.newPrice)} <small>/ kg</small></strong>
                </div>
                <div className="scrap-price-history">
                  <div><span>Previous price</span><strong>{formatPrice(item.oldPrice)} / kg</strong><small>Updated {item.oldDate}</small></div>
                  <div className="scrap-new-date"><span>New price</span><strong>{formatPrice(item.newPrice)} / kg</strong><small>Updated {item.newDate}</small></div>
                </div>
              </div>
            </article>
          )
        })}
      </div>
      <p className="scrap-note">Sample prices for display. Replace with your current market rates.</p>
    </section>
  )
}

export default Cards
