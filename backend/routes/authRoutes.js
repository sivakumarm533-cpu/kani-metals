import { Router } from 'express'
import { authenticate, requireAdmin } from '../middleware/auth.js'
import { authStatus, completeAdminSignup, createUser, currentUser, deleteUser, listUsers, login, requestAdminVerification, verifyAdminEmail } from '../controllers/authController.js'

const router = Router()
router.get('/status', authStatus)
router.post('/request-verification', requestAdminVerification)
router.post('/verify-email', verifyAdminEmail)
router.post('/signup', completeAdminSignup)
router.post('/login', login)
router.get('/me', authenticate, currentUser)
router.get('/users', authenticate, requireAdmin, listUsers)
router.post('/users', authenticate, requireAdmin, createUser)
router.delete('/users/:id', authenticate, requireAdmin, deleteUser)

export default router
