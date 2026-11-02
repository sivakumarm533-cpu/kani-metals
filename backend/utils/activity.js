import ActivityLog from '../models/ActivityLog.js'

const privateFields = /password|secret|recovery|token|hash|api.?key|credential|authorization|cookie|private.?key/i
const imageFields = /image|photo|avatar|background/i

function plainRecord(value) {
  if (!value) return {}
  if (typeof value.toObject === 'function') return value.toObject({ depopulate: true, flattenMaps: true })
  return value
}

function safeValue(value, field = '', depth = 0) {
  if (privateFields.test(field)) return undefined
  if (imageFields.test(field)) return value ? '[image attached]' : ''
  if (value == null || typeof value === 'boolean' || typeof value === 'number') return value ?? null
  if (value instanceof Date) return value.toISOString()
  if (Buffer.isBuffer(value)) return '[binary data]'
  if (typeof value === 'string') return value.length > 500 ? `${value.slice(0, 500)}…` : value
  if (depth >= 4) return '[nested data]'
  if (Array.isArray(value)) return value.slice(0, 50).map((entry) => safeValue(entry, '', depth + 1))
  if (typeof value === 'object') {
    return Object.fromEntries(Object.entries(value)
      .filter(([key]) => !['_id', '__v', 'createdAt', 'updatedAt'].includes(key))
      .map(([key, entry]) => [key, safeValue(entry, key, depth + 1)])
      .filter(([, entry]) => entry !== undefined))
  }
  return String(value)
}

function asComparable(value) {
  if (value instanceof Date) return value.toISOString()
  if (value && typeof value.toHexString === 'function') return value.toHexString()
  if (value && typeof value.toObject === 'function') return asComparable(value.toObject({ depopulate: true }))
  if (Array.isArray(value)) return value.map(asComparable)
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, asComparable(entry)]))
  return value
}

function createChanges(action, beforeValue, afterValue) {
  const before = plainRecord(beforeValue)
  const after = plainRecord(afterValue)
  const keys = new Set([...Object.keys(before), ...Object.keys(after)])
  const ignored = new Set(['_id', '__v', 'createdAt', 'updatedAt', 'passwordHash', 'totpSecretEncrypted', 'totpLastTimeStep', 'recoveryCodeHashes'])
  const changes = []
  for (const field of keys) {
    if (ignored.has(field) || privateFields.test(field)) continue
    const oldValue = before[field]
    const newValue = after[field]
    if (action === 'update' && JSON.stringify(asComparable(oldValue)) === JSON.stringify(asComparable(newValue))) continue
    changes.push({ field, before: safeValue(oldValue, field) ?? null, after: safeValue(newValue, field) ?? null })
  }
  return changes.slice(0, 100)
}

export async function recordActivity(req, { action, entity, entityId, entityLabel, before = null, after = null }) {
  if (!req.user?._id) throw new Error('Cannot record an activity without an authenticated user.')
  const record = plainRecord(after || before)
  const label = entityLabel || record.name || record.email || (entity === 'bill' && record.issuedDate ? `Bill ${new Date(record.issuedDate).toLocaleDateString('en-CA')}` : `${entity} record`)
  return ActivityLog.create({
    actor: req.user._id,
    actorName: req.user.name,
    actorEmail: req.user.email,
    action,
    entity,
    entityId: String(entityId || record._id || ''),
    entityLabel: String(label).slice(0, 160),
    changes: createChanges(action, before, after),
  })
}
