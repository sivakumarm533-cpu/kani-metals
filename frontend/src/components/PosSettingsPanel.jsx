import { useMemo, useState } from 'react'
import { useAppSettings } from '../settings/appSettingsContext.js'
import { POS_TEMPLATES, printReceiptHtml, receiptHtml } from '../utils/posReceipt.js'

/** Tiny sketch of each receipt design for the picker. */
function TemplateSketch({ id }) {
  return (
    <span className={`pos-sketch is-${id}`} aria-hidden="true">
      <span className="pos-sketch-head" />
      {id === 'compact' ? <><span className="pos-sketch-cols" /><span className="pos-sketch-cols" /><span className="pos-sketch-cols" /></>
        : id === 'invoice' ? <><span className="pos-sketch-title" /><span className="pos-sketch-box"><span /><span /><span /></span></>
          : <><span className="pos-sketch-line" /><span className="pos-sketch-line is-short" /><span className="pos-sketch-line" /></>}
      <span className="pos-sketch-total" />
    </span>
  )
}

/*
 * Settings → Bill details → POS printing. Saved separately from the WhatsApp bill
 * design: these options only change the thermal receipt.
 */

const SWITCHES = [
  { key: 'showLogo', icon: 'bi-image', title: 'Logo', text: 'Printed in black and white at the top.' },
  { key: 'showAddress', icon: 'bi-geo-alt', title: 'Business address', text: 'From the business details above.' },
  { key: 'showPhone', icon: 'bi-telephone', title: 'Business phone', text: 'From the business details above.' },
  { key: 'showGstin', icon: 'bi-building', title: 'GSTIN', text: 'Only when a GSTIN is filled in.' },
  { key: 'showDealer', icon: 'bi-person', title: 'Dealer details', text: 'Name, phone and location of the dealer.' },
  { key: 'showItemNotes', icon: 'bi-chat-left-text', title: 'Item notes', text: 'Notes typed on bill lines (e.g. weight deductions).' },
  { key: 'showPayments', icon: 'bi-wallet2', title: 'Paid and balance', text: 'Money received for this bill and the balance at the bottom.' },
  { key: 'showStatus', icon: 'bi-patch-check', title: 'Payment status', text: 'PAID, UNPAID or PARTIALLY PAID under the total.' },
  { key: 'showPreviousBalance', icon: 'bi-clock-history', title: 'Previous balance', text: 'Unpaid amount of older bills and the total due.' },
  { key: 'showTerms', icon: 'bi-file-text', title: 'Terms & conditions', text: 'Uses the terms above. Makes the receipt longer.' },
  { key: 'showGreeting', icon: 'bi-emoji-smile', title: 'Greeting', text: 'Uses the greeting above.' },
]

