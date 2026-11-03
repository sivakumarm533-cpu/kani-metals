import { useEffect, useState } from 'react'
import { useAppSettings } from '../settings/appSettingsContext.js'
import { renderBillImage } from '../utils/billImage.js'
import { useToast } from '../hooks/useToast.js'
import Toast from '../components/Toast.jsx'
import LoadError from '../components/LoadError.jsx'

const sample = {
  dealer: { name: 'Sample Dealer', phone: '98765 43210', location: 'Chennai', category: 'Regular Dealer' },
  bill: {
    _id: '000000000000000000a1b2c3',
    issuedDate: new Date().toISOString(),
    items: [
      { name: 'Copper wire scrap', category: 'Metal', quantity: 35, unit: 'kg', price: 745 },
      { name: 'Brass fittings', category: 'Metal', quantity: 20, unit: 'kg', price: 480 },
      { name: 'Aluminium sheet', category: 'Metal', quantity: 12.5, unit: 'kg', price: 172 },
    ],
  },
  state: { totalPaise: 3_637_500, receivedPaise: 1_500_000, pendingPaise: 2_137_500 },
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
  const { business, saveSettings, loaded } = useAppSettings()
  const [draft, setDraft] = useState(null)
  const [preview, setPreview] = useState({ key: '', url: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [toast, notify] = useToast()
  const form = draft || business
  const previewKey = JSON.stringify(form)

  useEffect(() => {
    let active = true
    let url = ''
    const timer = window.setTimeout(() => {
      const accent = getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim() || '#F36F12'
      renderBillImage({ ...sample, business: form, accent }).then((blob) => {
        if (!active) return
        url = URL.createObjectURL(blob)
        setPreview({ key: previewKey, url })
      }).catch(() => {})
    }, 350)
    return () => { active = false; window.clearTimeout(timer); if (url) URL.revokeObjectURL(url) }
  }, [form, previewKey])

  const update = (key, value) => setDraft((current) => ({ ...(current || business), [key]: value }))

  async function save(event) {
    event.preventDefault()
    setSaving(true); setError('')
    try {
      await saveSettings({ business: form })
      setDraft(null)
      notify('Bill details saved. New bills will use them.')
    } catch (issue) { setError(issue.message) } finally { setSaving(false) }
  }

  return (
    <section className="boarder-box settings-page bill-settings-page">
      <Toast toast={toast} />
      <header className="bill-header settings-page-header">
        <div><h1 className="page-title">Bill settings</h1><p>Business details printed on the bills you send to dealers on WhatsApp.</p></div>
      </header>
      <LoadError message={error} />
      <div className="bill-settings-layout">
        <form className="settings-panel bill-settings-form" onSubmit={save} aria-busy={saving}>
          <h2>Business details</h2>
          <div className="bill-settings-grid">
            {fields.map((field) => (
              <label key={field.key} className={field.wide ? 'is-wide' : ''}>{field.label}
                <input className="form-control" type={field.type || 'text'} maxLength={field.max} required={field.required} autoComplete={field.autoComplete} placeholder={field.placeholder} value={form[field.key] || ''} onChange={(event) => update(field.key, event.target.value)} />
              </label>
            ))}
            <label className="is-wide">Terms &amp; conditions
              <textarea className="form-control" rows="4" maxLength="1000" value={form.terms || ''} onChange={(event) => update('terms', event.target.value)} />
              <small>{(form.terms || '').length}/1000 characters</small>
            </label>
          </div>
          <div className="dealer-form-actions">
            {draft && <button type="button" className="back-button" onClick={() => setDraft(null)} disabled={saving}>Discard changes</button>}
            <button type="submit" className="continue-btn" disabled={!draft || saving || !loaded}>{saving ? 'Saving…' : 'Save bill details'}</button>
          </div>
        </form>
        <section className="settings-panel bill-settings-preview" aria-label="Sample bill preview">
          <h2>Preview</h2>
          <p>Sample bill using your details and the current theme colour.</p>
          {preview.url ? <img src={preview.url} alt="Sample bill preview" className={preview.key !== previewKey ? 'is-updating' : ''} /> : <div className="skeleton bill-share-skeleton" />}
        </section>
      </div>
    </section>
  )
}
