import { Router } from 'express'
import { requireAdmin } from '../middleware/auth.js'
import { getAppSettings, updateAppSettings } from '../controllers/settingsController.js'

const router = Router()
router.get('/', getAppSettings)
router.put('/', requireAdmin, updateAppSettings)

export default router
