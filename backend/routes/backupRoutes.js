import { Router } from 'express'
import { requireAdmin } from '../middleware/auth.js'
import { exportBackup, importBackup } from '../controllers/backupController.js'

const router = Router()
router.use(requireAdmin)
router.get('/export', exportBackup)
router.post('/import', importBackup)

export default router
