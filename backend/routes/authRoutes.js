import { Router } from 'express'
import { authenticate, requireAdmin } from '../middleware/auth.js'
import { authStatus, beginAdminEnrollment, createUser, currentUser, deleteUser, listUsers, login, logout, updateOwnProfilePicture, updateUser, userSummary, verifyAdminEnrollment, verifyLoginRecovery, verifyLoginTotp } from '../controllers/authController.js'
import { authRateLimit } from '../middleware/rateLimit.js'
import { profilePictureUpload } from '../middleware/profilePictureUpload.js'
import { listActivity } from '../controllers/activityController.js'

const router = Router()
router.get('/status', authStatus)
router.post('/totp/enroll', authRateLimit({ action: 'totp-enroll', max: 5 }), beginAdminEnrollment)
router.post('/totp/enroll/verify', authRateLimit({ action: 'totp-enroll-verify', max: 10 }), verifyAdminEnrollment)
router.post('/login', authRateLimit({ action: 'login', max: 10 }), login)
router.post('/totp/login/verify', authRateLimit({ action: 'totp-login-verify', max: 10 }), verifyLoginTotp)
router.post('/totp/login/recovery', authRateLimit({ action: 'totp-login-recovery', max: 5 }), verifyLoginRecovery)
router.post('/logout', authenticate, logout)
router.get('/me', authenticate, currentUser)
router.patch('/profile/photo', authenticate, profilePictureUpload, updateOwnProfilePicture)
router.get('/activity', authenticate, requireAdmin, listActivity)
router.get('/users/summary', authenticate, requireAdmin, userSummary)
router.get('/users', authenticate, requireAdmin, listUsers)
router.post('/users', authenticate, requireAdmin, profilePictureUpload, createUser)
router.patch('/users/:id', authenticate, requireAdmin, profilePictureUpload, updateUser)
router.delete('/users/:id', authenticate, requireAdmin, deleteUser)

export default router
