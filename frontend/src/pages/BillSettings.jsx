import { useEffect, useState } from 'react'
import { useAppSettings } from '../settings/appSettingsContext.js'
import { BILL_TEMPLATES, renderBillImage } from '../utils/billImage.js'
import { useToast } from '../hooks/useToast.js'
import Toast from '../components/Toast.jsx'
import LoadError from '../components/LoadError.jsx'

const sample = {
  dealer: { name: 'Sample Dealer', phone: '98765 43210', location: 'Chennai', category: 'Regular Dealer' },
  bill: {
    _id: '000000000000000000a1b2c3',
    issuedDate: new Date().toISOString(),
    items: [
      { name: 'MS scrap', category: 'Metal', quantity: 1200, unit: 'kg', price: 32, note: '1210 - 10 = 1200 (10 kg was waste material)' },
      { name: 'Copper wire scrap', category: 'Metal', quantity: 35, unit: 'kg', price: 745 },
      { name: 'Brass fittings', category: 'Metal', quantity: 20, unit: 'kg', price: 480 },
    ],
  },
  state: { totalPaise: 7_407_500, receivedPaise: 1_500_000, pendingPaise: 5_907_500 },
  payments: [{ bill: '000000000000000000a1b2c3', paymentStatus: 'received', paymentDate: new Date(Date.now() - 86400000 * 3).toISOString(), amountPaise: 1_000_000, paymentMethod: 'cash' }, { bill: '000000000000000000a1b2c3', paymentStatus: 'received', paymentDate: new Date().toISOString(), amountPaise: 500_000, paymentMethod: 'gpay' }],
}

const fields = [
  { key: 'name', label: 'Business name', max: 120, required: true, autoComplete: 'organization' },
  { key: 'tagline', label: 'Tagline (optional)', max: 120, placeholder: 'e.g. Scrap metal traders' },
  { key: 'phone', label: 'Phone number', max: 40, type: 'tel', autoComplete: 'tel' },
  { key: 'email', label: 'Email (optional)', max: 254, type: 'email', autoComplete: 'email' },
  { key: 'gstin', label: 'GSTIN (optional)', max: 30 },
  { key: 'address', label: 'Address', max: 300, wide: true, autoComplete: 'street-address' },
]

