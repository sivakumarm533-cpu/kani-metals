import { Router } from 'express'
import { createPayment, getDealerPaymentDetails, getPaymentOverview, reversePayment, updateChequeStatus } from '../controllers/paymentController.js'

const router = Router()
router.get('/overview', getPaymentOverview)
router.get('/dealers/:dealerId', getDealerPaymentDetails)
router.post('/', createPayment)
router.patch('/:id/status', updateChequeStatus)
router.post('/:id/reverse', reversePayment)

export default router
