import { Router } from 'express'
import { createDealer, dealerDeleteSummary, deleteDealer, listDealers, updateDealer } from '../controllers/dealerController.js'

const router = Router()
router.get('/', listDealers)
router.post('/', createDealer)
router.put('/:id', updateDealer)
router.get('/:id/delete-summary', dealerDeleteSummary)
router.delete('/:id', deleteDealer)

export default router
