import AppSetting, { BILL_TEMPLATE_IDS, THEME_IDS } from '../models/AppSetting.js'
import { DEFAULT_LISTS, FEATURE_KEYS, LIST_KEYS, MENU_KEYS } from '../config/features.js'
import { forgetFeatureCache } from '../middleware/auth.js'
import { recordActivity } from '../utils/activity.js'
import { badRequest, optionalText } from '../utils/validation.js'

const publicFeatures = (features = {}) => Object.fromEntries(FEATURE_KEYS.map((key) => [key, features?.[key] !== false]))

/** Saved order first, then any screen missing from it (e.g. added later) in default order. */
function publicMenuOrder(order = []) {
  const known = (Array.isArray(order) ? order : []).filter((key, index, list) => MENU_KEYS.includes(key) && list.indexOf(key) === index)
  return [...known, ...MENU_KEYS.filter((key) => !known.includes(key))]
}

/** Saved list in theme order; a missing list (older settings) means every theme is allowed. */
const publicUserThemes = (list) => (Array.isArray(list) ? THEME_IDS.filter((id) => list.includes(id)) : [...THEME_IDS])

const publicLists = (lists = {}) => Object.fromEntries(LIST_KEYS.map((key) => [key, Array.isArray(lists?.[key]) && lists[key].length ? [...lists[key]] : [...DEFAULT_LISTS[key]]]))

const LIST_LABELS = { itemCategories: 'item category', dealerCategories: 'dealer category', units: 'unit' }
/** Trimmed, unique (ignoring case), 1–60 characters each, 1–60 choices per list. */
function cleanList(key, value) {
  if (!Array.isArray(value)) throw badRequest('Dropdown list is invalid.')
  const seen = new Set()
  const out = []
  for (const raw of value) {
    const text = typeof raw === 'string' ? raw.trim().replace(/\s+/g, ' ') : ''
    if (!text) throw badRequest(`Each ${LIST_LABELS[key]} needs a name.`)
    if (text.length > (key === 'units' ? 20 : 60)) throw badRequest(`"${text.slice(0, 30)}" is too long for a ${LIST_LABELS[key]}.`)
    if (seen.has(text.toLowerCase())) throw badRequest(`"${text}" is in the ${LIST_LABELS[key]} list twice.`)
    seen.add(text.toLowerCase())
    out.push(text)
  }
  if (!out.length) throw badRequest(`Keep at least one ${LIST_LABELS[key]}.`)
  if (out.length > 60) throw badRequest(`A list can have at most 60 choices.`)
  return out
}

const publicSettings = (settings) => ({
  theme: settings.theme,
  allowUserThemes: settings.allowUserThemes !== false,
  userThemes: publicUserThemes(settings.userThemes),
  features: publicFeatures(settings.features),
  menuOrder: publicMenuOrder(settings.menuOrder),
  lists: publicLists(settings.lists?.toObject?.() ?? settings.lists),
  billTemplate: BILL_TEMPLATE_IDS.includes(settings.billTemplate) ? settings.billTemplate : 'classic',
  // Older settings have no show flags yet; treat a missing flag as "on".
  business: { ...(settings.business?.toObject?.() ?? settings.business), showTerms: settings.business?.showTerms !== false, showGreeting: settings.business?.showGreeting !== false, greeting: settings.business?.greeting ?? 'Thank you for your business' },
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

function activityLabel({ theme, business, features, allowUserThemes, menuOrder, lists, userThemes }) {
  if (userThemes !== undefined && theme === undefined && features === undefined) return 'Theme access'
  if (lists !== undefined && theme === undefined && business === undefined && features === undefined) return 'Dropdown lists'
  if (menuOrder !== undefined && features === undefined && allowUserThemes === undefined) return 'Menu order'
  if (features !== undefined || allowUserThemes !== undefined) return 'Feature access'
  if (theme !== undefined && business === undefined) return 'Application theme'
  return 'Business and bill settings'
}

/** Admins and sub-admins update the theme, feature access and/or the business details printed on bills. */
export async function updateAppSettings(req, res, next) {
  try {
    const settings = await loadSettings()
    const before = settings.toObject()
    const { theme, business, features, allowUserThemes, menuOrder, billTemplate, lists, userThemes } = req.body || {}
    if (userThemes !== undefined) {
      const valid = Array.isArray(userThemes) && userThemes.every((id, index) => THEME_IDS.includes(id) && userThemes.indexOf(id) === index)
      if (!valid) throw badRequest('Theme access list is invalid.')
      if (!userThemes.length) throw badRequest('Leave at least one theme switched on for team members.')
      settings.userThemes = publicUserThemes(userThemes)
    }
    if (lists !== undefined) {
      if (!lists || typeof lists !== 'object' || Array.isArray(lists)) throw badRequest('Dropdown lists are invalid.')
      for (const key of Object.keys(lists)) if (!LIST_KEYS.includes(key)) throw badRequest('Unknown dropdown list.')
      for (const key of LIST_KEYS) if (lists[key] !== undefined) settings.set(`lists.${key}`, cleanList(key, lists[key]))
    }
    if (billTemplate !== undefined) {
      if (!BILL_TEMPLATE_IDS.includes(billTemplate)) throw badRequest('Choose one of the available bill templates.')
      settings.billTemplate = billTemplate
    }
    if (menuOrder !== undefined) {
      const valid = Array.isArray(menuOrder) && menuOrder.length <= MENU_KEYS.length
        && menuOrder.every((key, index) => MENU_KEYS.includes(key) && menuOrder.indexOf(key) === index)
      if (!valid) throw badRequest('Menu order is invalid.')
      settings.menuOrder = publicMenuOrder(menuOrder)
    }
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
      const limits = { name: 120, tagline: 120, address: 300, phone: 40, email: 254, gstin: 30, terms: 1000, greeting: 200 }
      for (const [field, max] of Object.entries(limits)) {
        if (business[field] !== undefined) settings.business[field] = optionalText(business[field], `business ${field}`, max)
      }
      for (const field of ['showTerms', 'showGreeting']) {
        if (business[field] === undefined) continue
        if (typeof business[field] !== 'boolean') throw badRequest('Bill display settings are invalid.')
        settings.business[field] = business[field]
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