export default function BillSettings() {
  const { business, billTemplate, saveSettings, loaded } = useAppSettings()
  const [draft, setDraft] = useState(null)
  const [templateDraft, setTemplateDraft] = useState(null)
  const [preview, setPreview] = useState({ key: '', url: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [toast, notify] = useToast()
  const form = draft || business
  const template = templateDraft || billTemplate
  const changed = Boolean(draft) || (templateDraft !== null && templateDraft !== billTemplate)
  const previewKey = JSON.stringify({ form, template })

  useEffect(() => {
    let active = true
    let url = ''
    const timer = window.setTimeout(() => {
      const accent = getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim() || '#F36F12'
      renderBillImage({ ...sample, business: form, accent, template }).then((blob) => {
        if (!active) return
        url = URL.createObjectURL(blob)
        setPreview({ key: previewKey, url })
      }).catch(() => {})
    }, 250)
    return () => { active = false; window.clearTimeout(timer); if (url) URL.revokeObjectURL(url) }
  }, [form, template, previewKey])

  const update = (key, value) => setDraft((current) => ({ ...(current || business), [key]: value }))

  function discard() { setDraft(null); setTemplateDraft(null) }

  async function save(event) {
    event.preventDefault()
    setSaving(true); setError('')
    try {
      await saveSettings({ business: form, billTemplate: template })
      discard()
      notify('Bill settings saved. Bills you send now use them.')
    } catch (issue) { setError(issue.message) } finally { setSaving(false) }
  }

  return (
    <section className="boarder-box settings-page bill-settings-page">
      <Toast toast={toast} />
      <header className="bill-header settings-page-header">
        <div><h1 className="page-title">Bill settings</h1><p>Bill design and business details printed on the bills you send to dealers on WhatsApp.</p></div>
      </header>
      <LoadError message={error} />
      <div className="bill-settings-layout">
        <form className="settings-panel bill-settings-form" onSubmit={save} aria-busy={saving}>
          <h2>Bill template</h2>
          <div className="bill-template-grid" role="radiogroup" aria-label="Bill template">
            {BILL_TEMPLATES.map((option) => (
              <label key={option.id} className={`bill-template-option bill-template-${option.id}${template === option.id ? ' is-selected' : ''}`}>
                <input type="radio" name="billTemplate" value={option.id} checked={template === option.id} onChange={() => setTemplateDraft(option.id)} disabled={saving} />
                <span className="bill-template-thumb" aria-hidden="true"><span className="bill-template-thumb-head" /><span className="bill-template-thumb-row" /><span className="bill-template-thumb-row" /><span className="bill-template-thumb-row" /></span>
                <span className="bill-template-text"><strong>{option.name}</strong><small>{option.description}</small></span>
                {template === option.id && <i className="bi bi-check-circle-fill bill-template-check" aria-hidden="true" />}
              </label>
            ))}
          </div>

          <h2>Business details</h2>
          <div className="bill-settings-grid">
            {fields.map((field) => (
              <label key={field.key} className={field.wide ? 'is-wide' : ''}>{field.label}
                <input className="form-control" type={field.type || 'text'} maxLength={field.max} required={field.required} autoComplete={field.autoComplete} placeholder={field.placeholder} value={form[field.key] || ''} onChange={(event) => update(field.key, event.target.value)} />
              </label>
            ))}
            <label className="is-wide">Terms &amp; conditions
              <textarea className="form-control" rows="4" maxLength="1000" value={form.terms || ''} onChange={(event) => update('terms', event.target.value)} disabled={form.showTerms === false} />
              <small>{form.showTerms === false ? 'Hidden on bills — switch on below to print it.' : `${(form.terms || '').length}/1000 characters`}</small>
            </label>
            <label className="is-wide">Greeting
              <input className="form-control" maxLength="200" value={form.greeting ?? ''} onChange={(event) => update('greeting', event.target.value)} disabled={form.showGreeting === false} placeholder="e.g. Thank you for your business · Kani Metals" />
              <small>{form.showGreeting === false ? 'Hidden on bills — switch on below to print it.' : `${(form.greeting || '').length}/200 characters · printed at the bottom of the bill`}</small>
            </label>
          </div>

          <h2 className="bill-settings-subtitle">Show on bill</h2>
          <ul className="feature-list">
            {[
              { key: 'showTerms', icon: 'bi-file-text', title: 'Terms & conditions', text: 'Print the terms at the bottom of the bill and in the WhatsApp text.' },
              { key: 'showGreeting', icon: 'bi-emoji-smile', title: 'Greeting', text: form.greeting?.trim() ? `“${form.greeting.trim()}”` : 'Type a greeting above to print it.' },
            ].map((option) => {
              const on = form[option.key] !== false
              return (
                <li key={option.key} className={`feature-row${on ? '' : ' is-off'}`}>
                  <span className="feature-row-icon" aria-hidden="true"><i className={`bi ${option.icon}`} /></span>
                  <span className="feature-row-text"><strong>{option.title}</strong><small>{option.text}</small></span>
                  <label className={`feature-switch${on ? ' is-on' : ''}`}>
                    <input type="checkbox" role="switch" checked={on} onChange={(event) => update(option.key, event.target.checked)} disabled={saving} aria-label={`Show ${option.title} on bills`} />
                    <span className="feature-switch-track" aria-hidden="true"><span /></span>
                    <span className="feature-switch-state" aria-hidden="true">{on ? 'On' : 'Off'}</span>
                  </label>
                </li>
              )
            })}
          </ul>
          <div className="dealer-form-actions">
            {changed && <button type="button" className="back-button" onClick={discard} disabled={saving}>Discard changes</button>}
            <button type="submit" className="continue-btn" disabled={!changed || saving || !loaded}>{saving ? 'Saving…' : 'Save bill settings'}</button>
          </div>
        </form>
        <section className="settings-panel bill-settings-preview" aria-label="Sample bill preview">
          <h2>Preview</h2>
          <p>Sample bill using the chosen template, your details and the current theme colour.</p>
          {preview.url ? <img src={preview.url} alt="Sample bill preview" className={preview.key !== previewKey ? 'is-updating' : ''} /> : <div className="skeleton bill-share-skeleton" />}
        </section>
      </div>
    </section>
  )
}
