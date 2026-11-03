import AppSetting, { THEME_IDS } from '../models/AppSetting.js'
import { recordActivity } from '../utils/activity.js'
import { badRequest, optionalText } from '../utils/validation.js'

const publicSettings = (settings) => ({
  theme: settings.theme,
  business: settings.business,
  updatedAt: settings.updatedAt,
})

async function loadSettings() {
  return AppSetting.findOneAndUpdate({ key: 'app' }, { $setOnInsert: { key: 'app' } }, { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true })
}

/** Any signed-in user can read the theme and business details (used for the bill image). */
export async function getAppSettings(_req, res, next) {
  try { res.json(publicSettings(await loadSettings())) }
  catch (error) { next(error) }
}

/** Admins update the application theme and/or the business details printed on bills. */
export async function updateAppSettings(req, res, next) {
  try {
    const settings = await loadSettings()
    const before = settings.toObject()
    const { theme, business } = req.body || {}
    if (theme !== undefined) {
      if (!THEME_IDS.includes(theme)) throw badRequest('Choose one of the available themes.')
      settings.theme = theme
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
    await recordActivity(req, { action: 'update', entity: 'settings', entityId: settings._id, entityLabel: theme !== undefined && business === undefined ? 'Application theme' : 'Business and bill settings', before, after: settings })
    res.json(publicSettings(settings))
  } catch (error) { next(error) }
}
