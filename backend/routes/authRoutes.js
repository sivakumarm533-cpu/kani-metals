import { Router } from 'express'
import { authenticate, requireAdmin } from '../middleware/auth.js'
import { authStatus, createAdmin, createUser, currentUser, deleteUser, demoLogin, listUsers, login, logout, sendLoginOtp, sendRegistrationOtp, verifyLoginOtp, verifyRegistrationOtp } from '../controllers/authController.js'
import { authRateLimit } from '../middleware/rateLimit.js'

const router = Router()
router.get('/status', authStatus)
router.post('/send-otp', authRateLimit({ action: 'registration-send', max: 5 }), sendRegistrationOtp)
router.post('/verify-otp', authRateLimit({ action: 'registration-verify', max: 10 }), verifyRegistrationOtp)
router.post('/create-admin', authRateLimit({ action: 'create-admin', max: 5 }), createAdmin)
router.post('/login', authRateLimit({ action: 'login', max: 10 }), login)
router.post('/demo-login', authRateLimit({ action: 'demo-login', max: 10 }), demoLogin)
router.post('/send-login-otp', authRateLimit({ action: 'login-send-otp', max: 5 }), sendLoginOtp)
router.post('/verify-login-otp', authRateLimit({ action: 'login-verify-otp', max: 10 }), verifyLoginOtp)
router.post('/logout', authenticate, logout)
router.get('/me', authenticate, currentUser)
router.get('/users', authenticate, requireAdmin, listUsers)
router.post('/users', authenticate, requireAdmin, createUser)
router.delete('/users/:id', authenticate, requireAdmin, deleteUser)

export default router