export default function PosSettingsPanel({ business, sample, notify }) {
  const { pos, saveSettings, loaded } = useAppSettings()
  const [draft, setDraft] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const form = draft || pos
  const set = (key, value) => setDraft((current) => ({ ...(current || pos), [key]: value }))
  const previewHtml = useMemo(() => receiptHtml({ ...sample, business, previousPaise: 1_250_000, previousCount: 2 }, { ...form, copies: 1 }), [sample, business, form])

  async function save(event) {
    event.preventDefault()
    setSaving(true); setError('')
    try {
      await saveSettings({ pos: { ...form, copies: Number(form.copies), feedLines: Number(form.feedLines) } })
      setDraft(null)
      notify('POS printing settings saved.')
    } catch (issue) { setError(issue.message) } finally { setSaving(false) }
  }

  async function testPrint() {
    setError('')
    try { await printReceiptHtml(receiptHtml({ ...sample, business, previousPaise: 1_250_000, previousCount: 2 }, form)) }
    catch (issue) { setError(issue.message) }
  }

  return (
    <div className="bill-settings-layout pos-settings" id="pos-printing">
      <form className="settings-panel bill-settings-form" onSubmit={save} aria-busy={saving}>
        <h2><i className="bi bi-printer" aria-hidden="true" /> POS printing</h2>
        <p className="pos-settings-help">For thermal receipt printers (58 mm or 80 mm roll). Use <b>Print</b> on a bill; your printer is chosen in the print window. These options are separate from the WhatsApp bill design.</p>

        <h2 className="bill-settings-subtitle">Receipt template</h2>
        <div className="pos-template-grid" role="radiogroup" aria-label="Receipt template">
          {POS_TEMPLATES.map((option) => {
            const selected = (form.template || 'classic') === option.id
            return (
              <label key={option.id} className={`pos-template-option${selected ? ' is-selected' : ''}`}>
                <input type="radio" name="posTemplate" value={option.id} checked={selected} onChange={() => set('template', option.id)} disabled={saving} />
                <TemplateSketch id={option.id} />
                <span className="pos-template-text"><strong>{option.name}</strong><small>{option.description}</small></span>
                {selected && <i className="bi bi-check-circle-fill pos-template-check" aria-hidden="true" />}
              </label>
            )
          })}
        </div>

        <div className="pos-settings-grid">
          <fieldset className="pos-choice">
            <legend>Paper width</legend>
            <div className="stock-mode" role="radiogroup" aria-label="Paper width">
              {[['58', '58 mm', '2 inch'], ['80', '80 mm', '3 inch']].map(([id, label, hint]) => (
                <button key={id} type="button" role="radio" aria-checked={form.paperWidth === id} className={form.paperWidth === id ? 'is-active' : ''} onClick={() => set('paperWidth', id)}>{label} <small>{hint}</small></button>
              ))}
            </div>
          </fieldset>
          <fieldset className="pos-choice">
            <legend>Text size</legend>
            <div className="stock-mode" role="radiogroup" aria-label="Text size">
              {[['small', 'Small'], ['normal', 'Normal'], ['large', 'Large']].map(([id, label]) => (
                <button key={id} type="button" role="radio" aria-checked={form.fontSize === id} className={form.fontSize === id ? 'is-active' : ''} onClick={() => set('fontSize', id)}>{label}</button>
              ))}
            </div>
          </fieldset>
          <label>Copies per print
            <select className="form-control" value={String(form.copies)} onChange={(event) => set('copies', Number(event.target.value))}>
              <option value="1">1 copy</option><option value="2">2 copies (customer + office)</option><option value="3">3 copies</option>
            </select>
          </label>
          <label>Blank space at the end
            <select className="form-control" value={String(form.feedLines)} onChange={(event) => set('feedLines', Number(event.target.value))}>
              {[0, 1, 2, 3, 4, 5, 6, 8, 10].map((lines) => <option key={lines} value={lines}>{lines === 0 ? 'None' : `${lines} lines`}</option>)}
            </select>
            <small>Room to tear the paper below the last line.</small>
          </label>
          <label className="is-wide">Footer note (optional)
            <input className="form-control" maxLength="200" value={form.footerNote || ''} onChange={(event) => set('footerNote', event.target.value)} placeholder="e.g. Weight checked in front of the customer" />
          </label>
        </div>

        <h2 className="bill-settings-subtitle">Print on receipt</h2>
        <ul className="feature-list">
          {SWITCHES.map((option) => {
            const on = Boolean(form[option.key])
            return (
              <li key={option.key} className={`feature-row${on ? '' : ' is-off'}`}>
                <span className="feature-row-icon" aria-hidden="true"><i className={`bi ${option.icon}`} /></span>
                <span className="feature-row-text"><strong>{option.title}</strong><small>{option.text}</small></span>
                <label className={`feature-switch${on ? ' is-on' : ''}`}>
                  <input type="checkbox" role="switch" checked={on} onChange={(event) => set(option.key, event.target.checked)} disabled={saving} aria-label={`Print ${option.title} on POS receipts`} />
                  <span className="feature-switch-track" aria-hidden="true"><span /></span>
                  <span className="feature-switch-state" aria-hidden="true">{on ? 'On' : 'Off'}</span>
                </label>
              </li>
            )
          })}
        </ul>
        {error && <p className="payment-form-error" role="alert">{error}</p>}
        <div className="dealer-form-actions">
          <button type="button" className="back-button" onClick={testPrint}><i className="bi bi-printer" aria-hidden="true" /> Test print</button>
          {draft && <button type="button" className="back-button" onClick={() => setDraft(null)} disabled={saving}>Discard changes</button>}
          <button type="submit" className="continue-btn" disabled={!draft || saving || !loaded}>{saving ? 'Saving…' : 'Save POS settings'}</button>
        </div>
      </form>
      <section className="settings-panel bill-settings-preview pos-preview" aria-label="Sample receipt preview">
        <h2>Receipt preview</h2>
        <p>{POS_TEMPLATES.find((option) => option.id === form.template)?.name || 'Classic'} · {form.paperWidth} mm paper · sample bill. The real width depends on your printer.</p>
        <div className={`pos-paper is-${form.paperWidth}`}>
          <iframe title="Sample POS receipt" srcDoc={previewHtml} sandbox="allow-same-origin" />
        </div>
      </section>
    </div>
  )
}
