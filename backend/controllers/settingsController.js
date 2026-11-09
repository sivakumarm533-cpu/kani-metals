import AppSetting, { THEME_IDS } from '../models/AppSetting.js'
import { FEATURE_KEYS } from '../config/features.js'
import { forgetFeatureCache } from '../middleware/auth.js'
import { recordActivity } from '../utils/activity.js'
import { badRequest, optionalText } from '../utils/validation.js'

const publicFeatures = (features = {}) => Object.fromEntries(FEATURE_KEYS.map((key) => [key, features?.[key] !== false]))

const publicSettings = (settings) => ({
  theme: settings.theme,
  allowUserThemes: settings.allowUserThemes !== false,
  features: publicFeatures(settings.features),
  business: settings.business,
  updatedAt: settings.updatedAt,
})

async function loadSettings() {
  return AppSetting.findOneAndUpdate({ key: 'app' }, { $setOnInsert: { key: 'app' } }, { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true })
}

/** Any signed-in user can read the theme, enabled features and business details (used for the bill image). */
export async function getAppSettings(_req, res, next) {
  try { res.json(publicSettings(await loadSettings())) }
  catch (error) { next(error) }
}

function activityLabel({ theme, business, features, allowUserThemes }) {
  if (features !== undefined || allowUserThemes !== undefined) return 'Feature access'
  if (theme !== undefined && business === undefined) return 'Application theme'
  return 'Business and bill settings'
}

/** Admins and sub-admins update the theme, feature access and/or the business details printed on bills. */
export async function updateAppSettings(req, res, next) {
  try {
    const settings = await loadSettings()
    const before = settings.toObject()
    const { theme, business, features, allowUserThemes } = req.body || {}
    if (theme !== undefined) {
      if (!THEME_IDS.includes(theme)) throw badRequest('Choose one of the available themes.')
      settings.theme = theme
    }
    if (allowUserThemes !== undefined) {
      if (typeof allowUserThemes !== 'boolean') throw badRequest('Personal theme setting is invalid.')
      settings.allowUserThemes = allowUserThemes
    }
    if (features !== undefined) {
      if (!features || typeof features !== 'object' || Array.isArray(features)) throw badRequest('Feature settings are invalid.')
      const next = publicFeatures(settings.features)
      for (const key of FEATURE_KEYS) {
        if (features[key] === undefined) continue
        if (typeof features[key] !== 'boolean') throw badRequest('Feature settings are invalid.')
        next[key] = features[key]
      }
      settings.features = next
    }
    if (business !== undefined) {
      if (!business || typeof business !== 'object' || Array.isArray(business)) throw badRequest('Business details are invalid.')
      const limits = { name: 120, tagline: 120, address: 300, phone: 40, email: 254, gstin: 30, terms: 1000 }
      for (const [field, max] of Object.entries(limits)) {
        if (business[field] !== undefined) settings.business[field] = optionalText(business[field], `business ${field}`, max)
      }
      if (!settings.business.name) throw badRequest('Enter the business name shown on bills.')
      if (settings.business.email && !/^\S+@\S+\.\S+$/.test(settings.business.email)) throw badRequest('Enter a valid business email address.')
    }
    settings.updatedBy = req.user._id
    await settings.save()
    forgetFeatureCache()
    await recordActivity(req, { action: 'update', entity: 'settings', entityId: settings._id, entityLabel: activityLabel(req.body || {}), before, after: settings })
    res.json(publicSettings(settings))
  } catch (error) { next(error) }
}
