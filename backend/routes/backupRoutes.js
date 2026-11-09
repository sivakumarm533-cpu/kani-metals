import express, { Router } from 'express'
import { requirePrimaryAdmin } from '../middleware/auth.js'
import { exportBackup, importBackup } from '../controllers/backupController.js'

export const BACKUP_IMPORT_PATH = '/import'

const router = Router()
// Restoring a backup replaces every business record, so only the primary admin may use it.
router.use(requirePrimaryAdmin)
router.get('/export', exportBackup)
// Backups contain every dealer and bill image, so this route accepts a larger body.
// It is parsed only after authentication and the admin check above.
router.post(BACKUP_IMPORT_PATH, express.json({ limit: '60mb' }), importBackup)

export default router
