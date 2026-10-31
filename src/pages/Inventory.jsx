const stockItems = [
  { name: 'Copper Sheets', code: 'COP-001', quantity: 48, status: 'In stock' },
  { name: 'Steel Rods', code: 'STL-014', quantity: 8, status: 'Low stock' },
  { name: 'Aluminium Coils', code: 'ALU-006', quantity: 32, status: 'In stock' },
]

function Inventory() {
  return (
    <section className="page-container">
      <p className="eyebrow">STOCK MANAGEMENT</p>
      <h1>Inventory</h1>
      <p className="page-description">Check current quantities and see which materials need attention.</p>
      <div className="table-responsive inventory-table-wrap">
        <table className="table align-middle inventory-table">
          <thead><tr><th>Material</th><th>Item code</th><th>Quantity</th><th>Status</th></tr></thead>
          <tbody>{stockItems.map((item) => (
            <tr key={item.code}>
              <td className="fw-semibold">{item.name}</td><td>{item.code}</td><td>{item.quantity} units</td>
              <td><span className={`stock-pill${item.status === 'Low stock' ? ' is-low' : ''}`}>{item.status}</span></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </section>
  )
}

export default Inventory
